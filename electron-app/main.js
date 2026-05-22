'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const {
  parseMapBinary,
  serializeMapBinary,
  createEditorMapFromBinary,
  createBinaryMapFromEditor,
} = require('./mapBinary');

let mainWindow = null;
let ganServerChild = null;
let ganServerLogs = '';
const GAN_LOG_LIMIT = 16000;

function toErrorMessage(value) {
  if (value == null) return 'Unknown error';
  if (value instanceof Error) return value.message || 'Unknown error';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    if (typeof value.error === 'string' && value.error.trim()) return value.error;
    if (typeof value.message === 'string' && value.message.trim()) return value.message;
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function isBinaryMapPath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) return false;
  return path.extname(filePath).toLowerCase() === '.bin';
}

function inferPackageNameFromPath(filePath) {
  if (typeof filePath !== 'string' || !filePath.trim()) return 'newmap';
  const baseName = path.basename(filePath, path.extname(filePath)).trim();
  if (baseName) return baseName;
  return 'newmap';
}

function appendGanLog(chunk) {
  ganServerLogs += chunk;
  if (ganServerLogs.length > GAN_LOG_LIMIT) {
    ganServerLogs = ganServerLogs.slice(ganServerLogs.length - GAN_LOG_LIMIT);
  }
}

function getGanRootPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'celeste-gan');
  }
  return path.join(__dirname, '..', 'celeste-gan');
}

function getGanDefaultModelPath() {
  return path.join(getGanRootPath(), 'checkpoints', 'celeste_gan.pt');
}

function getGanPythonPath() {
  const venvPython = path.join(__dirname, '..', '.venv', 'Scripts', 'python.exe');
  if (fs.existsSync(venvPython)) return venvPython;
  return 'python';
}

function isGanChildRunning() {
  return !!(ganServerChild && ganServerChild.exitCode == null && !ganServerChild.killed);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function checkGanHealth(port = 5555, timeoutMs = 3000) {
  const http = require('http');

  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/health',
      method: 'GET',
      timeout: timeoutMs,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ status: 'error', model_loaded: false });
        }
      });
    });

    req.on('error', () => resolve({ status: 'offline', model_loaded: false }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 'timeout', model_loaded: false }); });
    req.end();
  });
}

// ---------------------------------------------------------------------------
// Generator path: dev vs. packaged
// ---------------------------------------------------------------------------
function getGeneratorPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'generator', 'celeste_pcg_generator.exe');
  }
  return path.join(__dirname, '..', 'cpp', 'build', 'celeste_pcg_generator.exe');
}

// ---------------------------------------------------------------------------
// Window
// ---------------------------------------------------------------------------
function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 640,
    backgroundColor: '#12131f',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.loadFile('index.html');

  win.once('ready-to-show', () => {
    win.show();
    // Open DevTools only in dev
    if (!app.isPackaged) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });

  win.on('close', (e) => {
    // Renderer signals dirty state; we just let it close for now
  });

  mainWindow = win;
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ---------------------------------------------------------------------------
// IPC: Generate map
// ---------------------------------------------------------------------------
ipcMain.handle('generate-map', async (_event, params) => {
  return new Promise((resolve, reject) => {
    const genPath = getGeneratorPath();

    if (!fs.existsSync(genPath)) {
      return reject({ error: `Generator not found at: ${genPath}` });
    }

    const args = [];
    if (params.mode)          args.push('--mode',           params.mode);
    if (params.layout)        args.push('--layout',         params.layout);
    if (params.archetype)     args.push('--archetype',      params.archetype);
    if (params.kit)           args.push('--kit',            params.kit);
    if (params.seed != null && String(params.seed).trim() !== '')
                              args.push('--seed',           String(params.seed));
    if (params.clusterWidth)  args.push('--cluster-width',  String(params.clusterWidth));
    if (params.clusterHeight) args.push('--cluster-height', String(params.clusterHeight));
    if (params.roomWidth)     args.push('--room-width',     String(params.roomWidth));
    if (params.roomHeight)    args.push('--room-height',    String(params.roomHeight));

    const child = spawn(genPath, args);
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', (err) => reject({ error: `Failed to launch generator: ${err.message}` }));
    child.on('close', (code) => {
      if (code !== 0) {
        return reject({ error: stderr.trim() || `Generator exited with code ${code}` });
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        reject({ error: `Could not parse generator output: ${e.message}\n${stdout.substring(0, 500)}` });
      }
    });

    // Safety timeout
    setTimeout(() => {
      child.kill();
      reject({ error: 'Generator timed out after 30 seconds' });
    }, 30000);
  });
});

// ---------------------------------------------------------------------------
// IPC: Open file
// ---------------------------------------------------------------------------
ipcMain.handle('open-map', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Celeste Map',
    filters: [
      { name: 'Celeste Maps', extensions: ['bin', 'json'] },
      { name: 'Binary Maps', extensions: ['bin'] },
      { name: 'JSON Maps', extensions: ['json'] },
      { name: 'All Files',  extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];

  if (!isBinaryMapPath(filePath)) {
    return { filePath, content: fs.readFileSync(filePath, 'utf8') };
  }

  try {
    const rawBinary = fs.readFileSync(filePath);
    const parsedMap = parseMapBinary(rawBinary);
    const editorMap = createEditorMapFromBinary(parsedMap);
    if (!editorMap.packageName) {
      editorMap.packageName = inferPackageNameFromPath(filePath);
    }

    return {
      filePath,
      content: JSON.stringify(editorMap, null, 2),
    };
  } catch (error) {
    throw new Error(`Failed to open map.bin: ${toErrorMessage(error)}`);
  }
});

ipcMain.handle('gan-pick-model', async (_event, params) => {
  const defaultModel = getGanDefaultModelPath();
  const fallbackDir = path.dirname(defaultModel);
  const requestedInitialPath = (params && typeof params.initialPath === 'string') ? params.initialPath.trim() : '';

  let initialPath = defaultModel;
  if (requestedInitialPath) {
    initialPath = requestedInitialPath;
  } else if (!fs.existsSync(defaultModel)) {
    initialPath = fallbackDir;
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select GAN model checkpoint',
    defaultPath: initialPath,
    filters: [
      { name: 'PyTorch Checkpoint', extensions: ['pt', 'pth'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (result.canceled || result.filePaths.length === 0) return null;
  return { path: result.filePaths[0] };
});

// ---------------------------------------------------------------------------
// IPC: Save file
// ---------------------------------------------------------------------------
ipcMain.handle('save-map', async (_event, { content, filePath }) => {
  let targetPath = filePath;

  const rawContent = typeof content === 'string' ? content : JSON.stringify(content ?? {}, null, 2);

  if (!targetPath) {
    const res = await dialog.showSaveDialog(mainWindow, {
      title: 'Save Map',
      defaultPath: 'my-map.bin',
      filters: [
        { name: 'Celeste Maps', extensions: ['bin', 'json'] },
        { name: 'Binary Maps', extensions: ['bin'] },
        { name: 'JSON Maps', extensions: ['json'] },
      ],
    });
    if (res.canceled) return null;
    targetPath = res.filePath;
  }

  if (!targetPath) {
    throw new Error('No output path selected for save operation.');
  }

  if (isBinaryMapPath(targetPath)) {
    let editorMap;
    try {
      editorMap = JSON.parse(rawContent);
    } catch (error) {
      throw new Error(`Could not parse editor JSON before writing map.bin: ${toErrorMessage(error)}`);
    }

    const packageNameFallback = inferPackageNameFromPath(targetPath);

    try {
      const binaryMap = createBinaryMapFromEditor(editorMap, packageNameFallback);
      const binaryBuffer = serializeMapBinary(binaryMap);
      fs.writeFileSync(targetPath, Buffer.from(new Uint8Array(binaryBuffer)));
    } catch (error) {
      throw new Error(`Failed to write map.bin: ${toErrorMessage(error)}`);
    }

    return targetPath;
  }

  fs.writeFileSync(targetPath, rawContent, 'utf8');
  return targetPath;
});

// ---------------------------------------------------------------------------
// IPC: Generate a single room and return it (PCG add/regen)
// ---------------------------------------------------------------------------
ipcMain.handle('generate-single-room', async (_event, params) => {
  return new Promise((resolve, reject) => {
    const genPath = getGeneratorPath();
    if (!fs.existsSync(genPath)) return reject({ error: `Generator not found: ${genPath}` });

    const args = [
      '--cluster-width',  '1',
      '--cluster-height', '1',
    ];
    if (params.mode)      args.push('--mode',      params.mode);
    if (params.kit)       args.push('--kit',        params.kit);
    if (params.archetype) args.push('--archetype',  params.archetype);
    if (params.layout)    args.push('--layout',     params.layout);
    if (params.seed != null && String(params.seed).trim() !== '')
                          args.push('--seed',       String(params.seed));
    if (params.roomWidth)  args.push('--room-width',  String(params.roomWidth));
    if (params.roomHeight) args.push('--room-height', String(params.roomHeight));

    const child = spawn(genPath, args);
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('error', err => reject({ error: err.message }));
    child.on('close', code => {
      if (code !== 0) return reject({ error: stderr.trim() || `exit ${code}` });
      try { resolve(JSON.parse(stdout)); } catch (e) { reject({ error: `Parse error: ${e.message}` }); }
    });
    setTimeout(() => { child.kill(); reject({ error: 'Timed out' }); }, 20000);
  });
});

// ---------------------------------------------------------------------------
// IPC: Generator path info
// ---------------------------------------------------------------------------
ipcMain.handle('get-generator-path', () => {
  const p = getGeneratorPath();
  return { path: p, exists: fs.existsSync(p) };
});

ipcMain.handle('open-external', (_event, url) => {
  // Validate URL is safe before opening
  if (typeof url === 'string' && /^https?:\/\//.test(url)) {
    shell.openExternal(url);
  }
});

// ---------------------------------------------------------------------------
// IPC: GAN fill room — call the celeste-gan HTTP server
// ---------------------------------------------------------------------------
ipcMain.handle('gan-fill-room', async (_event, params) => {
  const http = require('http');
  const port = params.port || 5555;

  return new Promise((resolve, reject) => {
    const fail = (error) => reject(new Error(toErrorMessage(error)));

    const body = JSON.stringify({
      width: Math.floor((params.width || 320) / 8),
      height: Math.floor((params.height || 184) / 8),
      kit: params.kit || 'house',
      temperature: params.temperature || 1.0,
    });

    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 15000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        const status = Number(res.statusCode || 0);

        try {
          const result = data.trim() ? JSON.parse(data) : {};

          if (status < 200 || status >= 300) {
            const serverMessage = toErrorMessage(result.error || result);
            fail(`GAN server error (${status}): ${serverMessage}`);
            return;
          }

          if (result.error) {
            fail(`GAN generation failed: ${toErrorMessage(result.error)}`);
            return;
          }

          if (!Array.isArray(result.tiles) || result.tiles.length === 0) {
            fail('GAN server returned no tiles for this room');
            return;
          }

          resolve(result);
        } catch (e) {
          const preview = (data || '').substring(0, 300);
          fail(`GAN response parse error: ${e.message}${preview ? `\nResponse: ${preview}` : ''}`);
        }
      });
    });

    req.on('error', (err) => {
      fail(`GAN server not reachable at 127.0.0.1:${port}. Start it with:\n  cd celeste-gan && python celeste_gan.py serve --model ./checkpoints/celeste_gan.pt\n\nError: ${err.message}`);
    });
    req.on('timeout', () => {
      req.destroy();
      fail('GAN server request timed out');
    });

    req.write(body);
    req.end();
  });
});

// ---------------------------------------------------------------------------
// IPC: Start GAN server (one-click launch)
// ---------------------------------------------------------------------------
ipcMain.handle('gan-start-server', async (_event, params) => {
  const port = Number((params && params.port) || 5555);
  const health = await checkGanHealth(port, 1000);
  if (health && health.status === 'ok') {
    return {
      started: false,
      alreadyRunning: true,
      runningExternally: !isGanChildRunning(),
      health,
      port,
    };
  }

  if (isGanChildRunning()) {
    return {
      started: false,
      alreadyRunning: true,
      runningExternally: false,
      health,
      port,
      pid: ganServerChild.pid,
    };
  }

  const ganRoot = getGanRootPath();
  const scriptPath = path.join(ganRoot, 'celeste_gan.py');
  const modelPath = (params && params.modelPath) || getGanDefaultModelPath();

  if (!fs.existsSync(ganRoot)) {
    throw new Error(`GAN directory not found: ${ganRoot}`);
  }
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`GAN script not found: ${scriptPath}`);
  }
  if (!fs.existsSync(modelPath)) {
    throw new Error(`GAN model not found at: ${modelPath}\n\nTrain or place celeste_gan.pt there, then try again.`);
  }

  const pythonPath = getGanPythonPath();
  ganServerLogs = '';

  const child = spawn(pythonPath, [scriptPath, 'serve', '--model', modelPath, '--port', String(port)], {
    cwd: ganRoot,
    windowsHide: true,
    env: {
      ...process.env,
      PYTHONUNBUFFERED: '1',
    },
  });

  ganServerChild = child;
  appendGanLog(`[gan-server] launch ${pythonPath} ${scriptPath} serve --model ${modelPath} --port ${port}\n`);

  child.stdout.on('data', (d) => appendGanLog(d.toString()));
  child.stderr.on('data', (d) => appendGanLog(d.toString()));
  child.on('error', (err) => appendGanLog(`\n[gan-server error] ${err.message}\n`));
  child.on('exit', (code, signal) => {
    appendGanLog(`\n[gan-server exited] code=${code} signal=${signal || 'none'}\n`);
    if (ganServerChild === child) ganServerChild = null;
  });

  const startedAt = Date.now();
  const startupTimeoutMs = 15000;
  while (Date.now() - startedAt < startupTimeoutMs) {
    const h = await checkGanHealth(port, 1200);
    if (h && h.status === 'ok' && h.model_loaded) {
      return {
        started: true,
        alreadyRunning: false,
        warmingUp: false,
        port,
        pid: child.pid,
        health: h,
      };
    }

    if (child.exitCode != null || child.killed) {
      const tail = ganServerLogs.slice(-1200).trim();
      throw new Error(`GAN server exited before becoming ready (code ${child.exitCode}).${tail ? `\n\nOutput:\n${tail}` : ''}`);
    }

    await delay(400);
  }

  const latestHealth = await checkGanHealth(port, 1200);
  return {
    started: true,
    alreadyRunning: false,
    warmingUp: true,
    port,
    pid: child.pid,
    health: latestHealth,
  };
});

// ---------------------------------------------------------------------------
// IPC: Check GAN server health
// ---------------------------------------------------------------------------
ipcMain.handle('gan-health', async (_event, params) => {
  const port = (params && params.port) || 5555;
  return checkGanHealth(port, 3000);
});

// ---------------------------------------------------------------------------
// IPC: Lua bridge
// ---------------------------------------------------------------------------
const luaBridge = require('./luaBridge');

ipcMain.handle('lua-eval', async (_event, params) => {
  const { code, opts } = params || {};
  if (!code) throw new Error('No Lua code provided');
  return luaBridge.evalLua(code, opts || {});
});

ipcMain.handle('lua-run-script', async (_event, params) => {
  const { scriptPath, args, opts } = params || {};
  if (!scriptPath) throw new Error('No script path provided');
  return luaBridge.runLuaScript(scriptPath, args || [], opts || {});
});

ipcMain.handle('lua-get-paths', async () => {
  return {
    luajit: luaBridge.getLuaJITPath(),
    luaLibsRoot: luaBridge.getLuaLibsRoot(),
  };
});

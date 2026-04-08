'use strict';

const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

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
      // win.webContents.openDevTools({ mode: 'detach' });
    }
  });

  win.on('close', (e) => {
    // Renderer signals dirty state; we just let it close for now
  });
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
  const result = await dialog.showOpenDialog({
    title: 'Open Celeste Map',
    filters: [
      { name: 'JSON Maps', extensions: ['json'] },
      { name: 'All Files',  extensions: ['*'] },
    ],
    properties: ['openFile'],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  return { filePath, content: fs.readFileSync(filePath, 'utf8') };
});

// ---------------------------------------------------------------------------
// IPC: Save file
// ---------------------------------------------------------------------------
ipcMain.handle('save-map', async (_event, { content, filePath }) => {
  let targetPath = filePath;
  if (!targetPath) {
    const res = await dialog.showSaveDialog({
      title: 'Save Map',
      defaultPath: 'my-map.json',
      filters: [{ name: 'JSON Maps', extensions: ['json'] }],
    });
    if (res.canceled) return null;
    targetPath = res.filePath;
  }
  fs.writeFileSync(targetPath, content, 'utf8');
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
        try {
          const result = JSON.parse(data);
          if (result.error) {
            reject({ error: result.error });
          } else {
            resolve(result);
          }
        } catch (e) {
          reject({ error: `Parse error: ${e.message}` });
        }
      });
    });

    req.on('error', (err) => {
      reject({ error: `GAN server not reachable at 127.0.0.1:${port}. Start it with:\n  cd celeste-gan && python celeste_gan.py serve --model ./checkpoints/celeste_gan.pt\n\nError: ${err.message}` });
    });
    req.on('timeout', () => {
      req.destroy();
      reject({ error: 'GAN server request timed out' });
    });

    req.write(body);
    req.end();
  });
});

// ---------------------------------------------------------------------------
// IPC: Check GAN server health
// ---------------------------------------------------------------------------
ipcMain.handle('gan-health', async (_event, params) => {
  const http = require('http');
  const port = (params && params.port) || 5555;

  return new Promise((resolve) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/health',
      method: 'GET',
      timeout: 3000,
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
});

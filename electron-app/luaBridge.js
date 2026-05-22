'use strict';

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { app } = require('electron');

// ---------------------------------------------------------------------------
//  Path helpers
// ---------------------------------------------------------------------------

function getLuaJITPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'luajit', 'luajit.exe');
  }
  return path.join(__dirname, '..', 'lua_libs', 'luajit', 'bin', 'luajit.exe');
}

function getLuaLibsRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'lua_libs');
  }
  return path.join(__dirname, '..', 'lua_libs');
}

// ---------------------------------------------------------------------------
//  Native LuaJIT execution  (child_process)
// ---------------------------------------------------------------------------

/**
 * Run a Lua script file with the bundled LuaJIT binary.
 * @param {string}   scriptPath  Absolute path to the .lua file.
 * @param {string[]} [args]      Extra CLI arguments forwarded to the script.
 * @param {object}   [opts]      Options: { cwd, env, timeout }.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
function runLuaScript(scriptPath, args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    const luajit = getLuaJITPath();
    if (!fs.existsSync(luajit)) {
      return reject(new Error(`LuaJIT binary not found at: ${luajit}`));
    }

    const libRoot = getLuaLibsRoot();
    const luaPath = [
      path.join(libRoot, '?.lua'),
      path.join(libRoot, '?', 'init.lua'),
      path.join(libRoot, 'dkjson', '?.lua'),
      path.join(libRoot, 'lua-yaml', '?.lua'),
      path.join(libRoot, 'xml2lua', '?.lua'),
      path.join(libRoot, 'Selene', '?.lua'),
      path.join(libRoot, 'luajit-request', '?.lua'),
    ].join(';');

    const env = Object.assign({}, process.env, opts.env || {}, {
      LUA_PATH: luaPath + ';;',
    });

    const child = spawn(luajit, [scriptPath, ...args], {
      cwd: opts.cwd || path.dirname(scriptPath),
      env,
      timeout: opts.timeout || 30000,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, code }));
  });
}

/**
 * Evaluate a Lua code string with the bundled LuaJIT binary via stdin.
 * @param {string} luaCode  Lua source code.
 * @param {object} [opts]   Options: { cwd, env, timeout }.
 * @returns {Promise<{stdout: string, stderr: string, code: number}>}
 */
function evalLua(luaCode, opts = {}) {
  return new Promise((resolve, reject) => {
    const luajit = getLuaJITPath();
    if (!fs.existsSync(luajit)) {
      return reject(new Error(`LuaJIT binary not found at: ${luajit}`));
    }

    const libRoot = getLuaLibsRoot();
    const luaPath = [
      path.join(libRoot, '?.lua'),
      path.join(libRoot, '?', 'init.lua'),
      path.join(libRoot, 'dkjson', '?.lua'),
      path.join(libRoot, 'lua-yaml', '?.lua'),
      path.join(libRoot, 'xml2lua', '?.lua'),
      path.join(libRoot, 'Selene', '?.lua'),
      path.join(libRoot, 'luajit-request', '?.lua'),
    ].join(';');

    const env = Object.assign({}, process.env, opts.env || {}, {
      LUA_PATH: luaPath + ';;',
    });

    const child = spawn(luajit, ['-'], {
      cwd: opts.cwd || __dirname,
      env,
      timeout: opts.timeout || 30000,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => resolve({ stdout, stderr, code }));

    child.stdin.write(luaCode);
    child.stdin.end();
  });
}

// ---------------------------------------------------------------------------
//  In-process Lua via wasmoon  (Lua 5.4 WASM — no native FFI)
// ---------------------------------------------------------------------------

let _luaFactory = null;

/**
 * Get or create the wasmoon LuaFactory singleton.
 */
async function getLuaFactory() {
  if (!_luaFactory) {
    const { LuaFactory } = require('wasmoon');
    _luaFactory = new LuaFactory();
  }
  return _luaFactory;
}

/**
 * Create a fresh in-process Lua VM via wasmoon.
 * Pure-Lua libraries (dkjson, xml2lua, lua-yaml, Selene) are pre-loaded
 * onto the package.path so they can be require()'d.
 * @returns {Promise<LuaEngine>}
 */
async function createLuaEngine() {
  const factory = await getLuaFactory();
  const engine = await factory.createEngine();

  const libRoot = getLuaLibsRoot();
  const paths = [
    path.join(libRoot, '?.lua'),
    path.join(libRoot, '?', 'init.lua'),
    path.join(libRoot, 'dkjson', '?.lua'),
    path.join(libRoot, 'lua-yaml', '?.lua'),
    path.join(libRoot, 'xml2lua', '?.lua'),
    path.join(libRoot, 'Selene', '?.lua'),
  ].join(';');

  await engine.doString(`package.path = "${paths.replace(/\\/g, '\\\\')};;" .. package.path`);
  return engine;
}

// ---------------------------------------------------------------------------
//  Exports
// ---------------------------------------------------------------------------

module.exports = {
  getLuaJITPath,
  getLuaLibsRoot,
  runLuaScript,
  evalLua,
  getLuaFactory,
  createLuaEngine,
};

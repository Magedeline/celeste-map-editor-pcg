'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  generateMap:        (params)          => ipcRenderer.invoke('generate-map', params),
  generateSingleRoom: (params)          => ipcRenderer.invoke('generate-single-room', params),
  openMap:            ()                => ipcRenderer.invoke('open-map'),
  saveMap:            (content, fp)     => ipcRenderer.invoke('save-map', { content, filePath: fp }),
  getGeneratorPath:   ()                => ipcRenderer.invoke('get-generator-path'),
  openExternal:       (url)             => ipcRenderer.invoke('open-external', url),
  ganFillRoom:        (params)          => ipcRenderer.invoke('gan-fill-room', params),
  ganPickModel:       (params)          => ipcRenderer.invoke('gan-pick-model', params),
  ganStartServer:     (params)          => ipcRenderer.invoke('gan-start-server', params),
  ganHealth:          (params)          => ipcRenderer.invoke('gan-health', params),
  luaEval:            (code, opts)      => ipcRenderer.invoke('lua-eval', { code, opts }),
  luaRunScript:       (scriptPath, args, opts) => ipcRenderer.invoke('lua-run-script', { scriptPath, args, opts }),
  luaGetPaths:        ()                => ipcRenderer.invoke('lua-get-paths'),
});

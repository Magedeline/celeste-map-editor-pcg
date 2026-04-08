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
  ganHealth:          (params)          => ipcRenderer.invoke('gan-health', params),
});

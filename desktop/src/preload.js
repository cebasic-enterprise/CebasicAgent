'use strict';
// Solo lo usan las páginas locales (ajustes y sin conexión). La web del servidor no recibe preload.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('cebasic', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveServer: (url) => ipcRenderer.invoke('settings:save', url),
  retry: () => ipcRenderer.invoke('app:retry'),
  openSettings: () => ipcRenderer.invoke('app:open-settings'),
});

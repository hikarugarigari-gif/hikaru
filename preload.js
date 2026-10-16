'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  hideWindow:       ()  => ipcRenderer.invoke('hide-window'),
  getSettings:      ()  => ipcRenderer.invoke('get-settings'),
  saveSettings:     (s) => ipcRenderer.invoke('save-settings', s),
  getSnippets:      ()  => ipcRenderer.invoke('get-snippets'),
  saveSnippet:      (s) => ipcRenderer.invoke('save-snippet', s),
  deleteSnippet:    (id)=> ipcRenderer.invoke('delete-snippet', id),
  reorderSnippets:  (ids)=> ipcRenderer.invoke('reorder-snippets', ids),
  saveMemo:         (m) => ipcRenderer.invoke('save-memo', m),
  getMemos:         (q) => ipcRenderer.invoke('get-memos', q),
  getPendingCount:  ()  => ipcRenderer.invoke('get-pending-count'),
  retryPending:     ()  => ipcRenderer.invoke('retry-pending'),
});

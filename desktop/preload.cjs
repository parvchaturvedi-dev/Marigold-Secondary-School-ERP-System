const { contextBridge, ipcRenderer } = require('electron');

const nativeFetch = window.fetch.bind(window);
window.fetch = async (input, init) => {
  const activeSession = await ipcRenderer.invoke('mgps:archives:get-active');
  if (activeSession) {
    const requestUrl = new URL(typeof input === 'string' ? input : input.url, window.location.href);
    if (
      requestUrl.pathname.startsWith('/api/') &&
      !requestUrl.pathname.startsWith('/api/auth/') &&
      !['/api/desktop-sessions/current-session', '/api/desktop-sessions/rollover-preview'].includes(requestUrl.pathname)
    ) {
      throw new Error(
        `This online feature is disabled in local session “${activeSession.name}”. Switch to the current session first.`
      );
    }
  }
  return nativeFetch(input, init);
};

contextBridge.exposeInMainWorld('mgpsDesktop', Object.freeze({
  isDesktop: true,
  archives: Object.freeze({
    list: () => ipcRenderer.invoke('mgps:archives:list'),
    create: (name, classSetup) => ipcRenderer.invoke('mgps:archives:create', name, classSetup),
    createSnapshot: (name, payload, recordCount) =>
      ipcRenderer.invoke('mgps:archives:create-snapshot', name, payload, recordCount),
    read: (id) => ipcRenderer.invoke('mgps:archives:read', id),
    save: (id, payload) => ipcRenderer.invoke('mgps:archives:save', id, payload),
    readCollection: (id, namespace) =>
      ipcRenderer.invoke('mgps:archives:read-collection', id, namespace),
    saveCollection: (id, namespace, value) =>
      ipcRenderer.invoke('mgps:archives:save-collection', id, namespace, value),
    getActive: () => ipcRenderer.invoke('mgps:archives:get-active'),
    setActive: async (id) => {
      const activeSession = await ipcRenderer.invoke('mgps:archives:set-active', id);
      window.dispatchEvent(new CustomEvent('mgps-desktop-active-session', { detail: activeSession }));
      return activeSession;
    },
    rename: (id, name) => ipcRenderer.invoke('mgps:archives:rename', id, name),
    deleteDraft: (id) => ipcRenderer.invoke('mgps:archives:delete-draft', id),
    onActiveChanged: (callback) => {
      const listener = (event) => callback(event.detail);
      window.addEventListener('mgps-desktop-active-session', listener);
      return () => window.removeEventListener('mgps-desktop-active-session', listener);
    },
  }),
  updates: Object.freeze({
    check: () => ipcRenderer.invoke('mgps:updates:check'),
    download: () => ipcRenderer.invoke('mgps:updates:download'),
    install: () => ipcRenderer.invoke('mgps:updates:install'),
    onStatus: (callback) => {
      const listener = (event, status) => callback(status);
      ipcRenderer.on('mgps:updates:status', listener);
      return () => ipcRenderer.removeListener('mgps:updates:status', listener);
    },
  }),
}));

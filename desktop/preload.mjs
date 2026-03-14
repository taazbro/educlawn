import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('civicStudioDesktop', {
  getContext: () => ipcRenderer.invoke('desktop:get-context'),
  chooseWorkspace: () => ipcRenderer.invoke('desktop:choose-workspace'),
  openWorkspace: () => ipcRenderer.invoke('desktop:open-workspace'),
  openReleaseNotes: () => ipcRenderer.invoke('desktop:open-release-notes'),
  checkForUpdates: () => ipcRenderer.invoke('desktop:check-updates'),
  installUpdate: () => ipcRenderer.invoke('desktop:install-update'),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke('desktop:set-launch-at-login', enabled),
  installToApplications: () => ipcRenderer.invoke('desktop:install-to-applications'),
  trackProject: (payload) => ipcRenderer.invoke('desktop:track-project', payload),
  consumePendingProject: (slug) => ipcRenderer.invoke('desktop:consume-pending-project', slug),
  onStateChanged: (listener) => {
    const wrapped = (_event, payload) => listener(payload)
    ipcRenderer.on('desktop:state-changed', wrapped)
    return () => {
      ipcRenderer.removeListener('desktop:state-changed', wrapped)
    }
  },
})

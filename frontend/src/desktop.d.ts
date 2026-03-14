import type { DesktopContext } from './types'

declare global {
  interface Window {
    civicStudioDesktop?: {
      getContext: () => Promise<DesktopContext>
      chooseWorkspace: () => Promise<DesktopContext>
      openWorkspace: () => Promise<void>
      openReleaseNotes?: () => Promise<void>
      checkForUpdates?: () => Promise<DesktopContext>
      installUpdate?: () => Promise<void>
      setLaunchAtLogin?: (enabled: boolean) => Promise<DesktopContext>
      installToApplications?: () => Promise<DesktopContext>
      trackProject?: (payload: { slug: string; title: string }) => Promise<DesktopContext>
      consumePendingProject?: (slug: string) => Promise<DesktopContext>
      onStateChanged?: (listener: (context: DesktopContext) => void) => () => void
    }
  }
}

export {}

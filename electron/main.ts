import { app, BrowserWindow, ipcMain, Notification } from 'electron'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import Store from 'electron-store'
import { NotificationStore } from './notificationStore.js'
import { NotificationEngine } from './notificationEngine.js'
import { MiruBridge } from './miruBridge.js'
import { OfflineStore } from './offlineStore.js'
import { ShokaiErrorFactory } from './ShokaiErrors.js'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Initialisiere Stores
const store = new Store()
const notificationStore = new NotificationStore()
const offlineStore = new OfflineStore()
let notificationEngine: NotificationEngine | null = null
let miruBridge: MiruBridge | null = null

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, '..')

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null

function createWindow() {
  win = new BrowserWindow({
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
    },
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

/* ========================================
   NOTIFICATION SYSTEM SETUP
   ======================================== */

function setupNotifications() {
  // Lade gespeicherte Config
  const config = store.get('notifications.config', {
    enabled: false, // Default: Aus
    checkInterval: 30, // 30 Minuten
    lookbackWindow: 24, // 24 Stunden
  })

  // Initialisiere Engine
  notificationEngine = new NotificationEngine(notificationStore, store, config)

  // Starte Engine wenn enabled
  if (config.enabled) {
    notificationEngine.start()
    console.log('[Main] Notification engine started')
  }
}

/* ========================================
   IPC HANDLERS
   ======================================== */

// Get notification config
ipcMain.handle('notifications:getConfig', async () => {
  if (!notificationEngine) return null
  return notificationEngine.getStatus()
})

// Update notification config
ipcMain.handle('notifications:updateConfig', async (_event, config) => {
  if (!notificationEngine) return { success: false, error: 'Engine not initialized' }

  try {
    notificationEngine.updateConfig(config)
    store.set('notifications.config', { ...notificationEngine.getStatus().config })
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// Manueller Check (für Testing/User-Button)
ipcMain.handle('notifications:checkNow', async () => {
  if (!notificationEngine) return { success: false, error: 'Engine not initialized' }

  try {
    // Hole Token und User ID
    const anilistData = store.get('anilist') as any
    const token = anilistData?.access_token
    const userId = anilistData?.user_id

    if (!token || !userId) {
      return { success: false, error: 'Not authenticated' }
    }

    await notificationEngine.check(token, String(userId))
    return { success: true, message: 'Check completed' }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// Get notification history
ipcMain.handle('notifications:getHistory', async () => {
  try {
    const anilistData = store.get('anilist') as any
    const userId = anilistData?.user_id

    if (!userId) {
      return { success: false, error: 'Not authenticated' }
    }

    const history = notificationStore.getHistory(String(userId), 50)
    return { success: true, history }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// Achievement notification
ipcMain.handle('achievement:notify', async (_event, achievement: { name: string; icon: string; description: string }) => {
  try {
    if (!Notification.isSupported()) {
      console.log('[Main] System notifications not supported')
      return { success: false, error: 'Notifications not supported' }
    }

    const notification = new Notification({
      title: `Achievement Unlocked!`,
      body: `${achievement.icon} ${achievement.name}\n${achievement.description}`,
      silent: false,
    })

    notification.show()
    console.log('[Main] Achievement notification shown:', achievement.name)
    return { success: true }
  } catch (err: any) {
    console.error('[Main] Achievement notification error:', err)
    return { success: false, error: err.message }
  }
})

// Store access (für Renderer Process)
ipcMain.handle('store:get', async (_event, key) => {
  return store.get(key)
})

ipcMain.handle('store:set', async (_event, key, value) => {
  store.set(key, value)
})

ipcMain.handle('store:delete', async (_event, key) => {
  store.delete(key)
})

// Miru Bridge IPC handlers
ipcMain.handle('miru:status', async () => {
  if (!miruBridge) return { running: false, connected: false, port: 9876 }
  return miruBridge.getStatus()
})

ipcMain.handle('miru:start', async () => {
  if (!miruBridge) {
    miruBridge = new MiruBridge()
  }
  const success = miruBridge.start()
  return { success }
})

ipcMain.handle('miru:stop', async () => {
  if (miruBridge) {
    miruBridge.stop()
  }
  return { success: true }
})

/* ========================================
   OFFLINE MODE IPC HANDLERS
   ======================================== */

// Cache library entries
ipcMain.handle('offline:cacheLibrary', async (_event, userId: string, entries: any[]) => {
  try {
    offlineStore.cacheLibrary(userId, entries)
    return { success: true }
  } catch (err: any) {
    console.error('[Main] Cache library failed:', err)
    return { success: false, error: err.message }
  }
})

// Get cached library
ipcMain.handle('offline:getCachedLibrary', async (_event, userId: string) => {
  try {
    const entries = offlineStore.getCachedLibrary(userId)
    return { success: true, entries }
  } catch (err: any) {
    console.error('[Main] Get cached library failed:', err)
    return { success: false, error: err.message, entries: [] }
  }
})

// Get cached entry by media ID
ipcMain.handle('offline:getCachedEntry', async (_event, userId: string, mediaId: number) => {
  try {
    const entry = offlineStore.getCachedEntryByMediaId(userId, mediaId)
    return { success: true, entry }
  } catch (err: any) {
    return { success: false, error: err.message, entry: null }
  }
})

// Update cached entry
ipcMain.handle('offline:updateCachedEntry', async (_event, userId: string, mediaId: number, updates: any) => {
  try {
    offlineStore.updateCachedEntry(userId, mediaId, updates)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// Check if cache is valid
ipcMain.handle('offline:isCacheValid', async (_event, userId: string) => {
  try {
    const valid = offlineStore.isCacheValid(userId)
    const lastCacheTime = offlineStore.getLastCacheTime(userId)
    return { success: true, valid, lastCacheTime }
  } catch (err: any) {
    return { success: false, valid: false, lastCacheTime: 0 }
  }
})

// Enqueue sync action
ipcMain.handle('offline:enqueue', async (_event, userId: string, action: string, payload: any) => {
  try {
    const id = offlineStore.enqueue(userId, action, payload)
    return { success: true, id }
  } catch (err: any) {
    console.error('[Main] Enqueue failed:', err)
    return { success: false, error: err.message }
  }
})

// Get pending queue
ipcMain.handle('offline:getPendingQueue', async (_event, userId: string) => {
  try {
    const queue = offlineStore.getPendingQueue(userId)
    return { success: true, queue }
  } catch (err: any) {
    return { success: false, error: err.message, queue: [] }
  }
})

// Get queue count
ipcMain.handle('offline:getQueueCount', async (_event, userId: string) => {
  try {
    const count = offlineStore.getQueueCount(userId)
    return count
  } catch (err: any) {
    return 0
  }
})

// Mark item as synced
ipcMain.handle('offline:markSynced', async (_event, id: number) => {
  try {
    offlineStore.markSynced(id)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// Mark item as failed
ipcMain.handle('offline:markFailed', async (_event, id: number, error: string) => {
  try {
    offlineStore.markFailed(id, error)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// Remove from queue
ipcMain.handle('offline:removeFromQueue', async (_event, id: number) => {
  try {
    offlineStore.removeFromQueue(id)
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
})

// Process a queue item (execute the actual API call)
ipcMain.handle('offline:processQueueItem', async (_event, id: number, action: string, payload: any) => {
  try {
    // Get access token
    const anilistData = store.get('anilist') as any
    const token = anilistData?.access_token

    if (!token) {
      throw new Error('Not authenticated')
    }

    // Execute the action
    if (action === 'save') {
      const mutation = `
        mutation SaveMediaListEntry($mediaId: Int, $status: MediaListStatus, $progress: Int, $score: Float) {
          SaveMediaListEntry(mediaId: $mediaId, status: $status, progress: $progress, score: $score) {
            id
            status
            progress
            score
          }
        }
      `
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: mutation,
          variables: payload,
        }),
      })

      // Validate HTTP status before parsing JSON
      if (!response.ok) {
        throw ShokaiErrorFactory.httpError(
          response.status,
          response.statusText,
          'https://graphql.anilist.co/SaveMediaListEntry'
        )
      }

      const result = await response.json()
      if (result.errors) {
        throw ShokaiErrorFactory.graphqlError(
          result.errors[0]?.message || 'Unknown GraphQL error',
          'SaveMediaListEntry'
        )
      }
    } else if (action === 'delete') {
      const mutation = `
        mutation DeleteMediaListEntry($id: Int) {
          DeleteMediaListEntry(id: $id) {
            deleted
          }
        }
      `
      const response = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          query: mutation,
          variables: { id: payload.entryId },
        }),
      })

      // Validate HTTP status before parsing JSON
      if (!response.ok) {
        throw ShokaiErrorFactory.httpError(
          response.status,
          response.statusText,
          'https://graphql.anilist.co/DeleteMediaListEntry'
        )
      }

      const result = await response.json()
      if (result.errors) {
        throw ShokaiErrorFactory.graphqlError(
          result.errors[0]?.message || 'Unknown GraphQL error',
          'DeleteMediaListEntry'
        )
      }
    }

    // Mark as synced
    offlineStore.markSynced(id)
    return { success: true }
  } catch (err: any) {
    const errorMessage = err.code
      ? `${err.getDisplayMessage?.()} - ${err.message}`
      : err.message || 'Unknown error'
    console.error('[Main] Process queue item failed:', err.code || 'NO_CODE', errorMessage)

    // Log full error details if it's a ShokaiError
    if (err.toJSON) {
      console.error('[Main] Error details:', JSON.stringify(err.toJSON(), null, 2))
    }

    offlineStore.markFailed(id, errorMessage)
    throw err
  }
})

// Setup Miru Bridge
function setupMiruBridge() {
  miruBridge = new MiruBridge()
  miruBridge.start()

  // Forward scrobble events to renderer
  miruBridge.onScrobble((data) => {
    if (win) {
      win.webContents.send('miru:scrobble', data)
    }
  })

  // Log connection changes
  miruBridge.onConnectionChange((connected) => {
    console.log(`[Main] Miru extension ${connected ? 'connected' : 'disconnected'}`)
    if (win) {
      win.webContents.send('miru:connection', { connected })
    }
  })
}

app.whenReady().then(() => {
  createWindow()
  setupNotifications()
  setupMiruBridge()
})

// Cleanup beim Beenden
app.on('before-quit', () => {
  if (notificationEngine) {
    notificationEngine.stop()
  }
  if (miruBridge) {
    miruBridge.stop()
  }
  notificationStore.close()
  offlineStore.close()
})

// Sync Manager - Coordinates online/offline sync
// Runs in renderer process, communicates with electron via IPC

export interface SyncResult {
  success: number;
  failed: number;
  errors: string[];
}

export interface SyncManagerState {
  isOnline: boolean;
  pendingCount: number;
  lastSyncAt: number | null;
  isSyncing: boolean;
}

type OnlineStatusCallback = (online: boolean) => void;
type SyncCompleteCallback = (result: SyncResult) => void;
type QueueUpdateCallback = (count: number) => void;

class SyncManager {
  private isOnline: boolean = navigator.onLine;
  private syncInterval: NodeJS.Timeout | null = null;
  private pendingCount: number = 0;
  private lastSyncAt: number | null = null;
  private isSyncing: boolean = false;

  private onOnlineStatusChange: OnlineStatusCallback | null = null;
  private onSyncComplete: SyncCompleteCallback | null = null;
  private onQueueUpdate: QueueUpdateCallback | null = null;

  constructor() {
    this.setupNetworkListeners();
    this.checkPendingQueue();
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  getState(): SyncManagerState {
    return {
      isOnline: this.isOnline,
      pendingCount: this.pendingCount,
      lastSyncAt: this.lastSyncAt,
      isSyncing: this.isSyncing,
    };
  }

  setOnOnlineStatusChange(callback: OnlineStatusCallback): void {
    this.onOnlineStatusChange = callback;
  }

  setOnSyncComplete(callback: SyncCompleteCallback): void {
    this.onSyncComplete = callback;
  }

  setOnQueueUpdate(callback: QueueUpdateCallback): void {
    this.onQueueUpdate = callback;
  }

  async forceSync(): Promise<SyncResult> {
    if (!this.isOnline) {
      return { success: 0, failed: 0, errors: ['Offline'] };
    }

    return this.processQueue();
  }

  startAutoSync(intervalMs: number = 30000): void {
    this.stopAutoSync();

    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.processQueue();
      }
    }, intervalMs);

    console.log('[SyncManager] Auto-sync started');
  }

  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // Queue a save action for offline execution
  async queueSave(userId: string, payload: {
    mediaId: number;
    status?: string;
    progress?: number;
    score?: number;
  }): Promise<void> {
    try {
      // @ts-ignore - window.shokai is defined in preload
      await window.shokai?.offline?.enqueue(userId, 'save', payload);
      this.checkPendingQueue();
    } catch (e) {
      console.error('[SyncManager] Failed to queue save:', e);
    }
  }

  // Queue a delete action for offline execution
  async queueDelete(userId: string, entryId: number, mediaId: number): Promise<void> {
    try {
      // @ts-ignore
      await window.shokai?.offline?.enqueue(userId, 'delete', { entryId, mediaId });
      this.checkPendingQueue();
    } catch (e) {
      console.error('[SyncManager] Failed to queue delete:', e);
    }
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private setupNetworkListeners(): void {
    window.addEventListener('online', () => {
      console.log('[SyncManager] Online');
      this.isOnline = true;
      this.onOnlineStatusChange?.(true);

      // Attempt to sync when coming back online
      if (this.pendingCount > 0) {
        this.processQueue();
      }
    });

    window.addEventListener('offline', () => {
      console.log('[SyncManager] Offline');
      this.isOnline = false;
      this.onOnlineStatusChange?.(false);
    });
  }

  private async checkPendingQueue(): Promise<void> {
    try {
      // @ts-ignore
      const userId = await window.shokai?.store?.get('anilist.user_id');
      if (!userId) return;

      // @ts-ignore
      const count = await window.shokai?.offline?.getQueueCount(userId);
      this.pendingCount = count || 0;
      this.onQueueUpdate?.(this.pendingCount);
    } catch (e) {
      console.error('[SyncManager] Failed to check queue:', e);
    }
  }

  private async processQueue(): Promise<SyncResult> {
    if (this.isSyncing) {
      return { success: 0, failed: 0, errors: ['Already syncing'] };
    }

    this.isSyncing = true;
    const result: SyncResult = { success: 0, failed: 0, errors: [] };

    try {
      // @ts-ignore
      const userId = await window.shokai?.store?.get('anilist.user_id');
      if (!userId) {
        this.isSyncing = false;
        return { success: 0, failed: 0, errors: ['Not authenticated'] };
      }

      // @ts-ignore
      const pending = await window.shokai?.offline?.getPendingQueue(userId);
      if (!pending || pending.length === 0) {
        this.isSyncing = false;
        return result;
      }

      console.log(`[SyncManager] Processing ${pending.length} queued actions`);

      for (const item of pending) {
        try {
          // @ts-ignore
          await window.shokai?.offline?.processQueueItem(item.id, item.action, item.payload);
          result.success++;
        } catch (e: any) {
          result.failed++;
          result.errors.push(e.message || 'Unknown error');
        }
      }

      this.lastSyncAt = Date.now();
      this.onSyncComplete?.(result);
      this.checkPendingQueue();

    } catch (e: any) {
      result.errors.push(e.message || 'Sync failed');
    } finally {
      this.isSyncing = false;
    }

    return result;
  }
}

// Singleton instance
export const syncManager = new SyncManager();
export default SyncManager;

// electron/notificationEngine.ts
// Notification Engine for new anime episodes
import { Notification } from 'electron';
// ============================================================================
// NOTIFICATION ENGINE
// ============================================================================
export class NotificationEngine {
    constructor(store) {
        this.history = [];
        this.checkTimer = null;
        this.isRunning = false;
        this.accessToken = null;
        this.userId = null;
        this.store = store;
        // Load config from store
        this.config = (store.get('notifications.config') ?? {
            enabled: false,
            checkInterval: 30,
            lookbackWindow: 24,
        });
        // Load history
        this.history = (store.get('notifications.history') ?? []);
        // Load auth info (using flat keys as stored by main.js)
        this.accessToken = store.get('anilist.access_token') || null;
        this.userId = store.get('anilist.user_id') || null;
        if (this.config.enabled && this.accessToken && this.userId) {
            this.start();
        }
    }
    // ============================================================================
    // PUBLIC API
    // ============================================================================
    start() {
        if (this.isRunning)
            return;
        if (!this.accessToken || !this.userId) {
            console.log('[Notifications] Cannot start - not authenticated');
            return;
        }
        this.isRunning = true;
        console.log('[Notifications] Started');
        this.scheduleNextCheck();
    }
    stop() {
        if (this.checkTimer) {
            clearTimeout(this.checkTimer);
            this.checkTimer = null;
        }
        this.isRunning = false;
        console.log('[Notifications] Stopped');
    }
    getConfig() {
        return {
            running: this.isRunning,
            config: this.config,
        };
    }
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        this.store.set('notifications.config', this.config);
        if (this.config.enabled && !this.isRunning && this.accessToken && this.userId) {
            this.start();
        }
        else if (!this.config.enabled && this.isRunning) {
            this.stop();
        }
        else if (this.isRunning) {
            // Restart timer with new interval
            this.stop();
            this.start();
        }
        return { success: true };
    }
    async checkNow() {
        if (!this.accessToken || !this.userId) {
            return { success: false, error: 'Not authenticated' };
        }
        try {
            await this.performCheck();
            return { success: true };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    }
    getHistory() {
        return this.history.slice().reverse().slice(0, 50); // Last 50
    }
    async test() {
        try {
            const notification = new Notification({
                title: 'ShokaiShelf Notifications',
                body: 'Test-Benachrichtigung funktioniert!',
            });
            notification.show();
            return { success: true };
        }
        catch (e) {
            return { success: false, error: e.message };
        }
    }
    updateAuth(accessToken, userId) {
        this.accessToken = accessToken;
        this.userId = userId;
        if (this.config.enabled && accessToken && userId && !this.isRunning) {
            this.start();
        }
        else if ((!accessToken || !userId) && this.isRunning) {
            this.stop();
        }
    }
    // ============================================================================
    // PRIVATE METHODS
    // ============================================================================
    scheduleNextCheck() {
        if (!this.isRunning)
            return;
        const intervalMs = this.config.checkInterval * 60 * 1000;
        this.checkTimer = setTimeout(() => {
            this.performCheck();
            this.scheduleNextCheck();
        }, intervalMs);
    }
    async performCheck() {
        if (!this.accessToken || !this.userId)
            return;
        try {
            console.log('[Notifications] Performing check...');
            const now = Math.floor(Date.now() / 1000);
            const lookbackSeconds = this.config.lookbackWindow * 3600;
            const airingAtGreater = now - lookbackSeconds;
            // Fetch user's watching list
            const watchingList = await this.fetchWatchingList();
            const mediaIds = watchingList.map(entry => entry.media.id);
            if (mediaIds.length === 0) {
                console.log('[Notifications] No anime in watching list');
                return;
            }
            // Fetch airing schedule for these anime
            const airingSchedules = await this.fetchAiringSchedules(mediaIds, airingAtGreater, now);
            console.log('[Notifications] Found ' + airingSchedules.length + ' airing episodes');
            // Filter out already notified
            const newEpisodes = airingSchedules.filter(schedule => {
                return !this.history.some(item => item.mediaId === schedule.mediaId &&
                    item.episode === schedule.episode &&
                    item.userId === this.userId);
            });
            console.log('[Notifications] ' + newEpisodes.length + ' new episodes to notify');
            // Send notifications
            for (const schedule of newEpisodes) {
                this.sendNotification(schedule);
                this.addToHistory(schedule);
            }
        }
        catch (e) {
            console.error('[Notifications] Check failed:', e);
        }
    }
    async fetchWatchingList() {
        const query = `
      query ($userId: Int!) {
        MediaListCollection(userId: $userId, type: ANIME, status_in: [CURRENT, PLANNING]) {
          lists {
            entries {
              media {
                id
                title {
                  romaji
                  english
                  native
                }
              }
            }
          }
        }
      }
    `;
        const result = await this.graphql(query, { userId: parseInt(this.userId) });
        const lists = result?.MediaListCollection?.lists || [];
        const entries = [];
        for (const list of lists) {
            entries.push(...list.entries);
        }
        return entries;
    }
    async fetchAiringSchedules(mediaIds, airingAtGreater, airingAtLesser) {
        const query = `
      query ($mediaIds: [Int], $airingAtGreater: Int, $airingAtLesser: Int) {
        Page(page: 1, perPage: 50) {
          airingSchedules(
            mediaId_in: $mediaIds
            airingAt_greater: $airingAtGreater
            airingAt_lesser: $airingAtLesser
            sort: TIME_DESC
          ) {
            id
            airingAt
            episode
            mediaId
            media {
              id
              title {
                romaji
                english
                native
              }
              coverImage {
                large
              }
            }
          }
        }
      }
    `;
        const result = await this.graphql(query, {
            mediaIds,
            airingAtGreater,
            airingAtLesser,
        });
        return result?.Page?.airingSchedules || [];
    }
    async graphql(query, variables = {}) {
        const res = await fetch('https://graphql.anilist.co', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + this.accessToken,
            },
            body: JSON.stringify({ query, variables }),
        });
        const json = await res.json();
        return json?.data ?? null;
    }
    sendNotification(schedule) {
        const title = schedule.media.title.english || schedule.media.title.romaji || 'New Episode';
        const notification = new Notification({
            title: title + ' - Episode ' + schedule.episode,
            body: 'Neue Episode ist verfügbar!',
        });
        notification.show();
        console.log('[Notifications] Sent: ' + title + ' - Episode ' + schedule.episode);
    }
    addToHistory(schedule) {
        const title = schedule.media.title.english || schedule.media.title.romaji || 'Unknown';
        const item = {
            id: schedule.id,
            mediaId: schedule.mediaId,
            episode: schedule.episode,
            airingAt: schedule.airingAt,
            notifiedAt: Date.now(),
            userId: this.userId,
            title,
        };
        this.history.push(item);
        // Keep only last 200
        if (this.history.length > 200) {
            this.history = this.history.slice(-200);
        }
        this.store.set('notifications.history', this.history);
    }
}

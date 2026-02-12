# 🔔 ShokaiShelf Notifications System

## Übersicht

Das Benachrichtigungssystem von ShokaiShelf sendet automatisch Desktop-Notifications wenn neue Episoden von Anime auf deinen "Watching" oder "Planning" Listen bei AniList verfügbar werden.

## Features

- ✅ **Automatische Prüfung**: Läuft im Hintergrund und prüft regelmäßig nach neuen Episoden
- ✅ **Desktop-Notifications**: Native Electron Notifications mit Anime-Cover
- ✅ **Keine Duplikate**: SQLite-basiertes Tracking verhindert mehrfache Benachrichtigungen
- ✅ **Konfigurierbar**: Prüf-Intervall und Zeitfenster individuell einstellbar
- ✅ **Datenschutz**: Alles läuft lokal, keine externen Server (außer AniList API)

## Architektur

### Backend (Electron Main Process)

#### `electron/notificationStore.ts`
- SQLite-Datenbank für Notification-Historie
- Verhindert Duplikate durch `wasNotified()` Check
- Speichert: `media_id`, `episode`, `user_id`, `notified_at`

#### `electron/notificationEngine.ts`
- Background Service mit konfigurierbarem Intervall
- Holt Planning/Watching Listen von AniList
- Filtert Anime mit `nextAiringEpisode`
- Sendet Electron Notifications
- Nutzt `lookbackWindow` um nur aktuelle Episoden zu benachrichtigen

#### `electron/main.ts` / `electron/main.js`
- IPC Handler:
  - `notifications:getConfig` - Aktuelle Konfiguration abrufen
  - `notifications:updateConfig` - Config aktualisieren (enabled, interval, lookback)
  - `notifications:checkNow` - Manuelle Prüfung triggern
  - `notifications:getHistory` - Historie abrufen
- Initialisiert Engine beim App-Start
- Speichert User ID beim Login

### Frontend (React)

#### `src/pages/Settings.tsx`
- Neuer "Benachrichtigungen" Tab
- Toggle für Enable/Disable
- Slider für Prüf-Intervall (10-120 Min)
- Slider für Zeitfenster (6-72 Std)
- "Jetzt prüfen" Button zum Testen
- Info-Box mit Erklärung

#### `electron/preload.js`
- Exposed `window.shokai.notifications` API
- TypeScript Types in `src/api/anilist.ts`

## Konfiguration

### Standard-Einstellungen

```javascript
{
  enabled: false,           // Standard: Aus (User muss aktivieren)
  checkInterval: 30,        // 30 Minuten
  lookbackWindow: 24,       // 24 Stunden
}
```

### Settings UI

1. **Benachrichtigungen aktivieren**: Master-Toggle
2. **Prüf-Intervall**: Wie oft soll geprüft werden? (10-120 Min)
3. **Zeitfenster**: Wie weit zurückschauen? (6-72 Std)

## Workflow

1. **User aktiviert Notifications** in Settings
2. **Engine startet** automatisch im Hintergrund
3. **Alle X Minuten** (konfigurierbar):
   - Hole Access Token & User ID aus electron-store
   - Fetche User's MediaListCollection von AniList
   - Filtere PLANNING & CURRENT Einträge
   - Prüfe `nextAiringEpisode`
   - Wenn Episode innerhalb Lookback Window:
     - Check in SQLite: Bereits benachrichtigt?
     - Falls nein: Sende Desktop Notification
     - Speichere in Historie
4. **User bekommt Notification** 🎬

## Technische Details

### AniList API Query

```graphql
query ($userId: Int!) {
  MediaListCollection(userId: $userId, type: ANIME) {
    lists {
      entries {
        status
        media {
          id
          title { romaji english native }
          coverImage { large }
          nextAiringEpisode {
            airingAt
            episode
          }
        }
      }
    }
  }
}
```

### SQLite Schema

```sql
CREATE TABLE notification_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  media_id INTEGER NOT NULL,
  episode INTEGER NOT NULL,
  airing_at INTEGER NOT NULL,
  notified_at INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT,
  UNIQUE(media_id, episode, user_id)
);
```

## Testing

### Manuelle Prüfung

1. Gehe zu **Settings → Benachrichtigungen**
2. Klicke "🔍 Jetzt prüfen"
3. Ergebnis wird angezeigt

### Console Logs

```javascript
// Engine gestartet
[NotificationEngine] Started with 30min interval

// Prüfung läuft
[NotificationEngine] Checking for user 12345...
[NotificationEngine] Found 5 anime with airing episodes

// Notification gesendet
[NotificationEngine] Notified: Attack on Titan EP12

// Cleanup
[NotificationEngine] Cleaned up 3 old notification records
```

## Dependencies

- `electron` - Desktop Notifications
- `better-sqlite3` - Lokale Datenbank
- `electron-store` - Config Persistence
- `axios` - AniList API Calls

## Future Improvements

- [ ] Click on Notification → Jump to Anime in Library
- [ ] Sound/Vibration Settings
- [ ] Custom Notification Text Templates
- [ ] Filter by Genre/Tag
- [ ] Weekly Summary Notification
- [ ] Integration mit Calendar View

## Troubleshooting

### Keine Notifications

1. **Settings prüfen**: Ist "Benachrichtigungen aktivieren" AN?
2. **Auth prüfen**: Mit AniList angemeldet?
3. **Console prüfen**: DevTools öffnen und nach "[NotificationEngine]" suchen
4. **Watchlist prüfen**: Hast du Anime auf Planning/Watching?
5. **Timing prüfen**: Sind neue Episoden innerhalb des Zeitfensters erschienen?

### User ID nicht gefunden

- **Fix**: Erneut einloggen → User ID wird beim Login gespeichert

### Doppelte Notifications

- **Unmöglich**: SQLite UNIQUE Constraint verhindert Duplikate
- Falls doch: Check `notification_history` Tabelle

## Files Übersicht

```
ShokaiShelf/
├── electron/
│   ├── notificationStore.ts       # SQLite Store
│   ├── notificationEngine.ts      # Background Service
│   ├── main.ts                    # IPC Handlers (neu)
│   ├── main.js                    # Auth + User ID speichern
│   └── preload.js                 # API Exposure
├── src/
│   ├── api/anilist.ts             # TypeScript Types
│   └── pages/Settings.tsx         # UI (neuer Tab)
└── NOTIFICATIONS.md               # Diese Datei
```

---

**Version**: 0.2.0
**Erstellt**: 2025-11-11
**Status**: ✅ Produktionsbereit

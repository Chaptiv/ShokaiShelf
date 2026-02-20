<p align="center">
  <img src="build/icons/icon.png" alt="ShokaiShelf Logo" width="128" />
</p>

<h1 align="center">ShokaiShelf</h1>

<p align="center">
  <b>A modern, privacy-first anime tracking & recommendation desktop app.</b>
  <br />
  Powered by AniList. Built with Electron, React & TypeScript.
</p>

<p align="center">
  <a href="https://github.com/Chaptiv/ShokaiShelf/releases"><img alt="Version" src="https://img.shields.io/github/v/release/Chaptiv/ShokaiShelf?label=version&color=7c3aed" /></a>
  <a href="https://github.com/Chaptiv/ShokaiShelf/releases"><img alt="Downloads" src="https://img.shields.io/github/downloads/Chaptiv/ShokaiShelf/total?color=7c3aed" /></a>
  <a href="#license"><img alt="License" src="https://img.shields.io/badge/license-see%20below-7c3aed" /></a>
  <a href="https://github.com/Chaptiv/ShokaiShelf/issues"><img alt="Issues" src="https://img.shields.io/github/issues/Chaptiv/ShokaiShelf?color=7c3aed" /></a>
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#installation">Installation</a> &bull;
  <a href="#netrec-dream--the-recommendation-engine">NetRec Dream</a> &bull;
  <a href="#tech-stack">Tech Stack</a> &bull;
  <a href="#development">Development</a> &bull;
  <a href="#the-part-nobody-asked-for--the-history-of-shokaishelf">History</a> &bull;
  <a href="#license">License</a>
</p>

---

## What is ShokaiShelf?

ShokaiShelf is a desktop anime tracker that syncs with [AniList](https://anilist.co) and gives you **personalized recommendations that are calculated entirely on your machine** — no data ever leaves your computer. Browse your library, track what you're watching, discover your next obsession, and flex your stats, all from one app with a glassmorphism UI that actually looks good.

> **Status:** Public Beta (v0.2.0 "NetRec Dream")
> Available for **Windows**, **macOS**, and **Linux**.

---

## Screenshots

<p align="center">
  
  <br />
  <img width="2672" height="1445" src="https://github.com/user-attachments/assets/0704def3-4a87-49ea-af93-80d987fd14ec" />
  <em>Dashboard — Personalized recommendations and your current watch at a glance.</em>
</p>

<p align="center">
  <img width="2672" height="1445" src="https://github.com/user-attachments/assets/04ec33cc-55cf-4e1a-b249-bf5055303a5b" />
  <br />
  <em>Library — Browse your full collection with stats, filters, and status tabs.</em>
</p>

<p align="center">
  <img width="2672" height="1445" src="https://github.com/user-attachments/assets/d3098ba6-101a-4c90-b2db-4f058b949a96" />
  <br />
  <em>Search — Find anime by name, browse trending titles, or explore by genre.</em>
</p>

<p align="center">
  <img width="2672" height="1445" src="https://github.com/user-attachments/assets/a7050f2e-addb-4929-b56b-2d8e8fa29fd5" />
  <br />
  <em>Media Detail — Track progress, set scores, view studios, tags, and more.</em>
</p>

---

## Features

### NetRec Dream Engine
The heart of ShokaiShelf. A recommendation engine that learns your taste without sending a single byte to any server.

- **Semantic Clustering** — Groups anime by thematic similarity and analyzes your drop patterns to figure out what you *actually* dislike, not just what you rated low.
- **Implicit Signal Analysis** — Goes beyond scores. Tracks binge velocity, completion habits, drop forensics (did you drop it after 2 episodes or 20? That means something different), and even your tolerance for older or longer series.
- **Dynamic Profiles** — Your recommendation profile evolves every time new data comes in. It gets smarter the more you watch.
- **Transparent Reasoning** — Every recommendation comes with a confidence score and a human-readable explanation of *why* it was suggested.

### AniList Integration
- Full OAuth 2.0 login
- Two-way sync of your lists, scores, and progress
- Push updates back to AniList in real time
- Automatic token refresh — log in once and forget about it

### Discord Rich Presence
Show your friends what you're watching, which episode you're on, and how much time is left — right in your Discord profile.

### Native Notifications
A background service watches for new episodes of titles in your "Watching" and "Planning" lists and sends you native OS notifications. Fully configurable check intervals (10-120 min) and lookback windows.

### Achievements (Beta)
A gamification layer that tracks your viewing habits and awards badges for milestones. Because anime needs a meta-game.

### Echo / Wrapped (Beta)
A statistics page with monthly and yearly viewing summaries, fun facts about your habits, and shareable images you can export.

### Local Scrobbler (Beta)
Automatically detects media playback in **VLC** and **MPC-HC** and syncs your progress to AniList. No manual episode tracking needed.

### Auto-Updater
Future updates are delivered automatically via GitHub Releases. Just launch the app and stay up to date.

### UI & Design
- **Glassmorphism Design** — A full "Dream" design language with frosted glass elements and fluid animations.
- **Liquid Grid Layout** — Responsive, adaptive layout that works across screen sizes.
- **Internationalization** — Full English and German translations with automatic language detection.
- **ColdStart Wizard** — A guided first-time setup that calibrates recommendations even if your list is small.

---

## Installation

### Download

Head to the [Releases page](https://github.com/Chaptiv/ShokaiShelf/releases) and download the latest installer for your platform:

| Platform    | File |
|----------   |------|
| Windows     | `ShokaiShelf-Installer-x.x.x.exe` |
| macOS ARM   | `ShokaiShelf-Mac-ARM-x.x.x-Installer.dmg` |
| macOS X64   | `ShokaiShelf-Mac-X64-x.x.x-Installer.dmg` |
| Linux       | `Not Available, but creatable via self-build` |

### First-Time Setup

1. **Launch ShokaiShelf** — The ColdStart Wizard will guide you through the initial setup.
2. **Create AniList API Credentials:**
   - Go to [AniList Settings > Developer](https://anilist.co/settings/developer)
   - Click **"Create New Client"**
   - Set the **Redirect URL** to:
     ```
     http://127.0.0.1:43210/callback
     ```
   - Copy the **Client ID** and **Client Secret**
3. **Enter your credentials** in the wizard and log in.
4. Your library will sync automatically. Recommendations start building from your first session.

---

## NetRec Dream — The Recommendation Engine

NetRec Dream (V4) is ShokaiShelf's custom-built recommendation engine. It replaced the earlier linear regression model (V2) and is designed to understand *how* you watch, not just *what* you rate.

### How It Works

```
Your AniList Data
       |
       v
+-----------------+     +-------------------+     +----------------+
| Implicit Signal |---->| Semantic Clustering|---->| Dream Scoring  |
|    Analysis     |     |   & Profiling      |     |  & Ranking     |
+-----------------+     +-------------------+     +----------------+
       |                        |                         |
  Binge speed            Tag co-occurrence          Confidence score
  Drop forensics         Cluster affinities         Explanations
  Tolerance scores       Pattern discovery          Final picks
  Engagement data        Profile evolution          MMR re-ranking
```

**Implicit Signals** analyze your behavior patterns:
- **Binge Velocity** — How fast you burn through episodes. Power bingers and slow burners get different suggestions.
- **Drop Forensics** — Categorizes drops into vibe checks (<25% progress), boredom drops (25-67%), and burnout drops (>67%). Each tells a different story about your taste.
- **Tolerance Scoring** — Measures your openness to older anime (pre-2010), longer series (50+ episodes), and slower pacing.
- **Completion Rate** — Are you a completionist or a serial dropper? This affects how aggressively the engine recommends longer commitments.

**Semantic Clustering** groups anime by thematic similarity using tag co-occurrence analysis, then calculates your affinity for each cluster on a scale from -1 to +1. This lets the engine recommend along taste dimensions that go beyond simple genre labels.

**Engine Selection** is automatic:
- If you have a mature DreamProfile (confidence >= 0.3 or 10+ feedback entries), Dream V4 takes over.
- New users start with V3 (collaborative filtering + content-based scoring) until enough data is collected.
- Existing V3 data is automatically migrated to V4 — nothing is lost.

> All computation happens locally. Your data never leaves your machine.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **UI Framework** | React 18, Vite 6, TypeScript 5 |
| **Animations** | Framer Motion |
| **Desktop Shell** | Electron 40 |
| **Database** | SQLite (better-sqlite3) |
| **API** | AniList GraphQL |
| **Integrations** | Discord RPC, WebSocket |
| **Security** | DOMPurify (XSS protection) |
| **i18n** | react-i18next |
| **Testing** | Vitest, React Testing Library |
| **Build** | electron-builder (NSIS / DMG / AppImage) |
| **Virtualization** | TanStack Virtual (for large lists) |

---

## Development

### Prerequisites

- Node.js 18+
- npm
- An AniList account with [Developer credentials](https://anilist.co/settings/developer)

### Getting Started

```bash
# Clone the repository
git clone https://github.com/Chaptiv/ShokaiShelf.git
cd ShokaiShelf

# Install dependencies
npm install

# Start the dev server (Vite + Electron with hot reload)
npm run dev
```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for production and create installers |
| `npm run build:renderer` | Build the React frontend only |
| `npm test` | Run the test suite (Vitest) |
| `npm run lint` | Lint with ESLint |
| `npm start` | Launch the built Electron app |

### Project Structure

```
ShokaiShelf/
├── src/                        # React frontend
│   ├── pages/                  # Application pages (Dashboard, Library, Search, ...)
│   ├── components/             # Reusable UI components
│   ├── logic/
│   │   ├── netrecDream/        # NetRec Dream V4 engine
│   │   ├── netrecV3/           # NetRec V3 (legacy fallback)
│   │   ├── wrapped/            # Echo / Wrapped statistics
│   │   └── achievements/       # Achievement system
│   ├── api/                    # AniList GraphQL client
│   ├── shingen/                # Design system (theme, sidebar, tokens)
│   ├── hooks/                  # Custom React hooks
│   ├── utils/                  # Utilities (logger, sanitizer)
│   └── state/                  # React Context (settings)
├── electron/                   # Electron main process
│   ├── main.ts                 # App initialization & IPC handlers
│   ├── preload.ts              # Context bridge
│   ├── notificationEngine.ts   # Background episode notifications
│   ├── discord.ts              # Discord Rich Presence
│   ├── scrobbler.ts            # Video player detection
│   └── offlineStore.ts         # Offline persistence
├── miru-extension/             # Browser extension (experimental)
├── build/                      # App icons & build assets
└── electron-builder.json5      # Packaging configuration
```

---

## Known Issues (v0.2.0 Beta)

This is a public beta. Things might break. Here's what is currently known:

- **Scrobbler** — May misidentify some video game footage (e.g., Dark Souls) as anime playback.
- **Notifications** — Desktop notifications may appear as "Electron.App.ShokaiShelf" without the anime thumbnail.
- **Social Tab** — Global activity feed may show "Unknown" status for some entries.
- **Windows Installer** — Progress bar may briefly display inverted during installation.
- **Localization** — The "First Dislike" context menu stays in German regardless of the language setting.
- **Performance** — Initial library scan for 1000+ entries can take significant time on first launch.

Found something else? Please [open an issue](https://github.com/Chaptiv/ShokaiShelf/issues) with screenshots and logs if possible.

---

## The Part Nobody Asked For — The History of ShokaiShelf

This is a solo project, and it has been a long road to get here.

It all started about two years ago with a simple C# CLI project called **"Project Hikari"**, built for a class test. It was nothing fancy — just a command-line tool — but it planted the seed. After the test was over, the idea stuck around.

That seed grew into **ShokaiShelf 0.0.1**, rewritten from scratch in Python. Over the next few iterations (up to 0.0.4), it slowly took shape as an actual application, but it was clear that Python wasn't going to cut it for the kind of desktop experience I had in mind.

So I did what any reasonable person would do: I threw everything away and **rewrote the entire codebase from the ground up** in Electron, React, and TypeScript. That rewrite took **seven months**. During that time, the recommendation engine (NetRec) was born, the UI got its glassmorphism identity, and **ShokaiShelf 0.1.0** finally saw the light of day.

Here you see the clear difference. On top is 0.0.5, written in Python, and on the Bottom you find an early version of 0.1.0.

<img width="540" height="811" src="https://github.com/user-attachments/assets/cb186af3-9ef4-4ab3-856a-2e29caf9b6fb" />


Now, with **ShokaiShelf 0.2.0**, the app is going public for real — not just silently pushed to a GitHub repository, but actually put out there for people to find, try, and (hopefully) break. The recommendation engine has been rebuilt from scratch *again* (NetRec Dream V4), the UI has been overhauled, and there are more features than I ever planned for when this was just a class project.

I'm putting this out here because I believe that with enough feedback, ShokaiShelf can keep growing. If you've made it this far, give it a try — and if something doesn't work, [let me know](https://github.com/Chaptiv/ShokaiShelf/issues). Every bug report, feature request, and piece of feedback matters.

```
Project Hikari (C# CLI)
        |
        v
ShokaiShelf 0.0.1 - 0.0.4 (Python)
        |
        | 7 months of rewriting
        v
ShokaiShelf 0.1.0 (Electron/React/TypeScript + NetRec V2/V3)
        |
        v
ShokaiShelf 0.2.0 "NetRec Dream" (Public Beta)  <-- You are here
```

---

## License

**Copyright (c) 2024-2026 Chaptiv.**

ShokaiShelf's source code is available for viewing and contribution. You are welcome to explore the codebase, learn from it, and submit pull requests.

**However, the following is strictly prohibited:**

- Using ShokaiShelf's code or any part of it (including the NetRec / AnimeNetRecs recommendation engine) in another application.
- Redistributing ShokaiShelf, in whole or in part, under a different name or as a different product.

In short: **look, learn, contribute — but don't copy it into your own app or ship it as something else.**

---

<p align="center">
  <sub>Built without enough sleep by <a href="https://github.com/Chaptiv">Chaptiv</a>.</sub>
</p>

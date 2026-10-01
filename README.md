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
  <a href="#license"><img alt="License: GPL 3.0" src="https://img.shields.io/badge/license-GPL%203.0-7c3aed" /></a>
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

ShokaiShelf is a desktop anime tracker that syncs with [AniList](https://anilist.co) and gives you **personalized recommendations that are calculated entirely on your machine** — recommendation scoring and your Dream profile stay on your machine. AniList requests and list updates still use its online API. Browse your library, track what you're watching, discover your next obsession, and flex your stats, all from one app with a glassmorphism UI that actually looks good.

> **Status:** Public Beta (v0.2.4 "NetRec Dream")
> Installers target **Windows** and **macOS**. **Linux** is available through a self-build.
> **License:** [GNU GPL 3.0](LICENSE) (`GPL-3.0-only`).

---

## Current Release — 0.2.4

- **Dashboard startup:** Failed or missing AniList profiles now show an error with a retry action instead of leaving the Dream loading screen running indefinitely.
- **Bounded loading:** AniList requests time out after 30 seconds. Dashboard initialization has a two-minute limit, and late results cannot replace the timeout screen.
- **Rate-limit recovery:** Each GraphQL request retries a rate-limit response once, rather than retrying indefinitely.
- **Dream migration:** Default behavioral metrics use an ES module import so migration also works in the renderer without Node.js `require()`.
- **Licensing:** ShokaiShelf is licensed under GNU GPL version 3.0.

See [CHANGELOG.md](CHANGELOG.md) for release details. The renderer build and automated startup tests pass; the Windows executable still needs validation on Windows.

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
The heart of ShokaiShelf. A recommendation engine that scores candidates and maintains your taste profile locally, using anime and library data fetched from AniList.

- **Semantic Clustering** — Groups anime by thematic similarity and analyzes your drop patterns to figure out what you *actually* dislike, not just what you rated low.
- **Implicit Signal Analysis** — Goes beyond scores. Tracks binge velocity, completion habits, drop forensics (did you drop it after 2 episodes or 20? That means something different), and even your tolerance for older or longer series.
- **Dynamic Profiles** — Your recommendation profile evolves every time new data comes in. It gets smarter the more you watch.
- **Transparent Reasoning** — Every recommendation comes with a confidence score and a human-readable explanation of *why* it was suggested.

### AniList Integration
- Browser-based AniList OAuth login
- Two-way sync of your lists, scores, and progress
- Push updates back to AniList in real time
- AniList access tokens stored locally through Electron

### Discord Rich Presence
Show your friends what you're watching, which episode you're on, and how much time is left — right in your Discord profile.

### Native Notifications
A background service watches for new episodes of titles in your "Watching" and "Planning" lists and sends you native OS notifications. Fully configurable check intervals (10-120 min) and lookback windows.

### Update Checks
ShokaiShelf checks GitHub Releases for newer versions and displays an update notification. The update action opens the release page, where you can download and install the new version.

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
| Windows     | `ShokaiShelf-Installer-0.2.4.exe` |
| macOS       | `ShokaiShelf-Mac-0.2.4-Installer.dmg` (check the release for architecture availability) |
| Linux       | Self-build as an AppImage |

For a direct Windows build, run `ShokaiShelf.exe` inside the complete `win-unpacked` folder. Keep its `resources` directory and bundled DLLs beside it.

### First-Time Setup

1. **Launch ShokaiShelf** — The ColdStart Wizard will guide you through the initial setup.
2. **Log in with AniList** — click Sign In and authorize ShokaiShelf in your browser. No API credentials to create or manage.
3. Your library will sync automatically. Recommendations start building from your first session.

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

**Dream V4 is the active engine** for the dashboard and search. It builds on V3's candidate generation and scoring utilities, then adds adaptive Dream profiles and reasoning. Existing V3 data is migrated to a Dream profile during startup.

> Recommendation computation happens locally. AniList supplies anime and library data and receives the list updates you submit.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **UI Framework** | React 18, Vite 7, TypeScript 5 |
| **Animations** | Framer Motion |
| **Desktop Shell** | Electron 44 |
| **Storage** | electron-store and browser storage; SQLite offline support is currently disabled |
| **API** | AniList GraphQL |
| **Integrations** | Discord RPC, native notifications |
| **Security** | DOMPurify (XSS protection) |
| **i18n** | react-i18next |
| **Testing** | Vitest, React Testing Library |
| **Build** | electron-builder (NSIS / DMG / AppImage) |
| **Virtualization** | TanStack Virtual (for large lists) |

---

## Development

### Prerequisites

- Node.js 22.13+ (or Node.js 20.19+)
- npm
- An AniList account for login and library synchronization; the configured beta login does not require your own developer credentials

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
| `npm start` | Launch Electron (tries the dev server, then falls back to `dist`) |
| `npm run release` | Interactive versioning and release preparation; the custom Windows installer requires the sibling `ShokaiShelf-Installer` project |

### Project Structure

```
ShokaiShelf/
├── src/                        # React frontend
│   ├── pages/                  # Application pages (Dashboard, Library, Search, ...)
│   ├── components/             # Reusable UI components
│   ├── logic/
│   │   ├── netrecDream/        # NetRec Dream V4 engine
│   │   └── netrecV3/           # Candidate generation, scoring, cache & queries
│   ├── api/                    # AniList GraphQL client
│   ├── shingen/                # Design system (theme, sidebar, tokens)
│   ├── hooks/                  # Custom React hooks
│   ├── utils/                  # Utilities (logger, sanitizer)
│   └── state/                  # React Context (settings)
├── electron/                   # Electron main process
│   ├── main.js                 # Active app entry point & IPC handlers
│   ├── preload.cjs             # Active context bridge
│   ├── notificationEngine.js   # Background episode notifications
│   ├── discord.js              # Discord Rich Presence
│   └── offlineStore.js         # Offline persistence (currently disabled)
├── build/                      # App icons & build assets
├── electron-builder.json5      # Packaging configuration
├── CHANGELOG.md                # Release notes
└── LICENSE                     # GNU GPL version 3.0
```

---

## Known Issues (v0.2.4 Beta)

This is a public beta. Things might break. Here's what is currently known:

- **Notifications** — Desktop notifications may appear as "Electron.App.ShokaiShelf" without the anime thumbnail.
- **Social Tab** — Global activity feed may show "Unknown" status for some entries.
- **Windows Installer** — Progress bar may briefly display inverted during installation.
- **Localization** — The "First Dislike" context menu stays in German regardless of the language setting.
- **Performance** — Initial library scans and AniList rate-limit backoff can take time. Dashboard loading stops after two minutes with a retry action.
- **Offline Mode** — SQLite offline persistence is disabled in the active Electron entry point. An internet connection is needed to fetch uncached AniList data.
- **Windows Startup** — Startup error handling and timeouts are covered by automated tests, but the rebuilt executable still needs a Windows smoke test.

Found something else? Please [open an issue](https://github.com/Chaptiv/ShokaiShelf/issues) with screenshots and logs if possible.

---

## The Part Nobody Asked For — The History of ShokaiShelf

This is a solo project, and it has been a long road to get here.

It all started about two years ago with a simple C# CLI project called **"Project Hikari"**, built for a class test. It was nothing fancy — just a command-line tool — but it planted the seed. After the test was over, the idea stuck around.

That seed grew into **ShokaiShelf 0.0.1**, rewritten from scratch in Python. Over the next few iterations (up to 0.0.4), it slowly took shape as an actual application, but it was clear that Python wasn't going to cut it for the kind of desktop experience I had in mind.

So I did what any reasonable person would do: I threw everything away and **rewrote the entire codebase from the ground up** in Electron, React, and TypeScript. That rewrite took **seven months**. During that time, the recommendation engine (NetRec) was born, the UI got its glassmorphism identity, and **ShokaiShelf 0.1.0** finally saw the light of day.

Here you see the clear difference. On top is 0.0.5, written in Python, and on the Bottom you find an early version of 0.1.0.

<img width="540" height="811" src="https://github.com/user-attachments/assets/cb186af3-9ef4-4ab3-856a-2e29caf9b6fb" />


The **ShokaiShelf 0.2.x** public beta, currently **0.2.4**, brings the app to a wider audience — not just silently pushed to a GitHub repository, but actually put out there for people to find, try, and (hopefully) break. The recommendation engine has been rebuilt from scratch *again* (NetRec Dream V4), the UI has been overhauled, and there are more features than I ever planned for when this was just a class project.

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
ShokaiShelf 0.2.0 "NetRec Dream" (Public Beta)
        |
        v
ShokaiShelf 0.2.4 (Startup fixes + GNU GPL 3.0)  <-- You are here
```

---

## Disclaimer

ShokaiShelf is provided without warranty, to the extent permitted by applicable law, as described in sections 15 and 16 of the [GNU GPL version 3.0](LICENSE).

ShokaiShelf uses the public APIs of AniList and Discord. It is not affiliated with or endorsed by either service. This is a beta product; bugs and service interruptions may occur.

---

## License

**Copyright (c) 2024-2026 Chaptiv.**

ShokaiShelf, including its NetRec / AnimeNetRec recommendation engine, is free software licensed under the **GNU General Public License, version 3.0 only** (`GPL-3.0-only`). You may use, study, modify, and redistribute it under the terms of that license.

When distributing ShokaiShelf or a modified version, follow the GPL's requirements for license notices and corresponding source code. The complete license text is included in [LICENSE](LICENSE); further information is available from the [GNU GPL 3.0 page](https://www.gnu.org/licenses/gpl-3.0.html).

Third-party dependencies retain their own licenses.

---

<p align="center">
  <sub>Built without enough sleep by <a href="https://github.com/Chaptiv">Chaptiv</a>.</sub>
</p>

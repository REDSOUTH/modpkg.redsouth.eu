# MODPKG Web

This repository contains the frontend web application for **MODPKG**, the universal platform to create, manage, and export Minecraft modpacks directly in your browser without any launcher lock-in.

Part of the **REDSOUTH Studio** ecosystem, MODPKG allows creators, server administrators, and players to build standalone modpacks with mods, resourcepacks, shaders, datapacks, and custom configuration overrides in seconds.

---

## Key Features

- **In-Browser Engine:** 100% client-side processing. All package management, JSON manifest generation, and ZIP compilation happen locally in the browser with zero vendor lock-in.
- **Zero Launcher Lock-In:** Packages exported from MODPKG can be deployed universally to Vanilla Minecraft clients, dedicated servers, or any third-party launcher.
- **Multi-Loader & Multi-Version:** Native support for **Fabric, Forge, NeoForge, and Quilt**, spanning from modern releases to legacy Minecraft versions.
- **Official Formats Support:**
  - **`.mpkg`**: Lightweight version index manifest containing metadata, dependencies, and direct download links.
  - **`.mpkg-proj`**: Complete project archive with version history, custom files, and configuration data for backup and sharing.
  - **`.mpkg.zip`**: Complete offline bundle with all JARs, resourcepacks, shaders, and configs pre-sorted into their respective folders (`/mods/`, `/resourcepacks/`, `/config/`).
- **Modrinth Conversion (`.mrpack`):** Direct import and automatic conversion of Modrinth modpack archives into MODPKG projects.
- **Integrated Code Editor:** Built-in Monaco Editor for viewing and editing configuration files (`.json`, `.toml`, `.yaml`, `.cfg`, scripts, text files) with a visual directory explorer.
- **Multimedia Asset Preview:** Built-in previewers for images, audio tracks, and video files embedded in overrides.
- **My Resources Library:** Global cross-project repository to store reusable configs and custom content across all your modpacks.
- **Collision Prevention & Clean Storage:** Automatic conflict handling with incremental IDs (`-2`, `-3`...) and atomic local storage clean-up.
- **Multilingual Support:** Fully translated into 5 languages with automatic browser detection:
  - 🇺🇸 English
  - 🇪🇸 Español
  - 🇧🇷 Português (Brasil)
  - 🇫🇷 Français
  - 🇩🇪 Deutsch
- **Theming:** Full Dark, Light, and System theme support with distinctive MODPKG orange styling.

---

## Tech Stack

- **Framework:** React 18 + TypeScript + Vite
- **Styling:** Tailwind CSS + Tailwind Animate
- **UI Components:** Radix UI Primitives + Lucide Icons + Flag Icons
- **Code Editor:** Monaco Editor (`@monaco-editor/react`)
- **State & Storage:** React Context + Web Storage (LocalStorage)
- **Packaging & Compression:** JSZip
- **Internationalization:** i18next + react-i18next + i18next-browser-languagedetector
- **Animations:** Framer Motion
- **Notifications:** Sonner Toasts

---

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or pnpm / yarn

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/REDSOUTH-Studio/modpkg.git
   ```
2. Navigate to the project directory:
   ```bash
   cd modpkg
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Development

Run the local development server:
```bash
npm run dev
```

### Production Build

Compile the project for production:
```bash
npm run build
```

Preview the production build locally:
```bash
npm run preview
```

---

## Ecosystem & Links

- **Official Web:** [modpkg.redsouth.eu](https://modpkg.redsouth.eu/)
- **REDSOUTH Studio:** [redsouth.eu](https://redsouth.eu/)
- **Launch Blog Post:** [Introducing MODPKG](https://redsouth.eu/blog/introducing-modpkg)

---

## License

Copyright (c) 2026 REDSOUTH Studio  
All rights reserved.

The code in this repository is publicly available exclusively for viewing, analysis, and contributing to the original project via Pull Requests.

No right or license is granted (either explicitly or implicitly) to copy, modify, distribute, or use this code, whether in whole or in part, in other projects or for any other purpose without the express written permission of the author.

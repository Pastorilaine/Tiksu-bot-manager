---
description: "Tiksu Bot Manager project conventions — Electron + React + Vite codebase rules. Use when editing any file in this project."
applyTo: ["src/**", "electron/**"]
---

# Tiksu Bot Manager — Project Conventions

## Language
- UI text and user-facing strings: **Finnish**
- Code, variable names, comments: **English**

## Styling
- Inline styles for component-level styles, Tailwind for layout utilities
- Color palette is fixed — never invent new colors, always use the defined palette:
  - Primary: `#5865F2` (blue), hover `#4752C4`
  - Green: `#3ba55d`, Red: `#ed4245`, Yellow: `#faa81a`
  - Backgrounds: `#0b0b14` main, `#0d0d1a` sidebar, `#0f0f1c` modal
  - Text: `#f2f3f5` bright, `#e3e5e8` heading, `#b5bac1` body, `#4e5058` muted

## IPC (renderer ↔ main)
- All renderer↔main calls go through `window.api` (defined in `electron/preload.js`)
- Use `ipcRenderer.invoke` / `ipcMain.handle` — never `send`/`on` for request-response
- Every IPC handler in `main.js` must validate and sanitize its inputs

## Security
- Allowed bot file extensions: `.py .js .mjs .cjs .ts` only
- File paths: always `path.normalize()` + `fs.existsSync()` before use
- Never expose Node.js APIs directly to renderer — always through IPC

## Electron window
- `frame: false` — custom title bar in `TitleBar.jsx`
- Window close → hides to tray (does NOT quit). Use tray menu "Lopeta" to truly quit.
- Window state (size, position, maximized) is persisted via `electron-store`

## Icons
- Always use `lucide-react` — no other icon libraries

## Modals
- Use `ConfirmModal` for any destructive confirmation — never `window.confirm()`
- Modal backdrop: `position: fixed, inset: 0, zIndex: 50, backdropFilter: blur(4px)`

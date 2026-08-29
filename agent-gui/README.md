# agent-gui

Tauri-based GUI crate for the `rust-agent` workspace.

## Overview

This crate contains the desktop GUI application for `rust-agent`, built with:

- [Tauri](https://tauri.app/)
- React
- TypeScript
- Vite
- Tailwind CSS

The window is borderless. The main view is a circular local avatar/status image surrounded by a hollow progress ring. Drag anywhere to move the window. Right-clicking anywhere opens a small system menu with Pin (toggle always-on-top), Next Angelina, and Exit actions.

The displayed images are stored in `ui/src/assets/background/`. The “Next Angelina” menu item randomly switches to another GIF from that folder.

## Getting Started


Install frontend dependencies:

```bash
cd agent-gui
npm install
```

Build and test the Rust crate from the workspace root:

```bash
cargo build -p agent-gui
cargo test -p agent-gui
```

Run the Tauri desktop app:

```bash
cd agent-gui
npm run tauri dev
```

`npm run tauri dev` builds the frontend into `ui/dist` before launching the app. You can also launch the compiled debug binary with `cargo run -p agent-gui` after building the frontend with `npm run build`.

## Structure

- `src/main.rs` - Tauri application entry point.
- `ui/` - React + TypeScript + Vite frontend.
- `ui/src/App.tsx` - Main GUI layout, progress ring, Pin/Next Angelina/Exit context menu.
- `ui/src/index.css` - Tailwind CSS entry.
- `tauri.conf.json` - Tauri configuration.

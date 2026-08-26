# agent-gui

Tauri-based GUI crate for the `rust-agent` workspace.

## Overview

This crate contains the desktop GUI application for `rust-agent`, built with:

- [Tauri](https://tauri.app/)
- React
- TypeScript
- Vite
- Tailwind CSS

The window is borderless and provides custom minimize, maximize, and close controls in the top-right corner.

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

## Structure

- `src/main.rs` - Tauri application entry point.
- `ui/` - React + TypeScript + Vite frontend.
- `ui/src/App.tsx` - Main GUI layout and custom window controls.
- `ui/src/index.css` - Tailwind CSS entry.
- `tauri.conf.json` - Tauri configuration.

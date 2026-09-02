# AGENTS.md

Guidance for AI coding agents working on this repository.

## Project Overview

- **shisan-agent** is a desktop AI agent, licensed under **MIT**.
- It combines a desktop pet widget + chat UI (`agent-gui`, Tauri) with a Rust agent/LLM core (`agent-core`).

## Workspace Structure

- The root `Cargo.toml` is a Rust workspace manager with `resolver = "2"` and no workspace name declared (the project is called *shisan-agent*).
- `workspace.package`: version `0.1.0`, edition `2024`.
- Members — exactly **two**:
  - `agent-core`
  - `agent-gui`
- There is **no** `agent-provider` crate; provider logic is the module `agent-core/src/provider/`.

## agent-core Rules/Notes

- Purpose: core agent/LLM client (lib + bin).
  - `src/agent.rs` — `Agent` struct wrapping `OpenAIClient` with message history.
  - `src/provider/provider.rs` — `Provider` enum (`Deepseek`, `OpenRouter`) with `endpoint()` and `api_key_from_env()`.
  - `src/main.rs` — demo binary using `Provider::OpenRouter`.
- Dependencies: `dotenv 0.15`, `openai-api-rs 10.0.1`, `tokio 1` (features: `macros`, `rt-multi-thread`).
- Secrets: the `.env` file lives at `agent-core/src/.env` (gitignored at both root and crate level), loaded via dotenv from `CARGO_MANIFEST_DIR/src/.env`. Env var names: `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`.
- Run: `cargo run -p agent-core` (requires the `.env`).

## agent-gui Rules

`agent-gui` is a Tauri 2 desktop app (`tauri 2.11.2` with the `macos-private-api` feature; `tauri-build 2.6.2`) with a **dual-window architecture**. Window rules are per-window:

1. **Main pet window** (declared in `tauri.conf.json`)
   - 328×328 default, `minWidth`/`minHeight` 234, resizable, centered.
   - Borderless (`decorations: false`) and transparent (`transparent: true`).
   - Circular Angelina GIF avatar with an SVG day-progress ring.
   - Drag-to-move via `appWindow.startDragging()`; double-click opens the chat window.
   - Right-click context menu: Pin (always-on-top), Next Angelina, Exit.
   - **No title-bar buttons** on this window.

2. **Chat window** (created programmatically at 1280×800)
   - Borderless + transparent, like the main window.
   - Custom **Close / Maximize / Minimize** buttons in the **top-right** header, implemented in the frontend using Tauri's window API.
   - `rounded-xl` container with a visible border.
   - Collapsible conversation sidebar with localStorage-backed history (`ui/src/components/chat/useConversationHistory.ts`, max 50 sessions).
   - Message area (`ui/src/components/agui/MessageBox.tsx`) plus a right toolbox panel.

3. **Entry routing**
   - `ui/src/main.tsx` routes `App` (main window) vs `ChatWindow` via the URL query `?window=chat`.

4. **Rust backend** (`src/main.rs`)
   - Tauri commands: `close_chat_window`, `exit_app`.
   - The app exits when the main window is destroyed.

5. **Tauri configuration** (`tauri.conf.json`)
   - `productName: agent-gui`, `identifier: com.example.agent-gui`.
   - `macOSPrivateApi: true` — required for window transparency on macOS.
   - `frontendDist: ui/dist`; `beforeDevCommand`/`beforeBuildCommand` hardcoded to `npm run build`.
   - `bundle.active: false`; CSP is `null`.
   - Tauri v2 capabilities: `capabilities/main.json` and `capabilities/chat.json` define per-window permissions.

6. **Frontend stack** (source lives under `agent-gui/ui/`)
   - TypeScript `~5.8.3`, React `^19.1.0`, Vite `^7.0.4`.
   - Tailwind CSS v4 (`^4.1.0`) wired via the `@tailwindcss/vite` plugin + `@import "tailwindcss"` in `ui/src/index.css` — there is **no** `tailwind.config` file.
   - `ui/vite.config.ts` sets `esbuild.charset: "ascii"` so non-ASCII (CJK) strings are escaped in output JS — do not remove (cross-platform charset safety).

## Build & Dev Commands

- Workspace:
  - `cargo build` / `cargo test`
  - `cargo build -p <crate>`
- agent-core:
  - `cargo run -p agent-core`
- agent-gui (run from `agent-gui/`):
  - `pnpm install`
  - `pnpm run dev` — Vite dev server on port 1420 (`strictPort: true`)
  - `pnpm run build` — `tsc` + `vite build` to `ui/dist`
  - `pnpm run tauri dev` / `pnpm run tauri build`
- Package manager note: **pnpm is authoritative** for `agent-gui` (`pnpm-lock.yaml` + `pnpm-workspace.yaml` live there); the root `package-lock.json` is a leftover. However, the `tauri.conf.json` build hooks call `npm run build`.

## Environment & Secrets

- Env var names (values never in the repo): `DEEPSEEK_API_KEY`, `OPENROUTER_API_KEY`.
- Secrets live only in `agent-core/src/.env`, which is gitignored (root and crate `.gitignore`).
- **Never commit secrets** or put real key values in documentation.

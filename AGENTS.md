# AGENTS.md

## Project Rules

### Workspace

- This repository is a Rust workspace named `rust-agent`.
- The root `Cargo.toml` is the workspace manager.
- Managed workspace members:
  - `agent-core`
  - `agent-provider`
  - `agent-gui`

### agent-gui GUI Rules

The `agent-gui` crate is the desktop GUI application and must follow these rules:

1. **Borderless window**
   - The Tauri window must be configured with `"decorations": false`.

2. **Custom window controls**
   - The window must provide three custom buttons in the **top-right** corner:
     - Close
     - Maximize
     - Minimize
   - These buttons must be implemented in the frontend using Tauri's window API.

3. **Frontend stack**
   - The GUI frontend must use:
     - TypeScript
     - React
     - Vite
   - The frontend source lives under `agent-gui/ui/`.

4. **Styling**
   - The GUI must use Tailwind CSS for styling.

5. **Rounded corner border**
   - The GUI container must have rounded corners and a visible border.

6. **Transparent background**
   - The Tauri window background must be transparent instead of showing a black background.

7. **Default resolution**
   - The Tauri window must default to 1920×1080.

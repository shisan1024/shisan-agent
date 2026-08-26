import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

function App() {
  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden rounded-2xl border border-white/10 bg-gray-950 text-gray-100 shadow-2xl">
      <header
        data-tauri-drag-region
        className="flex h-10 shrink-0 items-center justify-between bg-gray-900 pl-3"
      >
        <span data-tauri-drag-region className="text-sm font-medium">
          agent-gui
        </span>

        <div className="flex h-full">
          <button
            type="button"
            aria-label="Minimize"
            title="Minimize"
            onClick={() => appWindow.minimize()}
            className="flex h-full w-12 items-center justify-center text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="M3 8.5h10" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Maximize"
            title="Maximize"
            onClick={() => appWindow.toggleMaximize()}
            className="flex h-full w-12 items-center justify-center text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="3" y="3" width="10" height="10" rx="1" />
            </svg>
          </button>

          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={() => appWindow.close()}
            className="flex h-full w-12 items-center justify-center text-gray-400 transition-colors hover:bg-red-500 hover:text-white"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            >
              <path d="m4 4 8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">agent-gui</h1>
          <p className="mt-2 text-sm text-gray-400">
            Borderless Tauri + React + TypeScript + Tailwind CSS
          </p>
        </div>
      </main>
    </div>
  );
}

export default App;

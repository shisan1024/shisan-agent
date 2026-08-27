import { useState, type ReactNode } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

type SidebarIconProps = {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
};

function SidebarIcon({ label, active, onClick, children }: SidebarIconProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
        active
          ? "bg-white text-black"
          : "text-white hover:bg-white hover:text-black active:bg-white active:text-black"
      }`}
    >
      {children}
    </button>
  );
}

function TodoIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function MessageIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      className="h-5 w-5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function App() {
  const [activeSidebar, setActiveSidebar] = useState("todo");

  return (
    <div className="relative flex h-screen w-screen flex-col rounded-2xl bg-black text-white">
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        viewBox="0 0 800 600"
        preserveAspectRatio="none"
      >
        <rect
          x="1"
          y="1"
          width="798"
          height="598"
          rx="16"
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          shapeRendering="geometricPrecision"
        />
      </svg>
      <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl">
        <header
        data-tauri-drag-region
        className="flex h-12 shrink-0 items-center justify-between border-b-[2px] border-white/60 bg-black pl-4"
      >
        <span data-tauri-drag-region className="text-sm font-semibold uppercase tracking-wider">
          agent-gui
        </span>

        <div className="flex h-full">
          <button
            type="button"
            aria-label="Minimize"
            title="Minimize"
            onClick={() => appWindow.minimize()}
            className="flex h-full w-12 items-center justify-center text-white transition-colors hover:bg-white hover:text-black"
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
            className="flex h-full w-12 items-center justify-center text-white transition-colors hover:bg-white hover:text-black"
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
            className="flex h-full w-12 items-center justify-center text-white transition-colors hover:bg-white hover:text-black"
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

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-16 shrink-0 flex-col items-center gap-4 border-r-[2px] border-white/60 bg-black py-4">
          <div className="flex flex-col items-center gap-4">
            <SidebarIcon
              label="Todo"
              active={activeSidebar === "todo"}
              onClick={() => setActiveSidebar("todo")}
            >
              <TodoIcon />
            </SidebarIcon>

            <SidebarIcon
              label="Messages"
              active={activeSidebar === "messages"}
              onClick={() => setActiveSidebar("messages")}
            >
              <MessageIcon />
            </SidebarIcon>
          </div>

          <div className="mt-auto">
            <SidebarIcon
              label="Settings"
              active={activeSidebar === "settings"}
              onClick={() => setActiveSidebar("settings")}
            >
              <SettingsIcon />
            </SidebarIcon>
          </div>
        </aside>

          <main className="min-w-0 flex-1 bg-black" />
        </div>
      </div>
    </div>
  );
}

export default App;

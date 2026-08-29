import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { currentMonitor, getCurrentWindow, LogicalPosition } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { Image } from "@tauri-apps/api/image";
import { listen } from "@tauri-apps/api/event";
import ContextMenu from "./components/ContextMenu";
import iconUrl from "./assets/icon.png";
const backgrounds = import.meta.glob("./assets/background/*.gif", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const backgroundKeys = Object.keys(backgrounds);
const INITIAL_KEY = "./assets/background/angelina_ride.gif";
const INITIAL_URL = backgrounds[INITIAL_KEY] ?? backgroundKeys[0] ?? "";

function getDayProgress() {
  const now = new Date();
  const secondsSinceMidnight =
    now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return secondsSinceMidnight / 86400;
}

const appWindow = getCurrentWindow();

async function setAppIcon() {
  try {
    const response = await fetch(iconUrl);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const icon = await Image.fromBytes(bytes);
    await appWindow.setIcon(icon);
  } catch (error) {
    console.error("Failed to set app icon", error);
  }
}

void setAppIcon();

const RING_SIZE = 182;
const STROKE_WIDTH = 13;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type MenuState = {
  x: number;
  y: number;
};

function App() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [progress, setProgress] = useState(getDayProgress);
  const [currentKey, setCurrentKey] = useState(INITIAL_KEY);
  const [currentImage, setCurrentImage] = useState(INITIAL_URL);

  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const lastClickAt = useRef(0);

  useEffect(() => {
    let cancelled = false;

    appWindow
      .isAlwaysOnTop()
      .then((value) => {
        if (!cancelled) {
          setAlwaysOnTop(value);
        }
      })
      .catch(() => {
        // Keep the default state if the query fails.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress(getDayProgress());
    }, 1000);

    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    void listen("chat-request-close", async () => {
      try {
        const chat = await WebviewWindow.getByLabel("chat");
        if (!chat) {
          console.log("[main] chat window not found");
          return;
        }

        await chat.destroy();
        console.log("[main] chat window destroyed");
      } catch (error) {
        console.error("[main] failed to destroy chat window", error);
      }
    })
      .then((fn) => {
        unlisten = fn;
      })
      .catch((error) => {
        console.error("[main] failed to listen chat-request-close", error);
      });

    return () => {
      unlisten?.();
    };
  }, []);

  useEffect(() => {
    if (!alwaysOnTop) {
      return;
    }

    let unlistenFocus: (() => void) | undefined;

    void appWindow
      .onFocusChanged(({ payload: focused }) => {
        if (!focused) {
          void appWindow.setAlwaysOnTop(true).catch(() => {});
        }
      })
      .then((unlisten) => {
        unlistenFocus = unlisten;
      })
      .catch(() => {});

    const timer = window.setInterval(() => {
      void appWindow.setAlwaysOnTop(true).catch(() => {});
    }, 1000);

    return () => {
      unlistenFocus?.();
      window.clearInterval(timer);
    };
  }, [alwaysOnTop]);

  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();

    const menuWidth = 160;
    const menuHeight = 130;
    const x = Math.min(event.clientX, window.innerWidth - menuWidth - 8);
    const y = Math.min(event.clientY, window.innerHeight - menuHeight - 8);

    setMenu({ x, y });
  };

  const closeMenu = () => setMenu(null);

  const openChatWindow = async () => {
    try {
      const existing = await WebviewWindow.getByLabel("chat");
      const monitor = await currentMonitor();
      let centerPosition: { x: number; y: number } | undefined;

      if (monitor) {
        const scale = monitor.scaleFactor;
        const monitorPosition = monitor.position.toLogical(scale);
        const monitorSize = monitor.size.toLogical(scale);
        centerPosition = {
          x: Math.round(monitorPosition.x + (monitorSize.width - 330) / 2),
          y: Math.round(monitorPosition.y + (monitorSize.height - 330) / 2),
        };
      }

      if (existing) {
        if (centerPosition) {
          await existing.setPosition(
            new LogicalPosition(centerPosition.x, centerPosition.y),
          );
        } else {
          await existing.center();
        }
        void existing.setFocus();
        return;
      }

      const chat = new WebviewWindow("chat", {
        url: "index.html?window=chat",
        title: "Angelina",
        width: 330,
        height: 330,
        resizable: true,
        decorations: false,
        transparent: true,
        center: !centerPosition,
        x: centerPosition?.x,
        y: centerPosition?.y,
      });

      if (centerPosition) {
        chat.once("tauri://created", () => {
          void chat.setPosition(
            new LogicalPosition(centerPosition!.x, centerPosition!.y),
          );
        });
      }

      chat.once("tauri://error", (error) => {
        console.error("Failed to open chat window", error);
      });
    } catch (error) {
      console.error("Failed to open chat window", error);
    }
  };

  const handlePin = async () => {
    const nextValue = !alwaysOnTop;

    try {
      await appWindow.setAlwaysOnTop(nextValue);

      if (nextValue) {
        await appWindow.setFocus();
      }

      setAlwaysOnTop(nextValue);
    } catch (error) {
      console.error("Failed to update always-on-top state", error);
    }
  };

  const handleNext = () => {
    const candidates = backgroundKeys.filter((key) => key !== currentKey);

    if (candidates.length === 0) {
      return;
    }

    const nextKey = candidates[Math.floor(Math.random() * candidates.length)];
    setCurrentKey(nextKey);
    setCurrentImage(backgrounds[nextKey]);
  };

  const handleExit = () => {
    void appWindow.destroy();
  };

  return (
    <div
      onMouseDown={(event) => {
        if (menu) {
          return;
        }
        if (event.button !== 0) {
          return;
        }

        const now = Date.now();
        if (now - lastClickAt.current < 300) {
          lastClickAt.current = 0;
          dragStart.current = null;
          openChatWindow();
          return;
        }

        lastClickAt.current = now;
        dragStart.current = { x: event.clientX, y: event.clientY };
      }}
      onMouseMove={(event) => {
        if (!dragStart.current) {
          return;
        }

        const dx = event.clientX - dragStart.current.x;
        const dy = event.clientY - dragStart.current.y;
        if (Math.hypot(dx, dy) > 5) {
          dragStart.current = null;
          lastClickAt.current = 0;
          event.preventDefault();
          void appWindow.startDragging();
        }
      }}
      onMouseUp={() => {
        dragStart.current = null;
      }}
      onContextMenu={handleContextMenu}
      className="fixed inset-0 flex items-center justify-center overflow-hidden bg-transparent text-white"
    >
      <div className="flex flex-col items-center gap-2">
        <div
          className="relative flex cursor-grab items-center justify-center rounded-full active:cursor-grabbing"
          style={{ width: "182px", height: "182px" }}
        >
          <svg
            aria-hidden="true"
            className="absolute inset-0 -rotate-90"
            viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
            style={{
              filter:
                "drop-shadow(0 0 1.5px rgba(255,34,21,0.5)) drop-shadow(0 0 4.5px rgba(255,34,21,0.5))",
            }}
          >
            <defs>
              <linearGradient
                id="progress-gradient"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#FFB873" />
                <stop offset="50%" stopColor="#FF0000" />
                <stop offset="100%" stopColor="#E27C38" />
              </linearGradient>
            </defs>
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RADIUS}
              fill="none"
              stroke="url(#progress-gradient)"
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
            />
          </svg>

          <img
            src={currentImage}
            alt="Angelina animation"
            draggable={false}
            className="pointer-events-none absolute h-[68%] w-[68%] rounded-full object-cover"
          />
        </div>

      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          alwaysOnTop={alwaysOnTop}
          onPin={handlePin}
          onNext={handleNext}
          onExit={handleExit}
          onClose={closeMenu}
        />
      )}

    </div>
  );
}

export default App;

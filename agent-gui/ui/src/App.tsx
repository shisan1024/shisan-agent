import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
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

const RING_SIZE = 182;
const STROKE_WIDTH = 13;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

type MenuState = {
  x: number;
  y: number;
};

type MenuItem = {
  label: string;
  action: () => void | Promise<void>;
};

function App() {
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [alwaysOnTop, setAlwaysOnTop] = useState(false);
  const [progress, setProgress] = useState(getDayProgress);
  const [currentKey, setCurrentKey] = useState(INITIAL_KEY);
  const [currentImage, setCurrentImage] = useState(INITIAL_URL);

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

  const menuItems: MenuItem[] = [
    {
      label: alwaysOnTop ? "Unpin" : "Pin",
      action: handlePin,
    },
    {
      label: "Next Angelina",
      action: handleNext,
    },
    {
      label: "Exit",
      action: handleExit,
    },
  ];

  return (
    <div
      onMouseDown={(event) => {
        if (menu) {
          return;
        }
        if (event.button !== 0) {
          return;
        }
        event.preventDefault();
        void appWindow.startDragging();
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
                "drop-shadow(0 0 1.5px rgba(255,255,255,0.85)) drop-shadow(0 0 4.5px rgba(255,255,255,0.45))",
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
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={closeMenu}
            onContextMenu={(event) => {
              event.preventDefault();
              closeMenu();
            }}
          />
          <div
            className="fixed z-50 min-w-40 rounded-md border border-[#c0c0c0] bg-[#f2f2f2]/95 p-1 text-sm text-[#1a1a1a] shadow-2xl backdrop-blur-md"
            style={{ left: menu.x, top: menu.y }}
          >
            {menuItems.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={() => {
                  closeMenu();
                  void item.action();
                }}
                className="flex w-full items-center rounded-md px-3 py-1.5 text-left transition-colors hover:bg-[#0078d7] hover:text-white"
              >
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default App;

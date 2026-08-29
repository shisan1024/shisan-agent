type ContextMenuProps = {
  x: number;
  y: number;
  alwaysOnTop: boolean;
  onPin: () => void;
  onNext: () => void;
  onExit: () => void;
  onClose: () => void;
};

function ContextMenu({
  x,
  y,
  alwaysOnTop,
  onPin,
  onNext,
  onExit,
  onClose,
}: ContextMenuProps) {
  const menuItems = [
    {
      label: alwaysOnTop ? "Unpin" : "Pin",
      action: onPin,
    },
    {
      label: "Next Angelina",
      action: onNext,
    },
    {
      label: "Exit",
      action: onExit,
    },
  ];

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
      />
      <div
        className="fixed z-50 min-w-40 rounded-md border border-[#c0c0c0] bg-[#f2f2f2]/95 p-1 text-sm text-[#1a1a1a] shadow-2xl backdrop-blur-md"
        style={{ left: x, top: y }}
      >
        {menuItems.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => {
              onClose();
              void item.action();
            }}
            className="flex w-full items-center rounded-md px-3 py-1.5 text-left transition-colors hover:bg-[#0078d7] hover:text-white"
          >
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export default ContextMenu;

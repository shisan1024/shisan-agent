import type { ConversationMeta } from "./useConversationHistory";

type SidebarProps = {
  conversations: ConversationMeta[];
  activeId: string;
  onNewConversation: () => void;
  onSelectConversation: (id: string) => void;
};

function Sidebar({
  conversations,
  activeId,
  onNewConversation,
  onSelectConversation,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-56 flex-col border-r border-[#B98070]/30 bg-[#F0DAD3]">
      <div className="p-4">
        <button
          type="button"
          onClick={onNewConversation}
          className="w-full rounded-md bg-[#B98070] px-3 py-1.5 text-sm font-medium text-[#FFF2EE] transition-colors hover:bg-[#8C5B4F]"
        >
          开启新话题
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            type="button"
            onClick={() => onSelectConversation(conversation.id)}
            className={`block w-full truncate px-3 py-2 text-left text-sm transition-colors ${
              conversation.id === activeId
                ? "bg-[#E8CDC4] font-medium text-[#5C3A33]"
                : "text-[#8C5B4F] hover:bg-[#E8CDC4]/60"
            }`}
          >
            {conversation.title}
          </button>
        ))}
      </div>
    </aside>
  );
}

export default Sidebar;

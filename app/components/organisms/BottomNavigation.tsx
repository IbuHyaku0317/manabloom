import type { Tab } from "../../domain/quiz";

type BottomNavigationProps = {
  activeTab: Tab;
  onSelect: (tab: Tab) => void;
};

type NavButtonProps = {
  active: boolean;
  icon: string;
  label: string;
  onClick: () => void;
};

function NavButton({ active, icon, label, onClick }: NavButtonProps) {
  return (
    <button type="button" className={active ? "active" : ""} onClick={onClick}>
      <span>{icon}</span>
      <small>{label}</small>
    </button>
  );
}

export function BottomNavigation({
  activeTab,
  onSelect,
}: BottomNavigationProps) {
  return (
    <nav className="bottom-nav" aria-label="メインメニュー">
      <NavButton
        active={activeTab === "home"}
        icon="⌂"
        label="ホーム"
        onClick={() => onSelect("home")}
      />
      <NavButton
        active={activeTab === "library"}
        icon="▤"
        label="問題"
        onClick={() => onSelect("library")}
      />
      <NavButton
        active={activeTab === "history"}
        icon="◷"
        label="履歴"
        onClick={() => onSelect("history")}
      />
      <NavButton
        active={activeTab === "settings"}
        icon="⚙"
        label="設定"
        onClick={() => onSelect("settings")}
      />
    </nav>
  );
}

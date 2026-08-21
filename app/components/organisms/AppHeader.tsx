type AppHeaderProps = {
  onHome: () => void;
};

export function AppHeader({ onHome }: AppHeaderProps) {
  return (
    <header className="topbar">
      <button className="brand" onClick={onHome} aria-label="ホームへ">
        <span className="brand-mark">M</span>
        <span>
          ManaBloom
          <small>自分でつくる学習帳</small>
        </span>
      </button>
      <span className="offline-pill">
        <i /> この端末に保存
      </span>
    </header>
  );
}

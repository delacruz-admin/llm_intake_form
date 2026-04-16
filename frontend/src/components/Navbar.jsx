export default function Navbar({ user, onLogout, page, onNavigate }) {
  const navItems = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'intake', label: 'New Request' },
  ];

  return (
    <nav className="h-14 flex items-center bg-white border-b-2 border-cooley-red shrink-0 z-50 px-6 justify-between">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 170 38" className="h-[22px] cursor-pointer" aria-label="Cooley" onClick={() => onNavigate('dashboard')}>
          <text x="0" y="30" fontFamily="Georgia, serif" fontSize="36" fontWeight="bold" fill="#C8102E" letterSpacing="-1.5">Cooley</text>
        </svg>
        <div className="w-px h-5 bg-border" />
        <div>
          <div className="text-[0.8rem] font-semibold text-text leading-tight">Architecture Review Board</div>
          <div className="text-[0.67rem] text-text-muted">Technology Infrastructure · Enterprise Architecture</div>
        </div>
        <div className="w-px h-5 bg-border ml-2" />
        <div className="flex items-center gap-1 ml-1">
          {navItems.map((item) => {
            const isActive = page === item.key;
            return (
              <button
                key={item.key}
                onClick={() => onNavigate(item.key)}
                className={`text-[0.74rem] font-semibold rounded-cooley px-3 py-1.5 transition-colors ${
                  isActive
                    ? 'bg-cooley-red text-white'
                    : 'text-text-dim hover:text-cooley-red hover:bg-cooley-red-light'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {user && (
          <span className="text-[0.72rem] text-text-dim">{user.name}</span>
        )}
        <button
          onClick={onLogout}
          className="text-[0.74rem] font-semibold text-text-muted bg-transparent border border-border rounded-cooley px-3 py-1 hover:border-cooley-red hover:text-cooley-red transition-colors"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}

export default function Navbar({ user, onLogout, page, onNavigate }) {
  return (
    <nav className="h-14 flex items-center bg-white border-b-2 border-cooley-red shrink-0 z-50 px-6 justify-between">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 170 38" className="h-[22px] cursor-pointer" aria-label="Cooley" onClick={() => onNavigate('intake')}>
          <text x="0" y="30" fontFamily="Georgia, serif" fontSize="36" fontWeight="bold" fill="#C8102E" letterSpacing="-1.5">Cooley</text>
        </svg>
        <div className="w-px h-5 bg-border" />
        <div>
          <div className="text-[0.8rem] font-semibold text-text leading-tight">
            {page === 'dashboard' ? 'ARB Intake Dashboard' : 'ARB Intake Assistant'}
          </div>
          <div className="text-[0.67rem] text-text-muted">Technology Infrastructure · Enterprise Architecture</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {page !== 'intake' && (
          <button
            onClick={() => onNavigate('intake')}
            className="text-[0.74rem] font-semibold text-cooley-red bg-transparent border-[1.5px] border-cooley-red rounded-cooley px-3 py-1 hover:bg-cooley-red hover:text-white transition-colors"
          >
            + New Request
          </button>
        )}
        {page !== 'dashboard' && (
          <button
            onClick={() => onNavigate('dashboard')}
            className="text-[0.74rem] font-semibold text-cooley-red bg-transparent border-[1.5px] border-cooley-red rounded-cooley px-3 py-1 hover:bg-cooley-red hover:text-white transition-colors"
          >
            Dashboard →
          </button>
        )}
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

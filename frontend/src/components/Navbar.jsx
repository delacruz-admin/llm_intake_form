export default function Navbar({ user, onLogout }) {
  return (
    <nav className="h-14 flex items-center bg-white border-b-2 border-cooley-red shrink-0 z-50 px-6 justify-between">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 170 38" className="h-[22px]" aria-label="Cooley">
          <text x="0" y="30" fontFamily="Georgia, serif" fontSize="36" fontWeight="bold" fill="#C8102E" letterSpacing="-1.5">Cooley</text>
        </svg>
        <div className="w-px h-5 bg-border" />
        <div>
          <div className="text-[0.8rem] font-semibold text-text leading-tight">ARB Intake Assistant</div>
          <div className="text-[0.67rem] text-text-muted">Technology Infrastructure · Enterprise Architecture</div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className="font-mono text-[0.6rem] font-medium text-cooley-red bg-cooley-red-light border border-cooley-red-mid px-2 py-0.5 rounded-sm tracking-wide">
          AI-Assisted
        </span>
        {user && (
          <span className="text-[0.72rem] text-text-dim">{user.name}</span>
        )}
        <button
          onClick={onLogout}
          className="text-[0.74rem] font-semibold text-cooley-red bg-transparent border-[1.5px] border-cooley-red rounded-cooley px-3 py-1 hover:bg-cooley-red hover:text-white transition-colors"
        >
          Sign Out
        </button>
      </div>
    </nav>
  );
}

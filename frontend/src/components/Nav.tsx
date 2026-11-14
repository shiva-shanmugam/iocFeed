import { NavLink } from 'react-router-dom';
export function Nav() {
  return (
    <nav className="h-14 px-6 flex items-center gap-8 border-b border-slate-800 bg-void/90 sticky top-0 z-40">
      <NavLink to="/" className="font-bold tracking-[.2em] text-cyan">
        IOC//FEED
      </NavLink>
      <div className="flex gap-5 text-xs tracking-widest text-slate-400">
        <NavLink to="/dashboard">LANDSCAPE</NavLink>
        <NavLink to="/bulk">BULK TRIAGE</NavLink>
        <NavLink to="/geo">GEO+TIME</NavLink>
      </div>
      <span className="ml-auto text-xs text-emerald-400">● LOCAL DB</span>
    </nav>
  );
}

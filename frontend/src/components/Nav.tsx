import { NavLink } from 'react-router-dom';
export function Nav() {
  return (
    <nav className="fixed inset-y-0 left-0 z-40 w-[184px] border-r border-line bg-base pb-7">
      <div className="h-12 border-b border-line px-3 flex items-center font-semibold">iocfeed</div>
      <div className="px-2 py-3 space-y-1 text-secondary">
        <NavLink to="/" end className="block border-l-2 border-transparent px-2 py-1.5">
          lookup
        </NavLink>
        <NavLink to="/dashboard" className="block border-l-2 border-transparent px-2 py-1.5">
          dashboard
        </NavLink>
        <NavLink to="/bulk" className="block border-l-2 border-transparent px-2 py-1.5">
          bulk triage
        </NavLink>
        <NavLink to="/geo" className="block border-l-2 border-transparent px-2 py-1.5">
          geo / timeline
        </NavLink>
      </div>
      <div className="absolute bottom-10 left-3 right-3 text-[11px] text-secondary">
        source: local db
      </div>
    </nav>
  );
}

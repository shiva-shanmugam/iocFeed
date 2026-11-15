import { NavLink } from 'react-router-dom';
export function Nav() {
  return (
    <nav className="fixed inset-y-0 left-0 z-40 w-[184px] border-r border-line bg-base pb-7">
      <div className="h-12 border-b border-line px-3 flex items-center font-semibold">iocfeed</div>
      <div className="px-2 py-3 space-y-1 text-secondary">
        <NavLink to="/" end className="block border-l-2 border-transparent px-2 py-1.5">
          Explore
        </NavLink>
        <NavLink to="/search" className="block border-l-2 border-transparent px-2 py-1.5">
          Search
        </NavLink>
        <NavLink to="/graph" className="block border-l-2 border-transparent px-2 py-1.5">
          Graph
        </NavLink>
        <NavLink to="/geo" className="block border-l-2 border-transparent px-2 py-1.5">
          Map
        </NavLink>
        <NavLink to="/feeds" className="block border-l-2 border-transparent px-2 py-1.5">
          Feeds
        </NavLink>
      </div>
      <div className="absolute bottom-10 left-2 right-2 text-[11px] text-secondary">
        <p className="section-label px-2 mb-1">Tools</p>
        <NavLink to="/bulk" className="block border-l-2 border-transparent px-2 py-1.5">
          Bulk
        </NavLink>
      </div>
    </nav>
  );
}

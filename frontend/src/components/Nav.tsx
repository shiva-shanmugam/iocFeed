import { NavLink } from 'react-router-dom';
import { useInvestigationTrail } from '../hooks/useInvestigationTrail';
import { AmbientOrbit } from './AmbientOrbit';
export function Nav() {
  const trail = useInvestigationTrail();
  return (
    <nav className="fixed inset-y-0 left-0 z-40 w-[184px] border-r border-line bg-base pb-7 overflow-hidden">
      <AmbientOrbit />
      <div className="h-12 border-b border-line px-3 flex items-center font-semibold">iocfeed</div>
      <div className="px-2 py-3 space-y-1 text-secondary">
        <NavLink to="/" end className="block border-l-2 border-transparent px-2 py-1.5">
          Atlas
        </NavLink>
        <NavLink to="/search" className="block border-l-2 border-transparent px-2 py-1.5">
          Search
        </NavLink>
        <NavLink to="/graph" className="block border-l-2 border-transparent px-2 py-1.5">
          Graph
        </NavLink>
        <NavLink to="/replay" className="block border-l-2 border-transparent px-2 py-1.5">
          Replay
        </NavLink>
        <NavLink to="/geo" className="block border-l-2 border-transparent px-2 py-1.5">
          Map
        </NavLink>
        <NavLink to="/feeds" className="block border-l-2 border-transparent px-2 py-1.5">
          Feeds
        </NavLink>
      </div>
      {trail.items.length > 0 && (
        <section className="nav-trail">
          <div className="nav-trail-heading">
            <span>Investigation trail</span>
            <button onClick={trail.clear}>clear</button>
          </div>
          {trail.items.map((item, index) => (
            <NavLink key={item.key} to={item.path} className="nav-trail-item">
              <span>{String(index + 1).padStart(2, '0')}</span>
              <b>{item.label}</b>
              <small>{item.meta}</small>
            </NavLink>
          ))}
        </section>
      )}
      <div className="absolute bottom-10 left-2 right-2 text-[11px] text-secondary">
        <p className="section-label px-2 mb-1">Tools</p>
        <NavLink to="/bulk" className="block border-l-2 border-transparent px-2 py-1.5">
          Bulk
        </NavLink>
      </div>
    </nav>
  );
}

import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Nav } from './components/Nav';
import { StatusBar } from './components/StatusBar';
import { AmbientOrbit } from './components/AmbientOrbit';
const Home = lazy(() => import('./pages/Home').then((x) => ({ default: x.Home })));
const Investigation = lazy(() =>
  import('./pages/Investigation').then((x) => ({ default: x.Investigation })),
);
const Dashboard = lazy(() => import('./pages/Dashboard').then((x) => ({ default: x.Dashboard })));
const Bulk = lazy(() => import('./pages/Bulk').then((x) => ({ default: x.Bulk })));
const GeoTimeline = lazy(() =>
  import('./pages/GeoTimeline').then((x) => ({ default: x.GeoTimeline })),
);
const Feeds = lazy(() => import('./pages/Feeds').then((x) => ({ default: x.Feeds })));
const GraphStart = lazy(() =>
  import('./pages/GraphStart').then((x) => ({ default: x.GraphStart })),
);
const Collection = lazy(() =>
  import('./pages/Collection').then((x) => ({ default: x.Collection })),
);
const IOCRecord = lazy(() => import('./pages/IOCRecord').then((x) => ({ default: x.IOCRecord })));
const Evidence = lazy(() => import('./pages/Evidence').then((x) => ({ default: x.Evidence })));
export default function App() {
  return (
    <div className="app-shell min-h-screen bg-base text-primary">
      <div className="workspace-backdrop" aria-hidden="true">
        <AmbientOrbit placement="workspace" />
      </div>
      <Nav />
      <div className="workspace-content ml-[184px] pb-7 min-h-screen">
        <Suspense fallback={<main className="p-4 text-secondary">loading module...</main>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/search" element={<Home />} />
            <Route path="/investigate/:id" element={<Investigation />} />
            <Route path="/graph" element={<GraphStart />} />
            <Route path="/collection/:kind/:value" element={<Collection />} />
            <Route path="/ioc/:id" element={<IOCRecord />} />
            <Route path="/evidence/:id/:source" element={<Evidence />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/bulk" element={<Bulk />} />
            <Route path="/geo" element={<GeoTimeline />} />
            <Route path="/feeds" element={<Feeds />} />
          </Routes>
        </Suspense>
      </div>
      <StatusBar />
    </div>
  );
}

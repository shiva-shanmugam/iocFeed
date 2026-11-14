import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Nav } from './components/Nav';
import { StatusBar } from './components/StatusBar';
const Home = lazy(() => import('./pages/Home').then((x) => ({ default: x.Home })));
const Investigation = lazy(() =>
  import('./pages/Investigation').then((x) => ({ default: x.Investigation })),
);
const Dashboard = lazy(() => import('./pages/Dashboard').then((x) => ({ default: x.Dashboard })));
const Bulk = lazy(() => import('./pages/Bulk').then((x) => ({ default: x.Bulk })));
const GeoTimeline = lazy(() =>
  import('./pages/GeoTimeline').then((x) => ({ default: x.GeoTimeline })),
);
export default function App() {
  return (
    <>
      <Nav />
      <Suspense
        fallback={
          <main className="h-[calc(100vh-6rem)] grid place-items-center text-slate-500">
            Loading module…
          </main>
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/investigate/:id" element={<Investigation />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/bulk" element={<Bulk />} />
          <Route path="/geo" element={<GeoTimeline />} />
        </Routes>
      </Suspense>
      <StatusBar />
    </>
  );
}

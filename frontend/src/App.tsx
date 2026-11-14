import {Routes,Route} from 'react-router-dom'; import {Nav} from './components/Nav'; import {StatusBar} from './components/StatusBar'; import {Home} from './pages/Home';import {Investigation} from './pages/Investigation';import {Dashboard} from './pages/Dashboard';import {Bulk} from './pages/Bulk';import {GeoTimeline} from './pages/GeoTimeline';
export default function App(){return <><Nav/><Routes><Route path="/" element={<Home/>}/><Route path="/investigate/:id" element={<Investigation/>}/><Route path="/dashboard" element={<Dashboard/>}/><Route path="/bulk" element={<Bulk/>}/><Route path="/geo" element={<GeoTimeline/>}/></Routes><StatusBar/></>}




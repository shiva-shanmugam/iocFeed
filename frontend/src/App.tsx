import {Routes,Route} from 'react-router-dom'; import {Nav} from './components/Nav'; import {StatusBar} from './components/StatusBar'; import {Home} from './pages/Home'; import {Placeholder} from './pages/Placeholder';import {Investigation} from './pages/Investigation';import {Dashboard} from './pages/Dashboard';import {Bulk} from './pages/Bulk';
export default function App(){return <><Nav/><Routes><Route path="/" element={<Home/>}/><Route path="/investigate/:id" element={<Investigation/>}/><Route path="/dashboard" element={<Dashboard/>}/><Route path="/bulk" element={<Bulk/>}/><Route path="/geo" element={<Placeholder title="Geo + timeline"/>}/></Routes><StatusBar/></>}



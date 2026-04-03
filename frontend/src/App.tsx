import { Route, Routes } from 'react-router-dom'
import KivoPublic from './KivoPublic'
import PanelLogin from './PanelLogin'
import PanelAdmin from './PanelAdmin'
import PanelAsesor from './PanelAsesor'
import PanelSupremo from './PanelSupremo'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<KivoPublic />} />
      <Route path="/:empresaSlug" element={<KivoPublic />} />
      <Route path="/panel" element={<PanelLogin />} />
      <Route path="/panel/admin" element={<PanelAdmin />} />
      <Route path="/panel/asesor" element={<PanelAsesor />} />
      <Route path="/panel/supremo" element={<PanelSupremo />} />
    </Routes>
  )
}

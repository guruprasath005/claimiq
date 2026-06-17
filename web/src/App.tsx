import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import CaseDetail from './pages/CaseDetail'
import Cases from './pages/Cases'
import Reports from './pages/Reports'
import Settings from './pages/Settings'
import NewCase from './pages/NewCase'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"          element={<Dashboard />} />
        <Route path="/new-case"  element={<NewCase />} />
        <Route path="/cases"     element={<Cases />} />
        <Route path="/case/:id"  element={<CaseDetail />} />
        <Route path="/reports"   element={<Reports />} />
        <Route path="/settings"  element={<Settings />} />
      </Routes>
    </Layout>
  )
}

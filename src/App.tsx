import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { History } from './components/History'
import { Practice } from './components/Practice'
import { ProviderSettings } from './components/ProviderSettings'

function navLinkClassName({ isActive }: { isActive: boolean }) {
  return `px-3 py-2 text-sm font-medium ${
    isActive ? 'text-gray-900' : 'text-gray-500 hover:text-gray-700'
  }`
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-svh">
        <nav className="flex justify-center gap-2 border-b border-gray-200 py-2">
          <NavLink to="/" end className={navLinkClassName}>
            Practice
          </NavLink>
          <NavLink to="/history" className={navLinkClassName}>
            History
          </NavLink>
          <NavLink to="/settings" className={navLinkClassName}>
            Settings
          </NavLink>
        </nav>
        <Routes>
          <Route path="/" element={<Practice />} />
          <Route path="/history" element={<History />} />
          <Route path="/settings" element={<ProviderSettings />} />
        </Routes>
      </div>
    </BrowserRouter>
  )
}

export default App

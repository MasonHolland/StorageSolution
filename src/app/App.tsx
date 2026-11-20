import { lazy, Suspense, useEffect } from 'react'
import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { BoxIcon, LayoutIcon, ScanIcon, SearchIcon, SettingsIcon } from './icons'
import { ToastProvider } from './ui'
import { requestPersistentStorage } from '../lib/storage'
const ContainersPage = lazy(() => import('../features/containers/ContainersPage').then((m) => ({ default: m.ContainersPage })))
const ContainerDetailPage = lazy(() => import('../features/containers/ContainerDetailPage').then((m) => ({ default: m.ContainerDetailPage })))
const ContainerFormPage = lazy(() => import('../features/containers/ContainerFormPage').then((m) => ({ default: m.ContainerFormPage })))
const SpacesPage = lazy(() => import('../features/spaces/SpacesPage').then((m) => ({ default: m.SpacesPage })))
const SpaceLayoutPage = lazy(() => import('../features/layout/SpaceLayoutPage').then((m) => ({ default: m.SpaceLayoutPage })))
const SearchPage = lazy(() => import('../features/search/SearchPage').then((m) => ({ default: m.SearchPage })))
const ScanPage = lazy(() => import('../features/labels/ScanPage').then((m) => ({ default: m.ScanPage })))
const LabelsPage = lazy(() => import('../features/labels/LabelsPage').then((m) => ({ default: m.LabelsPage })))
const SettingsPage = lazy(() => import('../features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })))

const NAV = [
  { to: '/', label: 'Boxes', icon: BoxIcon, end: true },
  { to: '/layout', label: 'Layout', icon: LayoutIcon },
  { to: '/search', label: 'Search', icon: SearchIcon },
  { to: '/scan', label: 'Scan', icon: ScanIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

export default function App() {
  useEffect(() => {
    // Ask once at start-up; browsers that need a user gesture simply say no and we ask again from Settings.
    requestPersistentStorage().catch(() => {})
  }, [])

  return (
    <HashRouter>
      <ToastProvider>
        <div className="app">
          <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<ContainersPage />} />
            <Route path="/c/new" element={<ContainerFormPage />} />
            <Route path="/c/:id" element={<ContainerDetailPage />} />
            <Route path="/c/:id/edit" element={<ContainerFormPage />} />
            <Route path="/layout" element={<SpacesPage />} />
            <Route path="/layout/:spaceId" element={<SpaceLayoutPage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/scan" element={<ScanPage />} />
            <Route path="/labels" element={<LabelsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<ContainersPage />} />
          </Routes>
          </Suspense>
          <nav className="bottom-nav" aria-label="Main">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}>
                <Icon />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </ToastProvider>
    </HashRouter>
  )
}

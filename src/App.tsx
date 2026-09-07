import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Sun, Moon, Settings } from 'lucide-react'
import { useTheme } from './store/theme'
import ModelPicker from './components/ModelPicker'
import AddModelModal from './components/AddModelModal'

/** Clean shell: just a slim top navbar — logo left, model + theme right. */
export default function App() {
  const { theme, toggle } = useTheme()
  const loc = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
  }, [loc.pathname])

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-xl no-print">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-3 sm:px-5">
          {/* Brand */}
          <Link to="/" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white shadow-glow">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z" /></svg>
            </span>
            <span className="text-lg font-extrabold tracking-tight">
              Gen<span className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 bg-clip-text text-transparent">exam</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <ModelPicker />
            <button className="btn-ghost !border-transparent !bg-transparent !p-2.5" onClick={toggle} aria-label="Toggle theme">
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <Link to="/settings" className="hidden btn-ghost !border-transparent !bg-transparent !p-2.5 sm:block" aria-label="Settings">
              <Settings size={17} />
            </Link>
          </div>
        </div>
        {/* mobile settings row */}
        {menuOpen && null}
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col">
        <Outlet />
      </main>

      {/* small popup for adding a model — lives at app level so navbar & home can open it */}
      <AddModelModal />
    </div>
  )
}

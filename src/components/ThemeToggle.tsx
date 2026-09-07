import { useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from '../store/theme'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()
  return (
    <button className="btn-ghost !p-2.5" onClick={toggle} aria-label="Toggle theme">
      {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  )
}

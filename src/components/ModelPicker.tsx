import { Link } from 'react-router-dom'
import { Settings } from 'lucide-react'
import { useModels } from '../store/models'

export default function ModelPicker() {
  const { models, activeModelId, setActive } = useModels()

  if (models.length === 0) {
    return (
      <Link
        to="/settings"
        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-600 transition hover:bg-amber-500/20 dark:text-amber-400"
      >
        <Settings size={13} /> Add a model
      </Link>
    )
  }

  return (
    <select
      value={activeModelId ?? ''}
      onChange={(e) => setActive(e.target.value)}
      className="max-w-[130px] cursor-pointer truncate rounded-xl border border-line bg-surface px-2 py-2 text-xs font-medium text-fg outline-none transition hover:bg-surface2 focus:border-indigo-500 sm:max-w-[190px] sm:px-2.5"
      title="Active AI model"
    >
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.vision ? '👁 ' : ''}
          {m.label}
        </option>
      ))}
    </select>
  )
}

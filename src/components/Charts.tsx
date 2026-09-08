// Tiny dependency-free SVG charts

export function LineChart({ data, height = 120 }: { data: { label: string; value: number }[]; height?: number }) {
  if (data.length === 0) return null
  const W = 520
  const H = height
  const pad = { t: 10, r: 10, b: 22, l: 28 }
  const max = 100
  const xs = (i: number) => pad.l + (i * (W - pad.l - pad.r)) / Math.max(1, data.length - 1)
  const ys = (v: number) => pad.t + (1 - v / max) * (H - pad.t - pad.b)
  const pts = data.map((d, i) => `${xs(i)},${ys(d.value)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
      {[0, 25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={W - pad.r} y1={ys(g)} y2={ys(g)} stroke="rgb(var(--c-line))" strokeWidth="1" strokeDasharray={g === 0 ? '' : '3 4'} />
          <text x={pad.l - 6} y={ys(g) + 3} textAnchor="end" fontSize="8" fill="rgb(var(--c-faint))">{g}</text>
        </g>
      ))}
      <polyline points={pts} fill="none" stroke="rgb(99 102 241)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={i}>
          <circle cx={xs(i)} cy={ys(d.value)} r="4" fill="rgb(99 102 241)" stroke="rgb(var(--c-surface))" strokeWidth="2" />
          {i % Math.ceil(data.length / 6) === 0 && (
            <text x={xs(i)} y={H - 6} textAnchor="middle" fontSize="8" fill="rgb(var(--c-faint))">{d.label}</text>
          )}
        </g>
      ))}
    </svg>
  )
}

export function Ring({ pct, size = 120, stroke = 10, children }: { pct: number; size?: number; stroke?: number; children?: React.ReactNode }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const color = pct >= 75 ? 'rgb(16 185 129)' : pct >= 45 ? 'rgb(245 158 11)' : 'rgb(239 68 68)'
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--c-line))" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(Math.min(100, pct) / 100) * c} ${c}`}
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1)' }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">{children}</div>
    </div>
  )
}

export function Bar({ pct, className = '' }: { pct: number; className?: string }) {
  const color = pct >= 75 ? 'from-emerald-500 to-emerald-400' : pct >= 45 ? 'from-amber-500 to-amber-400' : pct > 0 ? 'from-red-500 to-red-400' : 'from-line to-line'
  return (
    <div className={`h-2 overflow-hidden rounded-full bg-line ${className}`}>
      <div className={`h-full rounded-full bg-gradient-to-r transition-all duration-700 ${color}`} style={{ width: `${Math.max(2, pct)}%` }} />
    </div>
  )
}

import { GraduationCap, Home, HeartPulse, Briefcase, Layers } from 'lucide-react'
import { CATEGORY_NAMES } from '@/earmarkTypes'

const ICONS = [GraduationCap, Home, HeartPulse, Briefcase, Layers]

const COLORS: Record<number, { bg: string; text: string }> = {
  0: { bg: 'rgba(26,128,71,0.10)', text: '#1a8047' },
  1: { bg: 'rgba(18,45,69,0.08)', text: '#122d45' },
  2: { bg: 'rgba(186,43,76,0.08)', text: '#ba2b4c' },
  3: { bg: 'rgba(16,97,166,0.10)', text: '#1061a6' },
  4: { bg: 'rgba(107,101,128,0.10)', text: '#6b6580' },
}

export default function CategoryBadge({ category }: { category: number }) {
  const Icon = ICONS[category] ?? Layers
  const color = COLORS[category] ?? COLORS[4]
  const name = CATEGORY_NAMES[category] ?? 'Other'

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: color.bg, color: color.text }}
    >
      <Icon className="size-3" />
      {name}
    </span>
  )
}

import { GraduationCap, House, HeartPulse, Briefcase, Layers } from 'lucide-react'
import { CATEGORY_NAMES, CATEGORY_COLORS } from '@/earmarkTypes'

const ICONS = [GraduationCap, House, HeartPulse, Briefcase, Layers]

export default function CategoryBadge({ category }: { category: number }) {
  const Icon = ICONS[category] ?? Layers
  const color = CATEGORY_COLORS[category] ?? CATEGORY_COLORS[4]
  const name = CATEGORY_NAMES[category] ?? 'Other'

  return (
    <span
      className="inline-flex items-center gap-1 rounded-pill px-2.5 py-1 text-xs font-semibold"
      style={{ background: color.bg, color: color.text }}
    >
      <Icon className="size-3" aria-hidden />
      {name}
    </span>
  )
}

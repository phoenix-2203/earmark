/**
 * ThemeToggle — cycles System → Light → Dark.
 * Small icon button with a tooltip; works in SiteHeader, app header, and mobile menu.
 */
import { Monitor, Sun, Moon } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import type { ThemeChoice } from '@/lib/theme'

const NEXT: Record<ThemeChoice, ThemeChoice> = { system: 'light', light: 'dark', dark: 'system' }

const LABELS: Record<ThemeChoice, string> = {
  system: 'Theme: System',
  light:  'Theme: Light',
  dark:   'Theme: Dark',
}

const ICONS: Record<ThemeChoice, typeof Monitor> = {
  system: Monitor,
  light:  Sun,
  dark:   Moon,
}

interface Props {
  /** Extra Tailwind classes */
  className?: string
}

export default function ThemeToggle({ className = '' }: Props) {
  const { choice, setChoice } = useTheme()
  const Icon = ICONS[choice]

  return (
    <button
      title={LABELS[choice]}
      aria-label={LABELS[choice]}
      onClick={() => setChoice(NEXT[choice])}
      className={`rounded p-1.5 text-[var(--muted)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)] focus-visible:outline-2 focus-visible:outline-[var(--focus)] transition-colors ${className}`}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  )
}

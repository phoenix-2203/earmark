/**
 * "Who it's for" section — interactive tab list with FlowScene per use case.
 * id="use-cases" preserved for header nav link.
 * Order: Project budgets · Staff allowances · Grants & scholarships ·
 *        Aid & relief · Event budgets · Household bills · Money sent home
 */
import { useState, useRef, useCallback, type KeyboardEvent } from 'react'
import {
  Briefcase, Laptop, Server, Printer,
  Building2, BedDouble, Bus,
  Landmark, GraduationCap, FlaskConical,
  HeartHandshake, Pill, Stethoscope,
  PartyPopper, UtensilsCrossed, MapPin,
  Home, Zap, Wifi,
  Plane, School, Hospital,
  Zap as ZapIcon,
} from 'lucide-react'
import FlowScene, { type SceneParty } from '@/components/site/FlowScene'

// Silence duplicate import: Zap is used for Brightline + household bills
const _ZapIcon = ZapIcon

interface UseCase {
  label:     string
  funder:    SceneParty
  recipient: SceneParty
  payees:    [SceneParty, SceneParty]
  blocked:   string
  potTitle:  string
  amountNum: number
  sentence:  string
}

const CASES: UseCase[] = [
  {
    label:     'Project budgets',
    funder:    { label: 'A client',              Icon: Briefcase },
    recipient: { label: 'The agency / freelancer', Icon: Laptop  },
    payees:    [
      { label: 'Cloud hosting',  Icon: Server  },
      { label: 'Print shop',     Icon: Printer },
    ],
    blocked:  "Freelancer's own wallet",
    potTitle: 'Website redesign · Phase 1',
    amountNum: 4000,
    sentence: 'A job budget that can only be spent on the job.',
  },
  {
    label:     'Staff allowances',
    funder:    { label: 'A company',        Icon: Building2  },
    recipient: { label: 'Travelling staff', Icon: Building2  },
    payees:    [
      { label: 'Approved hotel',  Icon: BedDouble },
      { label: 'Transport co.',   Icon: Bus        },
    ],
    blocked:  "Staff member's wallet",
    potTitle: 'Travel allowance · Q4',
    amountNum: 800,
    sentence: 'Travel budgets that can only pay for travel.',
  },
  {
    label:     'Grants & scholarships',
    funder:    { label: 'A foundation',         Icon: Landmark     },
    recipient: { label: 'Student / researcher', Icon: GraduationCap },
    payees:    [
      { label: 'The university', Icon: Landmark     },
      { label: 'Lab supplier',   Icon: FlaskConical },
    ],
    blocked:  "Student's wallet",
    potTitle: 'Research grant 2026',
    amountNum: 5000,
    sentence: 'Funding that reaches the institution, with receipts for every payment.',
  },
  {
    label:     'Aid & relief',
    funder:    { label: 'An NGO',       Icon: HeartHandshake },
    recipient: { label: 'A household', Icon: Home            },
    payees:    [
      { label: 'Pharmacy', Icon: Pill        },
      { label: 'Clinic',   Icon: Stethoscope },
    ],
    blocked:  "Household's own wallet",
    potTitle: 'Essential support',
    amountNum: 300,
    sentence: 'Support that can only be used for essentials.',
  },
  {
    label:     'Event budgets',
    funder:    { label: 'A company or organiser', Icon: PartyPopper    },
    recipient: { label: 'Event planner',          Icon: PartyPopper    },
    payees:    [
      { label: 'Caterer',   Icon: UtensilsCrossed },
      { label: 'Venue',     Icon: MapPin           },
    ],
    blocked:  "Planner's wallet",
    potTitle: 'Annual conference budget',
    amountNum: 3000,
    sentence: "The planner pays vendors; the budget can't leak.",
  },
  {
    label:     'Household bills',
    funder:    { label: 'Parent / flatmate',  Icon: Home },
    recipient: { label: 'Bill payer',         Icon: Home },
    payees:    [
      { label: 'Electricity co.',   Icon: Zap  },
      { label: 'Internet provider', Icon: Wifi },
    ],
    blocked:  "Bill payer's wallet",
    potTitle: 'Household bills · Oct',
    amountNum: 200,
    sentence: "Bills get paid; the money can't be spent on anything else.",
  },
  {
    label:     'Money sent home',
    funder:    { label: 'Someone abroad', Icon: Plane    },
    recipient: { label: 'A relative',    Icon: Home     },
    payees:    [
      { label: 'The landlord', Icon: Home   },
      { label: 'The school',   Icon: School },
    ],
    blocked:  "Relative's own wallet",
    potTitle: 'School fees · Term 1',
    amountNum: 500,
    sentence: 'Help with school fees and rent without worrying where it goes.',
  },
]

// Suppress unused import warning for Hospital (kept in import for completeness)
void (Hospital as unknown)
void (_ZapIcon as unknown)

export default function LandingUseCases() {
  const [active, setActive] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  const handleKey = useCallback((e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let next = idx
    if (e.key === 'ArrowRight') next = (idx + 1) % CASES.length
    else if (e.key === 'ArrowLeft') next = (idx - 1 + CASES.length) % CASES.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = CASES.length - 1
    else return
    e.preventDefault()
    setActive(next)
    tabRefs.current[next]?.focus()
  }, [])

  const uc = CASES[active]

  return (
    <section
      id="use-cases"
      className="border-b border-[var(--line)] bg-[var(--bg)]"
      aria-labelledby="usecases-heading"
    >
      <div className="mx-auto max-w-[1040px] px-4 py-16 sm:py-20">
        <h2
          id="usecases-heading"
          className="mb-2 text-2xl font-semibold text-[var(--ink)] sm:text-3xl"
          style={{ letterSpacing: '-0.02em' }}
        >
          Who it's for
        </h2>
        <p className="mb-8 text-base text-[var(--ink-2)]">
          Earmark works wherever one person funds an expense and another person pays the bills.
        </p>

        {/* ── Tab chips ── */}
        <div
          role="tablist"
          aria-label="Use cases"
          className="mb-8 flex gap-2 overflow-x-auto pb-1"
          style={{ scrollbarWidth: 'none' }}
        >
          {CASES.map((c, i) => (
            <button
              key={c.label}
              role="tab"
              id={`tab-${i}`}
              aria-selected={active === i}
              aria-controls="tabpanel-usecases"
              ref={el => { tabRefs.current[i] = el }}
              tabIndex={active === i ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={e => handleKey(e, i)}
              className="shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
              style={{
                background:  active === i ? 'var(--accent)'  : 'var(--surface)',
                borderColor: active === i ? 'var(--accent)'  : 'var(--line)',
                color:       active === i ? 'var(--on-accent)' : 'var(--ink-2)',
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* ── Tab panel ── */}
        <div
          id="tabpanel-usecases"
          role="tabpanel"
          aria-labelledby={`tab-${active}`}
          className="space-y-6"
        >
          {/* Three-step strip */}
          <div className="grid gap-4 sm:grid-cols-3">
            {([
              { title: 'Funder',          party: uc.funder    },
              { title: 'Recipient',       party: uc.recipient },
              { title: 'Approved payees', party: undefined,
                customContent: (
                  <div className="space-y-1">
                    {uc.payees.map(p => (
                      <div key={p.label} className="flex items-center gap-1.5 text-sm text-[var(--ink-2)]">
                        <p.Icon className="size-3.5 text-[var(--accent)]" aria-hidden />
                        {p.label}
                      </div>
                    ))}
                  </div>
                ),
              },
            ] as Array<{ title: string; party?: SceneParty; customContent?: React.ReactNode }>).map(({ title, party, customContent }, si) => (
              <div
                key={title}
                className="rounded-card border p-4 shadow-card"
                style={{
                  background:  'var(--surface)',
                  borderColor: si === 2 ? 'var(--accent)' : 'var(--line)',
                }}
              >
                <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-[var(--muted)]">{title}</p>
                {customContent ?? (
                  <div className="flex items-center gap-2">
                    {party && <party.Icon className="size-4 text-[var(--accent)]" aria-hidden />}
                    <p className="text-sm font-medium text-[var(--ink)]">{party?.label}</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* FlowScene — full width */}
          <FlowScene
            key={active}
            funder={uc.funder}
            recipient={uc.recipient}
            payees={uc.payees}
            blocked={uc.blocked}
            potTitle={uc.potTitle}
            amountNum={uc.amountNum}
            currency="USDC"
          />

          <p className="text-sm text-[var(--ink-2)]">{uc.sentence}</p>
        </div>

        {/* Footer note */}
        <p className="mt-8 text-sm text-[var(--muted)]">
          In every case, the person spending can't pay themselves or anyone the funder hasn't approved.
        </p>
      </div>
    </section>
  )
}

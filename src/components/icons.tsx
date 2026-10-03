import {
  ArrowLeft, ArrowRight, BookOpen, Building2, BriefcaseBusiness, Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Circle, CircleAlert, CircleCheck, CircleDot, CircleHelp, ExternalLink, FileText,
  House, Info, Landmark, Languages, ListChecks, Menu, Minus, Moon, Network, PieChart, Radar, Scale, Search, Settings, ShieldAlert, SlidersHorizontal, Sparkles, Square, SquareCheck,
  Sun, TrendingUp, TriangleAlert, UserCog, Wallet, X, Link2, LayoutDashboard, Globe2, Plus, LocateFixed, Plane, User, Bell, MapPin, ClipboardList, LogIn, LogOut, ShieldCheck, FastForward, Send, Ellipsis, CircleUserRound,
} from 'lucide-react'

/** One centralized icon system: lucide SVG icons, same stroke width, same default size. Never use emojis for functional UI. */
const ICONS = {
  business: Building2, ownership: Network, pie: PieChart, legal: Scale, employment: BriefcaseBusiness, risk: ShieldAlert, documents: FileText, plan: ListChecks,
  search: Search, ai: Sparkles, language: Languages, settings: Settings, light: Sun, dark: Moon, back: ArrowLeft, next: ArrowRight,
  ok: CircleCheck, warn: TriangleAlert, info: Info, help: CircleHelp, alert: CircleAlert, down: ChevronDown, up: ChevronUp, left: ChevronLeft, right: ChevronRight, external: ExternalLink, home: House, menu: Menu, close: X,
  check: Check, square: Square, squareCheck: SquareCheck, circle: Circle, circleDot: CircleDot, funding: Wallet, control: SlidersHorizontal, economic: TrendingUp,
  management: UserCog, ownershipCat: Landmark, monitor: Radar, sources: Link2, culture: BookOpen, overview: LayoutDashboard, dash: Minus, globe: Globe2, plus: Plus, minus: Minus, target: LocateFixed, plane: Plane,
  user: User, bell: Bell, pin: MapPin, posts: ClipboardList, login: LogIn, logout: LogOut, shield: ShieldCheck, fastForward: FastForward, send: Send, more: Ellipsis, profile: CircleUserRound,
} as const
export type IconName = keyof typeof ICONS

export function Icon({ name, size = 18, className }: { name: IconName; size?: number; className?: string }) {
  const C = ICONS[name]
  return <C size={size} strokeWidth={1.75} className={`shrink-0 ${className ?? ''}`} aria-hidden="true" />
}

/** Country marker without emoji flags (they render as letters on Windows). */
export function CountryBadge({ c, className }: { c: 'TH' | 'CN'; className?: string }) {
  return <span className={`inline-flex items-center justify-center rounded border border-line bg-surface2 text-[10px] font-bold tracking-wide px-1.5 py-0.5 text-muted ${className ?? ''}`} aria-hidden="true">{c}</span>
}

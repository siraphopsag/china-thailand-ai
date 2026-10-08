import { common } from './common.js'
import { data } from './data.js'
import { pages } from './pages.js'
import { ux } from './ux.js'
import { legal } from './legal.js'
import { journey } from './journey.js'
import { geo } from './geo.js'
import { provinces } from './provinces.js'
import { brand } from './brand.js'
import { plan } from './plan.js'
import { jobboard } from './jobboard.js'
import { entry } from './entry.js'
import { home } from './home.js'
import { match } from './match.js'
import { cases } from './cases.js'
import { safety } from './safety.js'
import { design } from './design.js'
import { market } from './market.js'
import { ai } from './ai.js'

/** Every message is [th, zh, en]. Later spreads override earlier keys (ux.ts = simplified copy). */
export const messages = { ...common, ...data, ...pages, ...ux, ...legal, ...journey, ...geo, ...provinces, ...brand, ...plan, ...jobboard, ...entry, ...home, ...match, ...cases, ...safety, ...design, ...market, ...ai }
export type MsgKey = keyof typeof messages

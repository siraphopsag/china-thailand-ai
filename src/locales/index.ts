import { common } from './common.js'
import { intake } from './intake.js'
import { engine } from './engine.js'
import { data } from './data.js'
import { pages } from './pages.js'
import { ux } from './ux.js'
import { legal } from './legal.js'
import { journey } from './journey.js'
import { geo } from './geo.js'
import { provinces } from './provinces.js'
import { value } from './value.js'
import { brand } from './brand.js'
import { kb } from './kb.js'
import { plan } from './plan.js'
import { jobboard } from './jobboard.js'
import { review } from './review.js'
import { entry } from './entry.js'

/** Every message is [th, zh, en]. Later spreads override earlier keys (ux.ts = simplified copy). */
export const messages = { ...common, ...intake, ...engine, ...data, ...pages, ...ux, ...legal, ...journey, ...geo, ...provinces, ...value, ...brand, ...kb, ...plan, ...jobboard, ...review, ...entry }
export type MsgKey = keyof typeof messages

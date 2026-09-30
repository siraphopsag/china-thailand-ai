import { common } from './common.js'
import { intake } from './intake.js'
import { engine } from './engine.js'
import { data } from './data.js'
import { pages } from './pages.js'
import { ux } from './ux.js'

/** Every message is [th, zh, en]. Later spreads override earlier keys (ux.ts = simplified copy). */
export const messages = { ...common, ...intake, ...engine, ...data, ...pages, ...ux }
export type MsgKey = keyof typeof messages

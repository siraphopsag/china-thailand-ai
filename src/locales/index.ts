import { common } from './common.js'
import { intake } from './intake.js'
import { engine } from './engine.js'
import { data } from './data.js'
import { pages } from './pages.js'

/** Every message is [th, zh, en]. Add a language = add a column + one entry in i18n/core LANGS. */
export const messages = { ...common, ...intake, ...engine, ...data, ...pages }
export type MsgKey = keyof typeof messages

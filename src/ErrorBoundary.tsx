import { Component, type ReactNode } from 'react'
import { tr } from './i18n/core'
import { clearSavedData } from './storage'

/** a page's code could not be downloaded (offline, or a dropped connection) — not a fault in the saved data */
export const isNetworkError = (e: unknown) => (typeof navigator !== 'undefined' && navigator.onLine === false)
  || /dynamically imported module|Importing a module script failed|Loading (CSS )?chunk|Failed to fetch|NetworkError/i.test(String((e as Error | undefined)?.message ?? e))

/** Friendly localized fallback — never shows stack traces. Offers a way out even if saved data is what breaks the page. */
export class ErrorBoundary extends Component<{ children: ReactNode; compact?: boolean }, { failed: boolean; net: boolean }> {
  state = { failed: false, net: false }
  static getDerivedStateFromError(e: unknown) { return { failed: true, net: isNetworkError(e) } }
  componentDidCatch() { /* details intentionally not shown to users */ }
  render() {
    if (!this.state.failed) return this.props.children
    // QA, Oct 2026: offline, the page offered to wipe the saved data — now it offers to try again and says the data is safe
    const card = this.state.net ? (
      <div className="card max-w-md text-center mx-auto" role="alert">
        <h1 className="text-lg font-semibold">{tr('err.net')}</h1>
        <p className="text-sm text-muted mt-2">{tr('err.netNote')}</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
          <button className="btn-primary" onClick={() => { window.location.reload() }}>{tr('err.retry')}</button>
          <button className="btn-ghost" onClick={() => { window.location.href = '/' }}>{tr('err.home')}</button>
        </div>
      </div>
    ) : (
      <div className="card max-w-md text-center mx-auto" role="alert">
        <h1 className="text-lg font-semibold">{tr('err.generic')}</h1>
        <p className="text-sm text-muted mt-2">{tr('err.resetNote')}</p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center mt-4">
          <button className="btn-primary" onClick={() => { window.location.href = '/' }}>{tr('err.home')}</button>
          <button className="btn-ghost" onClick={() => { clearSavedData(); window.location.href = '/' }}>{tr('err.reset')}</button>
        </div>
      </div>
    )
    return this.props.compact ? <div className="py-10">{card}</div> : <div className="min-h-screen grid place-items-center p-6">{card}</div>
  }
}

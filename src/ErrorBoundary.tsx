import { Component, type ReactNode } from 'react'
import { tr } from './i18n/core'
import { clearSavedData } from './storage'

/** Friendly localized fallback — never shows stack traces. Offers a way out even if saved data is what breaks the page. */
export class ErrorBoundary extends Component<{ children: ReactNode; compact?: boolean }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { /* details intentionally not shown to users */ }
  render() {
    if (!this.state.failed) return this.props.children
    const card = (
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

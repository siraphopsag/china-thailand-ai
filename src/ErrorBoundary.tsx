import { Component, type ReactNode } from 'react'
import { tr } from './i18n/core'

/** Friendly localized fallback — never shows stack traces or technical details to users. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { /* details intentionally not shown to users */ }
  render() {
    if (!this.state.failed) return this.props.children
    return <div className="min-h-screen grid place-items-center p-6 text-center"><div className="card max-w-md"><h1 className="h2">{tr('err.generic')}</h1><button className="btn-primary mt-4" onClick={() => { window.location.href = '/' }}>{tr('err.home')}</button></div></div>
  }
}

import { Component, type ReactNode } from 'react'
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch() { /* details intentionally not shown to users */ }
  render() {
    if (!this.state.failed) return this.props.children
    return <div className="min-h-screen grid place-items-center p-6 text-center"><div className="card max-w-md"><h1 className="h2">ระบบไม่สามารถดำเนินการได้ในขณะนี้</h1><p className="text-slate-600 mt-2">กรุณาลองใหม่อีกครั้ง</p><button className="btn-primary mt-4" onClick={() => { window.location.href = '/' }}>กลับหน้าแรก</button></div></div>
  }
}

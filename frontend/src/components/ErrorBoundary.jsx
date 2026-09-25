import { Component } from 'react'

/**
 * Last line of defence against a render error blanking the entire app.
 *
 * React unmounts the whole tree when a render throws and nothing catches it,
 * which leaves an empty cream page with no way forward. This keeps a way back.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled render error', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6">
        <div className="max-w-sm text-center">
          <div className="readout-label">Something went wrong</div>
          <h1 className="mt-2 font-display text-2xl font-semibold text-ink">
            This page hit an unexpected error.
          </h1>
          <p className="mt-2 text-sm text-muted">
            Reloading usually clears it. If it keeps happening, head back to the start.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-pulse-dark"
            >
              Reload
            </button>
            <a
              href="/"
              className="rounded border border-line px-4 py-2 text-sm font-medium text-ink hover:border-ink"
            >
              Go home
            </a>
          </div>
        </div>
      </div>
    )
  }
}

import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  // 'app' — full-screen recovery, for the boundary wrapping the whole tree.
  // 'pane' — a smaller in-place fallback, for a boundary scoped to one panel
  // (e.g. the scripture pane) so the rest of the app keeps working.
  variant: 'app' | 'pane'
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

// Catches render-time throws in its subtree. Resetting `hasError` (via retry,
// or a remount when the caller keys this on whatever data produced the
// throw) is the only recovery path — there is no telemetry hook here by
// design, see CLAUDE.md's "no reporting service" rule for this task.
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  private retry = (): void => {
    this.setState({ hasError: false })
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children

    if (this.props.variant === 'pane') {
      return (
        <div className="error-boundary-pane">
          <div className="error-boundary-pane-title">This passage didn't load.</div>
          <div className="error-boundary-pane-body">
            The rest of your notes are still here. You can try loading it again.
          </div>
          <button type="button" className="dialog-btn dialog-btn-primary" onClick={this.retry}>
            Try again
          </button>
        </div>
      )
    }

    return (
      <div className="error-boundary-app">
        <div className="error-boundary-app-card">
          <div className="error-boundary-app-title">Something didn't load right.</div>
          <div className="error-boundary-app-body">
            Lantern ran into a problem it couldn't recover from on its own. Your notes are saved —
            reloading should bring things back.
          </div>
          <button
            type="button"
            className="dialog-btn dialog-btn-primary"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      </div>
    )
  }
}

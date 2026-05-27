import React from 'react';

interface Props { children: React.ReactNode }
interface State { error: Error | null; copied: boolean }

// Catches render/lifecycle errors anywhere in the routed page area and shows a
// readable, recoverable panel instead of a blank white screen. Mounted inside
// <App> (keyed by pathname) so the top switcher + bottom nav stay usable and
// navigating to another tab auto-resets it.
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('App crash:', error, info.componentStack);
  }

  private text(): string {
    const e = this.state.error;
    return e ? `${e.name}: ${e.message}\n\n${e.stack ?? '(no stack)'}` : '';
  }

  private copy = (): void => {
    const t = this.text();
    const ok = () => this.setState({ copied: true });
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(t).then(ok, ok);
    else ok();
  };

  private reload = (): void => {
    location.reload();
  };

  render(): React.ReactNode {
    const { error, copied } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="page">
        <div className="empty-state">
          <h2>Something went wrong</h2>
          <p>This screen hit an error. Switch tabs below, or copy the details and reload.</p>
        </div>
        <pre className="error-pre">{this.text()}</pre>
        <div className="form-actions">
          <button className="btn-primary full tap" onClick={this.copy}>
            {copied ? 'Copied' : 'Copy error'}
          </button>
          <button className="btn-secondary full" onClick={this.reload}>Reload app</button>
        </div>
      </div>
    );
  }
}

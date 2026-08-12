"use client";

import {Component, type ReactNode} from "react";

type Props = {
  name: string;
  children: ReactNode;
};

type State = {
  hasError: boolean;
  errorKey: number;
};

// Per-widget error boundary so one failing widget doesn't kill the dashboard.
export class WidgetErrorBoundary extends Component<Props, State> {
  state: State = {hasError: false, errorKey: 0};

  static getDerivedStateFromError(): Partial<State> {
    return {hasError: true};
  }

  // When the parent passes new children while we're in an errored state,
  // reset so React can attempt to render the new children. Without this,
  // a rerender alone wouldn't clear the boundary.
  componentDidUpdate(prevProps: Props): void {
    if (
      this.state.hasError &&
      prevProps.children !== this.props.children
    ) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState((s) => ({hasError: false, errorKey: s.errorKey + 1}));
    }
  }

  reset = () => {
    this.setState((s) => ({hasError: false, errorKey: s.errorKey + 1}));
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{padding: "1rem", color: "var(--t-text-muted)"}}>
          <p style={{margin: "0 0 0.5rem", fontSize: "0.875rem"}}>
            Couldn&apos;t load {this.props.name}.
          </p>
          <button
            type="button"
            onClick={this.reset}
            style={{
              fontSize: "0.75rem",
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              border: "1px solid var(--t-border)",
              background: "var(--t-bg-card)",
              color: "var(--t-text)",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      );
    }
    // errorKey as key forces remount on retry — clears the throwing child's state.
    return <div key={this.state.errorKey}>{this.props.children}</div>;
  }
}

WidgetErrorBoundary.displayName = "WidgetErrorBoundary";

export default WidgetErrorBoundary;

"use client";
import { Component } from "react";
import type { ReactNode } from "react";

/** A minimal Error Boundary with a reset button, used by the examples that reject. */
export class DemoErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div role="alert" className="demo-error">
          <p>Error Boundary caught: {this.state.error.message}</p>
          <button
            type="button"
            className="demo-button"
            onClick={() => this.setState({ error: null })}
          >
            Reset
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

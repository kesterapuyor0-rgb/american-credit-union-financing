import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode; fallback: ReactNode };
type State = { failed: boolean };

export class TransformBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State { return { failed: true }; }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('AI media stage failed; switching to the normal stream.', error, info.componentStack);
  }

  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

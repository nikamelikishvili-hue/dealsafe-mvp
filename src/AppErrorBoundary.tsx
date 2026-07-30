import { Component, type ErrorInfo, type ReactNode } from 'react';
import { reportClientFailure } from './services/clientFailureReporter.ts';

type AppErrorBoundaryProps = {
  children: ReactNode;
};

type AppErrorBoundaryState = {
  failed: boolean;
};

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(_error: Error, _errorInfo: ErrorInfo) {
    reportClientFailure({
      schema: 'dealivra.client-failure.v1',
      boundary: 'application_render',
      issue: 'react_render_failed',
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return <ApplicationFailurePage />;
  }
}

export function ApplicationFailurePage() {
  return (
    <main className="application-error-page">
      <section role="alert" aria-labelledby="application-error-title">
        <span aria-hidden="true">!</span>
        <p>DEALIVRA RECOVERY</p>
        <h1 id="application-error-title">This page could not finish loading.</h1>
        <div>
          <button type="button" onClick={() => location.reload()}>Try again</button>
          <a href="/">Return to home</a>
        </div>
        <small>No transaction action was completed on this screen.</small>
      </section>
    </main>
  );
}

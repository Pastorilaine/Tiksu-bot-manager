import { Component } from "react";
import { AlertCircle, RotateCw } from "lucide-react";

/**
 * Without this a render crash leaves a blank window in the packaged app —
 * no devtools, no message, nothing to report.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[renderer] Uncaught error:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 p-8 bg-bg text-text select-text">
        <AlertCircle className="w-10 h-10 text-danger" />
        <h1 className="text-title font-semibold">Sovellus kohtasi virheen</h1>
        <p className="text-label text-subtle max-w-md text-center">
          Botit jatkavat taustalla. Lataa näkymä uudelleen — jos virhe toistuu,
          kopioi alla oleva viesti raporttiin.
        </p>
        <pre className="max-w-2xl max-h-48 overflow-auto p-3 rounded-md bg-surface-2 border border-line text-meta font-mono text-danger whitespace-pre-wrap">
          {String(this.state.error?.stack || this.state.error)}
        </pre>
        <button onClick={() => window.location.reload()} className="btn btn-primary">
          <RotateCw className="w-4 h-4" /> Lataa uudelleen
        </button>
      </div>
    );
  }
}

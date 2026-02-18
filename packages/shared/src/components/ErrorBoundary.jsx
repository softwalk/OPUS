import { Component } from 'react';

/**
 * Generic React Error Boundary.
 * Catches JavaScript errors in its child component tree and
 * renders a fallback UI instead of crashing the entire app.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <App />
 *   </ErrorBoundary>
 *
 *   // With custom fallback:
 *   <ErrorBoundary fallback={<MyCustomErrorPage />}>
 *     <App />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          minHeight: '100vh', padding: '2rem', fontFamily: 'system-ui, sans-serif', textAlign: 'center',
          backgroundColor: '#fafafa', color: '#333',
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Algo salio mal
          </h1>
          <p style={{ color: '#666', marginBottom: '1rem', maxWidth: '400px' }}>
            Ocurrio un error inesperado. Puedes intentar recargar la pagina.
          </p>
          {this.state.error && (
            <pre style={{
              backgroundColor: '#f1f1f1', padding: '0.75rem', borderRadius: '6px',
              fontSize: '0.75rem', color: '#c00', maxWidth: '500px', overflow: 'auto',
              marginBottom: '1rem', textAlign: 'left',
            }}>
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={this.handleRetry}
              style={{
                padding: '0.5rem 1.25rem', borderRadius: '6px', border: '1px solid #ddd',
                backgroundColor: '#fff', cursor: 'pointer', fontSize: '0.875rem',
              }}
            >
              Reintentar
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '0.5rem 1.25rem', borderRadius: '6px', border: 'none',
                backgroundColor: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: '0.875rem',
              }}
            >
              Recargar pagina
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

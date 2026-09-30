import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('CivicTwin UI Uncaught Exception:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backgroundColor: '#0c1a30',
            color: '#f8fafc',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          <div
            style={{
              maxWidth: '600px',
              width: '100%',
              backgroundColor: '#132742',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '6px',
              padding: '32px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '4px',
                  backgroundColor: '#fee2e2',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#991b1b',
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <h1 style={{ fontSize: '18px', fontWeight: 700, margin: 0, color: '#ffffff' }}>
                  Platform Interface Exception
                </h1>
                <p style={{ fontSize: '12px', color: '#94a3b8', margin: '2px 0 0 0' }}>
                  CivicTwin AI Digital Public Infrastructure Safeguard
                </p>
              </div>
            </div>

            <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#cbd5e1', marginBottom: '16px' }}>
              An unexpected interface rendering issue was captured by the client reliability layer. The underlying
              backend services and database remain intact.
            </p>

            {this.state.error && (
              <div
                style={{
                  backgroundColor: '#07101e',
                  border: '1px solid #1e293b',
                  borderRadius: '4px',
                  padding: '12px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: '12px',
                  color: '#fca5a5',
                  overflowX: 'auto',
                  marginBottom: '20px',
                }}
              >
                {this.state.error.toString()}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={this.handleReset}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  backgroundColor: '#f59e0b',
                  color: '#0c1a30',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '10px 18px',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <RefreshCw size={15} />
                Reload Application
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

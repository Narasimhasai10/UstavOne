import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo?.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoBack = () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      window.location.hash = '#/';
      this.setState({ hasError: false, error: null, errorInfo: null });
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '50vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            fontFamily: 'var(--font-body, Hind, sans-serif)'
          }}
        >
          <div
            style={{
              maxWidth: '480px',
              width: '100%',
              background: 'var(--card, #2A141E)',
              color: 'var(--text, #F8EBD8)',
              border: '1.5px solid var(--line, #4A2634)',
              borderRadius: '24px',
              padding: '36px 28px',
              textAlign: 'center',
              boxShadow: '0 20px 50px rgba(0,0,0,0.25)'
            }}
          >
            <div style={{ fontSize: '3.5rem', marginBottom: '16px' }}>🪔</div>
            <h2
              style={{
                fontFamily: 'var(--font-heading, "Yatra One", serif)',
                fontSize: '1.8rem',
                color: 'var(--text, #F8EBD8)',
                margin: '0 0 10px'
              }}
            >
              Something went wrong on this page
            </h2>
            <p
              style={{
                color: 'var(--muted, #C9B0B8)',
                fontSize: '0.98rem',
                lineHeight: 1.5,
                margin: '0 0 28px'
              }}
            >
              We encountered an unexpected issue while loading this view. You can return to the previous screen or reload the application.
            </p>
            <div
              style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'center',
                flexWrap: 'wrap'
              }}
            >
              <button
                type="button"
                onClick={this.handleGoBack}
                style={{
                  padding: '12px 24px',
                  borderRadius: '12px',
                  border: '1.5px solid var(--line, #4A2634)',
                  background: 'transparent',
                  color: 'var(--text, #F8EBD8)',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: 'pointer'
                }}
              >
                Go back
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: '12px 28px',
                  borderRadius: '12px',
                  border: 0,
                  background: 'var(--gold, #E8B84A)',
                  color: '#3A0A1E',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(232, 184, 74, 0.3)'
                }}
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

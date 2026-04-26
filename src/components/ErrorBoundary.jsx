import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[FATAL_UI_ERROR]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center p-8 bg-[#fffdf9] text-center">
          <div className="w-16 h-16 bg-red-100 border-2 border-red-500 flex items-center justify-center mb-6 rounded-lg shadow-[4px_4px_0px_0px_#ef4444]">
            <span className="text-2xl">⚠️</span>
          </div>
          <h1 className="text-xl font-black uppercase tracking-tight text-red-600 mb-2">Module Crash Detected</h1>
          <p className="text-sm font-bold opacity-60 max-w-xs mb-8">
            The view failed to render. This can happen due to a connection drop or a runtime error.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-red-500 text-white font-black uppercase text-xs tracking-widest retro-border shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:translate-y-0.5 hover:shadow-none transition-all"
          >
            Reload Attic
          </button>
          {process.env.NODE_ENV === 'development' && (
            <pre className="mt-8 p-4 bg-black text-green-400 text-[10px] text-left overflow-auto max-w-full retro-border">
              {this.state.error?.toString()}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

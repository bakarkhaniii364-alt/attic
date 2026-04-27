import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render shows the fallback UI.
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // You can also log the error to an error reporting service here
    console.error("Attic Crash:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] bg-[#0000aa] text-white font-mono p-8 sm:p-16 flex flex-col items-start justify-center overflow-y-auto selection:bg-white selection:text-[#0000aa]">
          <div className="max-w-4xl mx-auto w-full space-y-6 animate-in fade-in duration-300">
            
            <h1 className="text-7xl sm:text-9xl font-bold mb-8">:(</h1>
            
            <p className="text-xl sm:text-3xl font-bold leading-tight">
              Your attic ran into a problem that it couldn't handle, and now it needs to refresh.
            </p>
            
            <p className="text-lg sm:text-xl opacity-90">
              You can look for the error in the console.
            </p>

            {/* The Error Output Box */}
            <div className="mt-8 p-4 bg-black/20 border-2 border-dashed border-white/40 text-sm overflow-x-auto backdrop-blur-sm">
              <p className="font-bold text-red-300">
                {this.state.error && this.state.error.toString()}
              </p>
              <pre className="mt-2 text-[11px] sm:text-xs opacity-70 whitespace-pre-wrap leading-relaxed">
                {this.state.errorInfo && this.state.errorInfo.componentStack}
              </pre>
            </div>

            {/* Refresh Button */}
            <div className="pt-8">
                <button
                onClick={() => window.location.reload()}
                className="px-8 py-3 bg-white text-[#0000aa] font-black uppercase tracking-widest hover:bg-gray-200 transition-colors border-2 border-white shadow-[4px_4px_0px_0px_rgba(255,255,255,0.3)] active:translate-y-[2px] active:shadow-none"
                >
                Restart Attic
                </button>
            </div>

          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

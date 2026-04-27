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
    console.error("Attic Crash:", error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        // 1. Outer Container: Matches your app's theme background
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-8 bg-[var(--bg-main)] text-[var(--text-main)] font-mono">
          
          {/* Solution 31: Consistent Grid Opacity (Matches App.jsx) */}
          <div className="absolute inset-0 bg-pattern-grid opacity-10 pointer-events-none" />
          
          {/* 2. The Retro Window Wrapper */}
          <div className="relative w-full max-w-3xl flex flex-col retro-border retro-shadow-dark animate-in fade-in zoom-in-95 duration-300">
            
            {/* Window Header (Theme colored) */}
            <div className="bg-[var(--border)] text-[var(--text-on-border)] px-3 py-2 flex justify-between items-center border-b-2 border-[var(--border)] select-none">
              <span className="font-black text-xs sm:text-sm tracking-widest uppercase flex items-center gap-2">
                fatal_exception.exe
              </span>
              {/* Fake window controls */}
              <div className="flex gap-1.5">
                 <div className="w-3 h-3 border-2 border-current opacity-50"></div>
                 <div className="w-3 h-3 border-2 border-current opacity-50"></div>
                 <div className="w-3 h-3 border-2 border-current bg-white"></div>
              </div>
            </div>

            {/* 3. Window Content: The Classic BSOD */}
            <div className="bg-[#0000aa] text-white p-6 sm:p-10 flex flex-col selection:bg-white selection:text-[#0000aa]">
              <h1 className="text-6xl sm:text-8xl font-bold mb-6">:(</h1>
              
              <p className="text-lg sm:text-2xl font-bold leading-tight mb-4">
                Your attic ran into a problem that it couldn't handle, and now it needs to refresh.
              </p>
              
              <p className="text-sm sm:text-base opacity-90 mb-8">
                You can look for the error in the console.
              </p>

              {/* The Error Output Box */}
              <div className="p-4 bg-black/30 border-2 border-dashed border-white/30 text-sm overflow-x-auto max-h-64 overflow-y-auto">
                <p className="font-bold text-red-300 mb-2">
                  {this.state.error && this.state.error.toString()}
                </p>
                <pre className="text-[10px] sm:text-xs opacity-70 whitespace-pre-wrap leading-relaxed">
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </div>

              {/* Action Buttons */}
              <div className="pt-8 flex justify-end items-center gap-4">
                <a 
                  href="https://www.facebook.com/bakarkhaniii/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[10px] font-black uppercase tracking-widest opacity-60 hover:opacity-100 transition-opacity underline underline-offset-4"
                >
                  Contact Developer
                </a>
                <button
                  onClick={() => window.location.href = '/'}
                  className="px-6 py-2 bg-white text-[#0000aa] font-black uppercase tracking-widest hover:bg-gray-200 transition-transform active:translate-y-[2px] border-2 border-white shadow-[4px_4px_0px_0px_rgba(0,0,0,0.3)] text-xs sm:text-sm"
                >
                  Restart Attic
                </button>
              </div>

            </div>
          </div>
        </div>
      );
    }

    return this.props.children; 
  }
}

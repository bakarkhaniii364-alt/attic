import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * ProtectedRoute - Ensures user is logged in.
 * By default, it also ensures the user has a paired room.
 */
export function ProtectedRoute({ children, requireRoom = true }) {
  const { user, loading, roomId, roomLoading } = useAuth();
  const location = useLocation();

  if (loading || (user && requireRoom && roomLoading)) return (
    <div className="w-full min-h-[100dvh] flex items-center justify-center bg-[#f9e2cf] z-50 relative">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
        <p className="font-black text-[var(--primary)] text-xs uppercase tracking-widest animate-pulse">Entering Attic...</p>
      </div>
    </div>
  );

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  if (requireRoom && !roomId) {
    return <Navigate to="/handshake" replace />;
  }

  return children;
}

export function PublicRoute({ children }) {
  const { user, roomId, loading } = useAuth();
  
  if (loading) return null;

  if (user && roomId) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

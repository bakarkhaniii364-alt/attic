import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * ProtectedRoute - Ensures user is logged in.
 * Pairing redirects are handled at the route level in App.jsx to prevent Guard Collisions.
 */
export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#f9e2cf]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin"></div>
        <p className="font-black text-[var(--primary)] text-xs uppercase tracking-widest animate-pulse">Entering Attic...</p>
      </div>
    </div>
  );

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
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

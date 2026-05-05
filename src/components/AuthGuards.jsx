import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { BootLoader } from './BootLoader.jsx';

/**
 * ProtectedRoute - Ensures user is logged in.
 * By default, it also ensures the user has a paired room.
 */
export function ProtectedRoute({ children, requireRoom = true }) {
  const { user, roomId, hasInitialized } = useAuth();
  const location = useLocation();

  // ONLY show the boot loader if we haven't initialized yet
  // Once hasInitialized is true, background updates won't trigger this unmount
  if (!hasInitialized) {
    return <BootLoader onComplete={() => {}} />;
  }

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

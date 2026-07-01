import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/instances.js';
import { BootLoader } from './BootLoader.jsx';

/**
 * ProtectedRoute - Ensures user is logged in.
 * By default, it also ensures the user has a paired room.
 */
export function ProtectedRoute({ children, requireRoom = true }) {
  const { user, roomId, partnerId, hasInitialized, roomLoading } = useAuth();
  const location = useLocation();

  // Show the boot loader if auth session is not initialized or we are still checking the room state
  if (!hasInitialized || (user && roomLoading)) {
    return <BootLoader onComplete={() => {}} />;
  }

  if (!user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  const isPaired = !!(roomId && partnerId);

  if (requireRoom && !isPaired) {
    return <Navigate to="/handshake" replace />;
  }

  if (!requireRoom && isPaired) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function PublicRoute({ children }) {
  const { user, roomId, partnerId, loading, roomLoading } = useAuth();
  
  if (loading || (user && roomLoading)) {
    return <BootLoader onComplete={() => {}} />;
  }

  if (user) {
    const isPaired = !!(roomId && partnerId);
    if (isPaired) {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/handshake" replace />;
    }
  }

  return children;
}

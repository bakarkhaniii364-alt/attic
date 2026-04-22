import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { Loader } from 'lucide-react';

/**
 * ProtectedRoute - Ensures user is logged in AND paired in a room.
 * If not logged in -> /login
 * If not paired -> /handshake
 */
export function ProtectedRoute({ children, session, hasRoom }) {
  const location = useLocation();

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasRoom && location.pathname !== '/handshake') {
    return <Navigate to="/handshake" replace />;
  }

  return children;
}

export function PublicRoute({ children, session, hasRoom }) {
  if (session && hasRoom) {
    return <Navigate to="/" replace />;
  }

  return children;
}

import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase.js';
import { Loader } from 'lucide-react';

/**
 * ProtectedRoute - Ensures user is logged in AND paired in a room.
 * If not logged in -> /login
 * If not paired -> /handshake
 */
export function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [hasRoom, setHasRoom] = useState(false);
  const location = useLocation();

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session) {
        const { data: room } = await supabase.rpc('get_my_room');
        setHasRoom(!!(room && room.is_paired));
      }
      
      setLoading(false);
    }
    checkAuth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-main)]">
        <Loader className="animate-spin text-[var(--primary)] mb-2" size={32} />
        <p className="text-xs font-bold opacity-40 uppercase tracking-widest">checking access...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!hasRoom && location.pathname !== '/handshake') {
    return <Navigate to="/handshake" replace />;
  }

  return children;
}

/**
 * PublicRoute - For Landing/Auth pages.
 * If already logged in and paired -> /dashboard
 */
export function PublicRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [hasRoom, setHasRoom] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      
      if (session) {
        const { data: room } = await supabase.rpc('get_my_room');
        setHasRoom(!!(room && room.is_paired));
      }
      
      setLoading(false);
    }
    checkAuth();
  }, []);

  if (loading) return null;

  if (session && hasRoom) {
    return <Navigate to="/" replace />;
  }

  return children;
}

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase.js';
import { isTestMode, getTestUser, getTestRoomId } from '../lib/testMode.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [partnerId, setPartnerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roomLoading, setRoomLoading] = useState(true); // separate from auth loading

  const isLoadingRef = useRef(true); // track loading without stale closure

  useEffect(() => {
    let mounted = true;

    let isFetchingRoom = false;
    const fetchRoomData = async () => {
      if (isFetchingRoom) return;
      isFetchingRoom = true;
      setRoomLoading(true);
      try {
        const rpcPromise = supabase.rpc('get_my_room');
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Room fetch timed out')), 10000)
        );
        const { data: room, error } = await Promise.race([rpcPromise, timeoutPromise]);
        if (error) throw error;
        if (mounted && room) {
          setRoomId(room.id);
          setPartnerId(room.partner_id);
        }
      } catch (err) {
        console.warn('[AUTH] Room fetch failed:', err.message);
      } finally {
        isFetchingRoom = false;
        if (mounted) setRoomLoading(false);
      }
    };

    const initAuth = async () => {
      if (isTestMode()) {
        const testUser = getTestUser();
        const testRoomId = getTestRoomId();
        localStorage.setItem('attic_test_mode', 'true');
        localStorage.setItem('attic_test_user', testUser);
        const isA = testUser.startsWith('userA');
        const [_, suffix] = testUser.split('_');
        const userA = `${isA ? testUser : 'userA'}${!isA && suffix ? `_${suffix}` : ''}`;
        const userB = `${isA ? 'userB' : testUser}${isA && suffix ? `_${suffix}` : ''}`;
        const partnerIdTest = isA ? userB : userA;
        setUser({ id: testUser, email: `${testUser}@test.com`, user_metadata: { name: testUser } });
        setSession({ user: { id: testUser } });
        setRoomId(testRoomId);
        setPartnerId(partnerIdTest);
        isLoadingRef.current = false;
        setRoomLoading(false); // Fix: unblock roomLoading for tests
        setLoading(false);
        return;
      }

      // Safety timeout — last resort in case getSession itself hangs
      const safetyTimeout = setTimeout(() => {
        if (isLoadingRef.current && mounted) {
          console.warn('[AUTH] getSession timed out, unblocking app.');
          isLoadingRef.current = false;
          setLoading(false);
        }
      }, 6000);

      try {
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        clearTimeout(safetyTimeout);
        if (!mounted) return;

        if (initialSession) {
          setSession(initialSession);
          setUser(initialSession.user);
          // Unblock the app immediately — don't wait for room data
          isLoadingRef.current = false;
          setLoading(false);
          // Load room data in the background (parallel, non-blocking)
          fetchRoomData(); // setRoomLoading handled inside
        } else {
          // No session → just unblock, nothing to room-fetch
          isLoadingRef.current = false;
          setLoading(false);
          setRoomLoading(false);
        }
      } catch (err) {
        console.error('[AUTH] Init failed:', err);
        clearTimeout(safetyTimeout);
        if (mounted) {
          isLoadingRef.current = false;
          setLoading(false);
          setRoomLoading(false);
        }
      }
    };

    initAuth();

    // Subscribe ONCE — handles sign-in/sign-out events
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      setUser(newSession?.user || null);
      isLoadingRef.current = false;
      setLoading(false); // Unblock first
      if (newSession?.user) {
        fetchRoomData(); // Then load room in background
      } else {
        setRoomId(null);
        setPartnerId(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []); // Run once — never re-subscribe

  const logout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
    setRoomId(null);
    setPartnerId(null);
  };

  const refreshRoom = async () => {
    if (user) {
      const { data: room } = await supabase.rpc('get_my_room');
      if (room) {
        setRoomId(room.id);
        setPartnerId(room.partner_id);
        return room;
      }
    }
    return null;
  };

  const handleAuthSuccess = async (newSession) => {
    setLoading(true);
    setSession(newSession);
    setUser(newSession.user);
    try {
      const { data: room } = await supabase.rpc('get_my_room');
      if (room) {
        setRoomId(room.id);
        setPartnerId(room.partner_id);
      }
    } catch (err) {
      console.error('[AUTH] Post-login room fetch failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePaired = async (newRoomId) => {
    setLoading(true);
    setRoomId(newRoomId);
    try {
      const { data: room } = await supabase.rpc('get_my_room');
      if (room) {
        setPartnerId(room.partner_id);
      }
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    roomId,
    partnerId,
    loading,
    roomLoading,
    logout,
    refreshRoom,
    handleAuthSuccess,
    handlePaired,
    userId: user?.id || null
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

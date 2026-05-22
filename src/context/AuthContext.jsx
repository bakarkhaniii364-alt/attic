import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { isTestMode, getTestUser, getTestRoomId } from '../lib/testMode.js';
import { AuthContext } from './instances.js';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [partnerId, setPartnerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [roomLoading, setRoomLoading] = useState(true);
  const [hasInitialized, setHasInitialized] = useState(false);

  const mountedRef = useRef(true);

  const fetchRoomData = useCallback(async (uid) => {
    if (!uid) {
      if (mountedRef.current) {
        setRoomId(null);
        setPartnerId(null);
        setRoomLoading(false);
        setHasInitialized(true);
      }
      return;
    }
    if (mountedRef.current) {
      setRoomLoading(true);
    }
    try {
      const { data: room } = await supabase.rpc('get_my_room');
      if (mountedRef.current) {
        if (room) {
          setRoomId(room.id);
          setPartnerId(room.creator_id === uid ? room.partner_id : room.creator_id);
        } else {
          setRoomId(null);
          setPartnerId(null);
        }
      }
    } catch (err) {
      console.warn('[AUTH] Room fetch failed:', err.message);
    } finally {
      if (mountedRef.current) {
        setRoomLoading(false);
        setHasInitialized(true);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    
    const init = async () => {
      if (isTestMode()) {
        const testUser = getTestUser();
        const [base, suffix] = testUser.split('_');
        let hex = '';
        if (suffix) {
            for (let i = 0; i < suffix.length; i++) {
                hex += suffix.charCodeAt(i).toString(16);
            }
        }
        hex = hex.padEnd(12, '0').substring(0, 12);
        const isA = testUser.startsWith('userA');
        const myUid = isA ? `00000000-0000-0000-000a-${hex}` : `00000000-0000-0000-000b-${hex}`;
        const partnerUid = isA ? `00000000-0000-0000-000b-${hex}` : `00000000-0000-0000-000a-${hex}`;

        setUser({ id: myUid, email: `${testUser}@test.com`, user_metadata: { name: testUser } });
        setUserId(myUid);
        setRoomId(getTestRoomId());
        setPartnerId(partnerUid);
        setLoading(false);
        setRoomLoading(false);
        setHasInitialized(true);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (mountedRef.current) {
        if (session) {
          setUser(session.user);
          setUserId(session.user.id);
          fetchRoomData(session.user.id);
        } else {
          setRoomLoading(false);
          setHasInitialized(true);
        }
        setLoading(false);
      }
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      if (session) {
        setUser(session.user);
        setUserId(session.user.id);
        fetchRoomData(session.user.id);
      } else {
        setUser(null);
        setUserId(null);
        setRoomId(null);
        setPartnerId(null);
        setRoomLoading(false);
        setHasInitialized(true);
      }
      setLoading(false);
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchRoomData]);

  const handleAuthSuccess = async (session) => {
    if (session) {
      setUser(session.user);
      setUserId(session.user.id);
      await fetchRoomData(session.user.id);
    }
  };

  const handlePaired = async (newRoomId, newPartnerId) => {
    if (newRoomId && newPartnerId) {
      setRoomId(newRoomId);
      setPartnerId(newPartnerId);
    } else {
      await fetchRoomData(userId);
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserId(null);
    setRoomId(null);
    setPartnerId(null);
    setHasInitialized(false);
    localStorage.clear();
    window.location.href = '/';
  };

  const value = useMemo(() => ({
    user,
    userId,
    roomId,
    partnerId,
    loading,
    roomLoading,
    hasInitialized,
    logout,
    handleAuthSuccess,
    handlePaired,
    fetchRoomData
  }), [user, userId, roomId, partnerId, loading, roomLoading, hasInitialized, fetchRoomData]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

import { useState, useEffect, useCallback } from 'react';
import { useSync } from '../context/SyncContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

/**
 * Returns a human-readable "last seen" string for any userId.
 * Updates every 30 seconds automatically.
 */
export function useLastSeen() {
  const { onlineUsers } = useSync();
  const { partnerId } = useAuth();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const getLastSeen = useCallback((userId) => {
    const presence = onlineUsers[userId];
    if (!presence) return 'Offline';
    if (presence.status === 'active') return 'Online now';

    const lastOnlineAt = presence.online_at;
    if (!lastOnlineAt) return 'Idle';

    const diffMs = Date.now() - new Date(lastOnlineAt).getTime();
    const diffMins = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1)    return 'Just now';
    if (diffMins < 60)   return `${diffMins} min ago`;
    if (diffHours < 24)  return `${diffHours}h ago`;
    if (diffDays === 1)  return 'Yesterday';
    return `${diffDays} days ago`;
  }, [onlineUsers, tick]);

  const partnerLastSeen = getLastSeen(partnerId);
  const isPartnerOnline = onlineUsers[partnerId]?.status === 'active';

  return { getLastSeen, partnerLastSeen, isPartnerOnline };
}

import { useState, useEffect, useCallback } from 'react';
import { useSync, useAuth } from '../context/instances.js';

/**
 * Returns a human-readable "last seen" string for any userId.
 * Updates every 30 seconds automatically.
 */
export function useLastSeen() {
  const { onlineUsers, globalState } = useSync();
  const { partnerId } = useAuth();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 30_000);
    return () => clearInterval(interval);
  }, []);

  const getLastSeen = useCallback((userId) => {
    const presence = onlineUsers[userId];
    const profile = globalState?.room_profiles?.[userId] || {};
    const lastActivity = profile.lastActivity;
    
    if (!presence) {
      // Offline logic
      const lastOnlineAt = profile.last_online_at || profile.updated_at;
      let label = 'Offline';
      if (lastOnlineAt) {
        const diffMs = Date.now() - new Date(lastOnlineAt).getTime();
        const diffMins = Math.floor(diffMs / 60_000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1)    label = 'Just now';
        else if (diffMins < 60)   label = `${diffMins}m ago`;
        else if (diffHours < 24)  label = `${diffHours}h ago`;
        else if (diffDays === 1)  label = 'Yesterday';
        else label = `${diffDays}d ago`;
      }

      return {
        status: 'offline',
        label: label === 'Offline' ? 'Offline' : `Last seen ${label}`,
        activity: null,
        lastActivity: lastActivity
      };
    }

    if (presence.status === 'active') {
      return {
        status: 'active',
        label: 'Online',
        activity: presence.activity,
        lastActivity: lastActivity
      };
    }

    return {
      status: 'idle',
      label: 'Idle',
      activity: presence.activity,
      lastActivity: lastActivity
    };
  }, [onlineUsers, globalState, tick]);

  const formatStatus = useCallback((userId) => {
    const data = getLastSeen(userId);
    if (data.status === 'active' || data.status === 'idle') {
      if (data.activity) return data.activity;
      return data.status === 'active' ? 'Online' : 'Idle';
    }
    
    let base = data.label;
    if (data.lastActivity) {
      base += ` (Played ${data.lastActivity.game})`;
    }
    return base;
  }, [getLastSeen]);

  const partnerStatusData = getLastSeen(partnerId);
  const partnerStatusLabel = formatStatus(partnerId);
  const isPartnerOnline = partnerStatusData.status === 'active';

  return { getLastSeen, formatStatus, partnerStatusData, partnerStatusLabel, isPartnerOnline };
}

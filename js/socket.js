import { supabase } from '../src/lib/supabase.js';

let channel = null;

export function initSocket(roomId, userId, callbacks) {
  const channelId = `room_sync_${roomId}`;
  
  if (channel) {
    supabase.removeChannel(channel);
  }

  channel = supabase.channel(channelId, {
    config: { presence: { key: userId } }
  });

  channel
    .on('broadcast', { event: 'state_update' }, ({ payload }) => {
      if (callbacks.onStateUpdate) callbacks.onStateUpdate(payload.key, payload.value);
    })
    .on('broadcast', {}, ({ event, payload }) => {
      if (event !== 'state_update' && callbacks.onBroadcast) {
        callbacks.onBroadcast(event, payload);
      }
    })
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      const onlineMap = {};
      Object.keys(state).forEach(id => {
        onlineMap[id] = state[id][0];
      });
      if (callbacks.onPresenceChange) callbacks.onPresenceChange(onlineMap);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const trackPresence = async () => {
          await channel.track({
            online_at: new Date().toISOString(),
            status: document.hasFocus() ? 'active' : 'idle'
          });
        };
        trackPresence();
        setInterval(trackPresence, 15000);
      }
    });

  // Subscribe to DB changes for chat messages
  supabase.channel(`chat_${roomId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: `room_id=eq.${roomId}`
    }, (payload) => {
      if (callbacks.onChatMessage) callbacks.onChatMessage(payload.new);
    })
    .subscribe();
}

export function broadcast(roomId, eventName, payload) {
  if (!channel) return;
  channel.send({
    type: 'broadcast',
    event: eventName,
    payload
  });
}

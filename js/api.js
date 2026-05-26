import { supabase } from '../src/lib/supabase.js';

let currentRoomId = null;

export function setRoomId(roomId) {
  currentRoomId = roomId;
}

export async function fetchAppState() {
  if (!currentRoomId) throw new Error("No room ID");
  const { data, error } = await supabase
    .from('app_state')
    .select('state')
    .eq('room_id', currentRoomId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return {}; // Not found
    throw error;
  }
  return data?.state || {};
}

export async function updateAppState(state) {
  if (!currentRoomId) return;
  await supabase
    .from('app_state')
    .update({ state })
    .eq('room_id', currentRoomId);
}

export async function fetchChatMessages() {
  if (!currentRoomId) return [];
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('room_id', currentRoomId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function sendChatMessage(content, senderId, type = 'text') {
  if (!currentRoomId) return;
  const { error } = await supabase
    .from('messages')
    .insert({
      room_id: currentRoomId,
      sender: senderId,
      content,
      type
    });
  if (error) throw error;
}

import { useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import { supabase } from '../lib/supabase.js';

/**
 * useChatSync - Specialized hook for room-specific chat history
 * Implements initial fetch, realtime subscriptions, and offline caching.
 */
/**
 * Maps database row fields to the format expected by the ChatView UI.
 */
  const mapMessage = (row) => {
    const mapped = {
      ...row,
      sender: row.sender_id,
      time: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      replyTo: row.metadata?.replyTo || null,
      reactions: row.metadata?.reactions || [],
      isDeleted: row.metadata?.isDeleted || false,
      isEdited: row.metadata?.isEdited || false,
      duration: row.metadata?.duration || null
    };

    // Route content to correct UI prop based on type
    if (row.type === 'text') mapped.text = row.content;
    else if (row.type === 'image') mapped.url = row.content;
    else if (row.type === 'voice') mapped.audioUrl = row.content;

    return mapped;
  };

export function useChatSync(roomId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  // 1. Initial Load & Cache Hydration
  useEffect(() => {
    if (!roomId) return;

    let mounted = true;

    const initChat = async () => {
      // Try to load from cache first for instant UI
      const cached = await localforage.getItem(`chat_cache_${roomId}`);
      if (cached && mounted) {
        setMessages(cached);
        setLoading(false);
      }

      // Fetch latest 50 from Supabase
      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('room_id', roomId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        console.error('[CHAT] Fetch error:', error);
        if (mounted) setLoading(false);
        return;
      }

      if (data && mounted) {
        const sortedData = data.map(mapMessage).reverse(); // Newest at bottom
        setMessages(sortedData);
        setLoading(false);
        setHasMore(data.length === 50);
        
        // Update cache
        localforage.setItem(`chat_cache_${roomId}`, sortedData);
      }
    };

    initChat();

    // 2. Realtime Subscription (Filtered by room_id)
    const uniqueId = Math.random().toString(36).substring(2, 9);
    const channelName = `room_chat_${roomId}_${uniqueId}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'chat_messages', 
          filter: `room_id=eq.${roomId}` 
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => {
              const mapped = mapMessage(payload.new);
              const newMsgs = [...prev, mapped];
              localforage.setItem(`chat_cache_${roomId}`, newMsgs);
              return newMsgs;
            });
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) => {
              const mapped = mapMessage(payload.new);
              const newMsgs = prev.map((m) => (m.id === mapped.id ? mapped : m));
              localforage.setItem(`chat_cache_${roomId}`, newMsgs);
              return newMsgs;
            });
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => {
              const newMsgs = prev.filter((m) => m.id !== payload.old.id);
              localforage.setItem(`chat_cache_${roomId}`, newMsgs);
              return newMsgs;
            });
          }
        }
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // 3. Send Message Helper
  const sendMessage = useCallback(async (content, type = 'text', senderId, metadata = {}) => {
    if (!roomId || !content) return;

    let finalContent = content;

    // If it's a blob/file (voice note or image), upload to storage first
    if (content instanceof Blob) {
      const fileExt = content.type.split('/')[1]?.split(';')[0] || 'png';
      const fileName = `${roomId}/${Date.now()}.${fileExt}`;
      const bucket = type === 'voice' ? 'voice_notes' : (type === 'image' ? 'scrapbook' : 'doodles');

      const { data: storageData, error: storageError } = await supabase.storage
        .from(bucket)
        .upload(fileName, content, { cacheControl: '3600', upsert: true });

      if (storageError) {
        console.error('[CHAT] Storage upload error:', storageError);
        throw storageError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);
      
      finalContent = publicUrl;
    }

    const newMessage = {
      room_id: roomId,
      sender_id: senderId,
      type,
      content: finalContent,
      metadata,
    };

    const { data, error } = await supabase
      .from('chat_messages')
      .insert(newMessage)
      .select()
      .single();

    if (error) {
      console.error('[CHAT] Send error:', error);
      throw error;
    }

    return data;
  }, [roomId]);

  // 4. Load More (Pagination)
  const loadMore = useCallback(async () => {
    if (!roomId || !hasMore || messages.length === 0) return;

    const oldestTimestamp = messages[0].created_at;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .lt('created_at', oldestTimestamp)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[CHAT] Pagination error:', error);
      return;
    }

    if (data && data.length > 0) {
      const moreMsgs = data.map(mapMessage).reverse();
      setMessages((prev) => [...moreMsgs, ...prev]);
      setHasMore(data.length === 50);
    } else {
      setHasMore(false);
    }
  }, [roomId, hasMore, messages]);

  // 5. Update Message Helper
  const updateMessage = useCallback(async (id, updates) => {
    if (!roomId || !id) return;

    // Map UI fields back to DB fields if necessary
    const dbUpdates = { ...updates };
    if (updates.text !== undefined) { dbUpdates.content = updates.text; delete dbUpdates.text; }
    
    // If updating metadata (like reactions or status)
    if (updates.reactions || updates.status || updates.isDeleted || updates.isEdited) {
        const { data: current } = await supabase.from('chat_messages').select('metadata').eq('id', id).single();
        dbUpdates.metadata = { ...(current?.metadata || {}), ...updates };
        delete dbUpdates.reactions;
        delete dbUpdates.status;
        delete dbUpdates.isDeleted;
        delete dbUpdates.isEdited;
    }

    const { data, error } = await supabase
      .from('chat_messages')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[CHAT] Update error:', error);
      throw error;
    }

    return data;
  }, [roomId]);

  // 6. Delete Message Helper (Soft delete via metadata)
  const deleteMessage = useCallback(async (id) => {
    return updateMessage(id, { isDeleted: true });
  }, [updateMessage]);

  return { messages, sendMessage, updateMessage, deleteMessage, loading, loadMore, hasMore };
}

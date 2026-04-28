import { useState, useEffect, useCallback, useRef } from 'react';
import localforage from 'localforage';
import { supabase } from '../lib/supabase.js';
import { isTestMode, sendTestStateUpdate, onTestStateUpdate } from '../lib/testMode.js';
import { encryptMessage, decryptMessage } from '../utils/crypto.js';

/**
 * useChatSync - Specialized hook for room-specific chat history
 * Implements initial fetch, realtime subscriptions, and offline caching.
 */
/**
 * Maps database row fields to the format expected by the ChatView UI.
 */
  const mapMessage = async (row, e2eeKey) => {
    const mapped = {
      ...row,
      sender: row.sender_id,
      time: new Date(row.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      replyTo: row.metadata?.replyTo || null,
      reactions: row.metadata?.reactions || [],
      isDeleted: row.metadata?.isDeleted || false,
      isEdited: row.metadata?.isEdited || false,
      duration: row.metadata?.duration || null,
      status: row.metadata?.status || 'sent',
      readAt: row.metadata?.readAt || null
    };

    // Route content to correct UI prop based on type
    if (row.type === 'text') {
        try {
            const parsed = JSON.parse(row.content);
            if (parsed.ciphertext && parsed.iv) {
                if (e2eeKey) {
                    mapped.text = await decryptMessage(parsed, e2eeKey);
                } else {
                    mapped.text = "[Encrypted Message - Secure Key Missing]";
                }
            } else {
                mapped.text = row.content;
            }
        } catch (e) {
            mapped.text = row.content;
        }
    }
    else if (row.type === 'image') mapped.url = row.content;
    else if (row.type === 'voice') mapped.audioUrl = row.content;
    else if (row.type === 'game_invite') {
      mapped.text = row.content;
      mapped.gameId = row.metadata?.gameId;
      mapped.gameTitle = row.metadata?.gameTitle;
      mapped.status = row.metadata?.status;
    }

    return mapped;
  };

export function useChatSync(roomId, e2eeKey) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  const keyRef = useRef(e2eeKey);
  useEffect(() => {
    keyRef.current = e2eeKey;
  }, [e2eeKey]);

  // 1. Initial Load & Cache Hydration
  useEffect(() => {
    if (!roomId) return;

    let mounted = true;

    const initChat = async () => {
      if (isTestMode()) {
        setLoading(false);
        return;
      }
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
        const mappedPromises = data.map(row => mapMessage(row, keyRef.current));
        const resolvedData = await Promise.all(mappedPromises);
        const sortedData = resolvedData.reverse(); // Newest at bottom
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
            mapMessage(payload.new, keyRef.current).then(mapped => {
                setMessages((prev) => {
                  if (prev.some(m => m.id === payload.new.id)) return prev;
                  const newMsgs = [...prev, mapped];
                  localforage.setItem(`chat_cache_${roomId}`, newMsgs);
                  return newMsgs;
                });
            });
          } else if (payload.eventType === 'UPDATE') {
            mapMessage(payload.new, keyRef.current).then(mapped => {
                setMessages((prev) => {
                  const newMsgs = prev.map((m) => (m.id === mapped.id ? mapped : m));
                  localforage.setItem(`chat_cache_${roomId}`, newMsgs);
                  return newMsgs;
                });
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
    
    let unspentTest;
    let unspentUpdateTest;
    if (isTestMode()) {
        unspentTest = onTestStateUpdate('chat_message', (payload) => {
            mapMessage(payload, keyRef.current).then(mapped => {
                setMessages((prev) => {
                    if (prev.some(m => m.id === payload.id)) return prev;
                    return [...prev, mapped];
                });
            });
        });
        unspentUpdateTest = onTestStateUpdate('chat_message_update', (payload) => {
            setMessages((prev) => {
                return prev.map((m) => {
                    if (m.id === payload.id) {
                        // Extract metadata updates
                        const metaUpdates = payload.metadata || {};
                        // Map status/readAt from metadata if present
                        const status = metaUpdates.status || m.status;
                        const readAt = metaUpdates.readAt || m.readAt;
                        console.log(`[TEST_SYNC] Updating message ${m.id} to status: ${status}`);
                        
                        return { 
                            ...m, 
                            ...payload,
                            status,
                            readAt,
                            metadata: { ...(m.metadata || {}), ...metaUpdates } 
                        };
                    }
                    return m;
                });
            });
        });
    }

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
      if (unspentTest) unspentTest();
      if (unspentUpdateTest) unspentUpdateTest();
    };
  }, [roomId]);

  // 3. Send Message Helper (WITH OPTIMISTIC UPDATES)
  const sendMessage = useCallback(async (content, type = 'text', senderId, metadata = {}) => {
    if (!roomId || !content) return;

    let finalContent = content;
    const isBlob = content instanceof Blob;

    if (isBlob) {
      finalContent = URL.createObjectURL(content); // Create instant local preview
    } else if (type === 'text') {
        if (!e2eeKey) {
            if (isTestMode()) {
                 console.warn("Dev Mode: Sending UNENCRYPTED message because E2EE Key is missing.");
                 // Do not encrypt, finalContent remains plain text
            } else {
                alert("Waiting for secure connection. Cannot send encrypted message.");
                throw new Error("Missing E2EE Key");
            }
        } else {
            const encrypted = await encryptMessage(finalContent, e2eeKey);
            finalContent = JSON.stringify(encrypted);
        }
    }

    // --- INSTANT OPTIMISTIC UI UPDATE ---
    // Solution 19: Use crypto.randomUUID() for robust collision resistance
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimisticMsg = {
      id: tempId,
      room_id: roomId,
      sender_id: senderId,
      type,
      content: finalContent,
      metadata: { ...metadata, status: 'sending' },
      created_at: new Date().toISOString()
    };
    
    // Instantly show the message on screen!
    const mappedOptimistic = await mapMessage(optimisticMsg, e2eeKey);
    setMessages(prev => [...prev, mappedOptimistic]);
    if (isTestMode()) {
        sendTestStateUpdate('chat_message', optimisticMsg);
        return optimisticMsg;
    }

    try {
      if (isBlob) {
        const fileExt = content.type.split('/')[1]?.split(';')[0] || 'png';
        const fileName = `${roomId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
        const bucket = type === 'voice' ? 'voice_notes' : (type === 'image' ? 'scrapbook' : 'doodles');

        const { error: storageError } = await supabase.storage.from(bucket).upload(fileName, content, { cacheControl: '3600', upsert: true });
        if (storageError) throw storageError;

        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
        finalContent = publicUrl;
      }

      const newMessage = {
        room_id: roomId,
        sender_id: senderId,
        type,
        content: finalContent,
        metadata: { ...metadata, status: 'sent' },
      };

      const { data, error } = await supabase.from('chat_messages').insert(newMessage).select().single();
      if (error) throw error;

      // Swap the temporary message with the real confirmed database message
      const mappedData = await mapMessage(data, e2eeKey);
      setMessages(prev => prev.map(m => m.id === tempId ? mappedData : m));
      return data;
    } catch (err) {
      console.error('[CHAT] Send error:', err);
      // If it fails, show a red failed state so the user knows!
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      throw err;
    }
  }, [roomId, e2eeKey]);

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
      const mappedPromises = data.map(row => mapMessage(row, keyRef.current));
      const resolvedData = await Promise.all(mappedPromises);
      const moreMsgs = resolvedData.reverse();
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
    
    // 🔥 FIX: Define all fields that belong ONLY in the metadata JSONB column
    const metaKeys = ['reactions', 'status', 'isDeleted', 'isEdited', 'readAt', 'duration', 'replyTo'];
    const hasMetaUpdate = metaKeys.some(key => updates[key] !== undefined);

    if (hasMetaUpdate) {
        // Fetch current metadata so we don't overwrite existing data
        const { data: current } = await supabase.from('chat_messages').select('metadata').eq('id', id).single();
        dbUpdates.metadata = { ...(current?.metadata || {}), ...updates };
        
        // Strip ALL metadata keys from the root of the Supabase update payload
        metaKeys.forEach(key => delete dbUpdates[key]);
    }

    if (isTestMode()) {
        const payload = { ...updates, id, metadata: { ...updates } };
        sendTestStateUpdate('chat_message_update', payload);
        return payload;
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

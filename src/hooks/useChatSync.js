import { useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import { supabase } from '../lib/supabase.js';
import { isTestMode, sendTestStateUpdate, onTestStateUpdate } from '../lib/testMode.js';

const mapMessage = async (row) => {
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

  if (row.type === 'text') {
      mapped.text = row.content;
      // Catch legacy encrypted messages so they don't break the UI
      if (row.content && row.content.includes('"ciphertext"')) {
          mapped.text = "[Legacy Encrypted Message]";
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

export function useChatSync(roomId) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!roomId) return;
    let mounted = true;

    const initChat = async () => {
      if (isTestMode()) {
        setLoading(false);
        return;
      }
      const cached = await localforage.getItem(`chat_cache_${roomId}`);
      if (cached && mounted) {
        setMessages(cached);
        setLoading(false);
      }

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
        const mappedPromises = data.map(row => mapMessage(row));
        const resolvedData = await Promise.all(mappedPromises);
        const sortedData = resolvedData.reverse(); 
        setMessages(sortedData);
        setLoading(false);
        setHasMore(data.length === 50);
        localforage.setItem(`chat_cache_${roomId}`, sortedData);
      }
    };

    initChat();

    const uniqueId = Math.random().toString(36).substring(2, 9);
    const channelName = `room_chat_${roomId}_${uniqueId}`;
    const channel = supabase.channel(channelName);

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            mapMessage(payload.new).then(mapped => {
                setMessages((prev) => {
                  if (prev.some(m => m.id === payload.new.id)) return prev;
                  const newMsgs = [...prev, mapped];
                  localforage.setItem(`chat_cache_${roomId}`, newMsgs);
                  return newMsgs;
                });
            });
          } else if (payload.eventType === 'UPDATE') {
            mapMessage(payload.new).then(mapped => {
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
            mapMessage(payload).then(mapped => {
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
                        const metaUpdates = payload.metadata || {};
                        const status = metaUpdates.status || m.status;
                        const readAt = metaUpdates.readAt || m.readAt;
                        return { ...m, ...payload, status, readAt, metadata: { ...(m.metadata || {}), ...metaUpdates } };
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

  const sendMessage = useCallback(async (content, type = 'text', senderId, metadata = {}) => {
    if (!roomId || !content) return;

    let finalContent = content;
    const isBlob = content instanceof Blob;

    if (isBlob) {
      finalContent = URL.createObjectURL(content); 
    } else if (type === 'text') {
      finalContent = content; // Ensure text is captured
    }

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
    
    const mappedOptimistic = await mapMessage(optimisticMsg);
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

      const mappedData = await mapMessage(data);
      setMessages(prev => prev.map(m => m.id === tempId ? mappedData : m));
      return data;
    } catch (err) {
      console.error('[CHAT] Send error:', err);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
      throw err;
    }
  }, [roomId]);

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
      const mappedPromises = data.map(row => mapMessage(row));
      const resolvedData = await Promise.all(mappedPromises);
      const moreMsgs = resolvedData.reverse();
      setMessages((prev) => [...moreMsgs, ...prev]);
      setHasMore(data.length === 50);
    } else {
      setHasMore(false);
    }
  }, [roomId, hasMore, messages]);

  const updateMessage = useCallback(async (id, updates) => {
    if (!roomId || !id) return;

    const dbUpdates = { ...updates };
    if (updates.text !== undefined) { dbUpdates.content = updates.text; delete dbUpdates.text; }
    
    const metaKeys = ['reactions', 'status', 'isDeleted', 'isEdited', 'readAt', 'duration', 'replyTo'];
    const hasMetaUpdate = metaKeys.some(key => updates[key] !== undefined);

    if (hasMetaUpdate) {
        const { data: current } = await supabase.from('chat_messages').select('metadata').eq('id', id).single();
        dbUpdates.metadata = { ...(current?.metadata || {}), ...updates };
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

  const deleteMessage = useCallback(async (id) => {
    return updateMessage(id, { isDeleted: true });
  }, [updateMessage]);

  return { messages, sendMessage, updateMessage, deleteMessage, loading, loadMore, hasMore };
}

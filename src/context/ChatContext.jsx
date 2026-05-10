import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import { supabase } from '../lib/supabase.js';
import { useAuth, useSync } from './instances.js';
import { isTestMode, sendTestStateUpdate, onTestStateUpdate } from '../lib/testMode.js';
import { ChatContext } from './instances.js';

const CACHE_VERSION = 'v5'; // Bumped for client_id duplication fix

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
    readAt: row.metadata?.readAt || null,
    fileName: row.metadata?.fileName || null,
    fileSize: row.metadata?.fileSize || null,
    clientId: row.metadata?.client_id || null
  };

  if (row.type === 'text') {
    mapped.text = row.content || '';
    if (row.content && row.content.includes('"ciphertext"')) {
      mapped.text = '[Legacy Encrypted Message]';
    }
  } else if (row.type === 'image') {
    mapped.url = row.content;
  } else if (row.type === 'voice') {
    mapped.audioUrl = row.content;
  } else if (row.type === 'video') {
    mapped.url = row.content;
  } else if (row.type === 'audio') {
    mapped.url = row.content;
  } else if (row.type === 'file') {
    mapped.url = row.content;
  } else if (row.type === 'game_invite') {
    mapped.text = row.content;
    mapped.gameId = row.metadata?.gameId;
    mapped.gameTitle = row.metadata?.gameTitle;
    mapped.status = row.metadata?.status;
  } else if (row.type === 'call_invite') {
    mapped.callType = row.metadata?.callType || 'voice';
    mapped.status = row.metadata?.status || 'accepted';
  }

  return mapped;
};

export function ChatProvider({ children }) {
  const { roomId, userId } = useAuth();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    if (!roomId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    let mounted = true;
    const cacheKey = `chat_cache_${roomId}_${CACHE_VERSION}`;

    const initChat = async () => {
      if (isTestMode()) {
        setLoading(false);
        return;
      }

      const cached = await localforage.getItem(cacheKey);
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
        const resolvedData = await Promise.all(data.map(row => mapMessage(row)));
        const sortedData = resolvedData.reverse();
        setMessages(sortedData);
        setLoading(false);
        setHasMore(data.length === 50);
        localforage.setItem(cacheKey, sortedData);
      }
    };

    initChat();

    const channel = supabase.channel(`chat_realtime_${roomId}_${CACHE_VERSION}`);
    channel
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_messages', filter: `room_id=eq.${roomId}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          mapMessage(payload.new).then(mapped => {
            if (!mounted) return;
            setMessages(prev => {
              // De-duplication Logic:
              // 1. Check if this exact DB ID is already present
              if (prev.some(m => m.id === mapped.id)) return prev;
              
              // 2. Check if there's an optimistic message with the same client_id
              const clientId = mapped.clientId;
              if (clientId && prev.some(m => String(m.id).startsWith('temp-') && m.clientId === clientId)) {
                // Replace the optimistic message with the real one
                const next = prev.map(m => (String(m.id).startsWith('temp-') && m.clientId === clientId) ? mapped : m);
                localforage.setItem(cacheKey, next);
                return next;
              }

              // 3. Otherwise, it's a new message from partner, append it
              const next = [...prev, mapped];
              localforage.setItem(cacheKey, next);
              return next;
            });
          });
        } else if (payload.eventType === 'UPDATE') {
          mapMessage(payload.new).then(mapped => {
            if (!mounted) return;
            setMessages(prev => {
              const next = prev.map(m => m.id === mapped.id ? mapped : m);
              localforage.setItem(cacheKey, next);
              return next;
            });
          });
        } else if (payload.eventType === 'DELETE') {
          if (mounted) setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  const { broadcast } = useSync();

  const sendMessage = useCallback(async (content, type = 'text', metadata = {}) => {
    const meta = (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) ? metadata : {};

    if (!roomId || !userId) {
      console.error('[CHAT] sendMessage called before auth ready:', { roomId, userId });
      return;
    }
    if (!content && type === 'text') {
      console.warn('[CHAT] Refusing empty text message');
      return;
    }

    const cacheKey = `chat_cache_${roomId}_${CACHE_VERSION}`;
    const tempId = `temp-${crypto.randomUUID()}`;
    const clientId = crypto.randomUUID(); // Client-side unique ID for de-duplication
    const optimisticContent = (content instanceof Blob || content instanceof File) ? URL.createObjectURL(content) : content;

    const optimisticMsg = {
      id: tempId,
      room_id: roomId,
      sender_id: userId,
      type,
      content: optimisticContent,
      metadata: { ...meta, status: 'sending', client_id: clientId },
      created_at: new Date().toISOString()
    };

    const mappedOptimistic = await mapMessage(optimisticMsg);
    // Explicitly set clientId because mapMessage extracts it from metadata
    mappedOptimistic.clientId = clientId;
    
    setMessages(prev => [...prev, mappedOptimistic]);

    if (isTestMode()) {
      sendTestStateUpdate('chat_message', optimisticMsg);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
      return optimisticMsg;
    }

    try {
      let finalContent = content;

      if (content instanceof Blob || content instanceof File) {
        const fileExt = content.name?.split('.').pop() || content.type.split('/')[1]?.split(';')[0] || 'bin';
        const bucket = (type === 'voice' || type === 'audio') ? 'voice_notes' : 'scrapbook';
        const fileName = `${roomId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, content);
        if (uploadError) throw uploadError;

        finalContent = `${bucket}/${fileName}`;
        
        if (content.name && !meta.fileName) meta.fileName = content.name;
        if (content.size && !meta.fileSize) meta.fileSize = content.size;
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: userId,
          type,
          content: finalContent,
          metadata: { ...meta, status: 'sent', client_id: clientId }
        })
        .select()
        .single();

      if (error) throw error;

      if (broadcast) {
        broadcast('chat_message', { sender: userId, type });
      }

      if (data && data.id) {
        const mapped = await mapMessage(data);
        setMessages(prev => {
          // If real-time listener already replaced it, this might be redundant but safe
          if (!prev.some(m => String(m.id).startsWith('temp-') && m.clientId === clientId)) {
             // If temp message is gone (maybe real-time already arrived), just ensure the real one is there
             if (prev.some(m => m.id === mapped.id)) return prev;
             return [...prev, mapped];
          }
          const next = prev.map(m => (String(m.id).startsWith('temp-') && m.clientId === clientId) ? mapped : m);
          localforage.setItem(cacheKey, next);
          return next;
        });
      } else {
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
      }
    } catch (err) {
      console.error('[CHAT] Send error:', err);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'failed' } : m));
    }
  }, [roomId, userId, broadcast]);

  const updateMessage = useCallback(async (idOrIds, updates) => {
    if (!idOrIds) return;
    const isArray = Array.isArray(idOrIds);
    if (isArray && idOrIds.length === 0) return;

    let query = supabase.from('chat_messages').update({ metadata: updates });
    if (isArray) {
      query = query.in('id', idOrIds);
    } else {
      query = query.eq('id', idOrIds);
    }
    const { error } = await query;
    if (error) console.error('[CHAT] Update error:', error);
  }, []);

  const deleteMessage = useCallback(async (id) => {
    if (!id) return;
    const { error } = await supabase.from('chat_messages').delete().eq('id', id);
    if (error) console.error('[CHAT] Delete error:', error);
  }, []);

  const loadMore = useCallback(async () => {
    if (!roomId || !hasMore || loading) return;
    const oldestMsg = messages[0];
    if (!oldestMsg) return;

    const { data, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('room_id', roomId)
      .lt('created_at', oldestMsg.created_at)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('[CHAT] Load more error:', error);
      return;
    }

    if (data) {
      const resolvedData = await Promise.all(data.map(row => mapMessage(row)));
      const sortedData = resolvedData.reverse();
      setMessages(prev => [...sortedData, ...prev]);
      setHasMore(data.length === 50);
    }
  }, [roomId, hasMore, loading, messages]);

  const value = { messages, sendMessage, updateMessage, deleteMessage, loadMore, loading, hasMore };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

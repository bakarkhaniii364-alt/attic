import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import { supabase } from '../lib/supabase.js';
import { useAuth } from './AuthContext.jsx';
import { isTestMode, sendTestStateUpdate, onTestStateUpdate } from '../lib/testMode.js';

const ChatContext = createContext(null);
const CACHE_VERSION = 'v3'; // Bump this to bust stale caches with corrupted sender_id

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
    mapped.text = row.content || '';
    if (row.content && row.content.includes('"ciphertext"')) {
      mapped.text = '[Legacy Encrypted Message]';
    }
  } else if (row.type === 'image') {
    mapped.url = row.content;
  } else if (row.type === 'voice') {
    mapped.audioUrl = row.content;
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

      // Serve versioned cache — stale v1/v2 caches are automatically skipped
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
              if (prev.some(m => m.id === mapped.id)) return prev;
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

  /**
   * sendMessage — the sender is ALWAYS the current logged-in user (userId from context).
   * Signature: (content, type?, metadata?)
   * Do NOT pass a senderId externally — it caused the identity bug where metadata
   * was shifted into the senderId slot, making all messages appear as the partner's.
   */
  const sendMessage = useCallback(async (content, type = 'text', metadata = {}) => {
    // Guard: if a non-object sneaks into the metadata slot (e.g., old call sites
    // that still pass userId as 3rd arg), treat it as empty metadata.
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
    const optimisticContent = content instanceof Blob ? URL.createObjectURL(content) : content;

    // Optimistic UI: show message immediately, attributed to current user
    const optimisticMsg = {
      id: tempId,
      room_id: roomId,
      sender_id: userId,
      type,
      content: optimisticContent,
      metadata: { ...meta, status: 'sending' },
      created_at: new Date().toISOString()
    };

    const mappedOptimistic = await mapMessage(optimisticMsg);
    setMessages(prev => [...prev, mappedOptimistic]);

    // In test mode, skip the real DB call — just broadcast and keep optimistic
    if (isTestMode()) {
      sendTestStateUpdate('chat_message', optimisticMsg);
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, status: 'sent' } : m));
      return optimisticMsg;
    }

    try {
      let finalContent = content;

      if (content instanceof Blob) {
        const fileExt = content.type.split('/')[1]?.split(';')[0] || 'bin';
        const bucket = type === 'voice' ? 'voice_notes' : type === 'image' ? 'scrapbook' : 'doodles';
        const fileName = `${roomId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage.from(bucket).upload(fileName, content);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(fileName);
        finalContent = publicUrl;
      }
      // For text / game_invite / etc — finalContent is already the string

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: userId,   // Always the logged-in user — never external
          type,
          content: finalContent,
          metadata: { ...meta, status: 'sent' }
        })
        .select()
        .single();

      if (error) throw error;

      // CRITICAL: Only replace the optimistic message if DB returned a valid row.
      // If data is empty or missing an id (e.g. mock/RLS returned nothing), keep
      // the optimistic message and just mark it 'sent' to avoid identity corruption.
      if (data && data.id) {
        const mapped = await mapMessage(data);
        setMessages(prev => {
          const next = prev.map(m => m.id === tempId ? mapped : m);
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
  }, [roomId, userId]);

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

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat must be used within a ChatProvider');
  return context;
}

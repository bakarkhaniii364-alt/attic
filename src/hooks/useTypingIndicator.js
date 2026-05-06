import { useState, useRef } from 'react';
import { useBroadcast } from './useSupabaseSync.js';

export function useTypingIndicator(userId, partnerId) {
  const [isTypingLocal, setIsTypingLocal] = useState(false);
  const [isPartnerTyping, setIsPartnerTyping] = useState(false);
  const typingTimeoutRef = useRef(null);

  const sendTyping = useBroadcast('typing', (payload) => {
    if (payload.userId === partnerId) {
      setIsPartnerTyping(payload.isTyping);
    }
  });

  const handleTyping = () => {
    if (!isTypingLocal) {
      setIsTypingLocal(true);
      sendTyping({ userId, isTyping: true });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTypingLocal(false);
      sendTyping({ userId, isTyping: false });
    }, 1500);
  };

  const stopTyping = () => {
    if (isTypingLocal) {
      setIsTypingLocal(false);
      sendTyping({ userId, isTyping: false });
    }
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  return {
    isTypingLocal,
    isPartnerTyping,
    handleTyping,
    stopTyping
  };
}

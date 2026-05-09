import { createContext } from 'react';

/**
 * Shared Context Instances
 * 
 * Moving these to a dedicated file prevents "ReferenceError: Cannot access before initialization"
 * which occurs when multiple context files import each other's hooks.
 */

export const AuthContext = createContext(null);
export const SyncContext = createContext(null);
export const CallContext = createContext(null);
export const ChatContext = createContext(null);

import { supabase } from '../src/lib/supabase.js';

let currentUser = null;
let currentSession = null;

export async function initAuth(onUserChange) {
  const { data: { session } } = await supabase.auth.getSession();
  currentSession = session;
  currentUser = session?.user || null;
  onUserChange(currentUser);

  supabase.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    currentUser = session?.user || null;
    onUserChange(currentUser);
  });
}

export function getUser() {
  return currentUser;
}

export async function login(email, password) {
  return await supabase.auth.signInWithPassword({ email, password });
}

export async function logout() {
  return await supabase.auth.signOut();
}

/**
 * Test mode — only enabled in development or when VITE_ENABLE_TEST_MODE=true.
 * Prevents production bypass of auth/network.
 */

const isDev = import.meta.env.DEV;
const testModeExplicitlyEnabled = import.meta.env.VITE_ENABLE_TEST_MODE === 'true';

export const canUseTestMode = () => isDev || testModeExplicitlyEnabled;

export const isTestMode = () => {
  if (!canUseTestMode() || typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return params.get('test_mode') === 'true' || localStorage.getItem('attic_test_mode') === 'true';
};

export const getTestUser = () => {
  if (typeof window === 'undefined') return 'userA';
  const params = new URLSearchParams(window.location.search);
  const urlUser = params.get('user');
  if (urlUser) return urlUser;
  return localStorage.getItem('attic_test_user') || 'userA';
};

const testChannel = typeof window !== 'undefined' ? new BroadcastChannel('attic_test_sync') : null;
const socketListeners = new Set();

function initTestRelay() {
  if (!isTestMode()) return;

  if (testChannel) {
    testChannel.onmessage = (e) => {
      try {
        socketListeners.forEach((l) => l(e.data));
      } catch (err) {
        console.error('[TEST_CHANNEL] Parse error:', err);
      }
    };
  }
}

if (typeof window !== 'undefined' && isTestMode()) {
  initTestRelay();
}

const getHexFromSuffix = (suffix) => {
  let hex = '';
  if (suffix) {
    for (let i = 0; i < suffix.length; i++) {
      hex += suffix.charCodeAt(i).toString(16);
    }
  }
  return hex.padEnd(12, '0').substring(0, 12);
};

export const getTestRoomId = () => {
  if (typeof window === 'undefined') return '';
  const user = getTestUser();
  const [, suffix] = user.split('_');
  const hex = getHexFromSuffix(suffix);
  return `00000000-0000-0000-0000-${hex}`;
};

export const sendTestBroadcast = (event, payload) => {
  let cleanPayload = payload;
  try {
    cleanPayload = JSON.parse(JSON.stringify(payload));
  } catch {
    /* keep original */
  }

  const msg = {
    type: 'broadcast',
    event,
    payload: cleanPayload,
    sender: getTestUser(),
    roomId: getTestRoomId(),
  };
  testChannel?.postMessage(msg);
};

export const onTestBroadcast = (event, callback) => {
  const roomId = getTestRoomId();
  const handler = (data) => {
    if (
      data.type === 'broadcast' &&
      (event === '*' || data.event === event) &&
      data.roomId === roomId &&
      data.sender !== getTestUser()
    ) {
      callback(data.payload, data.event);
    }
  };
  socketListeners.add(handler);
  return () => socketListeners.delete(handler);
};

export const sendTestStateUpdate = (key, value) => {
  let cleanValue = value;
  try {
    cleanValue = JSON.parse(JSON.stringify(value));
  } catch {
    /* keep original */
  }

  const msg = {
    type: 'state_update',
    key,
    value: cleanValue,
    sender: getTestUser(),
    roomId: getTestRoomId(),
  };
  testChannel?.postMessage(msg);
};

export const onTestStateUpdate = (key, callback) => {
  const roomId = getTestRoomId();
  const handler = (data) => {
    if (data.type === 'state_update' && (key === '*' || data.key === key) && data.roomId === roomId) {
      callback(data.value, data.key);
    }
  };
  socketListeners.add(handler);
  return () => socketListeners.delete(handler);
};

export const sendTestStateRequest = (key) => {
  const msg = { type: 'get_test_state', key, roomId: getTestRoomId() };
  testChannel?.postMessage(msg);
};

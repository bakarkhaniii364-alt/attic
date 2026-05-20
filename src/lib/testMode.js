/**
 * Centralized logic for the App's "Test Mode"
 * Used to bypass real network dependencies during E2E tests.
 */

export const isTestMode = () => {
    if (typeof window === 'undefined') return false;
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

// Global WebSocket and BroadcastChannel for cross-context communication in test mode
let testSocket = null;
const testChannel = typeof window !== 'undefined' ? new BroadcastChannel('attic_test_sync') : null;
const socketListeners = new Set();
let pendingMessages = [];

if (isTestMode()) {
    testSocket = new WebSocket('ws://localhost:8080');
    testSocket.onmessage = (e) => {
        try {
            const data = JSON.parse(e.data);
            console.log('[TEST_SOCKET] Message received:', data);
            socketListeners.forEach(l => l(data));
        } catch (err) {
            console.error('[TEST_SOCKET] Parse error:', err);
        }
    };
    testSocket.onopen = () => {
        console.log('[TEST_SOCKET] Connected to relay');
        pendingMessages.forEach(msg => testSocket.send(JSON.stringify(msg)));
        pendingMessages = [];
    };
    testSocket.onerror = (e) => console.error('[TEST_SOCKET] Relay error', e);

    if (testChannel) {
        testChannel.onmessage = (e) => {
            try {
                const data = e.data;
                socketListeners.forEach(l => l(data));
            } catch (err) {
                console.error('[TEST_CHANNEL] Parse error:', err);
            }
        };
    }
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
    const [_, suffix] = user.split('_');
    const hex = getHexFromSuffix(suffix);
    return `00000000-0000-0000-0000-${hex}`;
};

export const sendTestBroadcast = (event, payload) => {
    let cleanPayload = payload;
    try {
        cleanPayload = JSON.parse(JSON.stringify(payload));
    } catch (e) {}

    const msg = { 
        type: 'broadcast', 
        event, 
        payload: cleanPayload, 
        sender: getTestUser(),
        roomId: getTestRoomId() 
    };
    if (testSocket && testSocket.readyState === WebSocket.OPEN) {
        testSocket.send(JSON.stringify(msg));
    } else if (testSocket) {
        pendingMessages.push(msg);
    }
    if (testChannel) {
        testChannel.postMessage(msg);
    }
};

export const onTestBroadcast = (event, callback) => {
    const roomId = getTestRoomId();
    const handler = (data) => {
        if (data.type === 'broadcast' && 
            (event === '*' || data.event === event) && 
            data.roomId === roomId && 
            data.sender !== getTestUser()) {
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
    } catch (e) {}

    const msg = { 
        type: 'state_update', 
        key, 
        value: cleanValue, 
        sender: getTestUser(),
        roomId: getTestRoomId() 
    };
    if (testSocket && testSocket.readyState === WebSocket.OPEN) {
        testSocket.send(JSON.stringify(msg));
    } else if (testSocket) {
        pendingMessages.push(msg);
    }
    if (testChannel) {
        testChannel.postMessage(msg);
    }
};

export const onTestStateUpdate = (key, callback) => {
    const roomId = getTestRoomId();
    const handler = (data) => {
        if (data.type === 'state_update' && 
            (key === '*' || data.key === key) && 
            data.roomId === roomId) {
            callback(data.value, data.key);
        }
    };
    socketListeners.add(handler);
    return () => socketListeners.delete(handler);
};

export const sendTestStateRequest = (key) => {
    const msg = { 
        type: 'get_test_state', 
        key, 
        roomId: getTestRoomId() 
    };
    if (testSocket && testSocket.readyState === WebSocket.OPEN) {
        testSocket.send(JSON.stringify(msg));
    } else if (testSocket) {
        pendingMessages.push(msg);
    }
};

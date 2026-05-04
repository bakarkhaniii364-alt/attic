import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

console.log('Attic Test Sync Relay started on ws://localhost:8080');

const stateCache = {};

wss.on('connection', (ws) => {
  console.log('[RELAY] New client connected');
  
  // Send cached states on connection
  Object.values(stateCache).forEach((cachedMsg) => {
    ws.send(JSON.stringify(cachedMsg));
  });

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log(`[RELAY] Broadcasting: ${message.type || 'unknown'}`);
      
      if (message.type === 'state_update') {
        stateCache[`${message.roomId}_${message.key}`] = message;
      }

      if (message.type === 'get_test_state') {
        const cached = stateCache[`${message.roomId}_${message.key}`];
        if (cached) {
          ws.send(JSON.stringify(cached));
        }
      }

      // Broadcast to all other clients
      wss.clients.forEach((client) => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify(message));
        }
      });
    } catch (e) {
      console.error('[RELAY] Error parsing message:', e);
    }
  });

  ws.on('close', () => {
    console.log('[RELAY] Client disconnected');
  });
});

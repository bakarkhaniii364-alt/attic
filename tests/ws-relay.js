import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 8080 });

console.log('Attic Test Sync Relay started on ws://localhost:8080');

wss.on('connection', (ws) => {
  console.log('[RELAY] New client connected');
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);
      console.log(`[RELAY] Broadcasting: ${message.type || 'unknown'}`);
      
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

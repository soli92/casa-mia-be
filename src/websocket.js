import { WebSocketServer } from 'ws';
import { verifyAccessToken } from './utils/jwt.js';

export const initWebSocket = (server) => {
  const wss = new WebSocketServer({ server, path: '/ws' });

  // Mappa familyId -> array di connessioni WebSocket
  const familyConnections = new Map();

  wss.on('connection', (ws, req) => {
    console.log('🔌 Nuova connessione WebSocket');

    let familyId = null;
    let userId = null;

    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());

        // Autenticazione
        if (data.type === 'auth') {
          const user = verifyAccessToken(data.token);
          
          if (!user) {
            ws.send(JSON.stringify({ type: 'error', message: 'Token non valido' }));
            ws.close();
            return;
          }

          familyId = user.familyId;
          userId = user.id;

          // Aggiungi connessione alla famiglia
          if (!familyConnections.has(familyId)) {
            familyConnections.set(familyId, []);
          }
          familyConnections.get(familyId).push(ws);

          ws.send(JSON.stringify({ 
            type: 'auth_success', 
            message: 'Autenticato con successo',
            userId,
            familyId,
          }));

          console.log(`✅ WebSocket autenticato: user ${userId}, family ${familyId}`);
        }

        // Broadcast evento IoT a tutta la famiglia
        if (data.type === 'iot_event' && familyId) {
          broadcastToFamily(familyId, {
            type: 'iot_update',
            deviceId: data.deviceId,
            payload: data.payload,
            timestamp: new Date().toISOString(),
          });
        }

        // Broadcast aggiornamento generico
        if (data.type === 'update' && familyId) {
          broadcastToFamily(familyId, {
            type: 'data_update',
            resource: data.resource, // shopping, pantry, deadlines, etc
            action: data.action, // create, update, delete
            data: data.data,
            userId,
            timestamp: new Date().toISOString(),
          });
        }

      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({ type: 'error', message: 'Errore nel messaggio' }));
      }
    });

    ws.on('close', () => {
      // Rimuovi connessione dalla famiglia
      if (familyId && familyConnections.has(familyId)) {
        const connections = familyConnections.get(familyId);
        const index = connections.indexOf(ws);
        if (index > -1) {
          connections.splice(index, 1);
        }
        if (connections.length === 0) {
          familyConnections.delete(familyId);
        }
      }
      console.log('🔌 Connessione WebSocket chiusa');
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  // Funzione per inviare a tutti i membri di una famiglia
  const broadcastToFamily = (familyId, message) => {
    const connections = familyConnections.get(familyId);
    if (connections) {
      const messageStr = JSON.stringify(message);
      connections.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
          ws.send(messageStr);
        }
      });
    }
  };

  // Esporta per uso esterno
  wss.broadcastToFamily = broadcastToFamily;

  console.log('🌐 WebSocket server inizializzato su /ws');

  return wss;
};

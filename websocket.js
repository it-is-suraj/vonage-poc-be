import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const RECORDINGS_DIR = path.join(__dirname, 'recordings');
if (!fs.existsSync(RECORDINGS_DIR)) {
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
}

export function setupAudioConnectorWebSocket(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/media/stream') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const userId = url.searchParams.get('userId') || req.headers['x-user-id'] || 'unknown_user';
    const streamId = url.searchParams.get('streamId') || req.headers['x-stream-id'] || 'unknown_stream';
    const sessionId = url.searchParams.get('sessionId') || req.headers['x-session-id'] || 'unknown_session';

    console.log(`[AudioConnector WSS] Connected -> User: ${userId} | Stream: ${streamId} | Session: ${sessionId}`);

    const timestamp = Date.now();
    const fileName = `call_${userId}_${timestamp}.raw`;
    const audioFilePath = path.join(RECORDINGS_DIR, fileName);
    const audioStream = fs.createWriteStream(audioFilePath, { flags: 'a' });

    ws.on('message', (data, isBinary) => {
      if (!isBinary) {
        try {
          const message = JSON.parse(data.toString());
          console.log(`[AudioConnector Control][${userId}]:`, JSON.stringify(message, null, 2));
        } catch (err) {
          console.log(`[TEST Text Message][User: ${userId}]:`, data.toString());
          console.error('[AudioConnector] Failed to parse text message:', err);
        }
      } else {
        audioStream.write(data);
        // handleIncomingAudioChunk(data, { userId, streamId, sessionId });
      }
    });

    const cleanup = () => {
      if (audioStream && !audioStream.writableEnded) {
        audioStream.end();
        console.log(`[AudioFile] ${fileName} Saved.`);
      }
    }

    ws.on('close', (code, reason) => {
      console.log(`[AudioConnector WSS] Disconnected -> User: ${userId} (${code})`);
      cleanup();
    });

    ws.on('error', (err) => {
      console.error(`[AudioConnector WSS Error][${userId}]:`, err);
      cleanup();
    });
  });
}

function handleIncomingAudioChunk(pcmChunk, { userId, streamId, sessionId }) {
  // Feed this to User-tagged STT Pipeline
}
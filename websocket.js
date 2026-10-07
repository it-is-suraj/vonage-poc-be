import { WebSocketServer } from 'ws';

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

    let chunkCount = 0;
    let totalBytes = 0;
    const startTime = Date.now();

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
        chunkCount++;
        totalBytes += data.length;

        // Log progress every 50 chunks (~1 to 2 seconds of audio)
        if (chunkCount % 50 === 0) {
          const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
          const kbReceived = (totalBytes / 1024).toFixed(1);
          const rateKbps = (kbReceived / elapsedSec).toFixed(1);

          console.log(
            `[AUDIO STREAMING] User: "${userId}" | Chunks: ${chunkCount} | Received: ${kbReceived} KB | Elapsed: ${elapsedSec}s (~${rateKbps} KB/s)`
          );
        }

        // handleIncomingAudioChunk(data, { userId, streamId, sessionId });
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`[AudioConnector WSS] Disconnected -> User: ${userId} (${code})`);
    });

    ws.on('error', (err) => {
      console.error(`[AudioConnector WSS Error][${userId}]:`, err);
    });
  });
}

function handleIncomingAudioChunk(pcmChunk, { userId, streamId, sessionId }) {
  // Feed this to User-tagged STT Pipeline
}
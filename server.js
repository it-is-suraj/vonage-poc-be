import 'dotenv/config';

import express from 'express';
import http from 'http';
import cors from 'cors';
import vonage, { applicationId } from './vonage.js';
import { setupAudioConnectorWebSocket } from './websocket.js';
import { startParticipantAudioConnector, stopParticipantAudioConnector } from './audio-connector.js';

const app = express();
const server = http.createServer(app);

const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN || '*';
app.use(cors({ origin: ALLOWED_ORIGIN, methods: ['GET', 'POST'] }));
app.use(express.json());

// In-memory lookups
const roomSessions = new Map();         // roomName -> sessionId
const streamConnectors = new Map();     // streamId -> connectorId

app.post('/api/session/join', async (req, res) => {
  const { roomName, userId } = req.body;
  if (!roomName || !userId) {
    return res.status(400).json({ error: 'roomName and userId are required' });
  }

  try {
    let sessionId = roomSessions.get(roomName);
    if (!sessionId) {
      const session = await vonage.video.createSession({ mediaMode: 'routed', archiveMode: 'always' });
      sessionId = session.sessionId;
      roomSessions.set(roomName, sessionId);
      console.log(`[Session Created] Room: ${roomName} -> Session: ${sessionId}`);
    }

    const connectionData = JSON.stringify({ userId: String(userId) });
    const token = vonage.video.generateClientToken(sessionId, {
      role: 'publisher',
      expireTime: Math.floor(Date.now() / 1000) + (24 * 3600),
      data: connectionData
    });

    res.json({ applicationId, sessionId, token, userId });
  } catch (err) {
    console.error('Session join failure:', err);
    res.status(500).json({
      error: 'Failed to join session',
      details: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
    });
  }
});

app.post('/api/audio-connector/start-participant', async (req, res) => {
  const { sessionId, streamId, userId } = req.body;

  if (!sessionId || !streamId || !userId) {
    return res.status(400).json({ error: 'sessionId, streamId, and userId are required' });
  }

  try {
    if (streamConnectors.has(streamId)) {
      return res.status(200).json({ status: 'already_connected', connectorId: streamConnectors.get(streamId) });
    }

    const connectorData = await startParticipantAudioConnector(sessionId, streamId, userId);
    streamConnectors.set(streamId, connectorData.id);

    console.log(`[Connector Active] User: ${userId} | Stream: ${streamId} -> Connector: ${connectorData.id}`);
    res.json(connectorData);
  } catch (err) {
    console.error(`[Connector Failed] User: ${userId} | Stream: ${streamId}:`, err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/audio-connector/stop-participant', async (req, res) => {
  const { streamId } = req.body;
  if (!streamId) return res.status(400).json({ error: 'streamId is required' });

  try {
    const connectorId = streamConnectors.get(streamId);
    if (!connectorId) {
      return res.status(404).json({ error: 'No active connector found for stream' });
    }

    await stopParticipantAudioConnector(connectorId);
    streamConnectors.delete(streamId);

    console.log(`[Connector Stopped] Stream: ${streamId} -> Connector: ${connectorId}`);
    res.json({ status: 'stopped', connectorId });
  } catch (err) {
    console.error('Failed to stop connector:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now()
  });
});

app.get('/recordings', (req, res) => {
  try {
    const files = fs.readdirSync(RECORDINGS_DIR).map(fileName => {
      const stats = fs.statSync(path.join(RECORDINGS_DIR, fileName));
      return {
        fileName,
        sizeBytes: stats.size,
        createdAt: stats.birthtime
      };
    });
    res.json({ recordings: files });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve recordings', details: err.message });
  }
});

app.get('/recordings/:fileName', (req, res) => {
  const fileName = path.basename(req.params.fileName); // sanitize filename
  const filePath = path.join(RECORDINGS_DIR, fileName);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Recording not found');
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

  const readStream = fs.createReadStream(filePath);
  readStream.pipe(res);
});

setupAudioConnectorWebSocket(server);

server.listen(process.env.PORT || 5000, () => {
  console.log('Server listening on port', process.env.PORT || 5000);
});
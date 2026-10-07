import vonage from "./vonage.js";

export async function startParticipantAudioConnector(sessionId, streamId, userId) {
  const token = vonage.video.generateClientToken(sessionId, {
    role: 'subscriber',
    data: JSON.stringify({ role: 'audio-connector', targetUserId: userId }),
  });

  const domain = process.env.RENDER_EXTERNAL_HOSTNAME || process.env.PUBLIC_DOMAIN || 'localhost:5000';
  const protocol = domain.includes('localhost') ? 'ws' : 'wss';

  const query = new URLSearchParams({ userId, streamId, sessionId }).toString();
  const uri = `${protocol}://${domain}/media/stream?${query}`;

  const response = await vonage.video.connectToWebsocket(
    sessionId,
    token,
    {
      uri,
      audioRate: 16000,
      streams: [streamId],
      headers: {
        'x-session-id': sessionId,
        'x-user-id': String(userId),
        'x-stream-id': streamId,
      },
    }
  );

  return response;
}

export async function stopParticipantAudioConnector(connectionId) {
  return await vonage.video.stopWebsocket(connectionId);
}
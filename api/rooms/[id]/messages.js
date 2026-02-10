// GET/POST /api/rooms/[id]/messages — 收发消息
import { postMessage, getMessages, getRoom } from '../../../src/store.js';
import { authRoom, jsonResponse, errorResponse } from '../../../src/utils.js';

export default async function handler(req, { params }) {
  const roomId = params.id;
  const auth = await authRoom(req, roomId);
  if (!auth.ok) return errorResponse(auth.error, auth.status);

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const since = parseInt(url.searchParams.get('since') || '0');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const msgs = await getMessages(roomId, since, Math.min(limit, 100));
    return jsonResponse({ messages: msgs });
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      if (!body.sender || !body.content) {
        return errorResponse('sender and content required');
      }
      const msg = await postMessage(
        roomId,
        body.sender,
        body.content,
        body.type || 'text'
      );
      return jsonResponse(msg, 201);
    } catch (e) {
      return errorResponse(e.message, 500);
    }
  }

  return errorResponse('Method not allowed', 405);
}

export const config = { runtime: 'edge' };

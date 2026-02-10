// POST /api/rooms/[id]/join — 加入房间
import { joinRoom } from '../../../src/store.js';
import { authRoom, jsonResponse, errorResponse } from '../../../src/utils.js';

export default async function handler(req, { params }) {
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  const roomId = params.id;
  const auth = await authRoom(req, roomId);
  if (!auth.ok) return errorResponse(auth.error, auth.status);

  try {
    const body = await req.json();
    if (!body.id || !body.name) {
      return errorResponse('id and name required');
    }
    const room = await joinRoom(roomId, { id: body.id, name: body.name });
    return jsonResponse({ members: room.members });
  } catch (e) {
    return errorResponse(e.message, 500);
  }
}

export const config = { runtime: 'edge' };

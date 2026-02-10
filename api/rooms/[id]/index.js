// GET /api/rooms/[id] — 获取房间信息
import { getRoom } from '../../../src/store.js';
import { authRoom, jsonResponse, errorResponse } from '../../../src/utils.js';

export default async function handler(req, { params }) {
  if (req.method !== 'GET') {
    return errorResponse('Method not allowed', 405);
  }

  const roomId = params.id;
  const auth = await authRoom(req, roomId);
  if (!auth.ok) return errorResponse(auth.error, auth.status);

  const room = auth.room;
  return jsonResponse({
    id: room.id,
    name: room.name,
    created: room.created,
    members: room.members
  });
}

export const config = { runtime: 'edge' };

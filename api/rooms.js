// POST /api/rooms — 创建房间
import { createRoom } from '../src/store.js';
import { jsonResponse, errorResponse } from '../src/utils.js';

export default async function handler(req) {
  if (req.method !== 'POST') {
    return errorResponse('Method not allowed', 405);
  }

  try {
    const body = await req.json();
    const room = await createRoom(body.name);
    return jsonResponse({
      id: room.id,
      name: room.name,
      token: room.token,
      created: room.created
    }, 201);
  } catch (e) {
    return errorResponse(e.message, 500);
  }
}

export const config = { runtime: 'edge' };

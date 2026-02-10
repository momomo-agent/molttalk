// 简单认证：room token 验证
import { getRoom } from './store.js';

export async function authRoom(req, roomId) {
  const auth = req.headers.get?.('authorization') || req.headers?.['authorization'] || '';
  const token = auth.replace('Bearer ', '');
  
  if (!token) {
    return { ok: false, status: 401, error: 'Missing token' };
  }
  
  const room = await getRoom(roomId);
  if (!room) {
    return { ok: false, status: 404, error: 'Room not found' };
  }
  
  if (room.token !== token) {
    return { ok: false, status: 403, error: 'Invalid token' };
  }
  
  return { ok: true, room };
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function errorResponse(message, status = 400) {
  return jsonResponse({ error: message }, status);
}

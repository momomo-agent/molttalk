// Vercel KV 存储层
// 数据结构：
// room:{id} -> { id, name, created, members: [] }
// room:{id}:msgs -> sorted set (score=timestamp, value=JSON message)
// room:{id}:seq -> 消息序号计数器

import { kv } from '@vercel/kv';
import crypto from 'crypto';

export function generateId() {
  return crypto.randomBytes(6).toString('hex');
}

export function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

export async function createRoom(name) {
  const id = generateId();
  const token = generateToken();
  const room = {
    id,
    name: name || `room-${id}`,
    token,
    created: Date.now(),
    members: []
  };
  await kv.set(`room:${id}`, JSON.stringify(room));
  return room;
}

export async function getRoom(id) {
  const raw = await kv.get(`room:${id}`);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

export async function joinRoom(roomId, member) {
  const room = await getRoom(roomId);
  if (!room) return null;
  
  const exists = room.members.find(m => m.id === member.id);
  if (!exists) {
    room.members.push({
      id: member.id,
      name: member.name || 'anonymous',
      joined: Date.now()
    });
    await kv.set(`room:${roomId}`, JSON.stringify(room));
  }
  return room;
}

export async function postMessage(roomId, senderId, content, type = 'text') {
  const seq = await kv.incr(`room:${roomId}:seq`);
  const msg = {
    seq,
    sender: senderId,
    content,
    type, // text | memory | system
    ts: Date.now()
  };
  // 用 sorted set，score 是 seq
  await kv.zadd(`room:${roomId}:msgs`, { score: seq, member: JSON.stringify(msg) });
  // 只保留最近 500 条
  const count = await kv.zcard(`room:${roomId}:msgs`);
  if (count > 500) {
    await kv.zremrangebyrank(`room:${roomId}:msgs`, 0, count - 501);
  }
  return msg;
}

export async function getMessages(roomId, since = 0, limit = 50) {
  const raw = await kv.zrangebyscore(
    `room:${roomId}:msgs`,
    since + 1,  // exclusive
    '+inf',
    { count: limit, offset: 0 }
  );
  return (raw || []).map(item => typeof item === 'string' ? JSON.parse(item) : item);
}

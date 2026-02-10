// 内存存储（Node.js Runtime，同实例内共享）
const crypto = require('crypto');

// 全局变量在同一实例内持久
if (!global._molttalk) {
  global._molttalk = { rooms: {}, messages: {}, sequences: {} };
}
const store = global._molttalk;

function generateId() {
  return crypto.randomBytes(6).toString('hex');
}

function generateToken() {
  return crypto.randomBytes(16).toString('hex');
}

function createRoom(name) {
  const id = generateId();
  const token = generateToken();
  const room = { id, name: name || `room-${id}`, token, created: Date.now(), members: [] };
  store.rooms[id] = room;
  store.messages[id] = [];
  store.sequences[id] = 0;
  return room;
}

function getRoom(id) {
  return store.rooms[id] || null;
}

function joinRoom(roomId, member) {
  const room = store.rooms[roomId];
  if (!room) return null;
  if (!room.members.find(m => m.id === member.id)) {
    room.members.push({ id: member.id, name: member.name || 'anonymous', joined: Date.now() });
  }
  return room;
}

function leaveRoom(roomId, memberId) {
  const room = store.rooms[roomId];
  if (!room) return null;
  room.members = room.members.filter(m => m.id !== memberId);
  return room;
}

function getMembers(roomId) {
  const room = store.rooms[roomId];
  if (!room) return [];
  return room.members;
}

function postMessage(roomId, senderId, content, type = 'text') {
  const seq = (store.sequences[roomId] || 0) + 1;
  store.sequences[roomId] = seq;
  const msg = { seq, sender: senderId, content, type, ts: Date.now() };
  if (!store.messages[roomId]) store.messages[roomId] = [];
  store.messages[roomId].push(msg);
  if (store.messages[roomId].length > 500) {
    store.messages[roomId] = store.messages[roomId].slice(-500);
  }
  return msg;
}

function getMessages(roomId, since = 0, limit = 50) {
  const msgs = store.messages[roomId] || [];
  return msgs.filter(m => m.seq > since).slice(0, limit);
}

module.exports = { createRoom, getRoom, joinRoom, leaveRoom, getMembers, postMessage, getMessages };

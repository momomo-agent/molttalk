// KV-backed store
const { kvGet, kvPut } = require('./kv');

function generateId() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

function generateToken() {
  return Array.from({length: 32}, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random()*36)]).join('');
}

async function createRoom(name, creator) {
  const id = generateId();
  const token = generateToken();
  const room = { id, name: name || 'unnamed', token, members: [], messages: [], created: Date.now() };
  if (creator) room.members.push({ id: creator, name: creator, joined: Date.now() });
  await kvPut(`room:${id}`, room);
  return room;
}

async function getRoom(id) {
  return await kvGet(`room:${id}`);
}

async function saveRoom(room) {
  await kvPut(`room:${room.id}`, room);
}

module.exports = { createRoom, getRoom, saveRoom };

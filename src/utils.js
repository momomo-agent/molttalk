// Server version — bump this on breaking changes
const SERVER_VERSION = '1.2.0';

function json(res, data, status = 200) {
  res.setHeader('X-MoltTalk-Version', SERVER_VERSION);
  res.status(status).json(data);
}

function error(res, msg, status = 400) {
  res.setHeader('X-MoltTalk-Version', SERVER_VERSION);
  res.status(status).json({ error: msg });
}

function authRoom(req, room) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401, error: 'Missing token' };
  if (room.token !== token) return { ok: false, status: 403, error: 'Invalid token' };
  return { ok: true };
}

module.exports = { authRoom, json, error, SERVER_VERSION };

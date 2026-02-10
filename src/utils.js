function authRoom(req, room) {
  const auth = req.headers['authorization'] || '';
  const token = auth.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401, error: 'Missing token' };
  if (room.token !== token) return { ok: false, status: 403, error: 'Invalid token' };
  return { ok: true };
}

function json(res, data, status = 200) {
  res.status(status).json(data);
}

function error(res, msg, status = 400) {
  res.status(status).json({ error: msg });
}

module.exports = { authRoom, json, error };

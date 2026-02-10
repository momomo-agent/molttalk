// Cloudflare KV REST API storage
const CF_API = 'https://api.cloudflare.com/client/v4';

function getConfig() {
  return {
    token: process.env.CF_API_TOKEN,
    account: process.env.CF_ACCOUNT_ID,
    kvId: process.env.CF_KV_ID
  };
}

function kvUrl(key) {
  const c = getConfig();
  return `${CF_API}/accounts/${c.account}/storage/kv/namespaces/${c.kvId}/values/${encodeURIComponent(key)}`;
}

function headers() {
  return { 'Authorization': `Bearer ${getConfig().token}` };
}

async function kvGet(key) {
  const res = await fetch(kvUrl(key), { headers: headers() });
  if (res.status === 404) return null;
  const text = await res.text();
  try { return JSON.parse(text); } catch { return null; }
}

async function kvPut(key, value) {
  await fetch(kvUrl(key), {
    method: 'PUT',
    headers: headers(),
    body: JSON.stringify(value)
  });
}

module.exports = { kvGet, kvPut };

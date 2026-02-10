#!/usr/bin/env node
// MoltTalk CLI — OpenClaw skill 用的命令行工具

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '.molttalk.json');

function loadConfig() {
  const env = {
    url: process.env.MOLTTALK_URL || 'https://molttalk.site',
    room: process.env.MOLTTALK_ROOM || '',
    token: process.env.MOLTTALK_TOKEN || '',
    name: process.env.MOLTTALK_NAME || 'anonymous',
    lastSeq: 0
  };
  if (fs.existsSync(CONFIG_PATH)) {
    try {
      const file = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
      return { ...env, ...file };
    } catch { return env; }
  }
  return env;
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function request(method, urlStr, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const mod = url.protocol === 'https:' ? https : http;
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
    const req = mod.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const args = process.argv.slice(2);
  const cmd = args[0];
  const cfg = loadConfig();

  if (cmd === 'create') {
    const name = getArg(args, '--name') || 'molttalk-room';
    const res = await request('POST', `${cfg.url}/api/rooms`, { name });
    if (res.status === 201) {
      cfg.room = res.data.id;
      cfg.token = res.data.token;
      saveConfig(cfg);
      console.log(JSON.stringify(res.data, null, 2));
    } else {
      console.error('Error:', res.data);
    }
  }

  else if (cmd === 'join') {
    const room = getArg(args, '--room') || cfg.room;
    const token = getArg(args, '--token') || cfg.token;
    const name = getArg(args, '--name') || cfg.name;
    if (!room || !token) { console.error('Need --room and --token'); return; }
    cfg.room = room;
    cfg.token = token;
    cfg.name = name;
    const res = await request('POST', `${cfg.url}/api/rooms/${room}/join`, 
      { id: name, name }, token);
    saveConfig(cfg);
    console.log(JSON.stringify(res.data, null, 2));
  }

  else if (cmd === 'send') {
    const msg = getArg(args, '--message') || getArg(args, '-m') || args[1];
    const type = getArg(args, '--type') || 'text';
    if (!msg) { console.error('Need --message'); return; }
    const res = await request('POST', 
      `${cfg.url}/api/rooms/${cfg.room}/messages`,
      { from: cfg.name, text: msg, type },
      cfg.token);
    console.log(JSON.stringify(res.data, null, 2));
  }

  else if (cmd === 'poll') {
    const since = cfg.lastSeq || 0;
    const res = await request('GET',
      `${cfg.url}/api/rooms/${cfg.room}/messages?since=${since}`,
      null, cfg.token);
    const msgs = res.data?.messages || [];
    if (msgs.length > 0) {
      cfg.lastSeq = msgs[msgs.length - 1].seq;
      saveConfig(cfg);
    }
    console.log(JSON.stringify(msgs, null, 2));
  }

  else if (cmd === 'leave') {
    const res = await request('POST',
      `${cfg.url}/api/rooms/${cfg.room}/leave`,
      { id: cfg.name },
      cfg.token);
    console.log(JSON.stringify(res.data, null, 2));
  }

  else if (cmd === 'members') {
    const res = await request('GET',
      `${cfg.url}/api/rooms/${cfg.room}/members`,
      null, cfg.token);
    console.log(JSON.stringify(res.data, null, 2));
  }

  else if (cmd === 'info') {
    const res = await request('GET',
      `${cfg.url}/api/rooms/${cfg.room}`,
      null, cfg.token);
    console.log(JSON.stringify(res.data, null, 2));
  }

  else {
    console.log('MoltTalk CLI');
    console.log('Commands: create, join, leave, members, send, poll, info');
  }
}

function getArg(args, flag) {
  const i = args.indexOf(flag);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : null;
}

main().catch(e => console.error(e));

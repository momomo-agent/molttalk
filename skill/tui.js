#!/usr/bin/env node
// MoltTalk TUI - Terminal Chat Interface
const readline = require('readline');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '.molttalk.json');

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch { return {}; }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function request(method, url, body, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const opts = { hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: {} };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;
    if (body) opts.headers['Content-Type'] = 'application/json';
    const req = mod.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(data); } });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 颜色
const C = {
  reset: '\x1b[0m', dim: '\x1b[2m',
  green: '\x1b[32m', yellow: '\x1b[33m', cyan: '\x1b[36m',
  red: '\x1b[31m', magenta: '\x1b[35m', bold: '\x1b[1m',
};

const COLORS = [C.green, C.yellow, C.cyan, C.magenta, C.red];
const userColors = {};
let colorIdx = 0;

function getColor(name) {
  if (!userColors[name]) userColors[name] = COLORS[colorIdx++ % COLORS.length];
  return userColors[name];
}

function formatTime(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function printMsg(msg) {
  const color = getColor(msg.from);
  const time = formatTime(msg.ts);
  const type = msg.type === 'memory' ? ` ${C.yellow}[mem]${C.reset}` : '';
  process.stdout.write(`\r${C.dim}${time}${C.reset} ${color}${C.bold}${msg.from}${C.reset}${type}: ${msg.text}\n`);
}

// 主逻辑
async function main() {
  const cfg = loadConfig();
  if (!cfg.room || !cfg.token || !cfg.name) {
    console.log(`${C.red}请先用 cli.js join 加入房间${C.reset}`);
    process.exit(1);
  }
  const url = cfg.url || 'https://molttalk.site';
  let lastTs = cfg.lastTs || 0;

  // 头部
  console.clear();
  console.log(`${C.green}${C.bold}╔══════════════════════════════════╗${C.reset}`);
  console.log(`${C.green}${C.bold}║        MoltTalk Chat TUI        ║${C.reset}`);
  console.log(`${C.green}${C.bold}╚══════════════════════════════════╝${C.reset}`);
  console.log(`${C.dim}房间: ${cfg.room} | 身份: ${cfg.name}${C.reset}`);
  console.log(`${C.dim}输入消息回车发送 | /quit 退出 | /members 查看成员${C.reset}`);
  console.log(`${C.dim}${'─'.repeat(40)}${C.reset}`);

  // 先拉历史消息
  try {
    const res = await request('GET', `${url}/api/rooms/${cfg.room}/messages?since=0`, null, cfg.token);
    const msgs = res.messages || [];
    msgs.forEach(m => printMsg(m));
    if (msgs.length > 0) lastTs = msgs[msgs.length - 1].ts;
  } catch {}

  // readline
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.setPrompt(`${C.green}> ${C.reset}`);
  rl.prompt();

  // 轮询
  const pollInterval = setInterval(async () => {
    try {
      const res = await request('GET', `${url}/api/rooms/${cfg.room}/messages?since=${lastTs}`, null, cfg.token);
      const msgs = (res.messages || []).filter(m => m.from !== cfg.name);
      if (msgs.length > 0) {
        process.stdout.write('\r\x1b[K');
        msgs.forEach(m => printMsg(m));
        lastTs = msgs[msgs.length - 1].ts;
        cfg.lastTs = lastTs;
        saveConfig(cfg);
        rl.prompt();
      }
    } catch {}
  }, 3000);

  // 输入处理
  rl.on('line', async (line) => {
    const text = line.trim();
    if (!text) { rl.prompt(); return; }

    if (text === '/quit' || text === '/exit') {
      clearInterval(pollInterval);
      console.log(`${C.dim}再见 👋${C.reset}`);
      process.exit(0);
    }

    if (text === '/members') {
      try {
        const res = await request('GET', `${url}/api/rooms/${cfg.room}/members`, null, cfg.token);
        console.log(`${C.cyan}成员: ${(res.members||[]).map(m=>m.name).join(', ')}${C.reset}`);
      } catch { console.log(`${C.red}查询失败${C.reset}`); }
      rl.prompt(); return;
    }

    // 发消息
    const type = text.startsWith('/mem ') ? 'memory' : 'text';
    const msg = type === 'memory' ? text.slice(5) : text;
    try {
      const res = await request('POST', `${url}/api/rooms/${cfg.room}/messages`, { from: cfg.name, text: msg, type }, cfg.token);
      if (res.ts) {
        lastTs = res.ts;
        cfg.lastTs = lastTs;
        saveConfig(cfg);
        process.stdout.write(`\x1b[1A\x1b[K`);
        printMsg(res);
      }
    } catch { console.log(`${C.red}发送失败${C.reset}`); }
    rl.prompt();
  });

  rl.on('close', () => { clearInterval(pollInterval); process.exit(0); });
}

main();


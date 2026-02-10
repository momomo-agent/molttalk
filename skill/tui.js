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
function sys(text) { console.log(`${C.dim}${text}${C.reset}`); }

function ask(rl, question) {
  return new Promise(resolve => rl.question(`${C.cyan}${question}${C.reset}`, resolve));
}

let cfg, url, lastTs, pollInterval, rl;

function printHeader() {
  console.clear();
  console.log(`${C.green}${C.bold}╔══════════════════════════════════╗${C.reset}`);
  console.log(`${C.green}${C.bold}║        MoltTalk Chat TUI        ║${C.reset}`);
  console.log(`${C.green}${C.bold}╚══════════════════════════════════╝${C.reset}`);
  if (cfg.room) {
    sys(`房间: ${cfg.room} | 身份: ${cfg.name}`);
  }
  sys('命令: /create /join /switch /members /quit /help');
  sys('─'.repeat(40));
}

function printHelp() {
  sys('命令列表:');
  sys('  /create <名称>     创建新房间');
  sys('  /join <ID> <TOKEN> 加入房间');
  sys('  /switch <ID> <TOKEN> 切换房间');
  sys('  /name <名字>       设置昵称');
  sys('  /members           查看成员');
  sys('  /info              房间信息');
  sys('  /mem <内容>        发送记忆');
  sys('  /quit              退出');
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

function startPolling() {
  stopPolling();
  if (!cfg.room || !cfg.token) return;
  pollInterval = setInterval(async () => {
    try {
      const res = await request('GET', `${url}/api/rooms/${cfg.room}/messages?since=${lastTs}`, null, cfg.token);
      const msgs = (res.messages || []).filter(m => m.from !== cfg.name);
      if (msgs.length > 0) {
        process.stdout.write('\r\x1b[K');
        msgs.forEach(m => printMsg(m));
        lastTs = msgs[msgs.length - 1].ts;
        cfg.lastTs = lastTs; saveConfig(cfg);
        if (rl) rl.prompt();
      }
    } catch {}
  }, 3000);
}

async function loadHistory() {
  if (!cfg.room || !cfg.token) return;
  try {
    const res = await request('GET', `${url}/api/rooms/${cfg.room}/messages?since=0`, null, cfg.token);
    const msgs = res.messages || [];
    msgs.forEach(m => printMsg(m));
    if (msgs.length > 0) lastTs = msgs[msgs.length - 1].ts;
  } catch {}
}

async function switchRoom(roomId, token) {
  stopPolling();
  cfg.room = roomId; cfg.token = token; cfg.lastTs = 0;
  lastTs = 0; saveConfig(cfg);
  printHeader();
  // Join room
  try {
    await request('POST', `${url}/api/rooms/${roomId}/join`, { name: cfg.name, id: cfg.name }, token);
  } catch {}
  await loadHistory();
  startPolling();
  sys(`✅ 已切换到房间 ${roomId}`);
}

async function main() {
  cfg = loadConfig();
  url = cfg.url || 'https://molttalk.site';
  lastTs = cfg.lastTs || 0;

  // 如果没有名字，先问
  if (!cfg.name) {
    const tmpRl = readline.createInterface({ input: process.stdin, output: process.stdout });
    cfg.name = await ask(tmpRl, '你的昵称: ');
    cfg.url = cfg.url || url;
    saveConfig(cfg);
    tmpRl.close();
  }

  printHeader();

  // 如果已有房间，加载历史并开始轮询
  if (cfg.room && cfg.token) {
    await loadHistory();
    startPolling();
  } else {
    sys('还没有加入房间。用 /create 或 /join 开始。');
  }

  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.setPrompt(`${C.green}> ${C.reset}`);
  rl.prompt();

  rl.on('line', async (line) => {
    const text = line.trim();
    if (!text) { rl.prompt(); return; }

    // /quit
    if (text === '/quit' || text === '/exit') {
      stopPolling();
      sys('再见 👋');
      process.exit(0);
    }

    // /help
    if (text === '/help') { printHelp(); rl.prompt(); return; }

    // /create
    if (text.startsWith('/create')) {
      const name = text.slice(8).trim() || 'molttalk-room';
      try {
        const res = await request('POST', `${url}/api/rooms`, { name, creator: cfg.name });
        if (res.id) {
          sys(`✅ 房间创建成功！`);
          sys(`   ID: ${res.id}`);
          sys(`   Token: ${res.token}`);
          await switchRoom(res.id, res.token);
        } else { sys(`❌ 创建失败: ${JSON.stringify(res)}`); }
      } catch (e) { sys(`❌ 创建失败: ${e.message}`); }
      rl.prompt(); return;
    }

    // /join
    if (text.startsWith('/join')) {
      const parts = text.split(/\s+/);
      if (parts.length < 3) { sys('用法: /join <房间ID> <Token>'); rl.prompt(); return; }
      await switchRoom(parts[1], parts[2]);
      rl.prompt(); return;
    }

    // /switch (same as /join)
    if (text.startsWith('/switch')) {
      const parts = text.split(/\s+/);
      if (parts.length < 3) { sys('用法: /switch <房间ID> <Token>'); rl.prompt(); return; }
      await switchRoom(parts[1], parts[2]);
      rl.prompt(); return;
    }

    // /name
    if (text.startsWith('/name')) {
      const newName = text.slice(6).trim();
      if (!newName) { sys('用法: /name <昵称>'); rl.prompt(); return; }
      cfg.name = newName; saveConfig(cfg);
      sys(`✅ 昵称已改为: ${newName}`);
      rl.prompt(); return;
    }

    // /members
    if (text === '/members') {
      if (!cfg.room) { sys('还没有加入房间'); rl.prompt(); return; }
      try {
        const res = await request('GET', `${url}/api/rooms/${cfg.room}/members`, null, cfg.token);
        const members = res.members || [];
        sys('成员列表:');
        members.forEach(m => {
          const seen = m.lastSeen ? ` (最后活跃: ${formatTime(m.lastSeen)})` : '';
          sys(`  ${getColor(m.name)}●${C.reset} ${m.name}${seen}`);
        });
      } catch { sys('❌ 查询失败'); }
      rl.prompt(); return;
    }

    // /info
    if (text === '/info') {
      if (!cfg.room) { sys('还没有加入房间'); rl.prompt(); return; }
      try {
        const res = await request('GET', `${url}/api/rooms/${cfg.room}`, null, cfg.token);
        sys(`房间: ${res.name || res.id}`);
        sys(`ID: ${res.id}`);
        sys(`成员: ${res.members?.length || 0}`);
        sys(`消息: ${res.messageCount || 0}`);
      } catch { sys('❌ 查询失败'); }
      rl.prompt(); return;
    }

    // 没有房间时不能发消息
    if (!cfg.room || !cfg.token) {
      sys('还没有加入房间。用 /create 或 /join 开始。');
      rl.prompt(); return;
    }

    // /mem
    const type = text.startsWith('/mem ') ? 'memory' : 'text';
    const msg = type === 'memory' ? text.slice(5) : text;
    try {
      const res = await request('POST', `${url}/api/rooms/${cfg.room}/messages`,
        { from: cfg.name, text: msg, type }, cfg.token);
      if (res.ts) {
        lastTs = res.ts; cfg.lastTs = lastTs; saveConfig(cfg);
        process.stdout.write(`\x1b[1A\x1b[K`);
        printMsg(res);
      }
    } catch { sys('❌ 发送失败'); }
    rl.prompt();
  });

  rl.on('close', () => { stopPolling(); process.exit(0); });
}

main();

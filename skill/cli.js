#!/usr/bin/env node
// MoltTalk CLI — OpenClaw skill 用的命令行工具
const VERSION = '1.3.0';

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
        'X-MoltTalk-Client': VERSION,
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    };
    const req = mod.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const serverVer = res.headers['x-molttalk-version'];
        if (serverVer && serverVer !== VERSION) {
          console.error(`\x1b[33m⚠️  服务器版本 ${serverVer}，本地版本 ${VERSION}。请执行: node ${__filename} update\x1b[0m`);
        }
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
    const since = cfg.lastTs || 0;
    const res = await request('GET',
      `${cfg.url}/api/rooms/${cfg.room}/messages?since=${since}`,
      null, cfg.token);
    const msgs = res.data?.messages || [];
    if (msgs.length > 0) {
      cfg.lastTs = msgs[msgs.length - 1].ts;
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

  else if (cmd === 'update') {
    const { execSync } = require('child_process');
    const skillDir = __dirname;
    console.log(`当前版本: ${VERSION}`);
    console.log('正在更新...');
    try {
      // 尝试 git pull
      execSync('git pull', { cwd: skillDir, stdio: 'inherit' });
      console.log('✅ 更新完成');
    } catch {
      // 非 git 安装，用 curl 重新下载
      try {
        console.log('非 git 安装，重新下载...');
        execSync(`curl -fsSL https://molttalk.site/install.sh | bash`, { stdio: 'inherit' });
        console.log('✅ 更新完成');
      } catch {
        console.log('❌ 更新失败，请手动执行: curl -fsSL https://molttalk.site/install.sh | bash');
      }
    }
  }

  else if (cmd === 'version') {
    console.log(`MoltTalk CLI v${VERSION}`);
  }

  else if (cmd === 'listen') {
    if (!cfg.room || !cfg.token) { console.error('请先 join 房间'); return; }
    let lastTs = cfg.lastTs || 0;
    console.log(`🔗 监听中... (${cfg.name}@${cfg.room}) 每2秒轮询`);
    
    const doPoll = async () => {
      try {
        const res = await request('GET',
          `${cfg.url}/api/rooms/${cfg.room}/messages?since=${lastTs}`,
          null, cfg.token);
        const msgs = (res.data?.messages || []);
        msgs.forEach(m => {
          const t = new Date(m.ts);
          const ts = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`;
          console.log(`[${ts}] ${m.from}: ${m.text}`);
          lastTs = m.ts;
        });
        if (msgs.length) { cfg.lastTs = lastTs; saveConfig(cfg); }
      } catch {}
    };
    
    // 先拉一次，然后每2秒轮询
    await doPoll();
    setInterval(doPoll, 2000);
    // 保持进程运行
    process.on('SIGINT', () => { console.log('\n退出监听'); process.exit(0); });
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

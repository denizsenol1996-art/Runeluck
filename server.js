// Minimal RuneLuck dev server.
// Serves static files + POST /api/save-layout that writes layouts/current.json
// + simple username/password auth + per-user state persistence.
// Run with: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');

const PORT = 3000;
const ROOT = __dirname;
const LAYOUTS_DIR = path.join(ROOT, 'layouts');
if(!fs.existsSync(LAYOUTS_DIR)) fs.mkdirSync(LAYOUTS_DIR);

// ── Auth: users.json file storage ──
const USERS_FILE = path.join(ROOT, 'users.json');
function loadUsers(){ try { return JSON.parse(fs.readFileSync(USERS_FILE,'utf8')); } catch { return {}; } }
function saveUsers(u){ fs.writeFileSync(USERS_FILE, JSON.stringify(u, null, 2)); }
function hashPw(pw, salt){ return crypto.pbkdf2Sync(pw, salt, 10000, 64, 'sha256').toString('hex'); }
function makeToken(){ return crypto.randomBytes(24).toString('hex'); }
const sessions = {}; // token -> username (in-memory, lost on restart)

function readJsonBody(req, cb){
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => { try { cb(JSON.parse(body || '{}')); } catch { cb(null); } });
}
function jsonOK(res, data){ res.writeHead(200,{'Content-Type':'application/json'}); res.end(JSON.stringify(Object.assign({ok:true}, data))); }
function jsonErr(res, msg, code){ res.writeHead(code||400,{'Content-Type':'application/json'}); res.end(JSON.stringify({ok:false, error:msg})); }

const MIME = {
  '.html':'text/html', '.js':'text/javascript', '.css':'text/css',
  '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg', '.gif':'image/gif', '.svg':'image/svg+xml',
  '.gltf':'model/gltf+json', '.glb':'model/gltf-binary', '.bin':'application/octet-stream',
  '.mp4':'video/mp4', '.webp':'image/webp', '.ico':'image/x-icon',
};

function safePath(req){
  let p = decodeURIComponent(req.url.split('?')[0]);
  if(p === '/') p = '/index.html';
  p = path.normalize(p).replace(/^(\.\.[\/\\])+/, '');
  return path.join(ROOT, p);
}

const server = http.createServer((req, res) => {
  // CORS for local tools
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if(req.method === 'OPTIONS'){ res.writeHead(204); res.end(); return; }

  // ─── Auth endpoints ───
  if(req.method === 'POST' && req.url === '/api/register'){
    readJsonBody(req, (data) => {
      if(!data || !data.username || !data.password) return jsonErr(res, 'username and password required');
      const username = String(data.username).trim().toLowerCase();
      if(username.length < 2 || username.length > 24) return jsonErr(res, 'username must be 2-24 chars');
      if(!/^[a-z0-9_\-]+$/.test(username)) return jsonErr(res, 'username: a-z, 0-9, _, - only');
      const users = loadUsers();
      if(users[username]) return jsonErr(res, 'username already taken');
      const salt = crypto.randomBytes(16).toString('hex');
      users[username] = {
        salt, hash: hashPw(data.password, salt),
        state: { chips: 100000000, created: Date.now() },
        method: data.method || 'password',
      };
      saveUsers(users);
      const token = makeToken();
      sessions[token] = username;
      return jsonOK(res, { token, username, state: users[username].state });
    });
    return;
  }

  if(req.method === 'POST' && req.url === '/api/login'){
    readJsonBody(req, (data) => {
      if(!data || !data.username || !data.password) return jsonErr(res, 'username and password required');
      const username = String(data.username).trim().toLowerCase();
      const users = loadUsers();
      const u = users[username];
      if(!u) return jsonErr(res, 'invalid credentials');
      if(hashPw(data.password, u.salt) !== u.hash) return jsonErr(res, 'invalid credentials');
      const token = makeToken();
      sessions[token] = username;
      u.lastSeen = Date.now();
      saveUsers(users);
      return jsonOK(res, { token, username, state: u.state || {} });
    });
    return;
  }

  if(req.method === 'POST' && req.url === '/api/save-state'){
    readJsonBody(req, (data) => {
      if(!data || !data.token) return jsonErr(res, 'no token');
      const username = sessions[data.token];
      if(!username) return jsonErr(res, 'invalid session', 401);
      const users = loadUsers();
      if(!users[username]) return jsonErr(res, 'user not found');
      users[username].state = Object.assign({}, users[username].state, data.state || {});
      users[username].lastSeen = Date.now();
      saveUsers(users);
      return jsonOK(res, { saved: true });
    });
    return;
  }

  if(req.method === 'POST' && req.url === '/api/load-state'){
    readJsonBody(req, (data) => {
      if(!data || !data.token) return jsonErr(res, 'no token');
      const username = sessions[data.token];
      if(!username) return jsonErr(res, 'invalid session', 401);
      const users = loadUsers();
      if(!users[username]) return jsonErr(res, 'user not found');
      return jsonOK(res, { username, state: users[username].state || {} });
    });
    return;
  }

  // ─── Layout write endpoint ───
  if(req.method === 'POST' && req.url === '/api/save-layout'){
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        if(!Array.isArray(data)) throw new Error('expected array');
        fs.writeFileSync(path.join(LAYOUTS_DIR, 'current.json'), JSON.stringify(data, null, 2));
        res.writeHead(200, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:true, count:data.length}));
        process.stdout.write('[save] ' + data.length + ' items → layouts/current.json\n');
      } catch(e){
        res.writeHead(400, {'Content-Type':'application/json'});
        res.end(JSON.stringify({ok:false, error:e.message}));
      }
    });
    return;
  }

  // ─── Static file serving ───
  const file = safePath(req);
  fs.stat(file, (err, stat) => {
    if(err || !stat.isFile()){
      res.writeHead(404, {'Content-Type':'text/plain'});
      res.end('Not found: ' + req.url);
      return;
    }
    const ext = path.extname(file).toLowerCase();
    // Cache heavy static assets aggressively; keep dev source files fresh
    const CACHEABLE = new Set(['.glb','.gltf','.bin','.png','.jpg','.jpeg','.webp','.mp4','.ico','.svg']);
    const cacheHeader = CACHEABLE.has(ext)
      ? 'public, max-age=604800, immutable' // 1 week
      : 'no-store';
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': cacheHeader,
    });
    fs.createReadStream(file).pipe(res);
  });
});

// ═══════════════════════════════════════
// MULTIPLAYER WebSocket hub
// ═══════════════════════════════════════
const wss = new WebSocketServer({ server, path: '/ws' });
const mpPlayers = new Map(); // ws -> {id, pos, rot, anim, character}

function mpBroadcast(msg, exceptWs){
  const str = JSON.stringify(msg);
  for(const client of wss.clients){
    if(client !== exceptWs && client.readyState === 1){
      try { client.send(str); } catch(e){}
    }
  }
}

function mpSnapshot(exceptWs){
  const out = [];
  for(const [ws, p] of mpPlayers){
    if(ws === exceptWs) continue;
    out.push({ id: p.id, pos: p.pos, rot: p.rot, anim: p.anim, character: p.character });
  }
  return out;
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (buf) => {
    let msg;
    try { msg = JSON.parse(buf.toString()); } catch { return; }

    if(msg.type === 'hello'){
      // Validate token against HTTP auth sessions
      const username = sessions[msg.token];
      if(!username){ try { ws.send(JSON.stringify({type:'error',error:'bad_token'})); ws.close(); } catch(e){} return; }

      // If same user already connected, kick the old socket
      for(const [oldWs, p] of mpPlayers){
        if(p.id === username){
          try { oldWs.close(); } catch(e){}
          mpPlayers.delete(oldWs);
        }
      }

      const player = {
        id: username,
        pos: Array.isArray(msg.pos) ? msg.pos : [0,0,20],
        rot: typeof msg.rot === 'number' ? msg.rot : 0,
        anim: 'idle',
        character: msg.character || null,
      };
      mpPlayers.set(ws, player);

      // Send welcome + current players
      try { ws.send(JSON.stringify({ type:'welcome', id: username, players: mpSnapshot(ws) })); } catch(e){}
      // Broadcast join
      mpBroadcast({ type:'join', id: username, pos: player.pos, rot: player.rot, anim: player.anim, character: player.character }, ws);
      return;
    }

    const p = mpPlayers.get(ws);
    if(!p) return;

    if(msg.type === 'state'){
      if(Array.isArray(msg.pos)) p.pos = msg.pos;
      if(typeof msg.rot === 'number') p.rot = msg.rot;
      if(typeof msg.anim === 'string') p.anim = msg.anim;
      mpBroadcast({ type:'state', id: p.id, pos: p.pos, rot: p.rot, anim: p.anim }, ws);
    } else if(msg.type === 'character'){
      p.character = msg.character || null;
      mpBroadcast({ type:'character', id: p.id, character: p.character }, ws);
    } else if(msg.type === 'chat'){
      const text = String(msg.text || '').slice(0, 200);
      if(text) mpBroadcast({ type:'chat', id: p.id, text }, null);
    }
  });

  ws.on('close', () => {
    const p = mpPlayers.get(ws);
    if(p){
      mpBroadcast({ type:'leave', id: p.id }, ws);
      mpPlayers.delete(ws);
    }
  });
});

// Heartbeat: drop dead connections
setInterval(() => {
  for(const ws of wss.clients){
    if(ws.isAlive === false){ try { ws.terminate(); } catch(e){} continue; }
    ws.isAlive = false;
    try { ws.ping(); } catch(e){}
  }
}, 30000);

server.listen(PORT, () => {
  console.log('RuneLuck dev server: http://localhost:' + PORT);
  console.log('Multiplayer WebSocket: ws://localhost:' + PORT + '/ws');
  console.log('Layout auto-saves to: layouts/current.json');
});

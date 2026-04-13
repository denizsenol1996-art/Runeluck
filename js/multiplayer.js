// ═══════════════════════════════════════
// MULTIPLAYER — WebSocket client, remote player rendering
// ═══════════════════════════════════════

if(!window.RL) window.RL = {};

RL.multiplayer = {
  ws: null,
  connected: false,
  players: {}, // id -> { group, targetPos, targetRot, targetAnim }
  _lastSent: 0,
  _sendInterval: 66, // ms (~15 Hz)
  _lastPos: null,
  _lastRot: 0,
  _lastAnim: 'idle',
  _reconnectTimer: null,

  start(){
    if(!RL.auth || !RL.auth.token){ return; }
    if(this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    this._initChatUI();
    var scheme = (location.protocol === 'https:') ? 'wss:' : 'ws:';
    var url = scheme + '//' + location.host + '/ws';
    try {
      this.ws = new WebSocket(url);
    } catch(e){
      console.warn('[mp] ws construct failed', e);
      this._scheduleReconnect();
      return;
    }
    var self = this;
    this.ws.onopen = function(){
      self.connected = true;
      var pos = RL.player ? [RL.player.position.x, 0, RL.player.position.z] : [0,0,20];
      var rot = RL.player ? RL.player.rotation.y : 0;
      var character = (RL.player && RL.player.userData && RL.player.userData.config) || null;
      try {
        self.ws.send(JSON.stringify({
          type:'hello',
          token: RL.auth.token,
          pos: pos, rot: rot,
          character: character
        }));
      } catch(e){}
    };
    this.ws.onmessage = function(e){
      var msg; try { msg = JSON.parse(e.data); } catch { return; }
      self._handle(msg);
    };
    this.ws.onclose = function(){
      self.connected = false;
      self._removeAll();
      self._scheduleReconnect();
    };
    this.ws.onerror = function(){ /* handled by onclose */ };
  },

  _scheduleReconnect(){
    var self = this;
    if(this._reconnectTimer) return;
    this._reconnectTimer = setTimeout(function(){
      self._reconnectTimer = null;
      self.start();
    }, 3000);
  },

  _handle(msg){
    if(!msg || !msg.type) return;
    if(msg.type === 'welcome'){
      this.id = msg.id;
      (msg.players || []).forEach((p) => this._spawn(p));
    } else if(msg.type === 'join'){
      this._spawn(msg);
    } else if(msg.type === 'leave'){
      this._remove(msg.id);
    } else if(msg.type === 'state'){
      var p = this.players[msg.id];
      if(!p) return;
      if(Array.isArray(msg.pos)){
        p.targetPos.set(msg.pos[0], 0, msg.pos[2]);
      }
      if(typeof msg.rot === 'number') p.targetRot = msg.rot;
      if(typeof msg.anim === 'string' && p.group && RL.character && RL.character.setAction){
        RL.character.setAction(p.group, msg.anim);
      }
    } else if(msg.type === 'character'){
      // Rebuild the remote player with new config
      var existing = this.players[msg.id];
      if(existing){
        var pos = existing.group ? existing.group.position.clone() : new THREE.Vector3(0,0,0);
        var rot = existing.group ? existing.group.rotation.y : 0;
        this._remove(msg.id);
        this._spawn({ id: msg.id, pos:[pos.x,0,pos.z], rot: rot, character: msg.character });
      }
    } else if(msg.type === 'chat'){
      var isSelf = msg.id === (RL.auth && RL.auth.username);
      this._appendChatLog(msg.id, msg.text, isSelf);
      // Overhead bubble on the speaker's group (remote → from this.players; self → RL.player)
      var targetGroup = isSelf ? RL.player : (this.players[msg.id] && this.players[msg.id].group);
      if(targetGroup && RL._spawnOverhead) RL._spawnOverhead(targetGroup, msg.text);
    }
  },

  _initChatUI(){
    if(this._chatWired) return;
    this._chatWired = true;
    var self = this;
    var input = document.getElementById('chatInput');
    if(!input) return;
    input.addEventListener('keydown', function(e){
      e.stopPropagation(); // don't trigger game hotkeys
      if(e.key === 'Enter'){
        var text = (input.value || '').trim();
        input.value = '';
        if(!text) { input.blur(); return; }
        self._sendChat(text);
        input.blur();
      } else if(e.key === 'Escape'){
        input.value = ''; input.blur();
      }
    });
    // Press T or Enter (when not focused) to focus chat
    window.addEventListener('keydown', function(e){
      if(document.activeElement === input) return;
      if(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      var k = e.key.toLowerCase();
      if(k === 'enter'){ e.preventDefault(); input.focus(); }
    });
  },

  _sendChat(text){
    text = String(text).slice(0, 200);
    if(!text) return;
    if(!this.ws || this.ws.readyState !== 1) return;
    try { this.ws.send(JSON.stringify({ type:'chat', text: text })); } catch(e){}
    // Show locally (server doesn't echo back to sender)
    var me = (RL.auth && RL.auth.username) || 'you';
    this._appendChatLog(me, text, true);
    if(RL.player && RL._spawnOverhead) RL._spawnOverhead(RL.player, text);
  },

  _appendChatLog(id, text, isSelf){
    var log = document.getElementById('chatLog');
    if(!log) return;
    var div = document.createElement('div');
    div.className = 'chat-msg' + (isSelf ? ' self' : '');
    var nm = document.createElement('span');
    nm.className = 'nm';
    nm.textContent = id + ':';
    div.appendChild(nm);
    div.appendChild(document.createTextNode(' ' + text));
    log.appendChild(div);
    // Limit to 60 messages
    while(log.children.length > 60) log.removeChild(log.firstChild);
    log.scrollTop = log.scrollHeight;
  },

  _spawn(p){
    if(!p || !p.id) return;
    if(p.id === (RL.auth && RL.auth.username)) return; // don't spawn self
    if(this.players[p.id]) return;
    if(!RL.character || !RL.character._loaded) return;
    var group;
    try { group = RL.character.build(p.character || {}); } catch(e){ console.warn('[mp] build failed', e); return; }
    var px = (p.pos && p.pos[0]) || 0;
    var pz = (p.pos && p.pos[2]) || 0;
    group.position.set(px, 0, pz);
    group.rotation.y = p.rot || 0;

    // Nameplate (blue, to distinguish from self's gold)
    var mc = document.createElement('canvas'); mc.width = 256; mc.height = 64;
    var mx = mc.getContext('2d');
    mx.fillStyle = '#55ccff'; mx.font = 'bold 24px sans-serif'; mx.textAlign = 'center';
    mx.fillText('▼', 128, 24);
    mx.fillStyle = '#ffffff'; mx.font = 'bold 14px sans-serif';
    mx.strokeStyle = '#000'; mx.lineWidth = 3;
    mx.strokeText(p.id, 128, 52); mx.fillText(p.id, 128, 52);
    var marker = new THREE.Sprite(new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(mc), transparent: true, depthTest: false
    }));
    marker.scale.set(2, .5, 1); marker.position.y = 2.3;
    group.add(marker);

    // Blue glow under feet
    var glow = new THREE.Mesh(
      new THREE.CircleGeometry(.5, 16),
      new THREE.MeshBasicMaterial({ color: 0x55ccff, transparent: true, opacity: .25 })
    );
    glow.rotation.x = -Math.PI/2; glow.position.y = .02;
    group.add(glow);

    if(RL.scene) RL.scene.add(group);
    this.players[p.id] = {
      group: group,
      targetPos: new THREE.Vector3(px, 0, pz),
      targetRot: p.rot || 0,
    };
  },

  _remove(id){
    var p = this.players[id];
    if(!p) return;
    if(p.group && p.group.parent) p.group.parent.remove(p.group);
    delete this.players[id];
  },

  _removeAll(){
    for(var id in this.players) this._remove(id);
    this.players = {};
  },

  update(dt){
    // ── Send local state periodically if it changed ──
    var now = performance.now();
    if(this.ws && this.ws.readyState === 1 && RL.player && (now - this._lastSent) >= this._sendInterval){
      var px = RL.player.position.x, pz = RL.player.position.z;
      var rot = RL.player.rotation.y;
      var anim = (RL.player.userData && RL.player.userData.currentAction) || 'idle';
      var changed = !this._lastPos
        || Math.abs(this._lastPos[0] - px) > 0.01
        || Math.abs(this._lastPos[2] - pz) > 0.01
        || Math.abs(this._lastRot - rot) > 0.01
        || this._lastAnim !== anim;
      if(changed){
        this._lastSent = now;
        this._lastPos = [px, 0, pz];
        this._lastRot = rot;
        this._lastAnim = anim;
        try {
          this.ws.send(JSON.stringify({
            type:'state', pos: this._lastPos, rot: rot, anim: anim
          }));
        } catch(e){}
      }
    }

    // ── Interpolate remote players ──
    var lerp = Math.min(1, dt * 12);
    for(var id in this.players){
      var p = this.players[id];
      if(!p.group) continue;
      p.group.position.x += (p.targetPos.x - p.group.position.x) * lerp;
      p.group.position.z += (p.targetPos.z - p.group.position.z) * lerp;
      // Rotation shortest path
      var dr = p.targetRot - p.group.rotation.y;
      while(dr > Math.PI) dr -= Math.PI * 2;
      while(dr < -Math.PI) dr += Math.PI * 2;
      p.group.rotation.y += dr * lerp;
      // Animation mixer
      if(p.group.userData && p.group.userData.mixer){
        p.group.userData.mixer.update(dt);
      }
    }
  },

  // Call when local character config changes (equip, recolor, etc.)
  notifyCharacterChanged(){
    if(!this.ws || this.ws.readyState !== 1) return;
    var character = (RL.player && RL.player.userData && RL.player.userData.config) || null;
    try { this.ws.send(JSON.stringify({ type:'character', character: character })); } catch(e){}
  }
};

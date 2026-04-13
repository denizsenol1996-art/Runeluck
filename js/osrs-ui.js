// ═══════════════════════════════════════
// OSRS-STYLE INTERFACE — minimap, tabs, chatbox
// ═══════════════════════════════════════

RL.osrsUI = {
  active: true,
  currentTab: 'inventory',
  _minimapCtx: null,
  _minimapSize: 168,
  _messages: [],

  TABS: [
    {id:'inventory', label:'Inventory',        icon:'🎒', row:0},
    {id:'equipment', label:'Gear',             icon:'🛡', row:0},
    {id:'quests',    label:'Daily Challenges', icon:'📜', row:0},
    {id:'friends',   label:'Friends List',     icon:'👥', row:0},
    {id:'logout',    label:'Logout',           icon:'⏻', row:0},
  ],

  init() {
    document.body.classList.add('osrs-mode');
    this._buildHTML();
    this._wireTabs();
    this._wireChat();
    this._initMinimap();
    this._wireRun();
    this.addMessage('Welcome to RuneLuck.', 'system');
    this.addMessage('Use left-click to walk, right-click to rotate camera.', 'system');
    this.setTab('inventory');
  },

  _buildHTML() {
    var tabsHTML = this.TABS.map(function(t){
      return '<button class="rs-tab" data-tab="'+t.id+'" title="'+t.label+'">'+t.icon+'</button>';
    }).join('');

    var root = document.createElement('div');
    root.id = 'osrsUI';
    root.innerHTML = ''
      // MINIMAP AREA (top-right)
      + '<div class="rs-minimap-frame">'
      +   '<div class="rs-compass" title="Compass">'
      +     '<div id="osrsCompassRot" class="rs-compass-rot">'
      +       '<div class="rs-compass-arrow-n"></div>'
      +       '<div class="rs-compass-arrow-s"></div>'
      +       '<div class="rs-compass-letter">N</div>'
      +     '</div>'
      +     '<div class="rs-compass-hub"></div>'
      +   '</div>'
      +   '<div class="rs-worldmap-btn" title="World Map">🗺</div>'
      +   '<div class="rs-run-btn" id="rsRunBtn" title="Toggle Run">'
      +     '<svg viewBox="0 0 32 32"><circle cx="22" cy="6" r="3"/><path d="M20 10 L15 14 L10 12 L8 16 L12 17 L15 15 L18 17 L16 22 L10 26 L12 28 L18 24 L22 19 L26 22 L28 18 L24 16 L22 13 Z"/></svg>'
      +   '</div>'
      +   '<div class="rs-minimap-circle">'
      +     '<canvas id="rsMinimap" width="168" height="168"></canvas>'
      +   '</div>'
      + '</div>'
      // RIGHT TABS PANEL
      + '<div class="rs-tabs-panel">'
      +   '<div class="rs-tab-row rs-tab-row-top">'+tabsHTML+'</div>'
      +   '<div class="rs-tab-content" id="rsTabContent"></div>'
      + '</div>'
      // BUILD BUTTON (floating top-left)
      + '<button class="rs-build-btn" onclick="RL.build.toggle()" title="Build Mode (B)">\u{1F528} Build</button>'
      // CHATBOX (bottom)
      + '<div class="rs-chatbox">'
      +   '<div class="rs-chat-tabs">'
      +     '<button class="rs-chat-tab active" data-filter="all">All</button>'
      +     '<button class="rs-chat-tab" data-filter="game">Game</button>'
      +     '<button class="rs-chat-tab" data-filter="public">Public</button>'
      +     '<button class="rs-chat-tab" data-filter="private">Private</button>'
      +     '<button class="rs-chat-tab" data-filter="channel">Channel</button>'
      +     '<button class="rs-chat-tab" data-filter="clan">Clan</button>'
      +     '<button class="rs-chat-tab" data-filter="trade">Trade</button>'
      +   '</div>'
      +   '<div class="rs-chat-body">'
      +     '<div class="rs-chat-messages" id="rsChatMessages"></div>'
      +     '<div class="rs-chat-input-line"><span class="rs-chat-prompt" id="rsChatPrompt">You:</span><input type="text" id="rsChatInput" maxlength="80"></div>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(root);
  },

  _wireRun() {
    var btn = document.getElementById('rsRunBtn');
    if(!btn) return;
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      RL.running = !RL.running;
      btn.classList.toggle('active', RL.running);
    });
    btn.classList.toggle('active', !!RL.running);
  },

  _wireTabs() {
    var self = this;
    document.querySelectorAll('.rs-tab').forEach(function(btn){
      btn.addEventListener('click', function(){
        self.setTab(btn.dataset.tab);
      });
    });
  },

  setTab(id) {
    this.currentTab = id;
    document.querySelectorAll('.rs-tab').forEach(function(b){
      b.classList.toggle('active', b.dataset.tab === id);
    });
    var content = document.getElementById('rsTabContent');
    if(!content) return;
    content.innerHTML = this._renderTabContent(id);
  },

  _renderTabContent(id) {
    switch(id){
      case 'inventory':
        var inv = (RL.player && RL.player.userData && RL.player.userData.config && RL.player.userData.config.inventory) || [];
        var slots = '';
        for(var i=0;i<28;i++){
          var itemId = inv[i];
          if(itemId){
            var def = RL.character.ITEMS[itemId];
            var ic = def ? (def.icon || '?') : '?';
            var nm = def ? def.name : itemId;
            slots += '<div class="rs-inv-slot rs-inv-item" title="'+nm+' (click to equip)" onclick="RL.osrsUI.equipFromInventory('+i+')"><span class="rs-inv-icon">'+ic+'</span></div>';
          } else {
            slots += '<div class="rs-inv-slot"></div>';
          }
        }
        return '<div class="rs-panel-title">Inventory</div><div class="rs-inv-grid">'+slots+'</div>';
      case 'equipment':
        var eqMap = (RL.player && RL.player.userData && RL.player.userData.config && RL.player.userData.config.equipment) || {};
        var slot = function(label, key, fallback){
          var equipped = eqMap[key];
          var def = equipped && RL.character.ITEMS[equipped];
          var ic = def ? (def.icon || '?') : ('<span class="rs-eq-empty-icon">'+fallback+'</span>');
          var title = def ? (def.name + ' (click to unequip)') : label;
          var cls = def ? 'rs-eq-slot rs-eq-filled' : 'rs-eq-slot';
          var click = def ? ' onclick="RL.osrsUI.unequipSlot(\''+key+'\')"' : '';
          return '<div class="'+cls+'" data-slot="'+key+'" title="'+title+'"'+click+'><span class="rs-eq-icon">'+ic+'</span></div>';
        };
        var empty = '<div class="rs-eq-empty"></div>';
        var eq = '<div class="rs-eq-cross">'
          + empty + slot('Head','head','⛑') + empty
          + slot('Cape','cape','🧣') + slot('Neck','neck','📿') + slot('Ammo','ammo','🏹')
          + slot('Weapon','weapon','⚔') + slot('Body','body','👕') + slot('Shield','shield','🛡')
          + empty + slot('Legs','legs','👖') + empty
          + slot('Hands','hands','🧤') + slot('Feet','feet','👢') + slot('Ring','ring','💍')
          + '</div>'
          + '<div class="rs-eq-stats">'
          +   '<div class="rs-eq-stats-title">Attack bonus</div>'
          +   '<div class="rs-eq-stats-row"><span>Stab</span><b>0</b><span>Slash</span><b>0</b><span>Crush</span><b>0</b></div>'
          +   '<div class="rs-eq-stats-row"><span>Magic</span><b>0</b><span>Range</span><b>0</b></div>'
          +   '<div class="rs-eq-stats-title">Defence bonus</div>'
          +   '<div class="rs-eq-stats-row"><span>Stab</span><b>0</b><span>Slash</span><b>0</b><span>Crush</span><b>0</b></div>'
          +   '<div class="rs-eq-stats-row"><span>Magic</span><b>0</b><span>Range</span><b>0</b></div>'
          +   '<div class="rs-eq-stats-title">Other</div>'
          +   '<div class="rs-eq-stats-row"><span>Strength</span><b>0</b><span>Prayer</span><b>0</b></div>'
          + '</div>';
        return '<div class="rs-panel-title">Worn Equipment</div>'+eq;
      case 'skills':
        var sk = ['Attack','Hitpoints','Mining','Strength','Agility','Smithing','Defence','Herblore','Fishing','Ranged','Thieving','Cooking','Prayer','Crafting','Firemaking','Magic','Fletching','Woodcutting','Runecraft','Slayer','Farming','Construction','Hunter'];
        var html = '<div class="rs-panel-title">Skills</div><div class="rs-skills-grid">';
        sk.forEach(function(s){
          html += '<div class="rs-skill"><span class="rs-skill-name">'+s+'</span><span class="rs-skill-lvl">1/1</span></div>';
        });
        html += '</div><div class="rs-skills-total">Total level: 32</div>';
        return html;
      case 'combat':
        return '<div class="rs-panel-title">Combat Options</div>'
          + '<div class="rs-combat-style">Attack style: <b>Accurate</b></div>'
          + '<div class="rs-combat-style">Weapon: <b>Unarmed</b></div>'
          + '<div class="rs-combat-style">Combat level: <b>3</b></div>'
          + '<div class="rs-panel-hint">(Placeholder — no combat system yet)</div>';
      case 'quests':
        return '<div class="rs-panel-title">Daily Challenges</div>'
          + '<div class="rs-quest"><span style="color:#ff4040">● </span>Win 3 slot machine spins</div>'
          + '<div class="rs-quest"><span style="color:#ff4040">● </span>Play 5 rounds of blackjack</div>'
          + '<div class="rs-quest"><span style="color:#ff4040">● </span>Spin the roulette 10 times</div>'
          + '<div class="rs-quest"><span style="color:#ffcc00">● </span>Earn 100,000 GP</div>'
          + '<div class="rs-panel-hint">Resets daily at 00:00</div>';
      case 'prayer':
        return '<div class="rs-panel-title">Prayer</div><div class="rs-panel-hint">Prayer points: 99/99</div>';
      case 'magic':
        return '<div class="rs-panel-title">Spellbook</div><div class="rs-panel-hint">Standard spellbook</div>';
      case 'clan':
        return '<div class="rs-panel-title">Clan Chat</div><div class="rs-panel-hint">Not in a clan</div>';
      case 'friends':
        return '<div class="rs-panel-title">Friends List</div><div class="rs-panel-hint">Empty</div>';
      case 'account':
        return '<div class="rs-panel-title">Account Management</div><div class="rs-panel-hint">Character: '+((RL.player&&RL.player.userData&&RL.player.userData.config&&RL.player.userData.config.name)||'Adventurer')+'</div>';
      case 'logout':
        return '<div class="rs-panel-title">Logout</div><div style="font-size:11px;color:#c8b27a;margin-bottom:8px;">Your progress is saved to your account.</div><button class="rs-btn" onclick="RL.auth.logout()">Click here to logout</button>';
      case 'options':
        return '<div class="rs-panel-title">Options</div><button class="rs-btn" onclick="RL.build.toggle()">Build mode</button>';
      case 'emotes':
        return '<div class="rs-panel-title">Emotes</div><div class="rs-panel-hint">Yes, No, Cheer, Wave, Dance, Beckon...</div>';
      case 'music':
        return '<div class="rs-panel-title">Music</div><div class="rs-panel-hint">Currently playing: Harmony</div>';
    }
    return '<div class="rs-panel-hint">Coming soon</div>';
  },

  _initMinimap() {
    var canvas = document.getElementById('rsMinimap');
    if(!canvas || !RL.scene) return;
    var size = this._minimapSize;
    this._miniRenderer = new THREE.WebGLRenderer({canvas: canvas, antialias: false, alpha: true});
    this._miniRenderer.setSize(size, size, false);
    this._miniRenderer.setPixelRatio(1);
    // Orthographic top-down camera — real 2D view of the scene
    var halfView = 22;
    this._miniCam = new THREE.OrthographicCamera(-halfView, halfView, halfView, -halfView, 0.1, 300);
    this._miniCam.position.set(0, 80, 0);
    this._miniCam.up.set(0, 0, -1);
    this._miniCam.lookAt(0, 0, 0);
  },

  _miniSkip: 0,
  drawMinimap() {
    if(!this._miniRenderer || !RL.scene || !RL.player) return;
    // Minimap at ~10fps (every 6th frame) instead of 60fps
    this._miniSkip = (this._miniSkip+1) % 6;
    if(this._miniSkip !== 0){
      var compassGQ = document.getElementById('osrsCompassRot');
      if(compassGQ){
        var camA = RL.camAngle || 0;
        compassGQ.style.transform = 'rotate('+(camA*180/Math.PI).toFixed(1)+'deg)';
      }
      return;
    }
    var px = RL.player.position.x, pz = RL.player.position.z;
    this._miniCam.position.set(px, 80, pz);
    this._miniCam.up.set(0, 0, -1);
    this._miniCam.lookAt(px, 0, pz);
    this._miniCam.updateProjectionMatrix();
    this._miniRenderer.render(RL.scene, this._miniCam);
    // Compass: rotates with camera orbit (CSS transform on wrapper div)
    var compassG = document.getElementById('osrsCompassRot');
    if(compassG){
      var camA = RL.camAngle || 0;
      compassG.style.transform = 'rotate('+(camA*180/Math.PI).toFixed(1)+'deg)';
    }
  },

  equipFromInventory(idx) {
    if(!RL.player || !RL.player.userData) return;
    var cfg = RL.player.userData.config;
    cfg.inventory = cfg.inventory || [];
    cfg.equipment = cfg.equipment || {};
    var itemId = cfg.inventory[idx];
    if(!itemId) return;
    var item = RL.character.ITEMS[itemId];
    if(!item) return;
    var slot = item.slot;
    var prevId = cfg.equipment[slot] || null;
    if(prevId){
      cfg.inventory[idx] = prevId;
    } else {
      cfg.inventory.splice(idx, 1);
    }
    RL.character.equip(RL.player, slot, itemId);
    this._persist();
    this.setTab(this.currentTab);
  },

  unequipSlot(slot) {
    if(!RL.player || !RL.player.userData) return;
    var cfg = RL.player.userData.config;
    cfg.inventory = cfg.inventory || [];
    cfg.equipment = cfg.equipment || {};
    var itemId = cfg.equipment[slot];
    if(!itemId) return;
    if(cfg.inventory.length >= 28){
      this.addMessage('Your inventory is full.', 'system');
      return;
    }
    cfg.inventory.push(itemId);
    RL.character.equip(RL.player, slot, null);
    this._persist();
    this.setTab(this.currentTab);
  },

  _persist() {
    if(!RL.player || !RL.player.userData) return;
    var cfg = RL.player.userData.config;
    try { RL.character.save(cfg); } catch(e){}
    if(RL.auth && RL.auth.save) RL.auth.save();
  },

  _playerName() {
    return (RL.player && RL.player.userData && RL.player.userData.config && RL.player.userData.config.name)
        || (RL.character && RL.character.config && RL.character.config.name)
        || (RL.auth && RL.auth.username)
        || 'Player';
  },

  _refreshChatPrompt() {
    var p = document.getElementById('rsChatPrompt');
    if(p) p.textContent = this._playerName() + ':';
  },

  _wireChat() {
    var inp = document.getElementById('rsChatInput');
    var self = this;
    this._refreshChatPrompt();
    setInterval(function(){ self._refreshChatPrompt(); }, 2000);
    var box = document.querySelector('.rs-chatbox');
    if(box){
      ['mousedown','mouseup','click','keydown','keyup','keypress','wheel'].forEach(function(ev){
        box.addEventListener(ev, function(e){ e.stopPropagation(); });
      });
    }
    if(inp){
      inp.addEventListener('keydown', function(e){
        e.stopPropagation();
        if(e.key === 'Enter' && inp.value.trim()){
          var msg = inp.value;
          self.addMessage(msg, 'public');
          if(typeof RL!=='undefined' && RL.spawnOverhead) RL.spawnOverhead(msg);
          inp.value = '';
        }
      });
      inp.addEventListener('keyup', function(e){ e.stopPropagation(); });
      inp.addEventListener('keypress', function(e){ e.stopPropagation(); });
    }
    // RuneScape-style: type without clicking. Auto-focus chat input on any
    // printable key press, unless another input/textarea is already focused.
    document.addEventListener('keydown', function(e){
      if(!inp) return;
      var ae = document.activeElement;
      if(ae && (ae.tagName==='INPUT' || ae.tagName==='TEXTAREA' || ae.isContentEditable)) return;
      // Single printable character (letters, digits, punctuation, space)
      if(e.key && e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey){
        inp.focus();
      } else if(e.key === 'Enter'){
        inp.focus();
      }
    }, true); // capture phase so we focus before the keystroke is processed
    document.querySelectorAll('.rs-chat-tab').forEach(function(t){
      t.addEventListener('click', function(){
        document.querySelectorAll('.rs-chat-tab').forEach(function(x){x.classList.remove('active')});
        t.classList.add('active');
        self._filterChat(t.dataset.filter);
      });
    });
  },

  _filterChat(filter) {
    var msgs = document.getElementById('rsChatMessages');
    if(!msgs) return;
    msgs.querySelectorAll('.rs-msg').forEach(function(m){
      m.style.display = (filter==='all' || m.dataset.kind===filter || (filter==='public' && m.dataset.kind==='public')) ? '' : 'none';
    });
  },

  addMessage(text, kind) {
    kind = kind || 'game';
    this._messages.push({text:text, kind:kind});
    var box = document.getElementById('rsChatMessages');
    if(!box) return;
    var div = document.createElement('div');
    div.className = 'rs-msg rs-msg-'+kind;
    div.dataset.kind = kind;
    var name = this._playerName();
    if(kind === 'public'){
      div.innerHTML = '<span class="rs-msg-name">'+name+':</span> <span class="rs-msg-text">'+this._escape(text)+'</span>';
    } else if(kind === 'system'){
      div.innerHTML = '<span class="rs-msg-system">'+this._escape(text)+'</span>';
    } else {
      div.innerHTML = '<span class="rs-msg-text">'+this._escape(text)+'</span>';
    }
    box.appendChild(div);
    // Cap to last 8 visible messages so nothing scrolls
    while(box.children.length > 8) box.removeChild(box.firstChild);
  },

  _escape(s) {
    return String(s).replace(/[&<>"]/g, function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});
  }
};

// ═══ Overhead chat bubbles (RuneScape style yellow text above player) ═══
RL._overheads = [];

RL.spawnOverhead = function(text){
  if(!RL.player || !window.THREE || !RL.scene) return;
  text = String(text).slice(0, 80);

  var canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 128;
  var ctx = canvas.getContext('2d');
  ctx.font = 'bold 64px "Trebuchet MS", "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  // Black outline for readability
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#000';
  ctx.strokeText(text, 512, 64);
  // Yellow fill
  ctx.fillStyle = '#ffff00';
  ctx.fillText(text, 512, 64);

  var tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  var sprite = new THREE.Sprite(mat);
  // Width scaled to text length so short messages aren't huge
  var measure = ctx.measureText(text).width / 64; // approximate units
  var w = Math.max(2, Math.min(8, 0.8 + measure * 0.5));
  sprite.scale.set(w, w * (canvas.height / canvas.width) * (1024/128) , 1);
  sprite.scale.set(w, w * 0.18, 1);
  sprite.renderOrder = 9999;

  // Stack new bubbles above existing ones from this player
  var baseY = (RL.player.position.y || 0) + 2.6;
  var stackOffset = RL._overheads.filter(function(o){return o.player===RL.player}).length * 0.55;
  sprite.position.set(RL.player.position.x, baseY + stackOffset, RL.player.position.z);
  RL.scene.add(sprite);

  RL._overheads.push({
    sprite: sprite,
    player: RL.player,
    born: performance.now() / 1000,
    life: 8.0,
    stackOffset: stackOffset,
  });
};

RL._updateOverheads = function(t){
  if(!RL._overheads || !RL._overheads.length) return;
  for(var i = RL._overheads.length - 1; i >= 0; i--){
    var o = RL._overheads[i];
    var age = t - o.born;
    if(age >= o.life){
      RL.scene.remove(o.sprite);
      if(o.sprite.material.map) o.sprite.material.map.dispose();
      o.sprite.material.dispose();
      RL._overheads.splice(i, 1);
      continue;
    }
    // Follow the player horizontally
    if(o.player){
      o.sprite.position.x = o.player.position.x;
      o.sprite.position.z = o.player.position.z;
      o.sprite.position.y = (o.player.position.y || 0) + 2.6 + o.stackOffset;
    }
    // Fade in last 1.5s
    var fadeStart = o.life - 1.5;
    if(age > fadeStart){
      o.sprite.material.opacity = Math.max(0, 1 - (age - fadeStart) / 1.5);
    } else {
      o.sprite.material.opacity = 1;
    }
  }
};

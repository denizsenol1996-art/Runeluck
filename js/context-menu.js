// ═══════════════════════════════════════
// OSRS-Style Right-Click Context Menu
// ═══════════════════════════════════════

RL.contextMenu = {
  _el: null,
  _target: null,

  init: function() {
    // Create menu element
    var el = document.createElement('div');
    el.id = 'rsMenu';
    el.className = 'rs-menu';
    el.style.display = 'none';
    document.body.appendChild(el);
    this._el = el;

    // Close on any click
    document.addEventListener('mousedown', function(e) {
      if(!el.contains(e.target)) el.style.display = 'none';
    });

    // Block default right-click on entire page
    document.addEventListener('contextmenu', function(e) {
      e.preventDefault();
    });
  },

  show: function(x, y, obj) {
    var el = this._el;
    this._target = obj;
    var type = obj ? obj.userData.gameType || obj.userData.type || obj.userData._buildType : null;
    var name = this._getName(obj, type);

    // Build menu items
    var html = '<div class="rs-menu-header">' + name + '</div>';

    if(type === 'Slots' || type === 'slot') {
      html += this._item('play', '\u{1F3B0}', 'Play', name);
      html += this._item('sit', '\u{1FA91}', 'Sit', name);
      html += this._item('examine', '\u{1F50D}', 'Examine', name);
    } else if(type === 'Roulette' || type === 'roulette') {
      html += this._item('play', '\u{1F3A1}', 'Play', name);
      html += this._item('examine', '\u{1F50D}', 'Examine', name);
    } else if(type === 'Blackjack' || type === 'blackjack') {
      html += this._item('play', '\u{1F0CF}', 'Play', name);
      html += this._item('examine', '\u{1F50D}', 'Examine', name);
    } else if(type === 'npc') {
      html += this._item('talk', '\u{1F4AC}', 'Talk-to', name);
      html += this._item('examine', '\u{1F50D}', 'Examine', name);
    } else if(type === 'booth') {
      html += this._item('use', '\u{1F4B0}', 'Use', name);
      html += this._item('examine', '\u{1F50D}', 'Examine', name);
    } else if(obj && obj.userData._buildType) {
      html += this._item('examine', '\u{1F50D}', 'Examine', name);
      html += this._item('remove', '\u{1F5D1}', 'Remove', name);
    }

    // Always show these
    html += this._item('walk', '\u{1F6B6}', 'Walk here', '');
    html += this._item('cancel', '\u2716', 'Cancel', '');

    el.innerHTML = html;

    // Position (keep on screen)
    el.style.display = 'block';
    var mw = el.offsetWidth, mh = el.offsetHeight;
    if(x + mw > innerWidth) x = innerWidth - mw - 4;
    if(y + mh > innerHeight) y = innerHeight - mh - 4;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  },

  _item: function(action, icon, verb, name) {
    return '<div class="rs-menu-item" onmousedown="RL.contextMenu.action(\'' + action + '\')">' +
      '<span class="rs-menu-icon">' + icon + '</span>' +
      '<span class="rs-menu-verb">' + verb + '</span> ' +
      '<span class="rs-menu-name">' + name + '</span>' +
      '</div>';
  },

  _getName: function(obj, type) {
    if(!obj) return 'Ground';
    if(type === 'Slots' || type === 'slot') return 'Slot Machine';
    if(type === 'Roulette' || type === 'roulette') return 'Roulette Table';
    if(type === 'Blackjack' || type === 'blackjack') return 'Blackjack Table';
    if(type === 'npc') return 'Casino Dealer';
    if(type === 'booth') return 'Cashier';
    if(obj.userData._buildType) {
      var def = RL.build._getDef(obj.userData._buildType);
      return def ? def.name : 'Object';
    }
    return 'Object';
  },

  action: function(act) {
    var el = this._el;
    var obj = this._target;
    el.style.display = 'none';

    if(act === 'cancel') return;

    if(act === 'walk') {
      // Walk to click position (stored when menu was opened)
      if(this._walkPos) {
        RL.playerTarget = this._walkPos.clone();
        RL.playerTarget.y = 0;
        RL.pendingInteract = null;
        RL.spawnClickMarker(RL.playerTarget, 0xd4a843);
      }
      return;
    }

    if(act === 'examine') {
      var name = this._getName(obj, obj ? obj.userData.gameType || obj.userData.type || obj.userData._buildType : null);
      RL.contextMenu.showMessage('It\'s a ' + name + '.');
      return;
    }

    if(act === 'remove' && obj) {
      RL.scene.remove(obj);
      RL.placed = RL.placed.filter(function(p){ return p !== obj; });
      RL.interactables = RL.interactables.filter(function(p){ return p !== obj; });
      RL.build._updateCount();
      return;
    }

    if(act === 'talk') {
      RL.contextMenu.showMessage('The dealer nods at you.');
      return;
    }

    if(!obj) return;

    if(act === 'play' || act === 'use') {
      // Walk to object then interact
      var tp = obj.position.clone();
      var dir = new THREE.Vector3().subVectors(RL.player.position, tp).normalize();
      RL.playerTarget = tp.clone().add(dir.multiplyScalar(1.8));
      RL.playerTarget.y = 0;
      RL.pendingInteract = obj.userData.gameType || 'Slots';
      RL.spawnClickMarker(RL.playerTarget, 0xef4444);
      return;
    }

    if(act === 'sit' && obj) {
      // Walk to stool and sit
      var tp = obj.position.clone();
      var forward = new THREE.Vector3(0, 0, 0.9).applyAxisAngle(new THREE.Vector3(0,1,0), obj.rotation.y);
      RL.playerTarget = tp.clone().add(forward);
      RL.playerTarget.y = 0;
      RL.pendingSit = obj;
      RL.spawnClickMarker(RL.playerTarget, 0x4ade80);
      return;
    }
  },

  showMessage: function(text) {
    var msg = document.getElementById('rsMessage');
    if(!msg) {
      msg = document.createElement('div');
      msg.id = 'rsMessage';
      msg.className = 'rs-message';
      document.body.appendChild(msg);
    }
    msg.textContent = text;
    msg.style.display = 'block';
    msg.style.opacity = '1';
    clearTimeout(this._msgTimer);
    this._msgTimer = setTimeout(function(){
      msg.style.opacity = '0';
      setTimeout(function(){ msg.style.display = 'none'; }, 400);
    }, 3000);
  }
};

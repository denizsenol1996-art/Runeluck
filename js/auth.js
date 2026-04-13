// ═══════════════════════════════════════
// AUTH — Login overlay + state persistence
// ═══════════════════════════════════════

if(!window.RL) window.RL = {};

RL.auth = {
  token: null,
  username: null,
  _saveTimer: null,
  _onReady: null,

  init(onReady){
    this._onReady = onReady || function(){};
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem('runeluck_session') || 'null'); } catch(e){}
    if(stored && stored.token && stored.username){
      // Try to validate with server by loading state
      this.token = stored.token;
      this.username = stored.username;
      var self = this;
      fetch('/api/load-state', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({token: stored.token})
      }).then(function(r){return r.json()}).then(function(data){
        if(data.ok){
          self._applyState(data.state || {});
          self._afterLogin();
        } else {
          // Session expired (server restart) — re-login with stored creds if any
          self.token = null; self.username = null;
          localStorage.removeItem('runeluck_session');
          self._showLogin();
        }
      }).catch(function(){ self._showLogin(); });
    } else {
      this._showLogin();
    }

    this._wireUI();
  },

  _wireUI(){
    var self = this;
    var btn = document.getElementById('loginBtn');
    var dbtn = document.getElementById('loginDiscord');
    var user = document.getElementById('loginUser');
    var pass = document.getElementById('loginPass');
    if(btn) btn.addEventListener('click', function(){ self._submit(); });
    if(dbtn) dbtn.addEventListener('click', function(){ self._discordLogin(); });
    [user, pass].forEach(function(inp){
      if(!inp) return;
      inp.addEventListener('keydown', function(e){
        e.stopPropagation();
        if(e.key === 'Enter') self._submit();
      });
    });
  },

  _showLogin(){
    var s = document.getElementById('loginScreen');
    if(s) s.classList.add('show');
    var u = document.getElementById('loginUser');
    if(u) setTimeout(function(){ u.focus(); }, 100);
  },

  _hideLogin(){
    var s = document.getElementById('loginScreen');
    if(s) s.classList.remove('show');
  },

  _error(msg){
    var e = document.getElementById('loginError');
    if(e){ e.textContent = msg; e.style.display = 'block'; }
  },

  _submit(){
    var user = (document.getElementById('loginUser').value || '').trim();
    var pass = document.getElementById('loginPass').value || '';
    if(!user || !pass){ this._error('Vul username en password in'); return; }
    if(pass.length < 4){ this._error('Password minimaal 4 tekens'); return; }
    this._error('');
    this._authRequest(user, pass, 'password');
  },

  _discordLogin(){
    // Stub: prompt for Discord username, register with auto-generated password
    var name = prompt('Discord username (testing):');
    if(!name) return;
    name = name.trim().toLowerCase().replace(/[^a-z0-9_\-]/g,'');
    if(name.length < 2){ this._error('Invalid Discord username'); return; }
    // Use a deterministic stable password derived from username (testing only)
    var pw = 'discord_' + name + '_token';
    this._authRequest('d_' + name, pw, 'discord');
  },

  _authRequest(username, password, method){
    var self = this;
    // Try login first; if invalid credentials, try register
    fetch('/api/login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({username, password})
    }).then(function(r){return r.json()}).then(function(data){
      if(data.ok){
        self._success(data);
      } else {
        // Try register
        fetch('/api/register', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({username, password, method})
        }).then(function(r){return r.json()}).then(function(data2){
          if(data2.ok) self._success(data2);
          else self._error(data2.error || 'Login failed');
        }).catch(function(){ self._error('Server error'); });
      }
    }).catch(function(){ self._error('Server error'); });
  },

  _success(data){
    this.token = data.token;
    this.username = data.username;
    try {
      localStorage.setItem('runeluck_session', JSON.stringify({
        token: data.token, username: data.username
      }));
    } catch(e){}
    this._applyState(data.state || {});
    this._afterLogin();
  },

  _applyState(state){
    if(typeof state.chips === 'number') RL.chips = state.chips;
    if(state.character) RL._savedCharacter = state.character;
    if(typeof state.running === 'boolean') RL.running = state.running;
  },

  _collectState(){
    return {
      chips: typeof RL.chips === 'number' ? RL.chips : 0,
      running: !!RL.running,
      character: RL.character && RL.character.config ? RL.character.config : null,
      lastPlay: Date.now(),
    };
  },

  _afterLogin(){
    this._hideLogin();
    var self = this;
    // Auto-save every 30 seconds
    if(this._saveTimer) clearInterval(this._saveTimer);
    this._saveTimer = setInterval(function(){ self.save(); }, 30000);
    // Save before unload
    window.addEventListener('beforeunload', function(){
      try { navigator.sendBeacon && navigator.sendBeacon('/api/save-state', JSON.stringify({token:self.token, state:self._collectState()})); } catch(e){}
    });
    // Boot the game
    this._onReady();
  },

  save(){
    if(!this.token) return Promise.resolve();
    var self = this;
    return fetch('/api/save-state', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({token: self.token, state: self._collectState()})
    }).then(function(r){return r.json()}).catch(function(){});
  },

  logout(){
    var self = this;
    this.save().then(function(){
      localStorage.removeItem('runeluck_session');
      self.token = null; self.username = null;
      location.reload();
    });
  },
};

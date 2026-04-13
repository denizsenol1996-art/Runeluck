// ═══════════════════════════════════════
// MINES GAME — Stake-style, provably fair
// 5x5 grid, pick mines count, reveal tiles for growing multiplier
// ═══════════════════════════════════════

(function(){
  var root = null;
  var state = {
    balance: 100000,
    bet: 0,
    mines: 3,            // number of mines (1..24)
    revealed: 0,         // how many safe tiles revealed
    grid: [],            // 25 tiles: each { isMine:bool, revealed:bool, isDiamond:bool }
    minePositions: [],   // indices of mines
    phase: 'bet',        // 'bet' | 'play' | 'done'
    serverSeed: null,
    serverSeedHash: null,
    clientSeed: '',
    nonce: 0,
    revealedSeed: null,
    // House edge factor (1.00 = no edge). 0.97 = 3% house edge on mines
    HOUSE: 0.97,
  };

  // ─── Provably fair (Web Crypto) ───
  function randomHex(bytes){
    var arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    return Array.from(arr).map(function(b){return b.toString(16).padStart(2,'0')}).join('');
  }
  function sha256Hex(msg){
    var enc = new TextEncoder();
    return crypto.subtle.digest('SHA-256', enc.encode(msg)).then(function(buf){
      return Array.from(new Uint8Array(buf)).map(function(b){return b.toString(16).padStart(2,'0')}).join('');
    });
  }
  function hmacHex(key, msg){
    var enc = new TextEncoder();
    return crypto.subtle.importKey('raw', enc.encode(key), {name:'HMAC',hash:'SHA-256'}, false, ['sign'])
      .then(function(k){ return crypto.subtle.sign('HMAC', k, enc.encode(msg)); })
      .then(function(sig){ return Array.from(new Uint8Array(sig)).map(function(b){return b.toString(16).padStart(2,'0')}).join(''); });
  }
  function newServerSeed(){
    state.serverSeed = randomHex(32);
    return sha256Hex(state.serverSeed).then(function(h){
      state.serverSeedHash = h;
      state.revealedSeed = null;
      updatePF();
    });
  }

  // Turn the HMAC hash into a mine-position permutation (Fisher-Yates)
  function generateMines(minesCount){
    var msg = state.clientSeed + ':' + state.nonce;
    return hmacHex(state.serverSeed, msg).then(function(hx){
      var bytes = [];
      for(var i=0;i<hx.length;i+=2) bytes.push(parseInt(hx.slice(i,i+2),16));
      var perm = [];
      for(var i=0;i<25;i++) perm.push(i);
      var bi = 0;
      for(var i=24;i>0;i--){
        var r = 0;
        for(var k=0;k<4;k++){ r = (r<<8) | (bytes[bi % bytes.length] || 0); bi++; }
        var j = Math.abs(r) % (i+1);
        var tmp = perm[i]; perm[i] = perm[j]; perm[j] = tmp;
      }
      return perm.slice(0, minesCount).sort(function(a,b){return a-b;});
    });
  }

  // ─── Math ───
  // multiplier after `picks` safe clicks with `mines` total mines out of 25
  // Fair = (25!/picks!)/((25-picks)! * (25-mines)!/(picks)(...)...)
  // Practical: mult(n) = HOUSE * prod_{i=0..n-1}((25-i) / (25-mines-i))
  function multAfter(picks, mines){
    var m = 1;
    for(var i=0;i<picks;i++){
      m *= (25 - i) / (25 - mines - i);
    }
    return state.HOUSE * m;
  }
  function nextProfit(){
    if(state.phase !== 'play' || state.bet <= 0) return 0;
    var mult = multAfter(state.revealed + 1, state.mines);
    return Math.floor(state.bet * mult - state.bet);
  }
  function currentProfit(){
    if(state.revealed === 0 || state.phase === 'bet') return 0;
    var mult = multAfter(state.revealed, state.mines);
    return Math.floor(state.bet * mult - state.bet);
  }
  function currentMult(){
    if(state.revealed === 0) return 1;
    return multAfter(state.revealed, state.mines);
  }

  // ─── HTML build ───
  function build(){
    root = document.createElement('div');
    root.id = 'mnRoot';
    root.innerHTML =
      '<div class="mn-topbar">'
      +   '<button class="mn-close" title="Close">\u2715</button>'
      +   '<div class="mn-title"><b>RUNE</b><i>LUCK</i><span>MINES</span></div>'
      +   '<div class="mn-balance">GP: <span id="mnBal">100,000</span></div>'
      + '</div>'
      + '<div class="mn-body">'
      +   '<div class="mn-left">'
      +     '<div class="mn-grid" id="mnGrid"></div>'
      +     '<div class="mn-mult-display" id="mnMultDisplay">1.00×</div>'
      +   '</div>'
      +   '<div class="mn-right">'
      +     '<div class="mn-panel">'
      +       '<label class="mn-label">Bet Amount</label>'
      +       '<div class="mn-bet-row">'
      +         '<input type="number" id="mnBet" min="1" value="100" step="100">'
      +         '<button class="mn-small" onclick="RL.mines._betHalf()">½</button>'
      +         '<button class="mn-small" onclick="RL.mines._betDouble()">2×</button>'
      +         '<button class="mn-small" onclick="RL.mines._betMax()">Max</button>'
      +       '</div>'
      +       '<label class="mn-label">Mines</label>'
      +       '<div class="mn-mines-row">'
      +         '<input type="range" id="mnMines" min="1" max="24" value="3">'
      +         '<span id="mnMinesVal">3</span>'
      +       '</div>'
      +       '<label class="mn-label">Next multiplier</label>'
      +       '<div class="mn-next" id="mnNext">—</div>'
      +       '<label class="mn-label">Current profit</label>'
      +       '<div class="mn-profit" id="mnProfit">0 GP</div>'
      +       '<button class="mn-main-btn" id="mnMainBtn">BET</button>'
      +     '</div>'
      +     '<div class="mn-pf">'
      +       '<div class="mn-pf-title">\u{1F512} Provably Fair</div>'
      +       '<div class="mn-pf-row"><span>Hash:</span><code id="mnPfHash">—</code></div>'
      +       '<div class="mn-pf-row"><span>Client seed:</span><code id="mnPfClient">—</code></div>'
      +       '<div class="mn-pf-row"><span>Nonce:</span><code id="mnPfNonce">0</code></div>'
      +       '<div class="mn-pf-row"><span>Revealed seed:</span><code id="mnPfReveal">(hidden)</code></div>'
      +     '</div>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(root);
    root.addEventListener('mousedown', function(e){ e.stopPropagation(); });
    root.addEventListener('mouseup',   function(e){ e.stopPropagation(); });
    root.addEventListener('click',     function(e){ e.stopPropagation(); });
    root.querySelector('.mn-close').addEventListener('click', close);

    // Wire controls
    document.getElementById('mnBet').addEventListener('input', function(){
      var v = parseInt(this.value, 10) || 0;
      state.bet = Math.max(0, Math.min(state.balance, v));
      updateProfit();
    });
    document.getElementById('mnMines').addEventListener('input', function(){
      state.mines = parseInt(this.value, 10);
      document.getElementById('mnMinesVal').textContent = state.mines;
      updateProfit();
    });
    document.getElementById('mnMainBtn').addEventListener('click', onMainBtn);
    buildGrid();
  }

  function buildGrid(){
    var g = document.getElementById('mnGrid');
    g.innerHTML = '';
    for(var i=0;i<25;i++){
      var c = document.createElement('div');
      c.className = 'mn-cell';
      c.dataset.i = i;
      c.addEventListener('click', onCellClick);
      g.appendChild(c);
    }
  }

  // ─── UI updates ───
  function updateBalance(){
    var el = document.getElementById('mnBal');
    if(el) el.textContent = state.balance.toLocaleString();
  }
  function updateProfit(){
    var nextEl = document.getElementById('mnNext');
    var profitEl = document.getElementById('mnProfit');
    var multDisp = document.getElementById('mnMultDisplay');
    if(state.phase === 'play'){
      var nm = multAfter(state.revealed + 1, state.mines);
      var np = Math.floor(state.bet * nm - state.bet);
      if(nextEl) nextEl.textContent = nm.toFixed(2)+'× (+'+np.toLocaleString()+' GP)';
      var cm = currentMult();
      var cp = currentProfit();
      if(profitEl) profitEl.textContent = (cp >= 0 ? '+' : '') + cp.toLocaleString() + ' GP';
      if(multDisp) multDisp.textContent = cm.toFixed(2) + '×';
    } else {
      var nm0 = multAfter(1, state.mines);
      var np0 = Math.floor(state.bet * nm0 - state.bet);
      if(nextEl) nextEl.textContent = nm0.toFixed(2)+'× (+'+np0.toLocaleString()+' GP)';
      if(profitEl) profitEl.textContent = '0 GP';
      if(multDisp) multDisp.textContent = '1.00×';
    }
  }
  function updatePF(){
    var h = document.getElementById('mnPfHash');
    var c = document.getElementById('mnPfClient');
    var n = document.getElementById('mnPfNonce');
    var r = document.getElementById('mnPfReveal');
    if(h) h.textContent = state.serverSeedHash ? state.serverSeedHash.slice(0,20)+'...' : '—';
    if(c) c.textContent = state.clientSeed || '—';
    if(n) n.textContent = state.nonce;
    if(r) r.textContent = state.revealedSeed ? state.revealedSeed.slice(0,20)+'...' : '(hidden until round end)';
  }
  function setMainBtn(text, cls){
    var btn = document.getElementById('mnMainBtn');
    if(!btn) return;
    btn.textContent = text;
    btn.className = 'mn-main-btn ' + (cls || '');
  }

  // ─── Bet helpers ───
  var api = {
    _betHalf:   function(){ var i = document.getElementById('mnBet'); i.value = Math.max(1, Math.floor(parseInt(i.value,10)/2)); i.dispatchEvent(new Event('input')); },
    _betDouble: function(){ var i = document.getElementById('mnBet'); i.value = Math.min(state.balance, (parseInt(i.value,10)||0)*2); i.dispatchEvent(new Event('input')); },
    _betMax:    function(){ var i = document.getElementById('mnBet'); i.value = state.balance; i.dispatchEvent(new Event('input')); },
    open: open, close: close
  };

  // ─── Game actions ───
  function onMainBtn(){
    if(state.phase === 'bet'){
      startRound();
    } else if(state.phase === 'play'){
      if(state.revealed === 0){
        flash('Reveal at least 1 tile before cashing out');
        return;
      }
      cashOut();
    } else if(state.phase === 'done'){
      reset();
    }
  }

  function startRound(){
    var bet = parseInt(document.getElementById('mnBet').value, 10) || 0;
    if(bet <= 0){ flash('Enter a bet first'); return; }
    if(bet > state.balance){ flash('Not enough GP'); return; }
    state.bet = bet;
    state.balance -= bet;
    state.revealed = 0;
    state.nonce++;
    state.phase = 'play';
    updateBalance();
    updatePF();
    generateMines(state.mines).then(function(positions){
      state.minePositions = positions;
      state.grid = [];
      for(var i=0;i<25;i++){
        state.grid.push({ isMine: positions.indexOf(i) >= 0, revealed: false });
      }
      renderGrid();
      setMainBtn('CASH OUT', 'cashout');
      updateProfit();
      document.getElementById('mnBet').disabled = true;
      document.getElementById('mnMines').disabled = true;
    });
  }

  function onCellClick(e){
    if(state.phase !== 'play') return;
    var i = parseInt(e.currentTarget.dataset.i, 10);
    var tile = state.grid[i];
    if(tile.revealed) return;
    tile.revealed = true;
    if(tile.isMine){
      // BOOM
      playBoom();
      state.phase = 'done';
      revealAllMines();
      state.revealedSeed = state.serverSeed;
      updatePF();
      flash('BOOM! You lost '+state.bet.toLocaleString()+' GP');
      setMainBtn('NEW ROUND', 'new');
      renderGrid();
      // Start a new server seed commit for the next round
      setTimeout(function(){ newServerSeed(); }, 200);
    } else {
      state.revealed++;
      playDing(800 + state.revealed * 30);
      renderGrid();
      updateProfit();
      // If all safe tiles revealed → auto-cashout (max win)
      if(state.revealed === 25 - state.mines){
        cashOut();
      }
    }
  }

  function cashOut(){
    if(state.phase !== 'play' || state.revealed === 0) return;
    var mult = currentMult();
    var payout = Math.floor(state.bet * mult);
    state.balance += payout;
    updateBalance();
    state.phase = 'done';
    revealAllMines();
    state.revealedSeed = state.serverSeed;
    updatePF();
    flash('Cashed out '+payout.toLocaleString()+' GP at '+mult.toFixed(2)+'×');
    playCheer();
    setMainBtn('NEW ROUND', 'new');
    renderGrid();
    setTimeout(function(){ newServerSeed(); }, 200);
  }

  function reset(){
    state.phase = 'bet';
    state.revealed = 0;
    state.grid = [];
    state.minePositions = [];
    document.getElementById('mnBet').disabled = false;
    document.getElementById('mnMines').disabled = false;
    setMainBtn('BET', '');
    buildGrid();
    updateProfit();
  }

  function revealAllMines(){
    for(var i=0;i<state.grid.length;i++){
      state.grid[i].revealed = true;
    }
  }

  // ─── Render grid ───
  function renderGrid(){
    var g = document.getElementById('mnGrid');
    if(!g) return;
    var cells = g.children;
    for(var i=0;i<25;i++){
      var tile = state.grid[i];
      var c = cells[i];
      c.className = 'mn-cell';
      c.innerHTML = '';
      if(!tile || !tile.revealed){
        continue;
      }
      c.classList.add('revealed');
      if(tile.isMine){
        c.classList.add('mine');
        c.innerHTML = '<span>\u{1F4A3}</span>';
      } else {
        c.classList.add('diamond');
        c.innerHTML = '<span>\u{1F48E}</span>';
      }
    }
  }

  // ─── Flash + audio ───
  function flash(msg){
    var el = document.getElementById('mnMultDisplay');
    if(!el) return;
    var old = el.textContent;
    el.textContent = msg;
    el.classList.add('flash');
    setTimeout(function(){
      el.classList.remove('flash');
      updateProfit();
    }, 2200);
  }

  var audioCtx = null;
  function getCtx(){
    if(audioCtx) return audioCtx;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
    return audioCtx;
  }
  function playDing(freq){
    var c = getCtx(); if(!c) return;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = freq || 1000;
    g.gain.setValueAtTime(0.12, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.15);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.2);
  }
  function playBoom(){
    var c = getCtx(); if(!c) return;
    // Noise burst
    var len = Math.floor(c.sampleRate * 0.4);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for(var i=0;i<len;i++) data[i] = (Math.random()*2-1) * Math.pow(1-i/len, 1.5);
    var src = c.createBufferSource();
    src.buffer = buf;
    var filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 400;
    var g = c.createGain();
    g.gain.value = 0.6;
    src.connect(filt).connect(g).connect(c.destination);
    src.start();
    // Low bass thump
    var o = c.createOscillator();
    var og = c.createGain();
    o.type = 'sine';
    o.frequency.value = 80;
    o.frequency.exponentialRampToValueAtTime(25, c.currentTime + 0.3);
    og.gain.setValueAtTime(0.5, c.currentTime);
    og.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.4);
    o.connect(og).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.5);
  }
  function playCheer(){
    var c = getCtx(); if(!c) return;
    [1200, 1600, 2000].forEach(function(f, i){
      setTimeout(function(){
        var o = c.createOscillator();
        var g = c.createGain();
        o.type = 'triangle';
        o.frequency.value = f;
        g.gain.value = 0.1;
        o.connect(g).connect(c.destination);
        o.start();
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.2);
        o.stop(c.currentTime + 0.25);
      }, i*100);
    });
  }

  // ─── Open / close ───
  function open(){
    if(!root) build();
    root.style.display = 'flex';
    if(typeof RL !== 'undefined' && typeof RL.chips === 'number') state.balance = RL.chips;
    if(!state.clientSeed) state.clientSeed = randomHex(8);
    updateBalance();
    reset();
    newServerSeed();
  }

  function close(e){
    if(e){ e.stopPropagation && e.stopPropagation(); }
    if(root) root.style.display = 'none';
    if(typeof RL !== 'undefined') RL.chips = state.balance;
  }

  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' && root && root.style.display === 'flex'){ close(e); }
  });

  if(!window.RL) window.RL = {};
  RL.mines = api;

  function installHook(){
    if(RL.games && RL.games.open){
      var orig = RL.games.open;
      RL.games.open = function(type){
        if(type === 'Mines' || type === 'mines'){ open(); return; }
        orig.apply(this, arguments);
      };
      return true;
    }
    return false;
  }
  if(!installHook()){
    var tries = 0;
    var iv = setInterval(function(){
      tries++;
      if(installHook() || tries > 20) clearInterval(iv);
    }, 100);
  }
})();

// ═══════════════════════════════════════
// ROULETTE GAME — overlay UI
// Modes: Live Table, Solo, Battle
// ═══════════════════════════════════════

(function(){
  var root = null;
  var state = {
    balance: 100000,
    bets: {},
    chip: 100,
    spinning: false,
    lastNumber: null,
    phase: 'betting',
    timer: 30,
    history: [],
    // Provably fair
    serverSeed: null,
    serverSeedHash: null,
    clientSeed: '',
    nonce: 0,
    revealedSeed: null,
    lastRoll: null,
  };
  var ROUND_SEC = 30;
  var _tickIv = null;

  // ─── Provably fair helpers (Web Crypto API) ───
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
      updatePFUI();
    });
  }
  function pfRoll(){
    // result = first 8 hex of HMAC_SHA256(serverSeed, clientSeed:nonce) mod 37
    var msg = state.clientSeed + ':' + state.nonce;
    return hmacHex(state.serverSeed, msg).then(function(hx){
      state.lastRoll = hx;
      var slice = hx.slice(0, 8);
      var n = parseInt(slice, 16);
      return n % 37;
    });
  }
  function updatePFUI(){
    var hashEl = document.getElementById('pfHash');
    if(hashEl) hashEl.textContent = state.serverSeedHash ? state.serverSeedHash.slice(0,24)+'...' : '—';
    var csEl = document.getElementById('pfClient');
    if(csEl) csEl.textContent = state.clientSeed;
    var nEl = document.getElementById('pfNonce');
    if(nEl) nEl.textContent = state.nonce;
    var rEl = document.getElementById('pfReveal');
    if(rEl) rEl.textContent = state.revealedSeed ? state.revealedSeed.slice(0,24)+'...' : '(hidden until next round)';
    var rollEl = document.getElementById('pfRoll');
    if(rollEl) rollEl.textContent = state.lastRoll ? state.lastRoll.slice(0,16)+'...' : '—';
  }

  var RED_NUMBERS = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  function isRed(n){ return RED_NUMBERS.indexOf(n) >= 0; }
  function numColor(n){ return n===0 ? 'green' : (isRed(n) ? 'red' : 'black'); }

  function build(){
    root = document.createElement('div');
    root.id = 'rouletteRoot';
    root.innerHTML =
      '<div class="rg-topbar">'
      +   '<button class="rg-close" title="Close">\u2715</button>'
      +   '<div class="rg-title">\u{1F3B2} LIVE ROULETTE TABLE</div>'
      +   '<div class="rg-phase" id="rgPhase">PLACE BETS: <span id="rgTimer">30</span>s</div>'
      +   '<div class="rg-balance">GP: <span id="rgBal">100,000</span></div>'
      + '</div>'
      + '<div id="rgBody" class="rg-body"></div>';
    document.body.appendChild(root);
    root.addEventListener('mousedown', function(e){ e.stopPropagation(); });
    root.addEventListener('mouseup',   function(e){ e.stopPropagation(); });
    root.addEventListener('click',     function(e){ e.stopPropagation(); });
    root.querySelector('.rg-close').addEventListener('click', close);
  }

  function renderBody(){
    var body = document.getElementById('rgBody');
    body.innerHTML = renderLiveTable();
    wireBets();
    initCanvas();
  }

  function renderLiveTable(){
    var html = '<div class="rg-solo">';
    html += '<div class="rg-wheel-area">';
    html +=   '<div class="rg-pf" id="rgPF">';
    html +=     '<div class="rg-pf-title">\u{1F512} Provably Fair</div>';
    html +=     '<div class="rg-pf-row"><span>Hash (committed):</span><code id="pfHash">—</code></div>';
    html +=     '<div class="rg-pf-row"><span>Client seed:</span><code id="pfClient">—</code></div>';
    html +=     '<div class="rg-pf-row"><span>Nonce:</span><code id="pfNonce">0</code></div>';
    html +=     '<div class="rg-pf-row"><span>HMAC result:</span><code id="pfRoll">—</code></div>';
    html +=     '<div class="rg-pf-row"><span>Revealed seed:</span><code id="pfReveal">(hidden)</code></div>';
    html +=   '</div>';
    html +=   '<canvas id="rgWheelCanvas" width="480" height="480"></canvas>';
    html +=   '<div class="rg-side">';
    html +=     '<div class="rg-last" id="rgLast">'+ (state.lastNumber!==null?state.lastNumber:'\u2014') +'</div>';
    html +=     '<div class="rg-history" id="rgHistory"></div>';
    html +=   '</div>';
    html += '</div>';
    // Bet board
    html += '<div class="rg-board">';
    html +=   '<div class="rg-zero" data-bet="n0">0</div>';
    html +=   '<div class="rg-numbers">';
    // Numbers 1-36 in 3 rows × 12 cols (OSRS/European style)
    var rows = [[3,6,9,12,15,18,21,24,27,30,33,36],[2,5,8,11,14,17,20,23,26,29,32,35],[1,4,7,10,13,16,19,22,25,28,31,34]];
    for(var r=0;r<3;r++){
      html += '<div class="rg-row">';
      for(var c=0;c<12;c++){
        var n = rows[r][c];
        html += '<div class="rg-num rg-'+numColor(n)+'" data-bet="n'+n+'">'+n+'</div>';
      }
      html += '</div>';
    }
    html +=   '</div>';
    // Outside bets
    html +=   '<div class="rg-outside">';
    html +=     '<div class="rg-out" data-bet="d1">1st 12</div>';
    html +=     '<div class="rg-out" data-bet="d2">2nd 12</div>';
    html +=     '<div class="rg-out" data-bet="d3">3rd 12</div>';
    html +=   '</div>';
    html +=   '<div class="rg-outside">';
    html +=     '<div class="rg-out" data-bet="low">1-18</div>';
    html +=     '<div class="rg-out" data-bet="even">EVEN</div>';
    html +=     '<div class="rg-out rg-red" data-bet="red">RED</div>';
    html +=     '<div class="rg-out rg-black" data-bet="black">BLACK</div>';
    html +=     '<div class="rg-out" data-bet="odd">ODD</div>';
    html +=     '<div class="rg-out" data-bet="high">19-36</div>';
    html +=   '</div>';
    html += '</div>';
    // Chips + spin
    html += '<div class="rg-controls">';
    html +=   '<div class="rg-chips">';
    [10,100,1000,10000,100000].forEach(function(v,i){
      html += '<button class="rg-chip'+(v===state.chip?' sel':'')+'" data-chip="'+v+'">'+formatK(v)+'</button>';
    });
    html +=   '</div>';
    html +=   '<button class="rg-clear-btn" id="rgClearBets">Clear Bets</button>';
    html +=   '<div class="rg-total">Total bet: <span id="rgTotalBet">0</span> GP</div>';
    html += '</div>';
    html += '<div class="rg-result" id="rgResult"></div>';
    html += '</div>';
    return html;
  }

  function wireBets(){
    document.querySelectorAll('#rgBody [data-bet]').forEach(function(el){
      el.addEventListener('click', function(){ placeBet(el.dataset.bet); });
    });
    document.querySelectorAll('#rgBody .rg-chip').forEach(function(c){
      c.addEventListener('click', function(){
        state.chip = parseInt(c.dataset.chip, 10);
        document.querySelectorAll('#rgBody .rg-chip').forEach(function(x){x.classList.remove('sel')});
        c.classList.add('sel');
      });
    });
    var clearBtn = document.getElementById('rgClearBets');
    if(clearBtn) clearBtn.addEventListener('click', clearBets);
    updateTotalBet();
    renderHistory();
  }

  // ═══ CANVAS WHEEL + PHYSICS ═══
  // European single-zero wheel order (standard roulette)
  var WHEEL_ORDER = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  var wheel = { angle: 0, vel: 0 };
  var ball  = { angle: 0, vel: 0, radius: 0, targetRadius: 0, stopping: false, final: null };
  var animRaf = 0;

  var _wheelCache = null; // offscreen canvas for the wheel (drawn once, rotated each frame)
  var _wheelCtx   = null;

  function initCanvas(){
    var cv = document.getElementById('rgWheelCanvas');
    if(!cv) return;
    ball.radius = 185; ball.targetRadius = 185;
    _wheelCache = null;
    buildWheelCache(cv.width, cv.height);
    drawFrame();
  }

  // Build the static wheel once in an offscreen canvas — 37 pockets + hub + text.
  // At runtime we only rotate+blit this, which is ~50× cheaper than redrawing.
  function buildWheelCache(W, H){
    _wheelCache = document.createElement('canvas');
    _wheelCache.width = W; _wheelCache.height = H;
    var ctx = _wheelCache.getContext('2d');
    var cx = W/2, cy = H/2;
    var outerR = 225, rimR = 210, innerR = 155, hubR = 80;
    ctx.clearRect(0, 0, W, H);

    // Wood outer ring
    var g1 = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    g1.addColorStop(0, '#4a2810');
    g1.addColorStop(1, '#1a0a04');
    ctx.fillStyle = g1;
    ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, Math.PI*2); ctx.fill();

    // Rim + ball track
    ctx.fillStyle = '#0a0604';
    ctx.beginPath(); ctx.arc(cx, cy, rimR, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#4a2810';
    ctx.beginPath(); ctx.arc(cx, cy, innerR+5, 0, Math.PI*2); ctx.fill();

    // Pockets (translated to center, draw at angle 0)
    ctx.save();
    ctx.translate(cx, cy);
    var nPockets = 37;
    for(var i=0;i<nPockets;i++){
      var n = WHEEL_ORDER[i];
      var a0 = (i/nPockets)*Math.PI*2 - Math.PI/nPockets;
      var a1 = ((i+1)/nPockets)*Math.PI*2 - Math.PI/nPockets;
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0, 0, innerR, a0, a1);
      ctx.closePath();
      ctx.fillStyle = n===0 ? '#0a7a2a' : (isRed(n) ? '#a81818' : '#0a0a0a');
      ctx.fill();
      ctx.strokeStyle = '#d4a843';
      ctx.lineWidth = 1;
      ctx.stroke();
      var ta = (a0+a1)/2;
      var tx = Math.cos(ta) * (innerR-22);
      var ty = Math.sin(ta) * (innerR-22);
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(ta + Math.PI/2);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), 0, 0);
      ctx.restore();
    }
    // Hub + spokes
    var g2 = ctx.createRadialGradient(0, 0, 10, 0, 0, hubR);
    g2.addColorStop(0, '#ffd84a');
    g2.addColorStop(1, '#6a4a10');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(0, 0, hubR, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#2a1810'; ctx.lineWidth = 3; ctx.stroke();
    ctx.strokeStyle = '#2a1810';
    ctx.lineWidth = 6;
    for(var s=0;s<4;s++){
      ctx.save();
      ctx.rotate((s/4)*Math.PI*2);
      ctx.beginPath(); ctx.moveTo(0, -hubR); ctx.lineTo(0, -innerR+12); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // Decorative outer rim
    ctx.strokeStyle = '#d4a843';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, outerR-2, 0, Math.PI*2); ctx.stroke();
  }

  // Per-frame draw: blit the cached wheel rotated, then draw the ball
  function drawFrame(){
    var cv = document.getElementById('rgWheelCanvas');
    if(!cv || !_wheelCache) return;
    var ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    var cx = W/2, cy = H/2;
    var innerR = 155;
    ctx.imageSmoothingEnabled = true;
    ctx.clearRect(0, 0, W, H);
    // Rotate + blit the cached wheel
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(wheel.angle);
    ctx.drawImage(_wheelCache, -cx, -cy);
    ctx.restore();
    // Ball on top (in world space, not the wheel rotation)
    ctx.save();
    ctx.translate(cx, cy);
    var bx = Math.cos(ball.angle) * ball.radius;
    var by = Math.sin(ball.angle) * ball.radius;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.beginPath(); ctx.arc(bx+1, by+2, 10, 0, Math.PI*2); ctx.fill();
    var bg = ctx.createRadialGradient(bx-4, by-4, 1, bx, by, 10);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(1, '#888888');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  function drawWheel(){
    var cv = document.getElementById('rgWheelCanvas');
    if(!cv) return;
    var ctx = cv.getContext('2d');
    var W = cv.width, H = cv.height;
    var cx = W/2, cy = H/2;
    var outerR = 225, rimR = 210, innerR = 155, hubR = 80;
    ctx.clearRect(0,0,W,H);

    // Outer ring (wood)
    var g1 = ctx.createRadialGradient(cx, cy, innerR, cx, cy, outerR);
    g1.addColorStop(0, '#4a2810');
    g1.addColorStop(1, '#1a0a04');
    ctx.fillStyle = g1;
    ctx.beginPath(); ctx.arc(cx, cy, outerR, 0, Math.PI*2); ctx.fill();

    // Rim (ball track)
    ctx.fillStyle = '#0a0604';
    ctx.beginPath(); ctx.arc(cx, cy, rimR, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#4a2810';
    ctx.beginPath(); ctx.arc(cx, cy, innerR+5, 0, Math.PI*2); ctx.fill();

    // Rotating wheel with pockets
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(wheel.angle);
    var nPockets = 37;
    for(var i=0;i<nPockets;i++){
      var n = WHEEL_ORDER[i];
      var a0 = (i/nPockets)*Math.PI*2 - Math.PI/nPockets;
      var a1 = ((i+1)/nPockets)*Math.PI*2 - Math.PI/nPockets;
      // pocket background
      ctx.beginPath();
      ctx.moveTo(0,0);
      ctx.arc(0, 0, innerR, a0, a1);
      ctx.closePath();
      ctx.fillStyle = n===0 ? '#0a7a2a' : (isRed(n) ? '#a81818' : '#0a0a0a');
      ctx.fill();
      ctx.strokeStyle = '#d4a843';
      ctx.lineWidth = 1;
      ctx.stroke();
      // number label
      var ta = (a0+a1)/2;
      var tx = Math.cos(ta) * (innerR-22);
      var ty = Math.sin(ta) * (innerR-22);
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(ta + Math.PI/2);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 15px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(n), 0, 0);
      ctx.restore();
    }
    // Hub
    var g2 = ctx.createRadialGradient(0, 0, 10, 0, 0, hubR);
    g2.addColorStop(0, '#ffd84a');
    g2.addColorStop(1, '#6a4a10');
    ctx.fillStyle = g2;
    ctx.beginPath(); ctx.arc(0, 0, hubR, 0, Math.PI*2); ctx.fill();
    ctx.strokeStyle = '#2a1810'; ctx.lineWidth = 3; ctx.stroke();
    // cross spokes
    ctx.strokeStyle = '#2a1810';
    ctx.lineWidth = 6;
    for(var s=0;s<4;s++){
      ctx.save();
      ctx.rotate((s/4)*Math.PI*2);
      ctx.beginPath(); ctx.moveTo(0, -hubR); ctx.lineTo(0, -innerR+12); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();

    // Outer rim decorative
    ctx.strokeStyle = '#d4a843';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(cx, cy, outerR-2, 0, Math.PI*2); ctx.stroke();

    // Ball
    ctx.save();
    ctx.translate(cx, cy);
    var bx = Math.cos(ball.angle) * ball.radius;
    var by = Math.sin(ball.angle) * ball.radius;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.beginPath(); ctx.arc(bx+1, by+2, 10, 0, Math.PI*2); ctx.fill();
    var bg = ctx.createRadialGradient(bx-4, by-4, 1, bx, by, 10);
    bg.addColorStop(0, '#ffffff');
    bg.addColorStop(1, '#888888');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.arc(bx, by, 9, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }

  // ─── Web Audio: synthesized click ───
  var audioCtx = null;
  function getAudio(){
    if(audioCtx) return audioCtx;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
    return audioCtx;
  }
  function playClick(freq, dur, gain){
    var c = getAudio();
    if(!c) return;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = 'triangle';
    o.frequency.value = freq || 900;
    g.gain.value = gain || 0.08;
    o.connect(g).connect(c.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + (dur||0.05));
    o.stop(c.currentTime + (dur||0.05));
  }
  function playThud(){
    var c = getAudio();
    if(!c) return;
    var o = c.createOscillator();
    var g = c.createGain();
    o.type = 'sine';
    o.frequency.value = 140;
    g.gain.value = 0.25;
    o.connect(g).connect(c.destination);
    o.start();
    o.frequency.exponentialRampToValueAtTime(50, c.currentTime + 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
    o.stop(c.currentTime + 0.3);
  }

  var _lastAnimTime = 0;
  function animate(ts){
    animRaf = requestAnimationFrame(animate);
    // Frame-rate independent dt (seconds)
    if(!_lastAnimTime) _lastAnimTime = ts || performance.now();
    var now = ts || performance.now();
    var dt = Math.min(0.05, (now - _lastAnimTime) / 1000);
    _lastAnimTime = now;

    // Wheel: velocity is in rad/sec now. Exponential decay: e^(-k*t)
    //   At k=0.12: half-life ≈ 5.8s. Smooth 12-15s decel from initial spin.
    wheel.angle += wheel.vel * dt;
    wheel.vel *= Math.exp(-0.12 * dt);
    if(Math.abs(wheel.vel) < 0.01) wheel.vel = 0;

    if(state.spinning){
      // Ball velocity: rad/sec, counterclockwise (negative)
      ball.angle += ball.vel * dt;
      ball.vel *= Math.exp(-0.42 * dt); // faster decel than wheel (friction on track)
      var absVel = Math.abs(ball.vel);

      // Gradually shrink radius as ball loses energy
      if(absVel < 3.2 && ball.radius > 145){
        ball.radius -= 38 * dt;
        if(absVel < 2.0) ball.radius -= 24 * dt;
      }

      // Click on pocket pass
      var seg = Math.floor(((ball.angle % (Math.PI*2))+Math.PI*2) / (Math.PI*2/37));
      if(seg !== ball._lastSeg){
        ball._lastSeg = seg;
        if(ball.radius > 165 && absVel > 1.5) playClick(800+Math.random()*200, 0.04, 0.05);
      }

      // Lock into pocket
      if(absVel < 1.0 && ball.radius <= 150 && !ball.locked){
        ball.locked = true;
        playThud();
        var winIdx = WHEEL_ORDER.indexOf(ball.final);
        var pocketCenterA = (winIdx/37)*Math.PI*2;
        ball.angle = wheel.angle + pocketCenterA;
        ball.radius = 135;
        ball.vel = 0;
        setTimeout(resolveRound, 800);
      }
    }

    // Ball rides in the pocket after lock
    if(ball.locked && !state.spinning){
      var winIdx2 = WHEEL_ORDER.indexOf(ball.final);
      var pocketCenterA2 = (winIdx2/37)*Math.PI*2;
      ball.angle = wheel.angle + pocketCenterA2;
      ball.radius = 135;
    }

    drawFrame();
  }

  function startAnim(){
    cancelAnimationFrame(animRaf);
    animate();
  }

  // Used by spin() — replaced below
  function resolveRound(){
    state.spinning = false;
    // Stop the wheel so the ball visibly sits still in its pocket
    wheel.vel = 0;
    ball.vel = 0;
    // Keep ball.locked = true so it stays in pocket during result/betting phases
    var result = ball.final;
    var totalBet = 0;
    for(var k in state.bets) totalBet += state.bets[k];
    var winnings = calcWinnings(result);
    state.balance += winnings;
    updateBalance();
    var net = winnings - totalBet;
    var msg = (net >= 0 ? '+ ' : '') + net.toLocaleString() + ' GP — number '+result+' ('+numColor(result).toUpperCase()+')';
    flashResult(msg, net>=0?'win':'lose');
    state.bets = {};
    updateTotalBet();
    document.querySelectorAll('.rg-bet-amt').forEach(function(e){e.remove()});
    var last = document.getElementById('rgLast');
    if(last){ last.textContent = result; last.className = 'rg-last rg-'+numColor(result); }
    state.history = state.history || [];
    state.history.unshift(result);
    if(state.history.length > 10) state.history.length = 10;
    renderHistory();
    if(net >= 0){
      playClick(1200, 0.15, 0.12);
      setTimeout(function(){playClick(1800, 0.15, 0.12);}, 120);
    }
    state.phase = 'result';
    updatePhaseLabel();
    // Reveal the server seed for verification
    state.revealedSeed = state.serverSeed;
    updatePFUI();
    // After a short pause, start the next betting round with a fresh seed
    setTimeout(function(){
      newServerSeed().then(startNextRound);
    }, 5000);
  }

  function placeBet(betId){
    if(state.phase !== 'betting'){ flashResult('Betting closed', 'lose'); return; }
    var amt = state.chip;
    if(state.balance < amt){ flashResult('Not enough GP', 'lose'); return; }
    state.balance -= amt;
    state.bets[betId] = (state.bets[betId] || 0) + amt;
    updateBalance();
    updateTotalBet();
    flashBetChip(betId);
  }

  function flashBetChip(betId){
    var el = document.querySelector('[data-bet="'+betId+'"]');
    if(!el) return;
    var old = el.querySelector('.rg-bet-amt');
    if(old) old.remove();
    var chip = document.createElement('div');
    chip.className = 'rg-bet-amt';
    chip.textContent = formatK(state.bets[betId]);
    el.appendChild(chip);
  }

  function clearBets(){
    if(state.spinning) return;
    for(var k in state.bets){ state.balance += state.bets[k]; }
    state.bets = {};
    updateBalance();
    updateTotalBet();
    document.querySelectorAll('.rg-bet-amt').forEach(function(e){e.remove()});
  }

  function updateBalance(){
    document.getElementById('rgBal').textContent = state.balance.toLocaleString();
  }

  function updateTotalBet(){
    var total = 0;
    for(var k in state.bets) total += state.bets[k];
    var el = document.getElementById('rgTotalBet');
    if(el) el.textContent = total.toLocaleString();
  }

  function spin(){
    if(state.spinning) return;
    state.spinning = true;
    state.phase = 'spinning';
    updatePhaseLabel();
    state.lastNumber = null;
    getAudio();
    // Increment nonce and compute provably fair result
    state.nonce++;
    pfRoll().then(function(result){
      ball.final = result;
      ball.locked = false;
      ball.radius = 190;
      ball.angle = Math.random()*Math.PI*2;
      // Velocities in rad/sec (dt-based physics)
      ball.vel  = -12;  // counterclockwise, ~2 rev/sec initial
      wheel.vel =  5;   // clockwise, ~0.8 rev/sec initial
      _lastAnimTime = 0;
      startAnim();
      updatePFUI();
    });
  }

  function updatePhaseLabel(){
    var p = document.getElementById('rgPhase');
    if(!p) return;
    if(state.phase === 'betting'){
      p.className = 'rg-phase rg-phase-bet';
      p.innerHTML = 'PLACE BETS: <span id="rgTimer">'+state.timer+'</span>s';
    } else if(state.phase === 'spinning'){
      p.className = 'rg-phase rg-phase-spin';
      p.innerHTML = 'NO MORE BETS \u2014 SPINNING...';
    } else if(state.phase === 'result'){
      p.className = 'rg-phase rg-phase-result';
      p.innerHTML = 'RESULT: <span>'+state.lastNumber+'</span>';
    }
  }

  // ─── ROUND LOOP: every 30 sec automatic spin ───
  function startRoundLoop(){
    stopRoundLoop();
    state.timer = ROUND_SEC;
    state.phase = 'betting';
    updatePhaseLabel();
    _tickIv = setInterval(function(){
      if(state.phase !== 'betting'){ return; }
      state.timer--;
      var t = document.getElementById('rgTimer');
      if(t) t.textContent = state.timer;
      if(state.timer <= 0){
        spin();
      }
    }, 1000);
  }

  function stopRoundLoop(){
    if(_tickIv){ clearInterval(_tickIv); _tickIv = null; }
  }

  function startNextRound(){
    state.timer = ROUND_SEC;
    state.phase = 'betting';
    updatePhaseLabel();
  }

  function renderHistory(){
    var el = document.getElementById('rgHistory');
    if(!el) return;
    var h = state.history || [];
    el.innerHTML = '<div class="rg-hist-label">HISTORY</div>' + h.map(function(n){
      return '<span class="rg-hist rg-'+numColor(n)+'">'+n+'</span>';
    }).join('');
  }

  // Determine winnings for this result based on all current bets
  function calcWinnings(n){
    var won = 0;
    for(var k in state.bets){
      var amt = state.bets[k];
      if(k === 'n'+n) won += amt * 36;           // straight up pays 35:1 (35×amt + original)
      else if(k === 'red'   && isRed(n))          won += amt * 2;
      else if(k === 'black' && n>0 && !isRed(n))  won += amt * 2;
      else if(k === 'even'  && n>0 && n%2===0)    won += amt * 2;
      else if(k === 'odd'   && n>0 && n%2===1)    won += amt * 2;
      else if(k === 'low'   && n>=1 && n<=18)     won += amt * 2;
      else if(k === 'high'  && n>=19 && n<=36)    won += amt * 2;
      else if(k === 'd1'    && n>=1 && n<=12)     won += amt * 3;
      else if(k === 'd2'    && n>=13 && n<=24)    won += amt * 3;
      else if(k === 'd3'    && n>=25 && n<=36)    won += amt * 3;
    }
    return won;
  }

  function flashResult(msg, kind){
    var r = document.getElementById('rgResult');
    if(!r) return;
    r.textContent = msg;
    r.className = 'rg-result '+(kind||'');
    clearTimeout(flashResult._t);
    flashResult._t = setTimeout(function(){ r.className='rg-result'; r.textContent=''; }, 4500);
  }

  function formatK(n){
    if(n >= 1000000) return (n/1000000).toFixed(0)+'M';
    if(n >= 1000)    return (n/1000).toFixed(0)+'K';
    return String(n);
  }

  function open(){
    if(!root) build();
    root.style.display = 'flex';
    if(typeof RL !== 'undefined' && typeof RL.chips === 'number') state.balance = RL.chips;
    updateBalance();
    if(!state.clientSeed) state.clientSeed = randomHex(8);
    renderBody();
    // Prepare first server seed (commit) then start the round
    newServerSeed().then(startRoundLoop);
  }

  function close(e){
    if(e){ e.stopPropagation && e.stopPropagation(); }
    if(root) root.style.display = 'none';
    stopRoundLoop();
    cancelAnimationFrame(animRaf);
    if(typeof RL !== 'undefined') RL.chips = state.balance;
  }

  document.addEventListener('keydown', function(e){
    if(e.key==='Escape' && root && root.style.display==='flex'){ close(e); }
  });

  if(!window.RL) window.RL={};
  RL.roulette = { open: open, close: close };

  // Hook: override games.open for Roulette, runs ASAP after RL.games exists
  function installHook(){
    if(RL.games && RL.games.open){
      var orig = RL.games.open;
      RL.games.open = function(type){
        if(type === 'Roulette' || type === 'roulette'){ open(); return; }
        orig.apply(this, arguments);
      };
      return true;
    }
    return false;
  }
  if(!installHook()){
    // Retry a few times in case games.js not yet initialized
    var tries = 0;
    var iv = setInterval(function(){
      tries++;
      if(installHook() || tries > 20) clearInterval(iv);
    }, 100);
  }
})();

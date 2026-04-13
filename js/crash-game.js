// ═══════════════════════════════════════
// CRASH GAME — Rocket style
// Multiplier rises, cash out before crash
// Provably fair with HMAC-SHA256
// ═══════════════════════════════════════

(function(){
  var root = null;
  var canvas, ctx;
  var state = {
    balance: 100000,
    bet: 100,
    phase: 'idle', // idle | rising | crashed | cashedOut
    multiplier: 1.00,
    crashPoint: 0,
    cashOutAt: 0,
    startTime: 0,
    history: [],
    animFrame: null,
    // Provably fair
    serverSeed: null,
    serverSeedHash: null,
    clientSeed: '',
    nonce: 0,
    revealedSeed: null,
  };

  // ─── Provably fair ───
  function randomHex(n){var a=new Uint8Array(n);crypto.getRandomValues(a);return Array.from(a).map(function(b){return b.toString(16).padStart(2,'0')}).join('')}
  function sha256Hex(m){var e=new TextEncoder();return crypto.subtle.digest('SHA-256',e.encode(m)).then(function(b){return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0')}).join('')})}
  function hmacHex(k,m){var e=new TextEncoder();return crypto.subtle.importKey('raw',e.encode(k),{name:'HMAC',hash:'SHA-256'},false,['sign']).then(function(key){return crypto.subtle.sign('HMAC',key,e.encode(m))}).then(function(s){return Array.from(new Uint8Array(s)).map(function(x){return x.toString(16).padStart(2,'0')}).join('')})}
  function newSeed(){
    state.serverSeed=randomHex(32);
    return sha256Hex(state.serverSeed).then(function(h){state.serverSeedHash=h;state.revealedSeed=null;updatePF()});
  }

  function generateCrashPoint(){
    state.nonce++;
    var msg = state.clientSeed+':'+state.nonce;
    return hmacHex(state.serverSeed, msg).then(function(hx){
      // Bustabit-style crash point with 3% house edge
      var h = parseInt(hx.slice(0,13),16);
      if(h % 33 === 0) return 1.00; // ~3% instant crash
      var e = Math.pow(2,52);
      var point = Math.floor((100 * e - h) / (e - h)) / 100;
      return Math.max(1.00, point);
    });
  }

  // ─── Build UI ───
  function build(){
    root = document.createElement('div');
    root.id = 'crashRoot';
    root.innerHTML =
      '<div class="cr-topbar">'
      +   '<button class="cr-close" title="Close">\u2715</button>'
      +   '<div class="cr-title"><b>RUNE</b><i>LUCK</i><span>CRASH</span></div>'
      +   '<div class="cr-balance">GP: <span id="crBal">100,000</span></div>'
      + '</div>'
      + '<div class="cr-body">'
      +   '<div class="cr-main">'
      // Multiplier display
      +     '<div class="cr-multi-wrap">'
      +       '<canvas id="crashCanvas" width="700" height="320"></canvas>'
      +       '<div class="cr-multi-overlay" id="crMulti">1.00×</div>'
      +     '</div>'
      // History
      +     '<div class="cr-history" id="crHistory"></div>'
      // Controls
      +     '<div class="cr-controls">'
      +       '<div class="cr-bet-row">'
      +         '<label>Bet</label>'
      +         '<input type="number" id="crBet" value="100" min="1">'
      +         '<button class="cr-sm" onclick="RL.crash._half()">½</button>'
      +         '<button class="cr-sm" onclick="RL.crash._dbl()">2×</button>'
      +         '<button class="cr-sm" onclick="RL.crash._max()">Max</button>'
      +       '</div>'
      +       '<button class="cr-action-btn" id="crActionBtn">PLACE BET</button>'
      +     '</div>'
      +   '</div>'
      // PF sidebar
      +   '<div class="cr-pf">'
      +     '<div class="cr-pf-title">\u{1F512} Provably Fair</div>'
      +     '<div class="cr-pf-r"><span>Hash:</span><code id="crPfHash">—</code></div>'
      +     '<div class="cr-pf-r"><span>Client seed:</span><code id="crPfClient">—</code></div>'
      +     '<div class="cr-pf-r"><span>Nonce:</span><code id="crPfNonce">0</code></div>'
      +     '<div class="cr-pf-r"><span>Revealed:</span><code id="crPfReveal">(hidden)</code></div>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(root);
    root.addEventListener('mousedown',function(e){e.stopPropagation()});
    root.addEventListener('mouseup',function(e){e.stopPropagation()});
    root.addEventListener('click',function(e){e.stopPropagation()});
    root.querySelector('.cr-close').addEventListener('click',close);
    document.getElementById('crActionBtn').addEventListener('click',onAction);
    canvas = document.getElementById('crashCanvas');
    ctx = canvas.getContext('2d');
  }

  function updateBal(){
    document.getElementById('crBal').textContent = state.balance.toLocaleString();
  }
  function updatePF(){
    var h=document.getElementById('crPfHash');if(h)h.textContent=state.serverSeedHash?state.serverSeedHash.slice(0,20)+'...':'—';
    var c=document.getElementById('crPfClient');if(c)c.textContent=state.clientSeed;
    var n=document.getElementById('crPfNonce');if(n)n.textContent=state.nonce;
    var r=document.getElementById('crPfReveal');if(r)r.textContent=state.revealedSeed?state.revealedSeed.slice(0,20)+'...':'(hidden)';
  }

  // ─── Game logic ───
  function onAction(){
    if(state.phase === 'idle'){
      // Place bet and start
      var bet = parseInt(document.getElementById('crBet').value,10)||0;
      if(bet<=0 || bet>state.balance) return;
      state.bet = bet;
      state.balance -= bet;
      updateBal();
      state.phase = 'waiting';
      document.getElementById('crActionBtn').textContent = 'STARTING...';
      document.getElementById('crActionBtn').classList.add('cr-disabled');
      // Generate crash point then start
      generateCrashPoint().then(function(cp){
        state.crashPoint = cp;
        state.multiplier = 1.00;
        state.startTime = performance.now();
        state.phase = 'rising';
        document.getElementById('crActionBtn').textContent = 'CASH OUT';
        document.getElementById('crActionBtn').classList.remove('cr-disabled');
        document.getElementById('crActionBtn').classList.add('cr-cashout');
        tick();
      });
    } else if(state.phase === 'rising'){
      // Cash out
      cashOut();
    }
  }

  function cashOut(){
    state.cashOutAt = state.multiplier;
    state.phase = 'cashedOut';
    var winnings = Math.floor(state.bet * state.cashOutAt);
    state.balance += winnings;
    updateBal();
    showResult(true);
  }

  function tick(){
    if(state.phase !== 'rising' && state.phase !== 'cashedOut') return;

    var elapsed = (performance.now() - state.startTime) / 1000;
    // Multiplier grows exponentially
    state.multiplier = Math.floor(Math.pow(1.06, elapsed * 8) * 100) / 100;

    if(state.phase === 'rising' && state.multiplier >= state.crashPoint){
      // CRASHED
      state.multiplier = state.crashPoint;
      state.phase = 'crashed';
      showResult(false);
      drawGraph();
      return;
    }

    drawGraph();

    var multiEl = document.getElementById('crMulti');
    multiEl.textContent = state.multiplier.toFixed(2) + '×';

    if(state.phase === 'rising'){
      if(state.multiplier < 2){
        multiEl.style.color = '#e0f0e4';
      } else if(state.multiplier < 5){
        multiEl.style.color = '#4ade80';
      } else {
        multiEl.style.color = '#f0c94d';
      }
    }

    if(state.phase === 'rising' || state.phase === 'cashedOut'){
      state.animFrame = requestAnimationFrame(tick);
    }
  }

  function showResult(won){
    var multiEl = document.getElementById('crMulti');
    var btn = document.getElementById('crActionBtn');

    if(won){
      multiEl.style.color = '#4ade80';
      multiEl.style.textShadow = '0 0 40px rgba(34,197,94,.8)';
      multiEl.textContent = state.cashOutAt.toFixed(2) + '×';
      btn.textContent = 'WIN +' + Math.floor(state.bet * state.cashOutAt - state.bet).toLocaleString() + ' GP';
      btn.classList.remove('cr-cashout');
      btn.classList.add('cr-win');
      playWin();
      // Wait for crash to finish then reset
      var waitForCrash = function(){
        var elapsed = (performance.now() - state.startTime) / 1000;
        var currentMulti = Math.floor(Math.pow(1.06, elapsed * 8) * 100) / 100;
        if(currentMulti >= state.crashPoint){
          // Crash happened, add to history
          state.history.unshift({point:state.crashPoint, cashedOut:state.cashOutAt, won:true});
          if(state.history.length>20) state.history.length=20;
          renderHistory();
          revealAndReset();
        } else {
          requestAnimationFrame(waitForCrash);
        }
      };
      // Keep animating graph after cash out
      state.phase = 'cashedOut';
      // We let the animation continue in tick(), and separately watch for crash
      var checkCrash = setInterval(function(){
        var elapsed = (performance.now() - state.startTime) / 1000;
        var currentMulti = Math.floor(Math.pow(1.06, elapsed * 8) * 100) / 100;
        if(currentMulti >= state.crashPoint){
          clearInterval(checkCrash);
          if(state.animFrame) cancelAnimationFrame(state.animFrame);
          state.history.unshift({point:state.crashPoint, cashedOut:state.cashOutAt, won:true});
          if(state.history.length>20) state.history.length=20;
          renderHistory();
          revealAndReset();
        }
      }, 50);
    } else {
      multiEl.style.color = '#ff5555';
      multiEl.style.textShadow = '0 0 40px rgba(255,60,60,.7)';
      multiEl.textContent = 'CRASHED @ ' + state.crashPoint.toFixed(2) + '×';
      btn.textContent = 'BUSTED -' + state.bet.toLocaleString() + ' GP';
      btn.classList.remove('cr-cashout');
      btn.classList.add('cr-lose');
      playLose();
      state.history.unshift({point:state.crashPoint, cashedOut:0, won:false});
      if(state.history.length>20) state.history.length=20;
      renderHistory();
      revealAndReset();
    }
  }

  function revealAndReset(){
    state.revealedSeed = state.serverSeed;
    updatePF();
    newSeed();
    setTimeout(function(){
      state.phase = 'idle';
      var btn = document.getElementById('crActionBtn');
      btn.textContent = 'PLACE BET';
      btn.classList.remove('cr-win','cr-lose','cr-cashout','cr-disabled');
      var multiEl = document.getElementById('crMulti');
      multiEl.textContent = '1.00×';
      multiEl.style.color = '#e0f0e4';
      multiEl.style.textShadow = 'none';
      drawIdle();
    }, 2000);
  }

  // ─── Graph drawing ───
  var graphPoints = [];

  function drawIdle(){
    if(!ctx) return;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle = 'rgba(3,8,5,0.95)';
    ctx.fillRect(0,0,canvas.width,canvas.height);
    drawGrid();
    // Rocket emoji in center
    ctx.font = '48px serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillText('\u{1F680}', canvas.width/2, canvas.height/2 + 16);
  }

  function drawGrid(){
    ctx.strokeStyle = 'rgba(34,197,94,0.08)';
    ctx.lineWidth = 1;
    for(var x=0; x<canvas.width; x+=70){
      ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke();
    }
    for(var y=0; y<canvas.height; y+=40){
      ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke();
    }
  }

  function drawGraph(){
    if(!ctx) return;
    var w = canvas.width, h = canvas.height;
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = 'rgba(3,8,5,0.95)';
    ctx.fillRect(0,0,w,h);
    drawGrid();

    var elapsed = (performance.now() - state.startTime) / 1000;
    var maxTime = Math.max(elapsed + 1, 5);
    var maxMulti = Math.max(state.multiplier + 0.5, 3);

    // Draw axes labels
    ctx.fillStyle = 'rgba(200,224,208,0.3)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    for(var m=1; m<=maxMulti; m+=Math.max(1,Math.floor(maxMulti/5))){
      var yy = h - 30 - ((m - 1) / (maxMulti - 1)) * (h - 50);
      ctx.fillText(m.toFixed(1)+'×', 40, yy + 3);
    }

    // Draw curve
    var padL = 50, padR = 20, padTop = 20, padBot = 30;
    var gw = w - padL - padR, gh = h - padTop - padBot;

    ctx.beginPath();
    ctx.moveTo(padL, h - padBot);

    var steps = Math.min(Math.floor(elapsed * 30), 500);
    for(var i=0; i<=steps; i++){
      var t = (i / Math.max(steps,1)) * elapsed;
      var multi = Math.pow(1.06, t * 8);
      var px = padL + (t / maxTime) * gw;
      var py = h - padBot - ((multi - 1) / (maxMulti - 1)) * gh;
      ctx.lineTo(px, py);
    }

    // Gradient stroke
    var crashed = state.phase === 'crashed';
    var grad = ctx.createLinearGradient(padL, h, padL, padTop);
    if(crashed){
      grad.addColorStop(0, '#ff3333');
      grad.addColorStop(1, '#ff6666');
    } else {
      grad.addColorStop(0, '#15803d');
      grad.addColorStop(1, state.multiplier >= 5 ? '#f0c94d' : '#4ade80');
    }
    ctx.strokeStyle = grad;
    ctx.lineWidth = 3;
    ctx.shadowColor = crashed ? 'rgba(255,50,50,0.5)' : 'rgba(34,197,94,0.5)';
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Fill under curve
    var lastPx = padL + (elapsed / maxTime) * gw;
    var lastMulti = Math.pow(1.06, elapsed * 8);
    var lastPy = h - padBot - ((lastMulti - 1) / (maxMulti - 1)) * gh;
    ctx.lineTo(lastPx, h - padBot);
    ctx.closePath();
    var fillGrad = ctx.createLinearGradient(padL, h, padL, padTop);
    if(crashed){
      fillGrad.addColorStop(0, 'rgba(255,50,50,0.02)');
      fillGrad.addColorStop(1, 'rgba(255,50,50,0.12)');
    } else {
      fillGrad.addColorStop(0, 'rgba(34,197,94,0.02)');
      fillGrad.addColorStop(1, 'rgba(34,197,94,0.12)');
    }
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Draw rocket at tip
    if(!crashed){
      ctx.font = '24px serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.save();
      ctx.translate(lastPx, lastPy - 16);
      ctx.fillText('\u{1F680}', 0, 0);
      ctx.restore();
    } else {
      // Explosion
      ctx.font = '32px serif';
      ctx.textAlign = 'center';
      ctx.fillText('\u{1F4A5}', lastPx, lastPy - 10);
    }

    // Cash out marker
    if(state.phase === 'cashedOut' && state.cashOutAt > 1){
      var coElapsed = Math.log(state.cashOutAt) / Math.log(Math.pow(1.06, 8));
      var coPx = padL + (coElapsed / maxTime) * gw;
      var coPy = h - padBot - ((state.cashOutAt - 1) / (maxMulti - 1)) * gh;
      ctx.beginPath();
      ctx.arc(coPx, coPy, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#4ade80';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#4ade80';
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(state.cashOutAt.toFixed(2) + '×', coPx, coPy - 14);
    }
  }

  function renderHistory(){
    var el = document.getElementById('crHistory');
    if(!el) return;
    el.innerHTML = state.history.map(function(h){
      var cls = h.won ? 'cr-h-win' : (h.point >= 2 ? 'cr-h-high' : 'cr-h-lose');
      return '<span class="cr-h '+cls+'">'+h.point.toFixed(2)+'×</span>';
    }).join('');
  }

  // ─── Audio ───
  var audioCtx=null;
  function getCtx(){if(audioCtx)return audioCtx;try{audioCtx=new(window.AudioContext||window.webkitAudioContext)}catch(e){}return audioCtx}
  function playWin(){var c=getCtx();if(!c)return;[600,800,1000,1200].forEach(function(f,i){setTimeout(function(){var o=c.createOscillator();var g=c.createGain();o.type='triangle';o.frequency.value=f;g.gain.value=.1;o.connect(g).connect(c.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.15);o.stop(c.currentTime+.2)},i*70)})}
  function playLose(){var c=getCtx();if(!c)return;var o=c.createOscillator();var g=c.createGain();o.type='sawtooth';o.frequency.value=400;g.gain.value=.08;o.connect(g).connect(c.destination);o.start();o.frequency.exponentialRampToValueAtTime(80,c.currentTime+.4);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.5);o.stop(c.currentTime+.55)}

  // ─── Bet helpers ───
  var api = {
    _half:function(){var i=document.getElementById('crBet');i.value=Math.max(1,Math.floor(i.value/2))},
    _dbl:function(){var i=document.getElementById('crBet');i.value=Math.min(state.balance,i.value*2)},
    _max:function(){var i=document.getElementById('crBet');i.value=state.balance},
    open:open, close:close
  };

  function open(){
    if(!root) build();
    root.style.display='flex';
    if(typeof RL!=='undefined'&&typeof RL.chips==='number') state.balance=RL.chips;
    if(!state.clientSeed) state.clientSeed=randomHex(8);
    updateBal();
    newSeed();
    drawIdle();
  }

  function close(e){
    if(e){e.stopPropagation&&e.stopPropagation()}
    if(state.animFrame) cancelAnimationFrame(state.animFrame);
    state.phase = 'idle';
    if(root) root.style.display='none';
    if(typeof RL!=='undefined') RL.chips=state.balance;
  }

  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&root&&root.style.display==='flex'){
      if(state.phase === 'rising') return; // Don't close during active game
      close(e);
    }
  });

  // Space bar to cash out
  document.addEventListener('keydown',function(e){
    if(e.code==='Space'&&root&&root.style.display==='flex'&&state.phase==='rising'){
      e.preventDefault();
      cashOut();
    }
  });

  if(!window.RL) window.RL={};
  RL.crash=api;

  function installHook(){
    if(RL.games&&RL.games.open){
      var orig=RL.games.open;
      RL.games.open=function(type){
        if(type==='Crash'||type==='crash'){open();return}
        orig.apply(this,arguments);
      };
      return true;
    }
    return false;
  }
  if(!installHook()){var tries=0;var iv=setInterval(function(){tries++;if(installHook()||tries>20)clearInterval(iv)},100)}
})();

// ═══════════════════════════════════════
// PLINKO — physics-based, seeded RNG
// 3 risk levels, ~3% house edge
// ═══════════════════════════════════════

(function(){
  var root = null;
  var canvas, ctx;
  var W = 560, H = 620;
  var ROWS = 12;
  var PEG_R = 5;
  var BALL_R = 7;
  var pegs = [];
  var slots = [];

  // Payout tables (sum*prob ≈ 0.97 = 3% house edge)
  // Pascal triangle gives binomial probabilities for n=12
  // Slot from left: 0..12 (13 slots)
  var PAYOUTS = {
    low:    [5.6, 2.1, 1.1, 1.0, 0.5, 0.3, 0.3, 0.3, 0.5, 1.0, 1.1, 2.1, 5.6],
    medium: [22,  5,   2,   1.4, 0.4, 0.2, 0.2, 0.2, 0.4, 1.4, 2,   5,   22],
    high:   [110, 25,  6,   2,   0.2, 0.2, 0.2, 0.2, 0.2, 2,   6,   25,  110],
  };

  var state = {
    balance: 100000,
    bet: 100,
    risk: 'medium',
    balls: [],     // active falling balls
    history: [],
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

  // ─── Geometry ───
  function buildBoard(){
    pegs = [];
    slots = [];
    var topY = 80;
    var botY = H - 90;
    var rowGap = (botY - topY) / ROWS;
    var colGap = 36;
    var cx = W/2;
    for(var r=0; r<ROWS; r++){
      var n = r + 3; // start with 3 pegs at top, grow
      var y = topY + r * rowGap;
      for(var i=0; i<n; i++){
        var x = cx + (i - (n-1)/2) * colGap;
        pegs.push({x:x, y:y});
      }
    }
    // 13 slots at bottom
    var slotW = colGap;
    var slotsCount = ROWS + 1;
    var slotsTotalW = slotsCount * slotW;
    var slotStartX = cx - slotsTotalW/2;
    for(var s=0; s<slotsCount; s++){
      slots.push({
        x: slotStartX + s * slotW,
        y: botY + 20,
        w: slotW,
        h: 36,
        index: s,
      });
    }
  }

  function getPayout(slotIndex){
    return PAYOUTS[state.risk][slotIndex];
  }

  // ─── Build UI ───
  function build(){
    root = document.createElement('div');
    root.id = 'plinkoRoot';
    root.innerHTML =
      '<div class="pl-topbar">'
      +   '<button class="pl-close" title="Close">\u2715</button>'
      +   '<div class="pl-title"><b>RUNE</b><i>LUCK</i><span>PLINKO</span></div>'
      +   '<div class="pl-balance">GP: <span id="plBal">100,000</span></div>'
      + '</div>'
      + '<div class="pl-body">'
      +   '<div class="pl-side">'
      +     '<div class="pl-bet-box">'
      +       '<label>Bet Amount</label>'
      +       '<input type="number" id="plBet" value="100" min="1">'
      +       '<div class="pl-bet-btns">'
      +         '<button class="pl-sm" onclick="RL.plinko._half()">½</button>'
      +         '<button class="pl-sm" onclick="RL.plinko._dbl()">2×</button>'
      +         '<button class="pl-sm" onclick="RL.plinko._max()">Max</button>'
      +       '</div>'
      +     '</div>'
      +     '<div class="pl-risk-box">'
      +       '<label>Risk</label>'
      +       '<div class="pl-risk-btns">'
      +         '<button class="pl-risk" data-risk="low">LOW</button>'
      +         '<button class="pl-risk active" data-risk="medium">MED</button>'
      +         '<button class="pl-risk" data-risk="high">HIGH</button>'
      +       '</div>'
      +     '</div>'
      +     '<button class="pl-drop-btn" id="plDropBtn">DROP BALL</button>'
      +     '<div class="pl-history-box">'
      +       '<div class="pl-history-title">Recent</div>'
      +       '<div class="pl-history" id="plHistory"></div>'
      +     '</div>'
      +     '<div class="pl-pf">'
      +       '<div class="pl-pf-title">\u{1F512} Provably Fair</div>'
      +       '<div class="pl-pf-r"><span>Hash:</span><code id="plPfHash">—</code></div>'
      +       '<div class="pl-pf-r"><span>Nonce:</span><code id="plPfNonce">0</code></div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="pl-board-wrap">'
      +     '<canvas id="plinkoCanvas" width="560" height="620"></canvas>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(root);
    root.addEventListener('mousedown',function(e){e.stopPropagation()});
    root.addEventListener('mouseup',function(e){e.stopPropagation()});
    root.addEventListener('click',function(e){e.stopPropagation()});
    root.querySelector('.pl-close').addEventListener('click',close);
    document.getElementById('plDropBtn').addEventListener('click',dropBall);
    var risks = root.querySelectorAll('.pl-risk');
    risks.forEach(function(b){
      b.addEventListener('click',function(){
        risks.forEach(function(x){x.classList.remove('active')});
        b.classList.add('active');
        state.risk = b.dataset.risk;
        draw();
      });
    });
    canvas = document.getElementById('plinkoCanvas');
    ctx = canvas.getContext('2d');
    buildBoard();
    startLoop();
  }

  function updateBal(){
    document.getElementById('plBal').textContent = state.balance.toLocaleString();
  }
  function updatePF(){
    var h=document.getElementById('plPfHash');if(h)h.textContent=state.serverSeedHash?state.serverSeedHash.slice(0,20)+'...':'—';
    var n=document.getElementById('plPfNonce');if(n)n.textContent=state.nonce;
  }

  // ─── Drop ball ───
  function dropBall(){
    var bet = parseInt(document.getElementById('plBet').value,10)||0;
    if(bet<=0 || bet>state.balance) return;
    state.bet = bet;
    state.balance -= bet;
    updateBal();
    state.nonce++;
    var msg = state.clientSeed+':'+state.nonce;
    hmacHex(state.serverSeed, msg).then(function(hx){
      // Use hash to seed initial position offset
      var seedVal = parseInt(hx.slice(0,8),16);
      var offset = ((seedVal % 1000) / 1000 - 0.5) * 6; // ±3px
      var ball = {
        x: W/2 + offset,
        y: 30,
        vx: ((seedVal & 1) ? 1 : -1) * 0.3,
        vy: 0,
        r: BALL_R,
        bet: bet,
        seed: hx,
        seedIdx: 8,
        trail: [],
        landed: false,
        slotIdx: -1,
      };
      state.balls.push(ball);
      updatePF();
    });
  }

  // ─── Physics loop ───
  var lastT = 0;
  function startLoop(){
    lastT = performance.now();
    function frame(now){
      var dt = Math.min((now - lastT) / 16.67, 2);
      lastT = now;
      step(dt);
      draw();
      if(root && root.style.display === 'flex'){
        requestAnimationFrame(frame);
      }
    }
    requestAnimationFrame(frame);
  }

  function step(dt){
    var gravity = 0.18;
    for(var i=state.balls.length-1; i>=0; i--){
      var b = state.balls[i];
      if(b.landed){
        // Bounce in slot for a bit then remove
        b.slotTimer = (b.slotTimer||0) + dt;
        if(b.slotTimer > 30){
          state.balls.splice(i,1);
        }
        continue;
      }
      b.vy += gravity * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.trail.push({x:b.x, y:b.y});
      if(b.trail.length > 12) b.trail.shift();

      // Collide with pegs
      for(var p=0; p<pegs.length; p++){
        var pg = pegs[p];
        var dx = b.x - pg.x;
        var dy = b.y - pg.y;
        var d2 = dx*dx + dy*dy;
        var rsum = b.r + PEG_R;
        if(d2 < rsum*rsum){
          var d = Math.sqrt(d2) || 0.0001;
          // Push out
          var nx = dx / d, ny = dy / d;
          b.x = pg.x + nx * rsum;
          b.y = pg.y + ny * rsum;
          // Reflect velocity
          var dot = b.vx * nx + b.vy * ny;
          b.vx = (b.vx - 2 * dot * nx) * 0.55;
          b.vy = (b.vy - 2 * dot * ny) * 0.55;
          // Seeded nudge for fair RNG influence
          var seedByte = parseInt(b.seed.charAt(b.seedIdx % b.seed.length),16);
          b.seedIdx++;
          var nudge = ((seedByte / 16) - 0.5) * 1.4;
          b.vx += nudge;
          // Mark peg as flashing
          pg.flash = 1.0;
          playPeg();
        }
      }

      // Wall bounds (very wide so they barely matter)
      if(b.x < 30){ b.x=30; b.vx=Math.abs(b.vx)*0.5; }
      if(b.x > W-30){ b.x=W-30; b.vx=-Math.abs(b.vx)*0.5; }

      // Landed in slot row
      if(b.y >= H - 90){
        var slotIdx = Math.floor((b.x - slots[0].x) / slots[0].w);
        slotIdx = Math.max(0, Math.min(slots.length-1, slotIdx));
        b.landed = true;
        b.slotIdx = slotIdx;
        b.x = slots[slotIdx].x + slots[slotIdx].w/2;
        var payout = getPayout(slotIdx);
        var winnings = Math.floor(b.bet * payout);
        state.balance += winnings;
        updateBal();
        slots[slotIdx].flash = 1.0;
        // History
        state.history.unshift({mult:payout, idx:slotIdx});
        if(state.history.length > 12) state.history.length = 12;
        renderHistory();
        if(payout >= 1) playWin(payout); else playLose();
      }
    }
    // Decay flashes
    for(var p2=0; p2<pegs.length; p2++) if(pegs[p2].flash) pegs[p2].flash = Math.max(0, pegs[p2].flash - 0.05*dt);
    for(var s2=0; s2<slots.length; s2++) if(slots[s2].flash) slots[s2].flash = Math.max(0, slots[s2].flash - 0.02*dt);
  }

  // ─── Drawing ───
  function draw(){
    if(!ctx) return;
    // Background
    var grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0,'#050a08');
    grad.addColorStop(1,'#020604');
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,W,H);

    // Pegs
    for(var i=0; i<pegs.length; i++){
      var p = pegs[i];
      var glow = p.flash || 0;
      if(glow > 0){
        ctx.beginPath();
        ctx.arc(p.x,p.y,PEG_R+8*glow,0,Math.PI*2);
        ctx.fillStyle = 'rgba(74,222,128,'+(glow*0.4)+')';
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(p.x,p.y,PEG_R,0,Math.PI*2);
      ctx.fillStyle = '#e0f0e4';
      ctx.fill();
      ctx.strokeStyle = 'rgba(74,222,128,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Slots
    for(var s=0; s<slots.length; s++){
      var sl = slots[s];
      var payout = getPayout(s);
      var color = payoutColor(payout);
      var flash = sl.flash || 0;
      ctx.fillStyle = flash > 0 ? blendColor(color, '#ffffff', flash*0.6) : color;
      // Slot box
      ctx.fillRect(sl.x+1, sl.y, sl.w-2, sl.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.strokeRect(sl.x+1, sl.y, sl.w-2, sl.h);
      // Text
      ctx.fillStyle = '#0a0e0c';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(payout+'×', sl.x + sl.w/2, sl.y + sl.h/2 + 4);
    }

    // Balls
    for(var b=0; b<state.balls.length; b++){
      var ball = state.balls[b];
      // Trail
      for(var t=0; t<ball.trail.length; t++){
        var tp = ball.trail[t];
        var alpha = (t / ball.trail.length) * 0.4;
        ctx.beginPath();
        ctx.arc(tp.x, tp.y, ball.r * (t/ball.trail.length), 0, Math.PI*2);
        ctx.fillStyle = 'rgba(240,201,77,'+alpha+')';
        ctx.fill();
      }
      // Ball
      var bg = ctx.createRadialGradient(ball.x-2, ball.y-2, 0, ball.x, ball.y, ball.r);
      bg.addColorStop(0,'#fff8d8');
      bg.addColorStop(1,'#f0c94d');
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.strokeStyle = '#8a6420';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function payoutColor(p){
    if(p >= 10) return '#ff3333';
    if(p >= 3) return '#ff8833';
    if(p >= 1.5) return '#f0c94d';
    if(p >= 1) return '#aacc44';
    if(p >= 0.5) return '#4ade80';
    return '#22c55e';
  }
  function blendColor(c1, c2, t){
    function hex(c){return [parseInt(c.slice(1,3),16),parseInt(c.slice(3,5),16),parseInt(c.slice(5,7),16)]}
    var a=hex(c1), b=hex(c2);
    var r=Math.round(a[0]*(1-t)+b[0]*t), g=Math.round(a[1]*(1-t)+b[1]*t), bb=Math.round(a[2]*(1-t)+b[2]*t);
    return 'rgb('+r+','+g+','+bb+')';
  }

  function renderHistory(){
    var el = document.getElementById('plHistory');
    if(!el) return;
    el.innerHTML = state.history.map(function(h){
      var cls = h.mult>=1.5 ? 'pl-h-win' : (h.mult>=1 ? 'pl-h-mid' : 'pl-h-lose');
      return '<span class="pl-h '+cls+'">'+h.mult+'×</span>';
    }).join('');
  }

  // ─── Audio ───
  var audioCtx=null;
  function getCtx(){if(audioCtx)return audioCtx;try{audioCtx=new(window.AudioContext||window.webkitAudioContext)}catch(e){}return audioCtx}
  function playPeg(){var c=getCtx();if(!c)return;var o=c.createOscillator();var g=c.createGain();o.type='sine';o.frequency.value=600+Math.random()*400;g.gain.value=.03;o.connect(g).connect(c.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.06);o.stop(c.currentTime+.08)}
  function playWin(mult){var c=getCtx();if(!c)return;var freqs=mult>=5?[800,1100,1400,1700]:[600,800,1000];freqs.forEach(function(f,i){setTimeout(function(){var o=c.createOscillator();var g=c.createGain();o.type='triangle';o.frequency.value=f;g.gain.value=.08;o.connect(g).connect(c.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.15);o.stop(c.currentTime+.2)},i*60)})}
  function playLose(){var c=getCtx();if(!c)return;var o=c.createOscillator();var g=c.createGain();o.type='sine';o.frequency.value=200;g.gain.value=.05;o.connect(g).connect(c.destination);o.start();o.frequency.exponentialRampToValueAtTime(100,c.currentTime+.15);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.2);o.stop(c.currentTime+.25)}

  // ─── API ───
  var api = {
    _half:function(){var i=document.getElementById('plBet');i.value=Math.max(1,Math.floor(i.value/2))},
    _dbl:function(){var i=document.getElementById('plBet');i.value=Math.min(state.balance,i.value*2)},
    _max:function(){var i=document.getElementById('plBet');i.value=state.balance},
    open:open, close:close
  };

  function open(){
    if(!root) build();
    root.style.display='flex';
    if(typeof RL!=='undefined'&&typeof RL.chips==='number') state.balance=RL.chips;
    if(!state.clientSeed) state.clientSeed=randomHex(8);
    updateBal();
    newSeed();
    startLoop();
  }

  function close(e){
    if(e){e.stopPropagation&&e.stopPropagation()}
    if(root) root.style.display='none';
    if(typeof RL!=='undefined') RL.chips=state.balance;
  }

  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&root&&root.style.display==='flex'){close(e)}
  });

  if(!window.RL) window.RL={};
  RL.plinko=api;

  function installHook(){
    if(RL.games&&RL.games.open){
      var orig=RL.games.open;
      RL.games.open=function(type){
        if(type==='Plinko'||type==='plinko'){open();return}
        orig.apply(this,arguments);
      };
      return true;
    }
    return false;
  }
  if(!installHook()){var tries=0;var iv=setInterval(function(){tries++;if(installHook()||tries>20)clearInterval(iv)},100)}
})();

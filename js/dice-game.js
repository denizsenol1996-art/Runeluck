// ═══════════════════════════════════════
// DICE GAME — Roat PKZ style
// Slider threshold, over/under, instant roll
// Payout = 99 / win_chance (1% house edge)
// ═══════════════════════════════════════

(function(){
  var root = null;
  var state = {
    balance: 100000,
    bet: 100,
    threshold: 50,     // roll must be > threshold to win
    lastRoll: null,
    lastWin: false,
    rolling: false,
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

  function getPayout(){
    var winChance = 100 - state.threshold; // e.g. threshold=50 → 50% win
    if(winChance <= 0) return 0;
    return Math.floor((99 / winChance) * 100) / 100; // 1% house edge
  }

  // ─── Build UI ───
  function build(){
    root = document.createElement('div');
    root.id = 'diceRoot';
    root.innerHTML =
      '<div class="dc-topbar">'
      +   '<button class="dc-close" title="Close">\u2715</button>'
      +   '<div class="dc-title"><b>RUNE</b><i>LUCK</i><span>DICE</span></div>'
      +   '<div class="dc-balance">GP: <span id="dcBal">100,000</span></div>'
      + '</div>'
      + '<div class="dc-body">'
      +   '<div class="dc-main">'
      // Roll result big display
      +     '<div class="dc-result-area">'
      +       '<div class="dc-roll-num" id="dcRollNum">—</div>'
      +       '<div class="dc-roll-msg" id="dcRollMsg"></div>'
      +     '</div>'
      // Slider bar
      +     '<div class="dc-slider-wrap">'
      +       '<div class="dc-bar" id="dcBar">'
      +         '<div class="dc-bar-red" id="dcBarRed"></div>'
      +         '<div class="dc-bar-green" id="dcBarGreen"></div>'
      +         '<div class="dc-bar-marker" id="dcBarMarker"></div>'
      +       '</div>'
      +       '<input type="range" class="dc-slider" id="dcSlider" min="1" max="98" value="50">'
      +       '<div class="dc-bar-labels"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div>'
      +     '</div>'
      // Stats row
      +     '<div class="dc-stats">'
      +       '<div class="dc-stat"><div class="dc-stat-label">Roll Over</div><div class="dc-stat-val" id="dcOver">50</div></div>'
      +       '<div class="dc-stat"><div class="dc-stat-label">Win Chance</div><div class="dc-stat-val" id="dcChance">50%</div></div>'
      +       '<div class="dc-stat"><div class="dc-stat-label">Payout</div><div class="dc-stat-val dc-gold" id="dcPayout">1.98×</div></div>'
      +     '</div>'
      // Bet + Roll
      +     '<div class="dc-controls">'
      +       '<div class="dc-bet-row">'
      +         '<label>Bet</label>'
      +         '<input type="number" id="dcBet" value="100" min="1">'
      +         '<button class="dc-sm" onclick="RL.dice._half()">½</button>'
      +         '<button class="dc-sm" onclick="RL.dice._dbl()">2×</button>'
      +         '<button class="dc-sm" onclick="RL.dice._max()">Max</button>'
      +       '</div>'
      +       '<button class="dc-roll-btn" id="dcRollBtn">ROLL DICE</button>'
      +     '</div>'
      // History
      +     '<div class="dc-history" id="dcHistory"></div>'
      +   '</div>'
      // PF sidebar
      +   '<div class="dc-pf">'
      +     '<div class="dc-pf-title">\u{1F512} Provably Fair</div>'
      +     '<div class="dc-pf-r"><span>Hash:</span><code id="dcPfHash">—</code></div>'
      +     '<div class="dc-pf-r"><span>Client seed:</span><code id="dcPfClient">—</code></div>'
      +     '<div class="dc-pf-r"><span>Nonce:</span><code id="dcPfNonce">0</code></div>'
      +     '<div class="dc-pf-r"><span>Revealed:</span><code id="dcPfReveal">(hidden)</code></div>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(root);
    root.addEventListener('mousedown',function(e){e.stopPropagation()});
    root.addEventListener('mouseup',function(e){e.stopPropagation()});
    root.addEventListener('click',function(e){e.stopPropagation()});
    root.querySelector('.dc-close').addEventListener('click',close);
    document.getElementById('dcSlider').addEventListener('input',onSlider);
    document.getElementById('dcRollBtn').addEventListener('click',roll);
    updateBar();
  }

  function onSlider(){
    state.threshold = parseInt(document.getElementById('dcSlider').value,10);
    updateBar();
  }

  function updateBar(){
    var t = state.threshold;
    var pct = t; // red zone 0..t
    document.getElementById('dcBarRed').style.width = pct+'%';
    document.getElementById('dcBarGreen').style.width = (100-pct)+'%';
    document.getElementById('dcOver').textContent = t;
    document.getElementById('dcChance').textContent = (100-t)+'%';
    document.getElementById('dcPayout').textContent = getPayout().toFixed(2)+'×';
  }

  function updateBal(){
    document.getElementById('dcBal').textContent = state.balance.toLocaleString();
  }
  function updatePF(){
    var h=document.getElementById('dcPfHash');if(h)h.textContent=state.serverSeedHash?state.serverSeedHash.slice(0,20)+'...':'—';
    var c=document.getElementById('dcPfClient');if(c)c.textContent=state.clientSeed;
    var n=document.getElementById('dcPfNonce');if(n)n.textContent=state.nonce;
    var r=document.getElementById('dcPfReveal');if(r)r.textContent=state.revealedSeed?state.revealedSeed.slice(0,20)+'...':'(hidden)';
  }

  function roll(){
    if(state.rolling) return;
    var bet = parseInt(document.getElementById('dcBet').value,10)||0;
    if(bet<=0) return;
    if(bet>state.balance) return;
    state.bet = bet;
    state.balance -= bet;
    state.rolling = true;
    updateBal();
    state.nonce++;
    var msg = state.clientSeed+':'+state.nonce;
    hmacHex(state.serverSeed, msg).then(function(hx){
      var result = (parseInt(hx.slice(0,8),16) % 10000) / 100; // 0.00 - 99.99
      result = Math.floor(result * 100) / 100;
      state.lastRoll = result;
      state.lastWin = result > state.threshold;
      // Animate
      animateRoll(result);
    });
  }

  function animateRoll(result){
    var el = document.getElementById('dcRollNum');
    var msg = document.getElementById('dcRollMsg');
    var marker = document.getElementById('dcBarMarker');
    var steps = 18;
    var step = 0;
    var iv = setInterval(function(){
      step++;
      var fake = Math.floor(Math.random()*10000)/100;
      el.textContent = fake.toFixed(2);
      el.style.color = '#888';
      el.style.textShadow = 'none';
      if(step >= steps){
        clearInterval(iv);
        el.textContent = result.toFixed(2);
        // Position marker on bar
        marker.style.left = result+'%';
        marker.style.display = 'block';
        if(state.lastWin){
          el.style.color = '#4ade80';
          el.style.textShadow = '0 0 30px rgba(34,197,94,.6)';
          msg.textContent = 'WIN +' + Math.floor(state.bet * getPayout() - state.bet).toLocaleString() + ' GP';
          msg.style.color = '#4ade80';
          state.balance += Math.floor(state.bet * getPayout());
          playWin();
        } else {
          el.style.color = '#ff5555';
          el.style.textShadow = '0 0 30px rgba(255,60,60,.5)';
          msg.textContent = 'LOSE -' + state.bet.toLocaleString() + ' GP';
          msg.style.color = '#ff5555';
          playLose();
        }
        updateBal();
        // Reveal seed, generate new
        state.revealedSeed = state.serverSeed;
        updatePF();
        newSeed();
        // History
        state.history.unshift({roll:result, win:state.lastWin, threshold:state.threshold});
        if(state.history.length>15) state.history.length=15;
        renderHistory();
        state.rolling = false;
      }
    }, 40);
  }

  function renderHistory(){
    var el = document.getElementById('dcHistory');
    if(!el) return;
    el.innerHTML = state.history.map(function(h){
      var cls = h.win ? 'dc-h-win' : 'dc-h-lose';
      return '<span class="dc-h '+cls+'" title="Over '+h.threshold+'">'+h.roll.toFixed(2)+'</span>';
    }).join('');
  }

  // ─── Audio ───
  var audioCtx=null;
  function getCtx(){if(audioCtx)return audioCtx;try{audioCtx=new(window.AudioContext||window.webkitAudioContext)}catch(e){}return audioCtx}
  function playWin(){var c=getCtx();if(!c)return;[800,1000,1200].forEach(function(f,i){setTimeout(function(){var o=c.createOscillator();var g=c.createGain();o.type='triangle';o.frequency.value=f;g.gain.value=.1;o.connect(g).connect(c.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.15);o.stop(c.currentTime+.2)},i*80)})}
  function playLose(){var c=getCtx();if(!c)return;var o=c.createOscillator();var g=c.createGain();o.type='sine';o.frequency.value=250;g.gain.value=.1;o.connect(g).connect(c.destination);o.start();o.frequency.exponentialRampToValueAtTime(120,c.currentTime+.2);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.3);o.stop(c.currentTime+.35)}

  // ─── Bet helpers ───
  var api = {
    _half:function(){var i=document.getElementById('dcBet');i.value=Math.max(1,Math.floor(i.value/2))},
    _dbl:function(){var i=document.getElementById('dcBet');i.value=Math.min(state.balance,i.value*2)},
    _max:function(){var i=document.getElementById('dcBet');i.value=state.balance},
    open:open, close:close
  };

  function open(){
    if(!root) build();
    root.style.display='flex';
    if(typeof RL!=='undefined'&&typeof RL.chips==='number') state.balance=RL.chips;
    if(!state.clientSeed) state.clientSeed=randomHex(8);
    updateBal();
    updateBar();
    newSeed();
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
  RL.dice=api;

  function installHook(){
    if(RL.games&&RL.games.open){
      var orig=RL.games.open;
      RL.games.open=function(type){
        if(type==='Dice'||type==='dice'){open();return}
        orig.apply(this,arguments);
      };
      return true;
    }
    return false;
  }
  if(!installHook()){var tries=0;var iv=setInterval(function(){tries++;if(installHook()||tries>20)clearInterval(iv)},100)}
})();

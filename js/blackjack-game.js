// ═══════════════════════════════════════
// BLACKJACK GAME — Roat PKZ style overlay
// Standard rules, dealer stands on 17, BJ pays 3:2
// ═══════════════════════════════════════

(function(){
  var root = null;
  var state = {
    balance: 100000,
    bet: 0,
    chip: 100,
    phase: 'bet', // 'bet' | 'play' | 'dealer' | 'result'
    deck: [],
    player: [],     // player's hand
    dealer: [],     // dealer's hand
    hideHole: true, // hide dealer's second card
    result: '',
  };

  var SUITS = ['\u2660','\u2665','\u2666','\u2663']; // ♠ ♥ ♦ ♣
  var RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

  function build(){
    root = document.createElement('div');
    root.id = 'bjRoot';
    root.innerHTML =
      '<div class="bj-topbar">'
      +   '<button class="bj-close" title="Close">\u2715</button>'
      +   '<div class="bj-title"><b>BLACK</b><i>JACK</i></div>'
      +   '<div class="bj-phase" id="bjPhase">Place your bet</div>'
      +   '<div class="bj-balance">GP: <span id="bjBal">100,000</span></div>'
      + '</div>'
      + '<div class="bj-body">'
      +   '<div class="bj-table">'
      +     '<div class="bj-logo-center"><b>RUNE</b><i>LUCK</i><span>\u2660\u2665 BLACKJACK \u2666\u2663</span></div>'
      +     '<div class="bj-deck" id="bjDeck">'
      +       '<div class="bj-deck-card" style="bottom:0"></div>'
      +       '<div class="bj-deck-card" style="bottom:2px"></div>'
      +       '<div class="bj-deck-card" style="bottom:4px"></div>'
      +       '<div class="bj-deck-card" style="bottom:6px"></div>'
      +       '<div class="bj-deck-card" style="bottom:8px"></div>'
      +     '</div>'
      +     '<div class="bj-hand bj-dealer-hand">'
      +       '<div class="bj-hand-label">DEALER <span class="bj-score" id="bjDealerScore">—</span></div>'
      +       '<div class="bj-cards" id="bjDealerCards"></div>'
      +     '</div>'
      +     '<div class="bj-result-banner" id="bjResult"></div>'
      +     '<div class="bj-hand bj-player-hand">'
      +       '<div class="bj-cards" id="bjPlayerCards"></div>'
      +       '<div class="bj-hand-label">YOU <span class="bj-score" id="bjPlayerScore">—</span></div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="bj-controls">'
      +     '<div class="bj-bet-info">BET: <span id="bjBetVal">0</span> GP</div>'
      +     '<div class="bj-chips" id="bjChips"></div>'
      +     '<div class="bj-buttons" id="bjButtons"></div>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(root);
    root.addEventListener('mousedown', function(e){ e.stopPropagation(); });
    root.addEventListener('mouseup',   function(e){ e.stopPropagation(); });
    root.addEventListener('click',     function(e){ e.stopPropagation(); });
    root.querySelector('.bj-close').addEventListener('click', close);
  }

  function render(){
    renderChips();
    renderHands();
    renderButtons();
    updateBalance();
    updatePhase();
    var rb = document.getElementById('bjResult');
    if(rb){ rb.textContent = state.result; rb.className = 'bj-result-banner' + (state.result?' show':''); }
    var bv = document.getElementById('bjBetVal');
    if(bv) bv.textContent = state.bet.toLocaleString();
  }

  function renderChips(){
    var div = document.getElementById('bjChips');
    if(!div) return;
    var chips = [10, 100, 1000, 10000, 100000];
    div.innerHTML = chips.map(function(v){
      var sel = v === state.chip ? ' sel' : '';
      return '<button class="bj-chip'+sel+'" data-v="'+v+'">'+fmtK(v)+'</button>';
    }).join('');
    div.querySelectorAll('.bj-chip').forEach(function(b){
      b.addEventListener('click', function(){
        if(state.phase !== 'bet'){ return; }
        var v = parseInt(b.dataset.v, 10);
        state.chip = v;
        if(state.balance >= v){
          state.bet += v;
          state.balance -= v;
          updateBalance();
          document.getElementById('bjBetVal').textContent = state.bet.toLocaleString();
        }
        div.querySelectorAll('.bj-chip').forEach(function(x){x.classList.remove('sel')});
        b.classList.add('sel');
      });
    });
  }

  function renderButtons(){
    var div = document.getElementById('bjButtons');
    if(!div) return;
    var html = '';
    if(state.phase === 'bet'){
      html += '<button class="bj-btn bj-deal" id="bjDeal">DEAL</button>';
      html += '<button class="bj-btn bj-clear" id="bjClearBet">Clear</button>';
    } else if(state.phase === 'play'){
      html += '<button class="bj-btn bj-hit" id="bjHit">HIT</button>';
      html += '<button class="bj-btn bj-stand" id="bjStand">STAND</button>';
      var canDouble = state.player.length === 2 && state.balance >= state.bet;
      html += '<button class="bj-btn bj-double'+(canDouble?'':' disabled')+'" id="bjDouble">DOUBLE</button>';
    } else if(state.phase === 'result' || state.phase === 'dealer'){
      html += '<button class="bj-btn bj-new" id="bjNew">NEW HAND</button>';
    }
    div.innerHTML = html;
    var d = document.getElementById('bjDeal');           if(d) d.addEventListener('click', deal);
    var c = document.getElementById('bjClearBet');       if(c) c.addEventListener('click', clearBet);
    var h = document.getElementById('bjHit');            if(h) h.addEventListener('click', hit);
    var s = document.getElementById('bjStand');          if(s) s.addEventListener('click', stand);
    var db = document.getElementById('bjDouble');        if(db && !db.classList.contains('disabled')) db.addEventListener('click', doubleDown);
    var n = document.getElementById('bjNew');            if(n) n.addEventListener('click', newHand);
  }

  function renderHands(){
    var pEl = document.getElementById('bjPlayerCards');
    var dEl = document.getElementById('bjDealerCards');
    if(!pEl || !dEl) return;
    renderHandInto(pEl, state.player, false);
    renderHandInto(dEl, state.dealer, true);
    var pScore = document.getElementById('bjPlayerScore');
    var dScore = document.getElementById('bjDealerScore');
    if(pScore) pScore.textContent = state.player.length ? displayScore(state.player) : '—';
    if(dScore) dScore.textContent = state.dealer.length ? (state.hideHole ? displayScore([state.dealer[0]]) : displayScore(state.dealer)) : '—';
  }

  // DOM-diff renderer: only newly appended cards get the slide animation.
  function renderHandInto(el, cards, isDealer){
    // Remove trailing cards that no longer exist
    while(el.children.length > cards.length) el.removeChild(el.lastChild);
    // Update / append
    for(var i=0; i<cards.length; i++){
      var wantBack = isDealer && i === 1 && state.hideHole;
      var html = wantBack ? cardBackHTML() : cardHTML(cards[i]);
      var existing = el.children[i];
      if(existing){
        // Only replace if the visible card changed (e.g., hole-card reveal)
        if(existing._html !== html){
          var tmp = document.createElement('div');
          tmp.innerHTML = html;
          var node = tmp.firstChild;
          node._html = html;
          node.style.animation = 'none'; // existing card — no slide
          el.replaceChild(node, existing);
        }
      } else {
        // New card — let CSS animation run
        var tmp2 = document.createElement('div');
        tmp2.innerHTML = html;
        var n2 = tmp2.firstChild;
        n2._html = html;
        el.appendChild(n2);
      }
    }
  }

  function cardHTML(card){
    var red = (card.suit === '\u2665' || card.suit === '\u2666');
    return '<div class="bj-card'+(red?' red':'')+'">'
      + '<div class="bj-card-tl">'+card.rank+'<br>'+card.suit+'</div>'
      + '<div class="bj-card-center">'+card.suit+'</div>'
      + '<div class="bj-card-br">'+card.rank+'<br>'+card.suit+'</div>'
      + '</div>';
  }
  function cardBackHTML(){
    return '<div class="bj-card bj-back"><div class="bj-card-pattern"></div></div>';
  }

  function updateBalance(){
    var el = document.getElementById('bjBal');
    if(el) el.textContent = state.balance.toLocaleString();
  }

  function updatePhase(){
    var el = document.getElementById('bjPhase');
    if(!el) return;
    if(state.phase === 'bet')         el.textContent = 'Place your bet';
    else if(state.phase === 'play')   el.textContent = 'Your turn — Hit or Stand';
    else if(state.phase === 'dealer') el.textContent = 'Dealer plays...';
    else if(state.phase === 'result') el.textContent = state.result;
  }

  // ─── Card logic ───
  function newDeck(){
    state.deck = [];
    // 6-deck shoe for realism
    for(var d=0;d<6;d++){
      for(var s=0;s<4;s++){
        for(var r=0;r<13;r++){
          state.deck.push({rank: RANKS[r], suit: SUITS[s]});
        }
      }
    }
    // Fisher-Yates shuffle
    for(var i=state.deck.length-1;i>0;i--){
      var j = Math.floor(Math.random()*(i+1));
      var tmp = state.deck[i]; state.deck[i] = state.deck[j]; state.deck[j] = tmp;
    }
  }

  function draw(){
    if(state.deck.length < 20) newDeck();
    return state.deck.pop();
  }

  function score(cards){
    var total = 0, aces = 0;
    cards.forEach(function(c){
      if(c.rank === 'A'){ aces++; total += 11; }
      else if(c.rank === 'J' || c.rank === 'Q' || c.rank === 'K') total += 10;
      else total += parseInt(c.rank, 10);
    });
    while(total > 21 && aces > 0){ total -= 10; aces--; }
    return total;
  }

  // Display score like "10/20" for soft hands (ace still counted as 11), else just "17"
  function displayScore(cards){
    var hi = score(cards);
    if(hi > 21) return hi; // bust
    // Is there an ace currently counting as 11?
    var hardTotal = 0;
    cards.forEach(function(c){
      if(c.rank === 'A') hardTotal += 1;
      else if(c.rank === 'J' || c.rank === 'Q' || c.rank === 'K') hardTotal += 10;
      else hardTotal += parseInt(c.rank, 10);
    });
    if(hardTotal !== hi && hi <= 21) return hardTotal + '/' + hi;
    return hi;
  }

  function isBlackjack(cards){
    return cards.length === 2 && score(cards) === 21;
  }

  // ─── Game actions ───
  function clearBet(){
    if(state.phase !== 'bet') return;
    state.balance += state.bet;
    state.bet = 0;
    render();
  }

  function deal(){
    if(state.phase !== 'bet') return;
    if(state.bet <= 0){ flash('Place a bet first'); return; }
    if(!state.deck.length) newDeck();
    state.player = [];
    state.dealer = [];
    state.hideHole = true;
    state.result = '';
    state.phase = 'play';
    render();
    // Deal cards one at a time with sound + stagger
    var sequence = [
      function(){ state.player.push(draw()); playDeal(); render(); },
      function(){ state.dealer.push(draw()); playDeal(); render(); },
      function(){ state.player.push(draw()); playDeal(); render(); },
      function(){ state.dealer.push(draw()); playDeal(); render(); afterInitialDeal(); },
    ];
    sequence.forEach(function(fn, i){ setTimeout(fn, 250 + i*420); });
  }

  function afterInitialDeal(){
    var pBJ = isBlackjack(state.player);
    var dBJ = isBlackjack(state.dealer);
    if(pBJ || dBJ){
      state.hideHole = false;
      if(pBJ && dBJ){
        state.balance += state.bet; // push
        state.result = 'PUSH — both Blackjack';
      } else if(pBJ){
        state.balance += Math.floor(state.bet * 2.5); // 3:2 + original
        state.result = 'BLACKJACK! +'+Math.floor(state.bet*1.5).toLocaleString()+' GP';
        playDing();
      } else {
        state.result = 'Dealer Blackjack — you lose';
      }
      state.phase = 'result';
      render();
    }
  }

  function hit(){
    if(state.phase !== 'play') return;
    state.player.push(draw());
    playDeal();
    var s = score(state.player);
    render();
    if(s > 21){
      state.result = 'BUST — you lose';
      state.phase = 'result';
      render();
    } else if(s === 21){
      stand();
    }
  }

  function stand(){
    if(state.phase !== 'play') return;
    state.phase = 'dealer';
    state.hideHole = false;
    render();
    dealerPlay();
  }

  function doubleDown(){
    if(state.phase !== 'play') return;
    if(state.player.length !== 2) return;
    if(state.balance < state.bet) return;
    state.balance -= state.bet;
    state.bet *= 2;
    state.player.push(draw());
    playDeal();
    render();
    if(score(state.player) > 21){
      state.result = 'BUST on double — you lose';
      state.phase = 'result';
      render();
    } else {
      setTimeout(stand, 600);
    }
  }

  function dealerPlay(){
    var step = function(){
      var s = score(state.dealer);
      if(s < 17){
        state.dealer.push(draw());
        playDeal();
        render();
        setTimeout(step, 800);
      } else {
        settle();
      }
    };
    setTimeout(step, 600);
  }

  function settle(){
    var p = score(state.player);
    var d = score(state.dealer);
    var won;
    if(d > 21){
      won = state.bet * 2;
      state.result = 'Dealer BUST — you win +'+state.bet.toLocaleString();
      playDing();
    } else if(p > d){
      won = state.bet * 2;
      state.result = 'You win +'+state.bet.toLocaleString()+' GP';
      playDing();
    } else if(p < d){
      won = 0;
      state.result = 'Dealer wins';
    } else {
      won = state.bet;
      state.result = 'PUSH — bet returned';
    }
    state.balance += won;
    state.phase = 'result';
    render();
  }

  function newHand(){
    state.bet = 0;
    state.player = [];
    state.dealer = [];
    state.result = '';
    state.phase = 'bet';
    state.hideHole = true;
    render();
  }

  // ─── UI helpers ───
  function flash(msg){
    var el = document.getElementById('bjResult');
    if(!el) return;
    el.textContent = msg;
    el.className = 'bj-result-banner show';
    clearTimeout(flash._t);
    flash._t = setTimeout(function(){
      if(state.phase === 'bet'){ el.textContent = ''; el.className='bj-result-banner'; }
    }, 2000);
  }

  function fmtK(n){ if(n>=1e6) return (n/1e6).toFixed(0)+'M'; if(n>=1e3) return (n/1e3).toFixed(0)+'K'; return String(n); }

  // ─── Audio ───
  var audioCtx = null;
  function getCtx(){
    if(audioCtx) return audioCtx;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e){}
    return audioCtx;
  }
  function playDeal(){
    var c = getCtx();
    if(!c) return;
    try {
      var now = c.currentTime;
      // ── 1. Paper-friction slide (brown noise with bandpass sweep) ──
      var slideDur = 0.26;
      var len = Math.floor(c.sampleRate * slideDur);
      var buf = c.createBuffer(1, len, c.sampleRate);
      var data = buf.getChannelData(0);
      // Brown noise = integrated white noise (more paper-like than pure white)
      var lastVal = 0;
      for(var i=0;i<len;i++){
        var t = i/len;
        var white = Math.random()*2-1;
        lastVal = (lastVal + 0.02*white) / 1.02;
        // Envelope: quick rise, slow decay
        var env = t < 0.03 ? t/0.03 : Math.pow(1-t, 1.3);
        data[i] = lastVal * 12 * env;
      }
      var src = c.createBufferSource();
      src.buffer = buf;
      var filt = c.createBiquadFilter();
      filt.type = 'bandpass';
      filt.frequency.value = 2400;
      filt.Q.value = 0.9;
      // Sweep the filter from 3500 Hz down to 1500 Hz
      filt.frequency.setValueAtTime(3500, now);
      filt.frequency.exponentialRampToValueAtTime(1500, now + slideDur);
      var slideGain = c.createGain();
      slideGain.gain.value = 0.5;
      src.connect(filt).connect(slideGain).connect(c.destination);
      src.start(now);

      // ── 2. Landing thud (short low sine when card hits felt) ──
      var thudAt = now + 0.20;
      var thud = c.createOscillator();
      var thudG = c.createGain();
      thud.type = 'sine';
      thud.frequency.value = 90;
      thud.frequency.exponentialRampToValueAtTime(45, thudAt + 0.08);
      thudG.gain.setValueAtTime(0, thudAt);
      thudG.gain.linearRampToValueAtTime(0.18, thudAt + 0.005);
      thudG.gain.exponentialRampToValueAtTime(0.001, thudAt + 0.12);
      thud.connect(thudG).connect(c.destination);
      thud.start(thudAt);
      thud.stop(thudAt + 0.15);

      // ── 3. Quick click (card edge snap) at the start ──
      var click = c.createOscillator();
      var clickG = c.createGain();
      click.type = 'square';
      click.frequency.value = 3800;
      clickG.gain.setValueAtTime(0.06, now);
      clickG.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
      click.connect(clickG).connect(c.destination);
      click.start(now);
      click.stop(now + 0.03);
    } catch(e){}
  }
  function playDing(){
    try {
      if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      var o = audioCtx.createOscillator();
      var g = audioCtx.createGain();
      o.type = 'triangle';
      o.frequency.value = 1200;
      g.gain.value = .15;
      o.connect(g).connect(audioCtx.destination);
      o.start();
      o.frequency.exponentialRampToValueAtTime(1800, audioCtx.currentTime + 0.1);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
      o.stop(audioCtx.currentTime + 0.3);
    } catch(e){}
  }

  // ─── Open / close ───
  function open(){
    if(!root) build();
    root.style.display = 'flex';
    if(typeof RL !== 'undefined' && typeof RL.chips === 'number') state.balance = RL.chips;
    if(!state.deck.length) newDeck();
    state.bet = 0;
    state.player = [];
    state.dealer = [];
    state.result = '';
    state.phase = 'bet';
    state.hideHole = true;
    render();
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
  RL.blackjack = { open: open, close: close };

  // Hook into games.open for 'Blackjack'
  function installHook(){
    if(RL.games && RL.games.open){
      var orig = RL.games.open;
      RL.games.open = function(type){
        if(type === 'Blackjack' || type === 'blackjack'){ open(); return; }
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

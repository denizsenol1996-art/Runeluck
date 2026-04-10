// ═══════════════════════════════════════
// GAMES — Premium Casino Game Overlays
// ═══════════════════════════════════════

RL.games = {
  active: null,

  init() {},

  open(type) {
    this.active = type;
    document.getElementById('gameOverlay').classList.add('show');
    document.getElementById('gameResult').textContent = '';
    document.getElementById('gameResult').className = 'game-result';

    if(type === 'Slots') this._initSlots();
    else if(type === 'Roulette') this._initRoulette();
    else if(type === 'Blackjack') this._initBlackjack();
  },

  close() {
    this.active = null;
    document.getElementById('gameOverlay').classList.remove('show');
  },

  _result(text, type) {
    const el = document.getElementById('gameResult');
    el.textContent = text;
    el.className = 'game-result ' + (type || '');
  },

  _fmt(n) {
    return n.toLocaleString();
  },

  // ═══ SLOTS ═══
  _initSlots() {
    document.getElementById('gameTitle').textContent = 'Slots';
    document.getElementById('gameDesc').textContent = 'Match 3 symbols to win · 💎💎💎 = 10x Jackpot';
    document.getElementById('gameControls').innerHTML =
      '<input class="g-input" id="slotBet" value="1000" placeholder="Bet">' +
      '<button class="g-btn" onclick="RL.games._spinSlots()">SPIN</button>';

    const ctx = document.getElementById('gameCanvas').getContext('2d');
    ctx.canvas.width = 580; ctx.canvas.height = 340;
    this._drawSlotIdle(ctx);
  },

  _drawSlotIdle(ctx) {
    // Dark bg with subtle gradient
    const grad = ctx.createLinearGradient(0,0,0,340);
    grad.addColorStop(0,'#0a0c14'); grad.addColorStop(1,'#060810');
    ctx.fillStyle = grad; ctx.fillRect(0,0,580,340);

    // Reel backgrounds
    for(let i = 0; i < 3; i++) {
      ctx.fillStyle = '#12141e';
      this._roundRect(ctx, 120+i*120, 70, 100, 170, 12);
    }
    // Gold frame
    ctx.strokeStyle = '#d4a843'; ctx.lineWidth = 2;
    this._roundRectStroke(ctx, 110, 60, 360, 190, 14);

    ctx.fillStyle = '#64748b'; ctx.font = '500 18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('PLACE BET & SPIN', 290, 310);
  },

  _spinSlots() {
    const bet = parseInt(document.getElementById('slotBet').value) || 1000;
    if(bet > RL.chips) { this._result('Not enough chips!', 'lose'); return; }
    RL.chips -= bet; RL.updateChips();

    const symbols = ['💎','7️⃣','🔔','⭐','🎲','💰'];
    const reels = [
      symbols[Math.floor(Math.random()*symbols.length)],
      symbols[Math.floor(Math.random()*symbols.length)],
      symbols[Math.floor(Math.random()*symbols.length)],
    ];

    const ctx = document.getElementById('gameCanvas').getContext('2d');
    const grad = ctx.createLinearGradient(0,0,0,340);
    grad.addColorStop(0,'#0a0c14'); grad.addColorStop(1,'#060810');
    ctx.fillStyle = grad; ctx.fillRect(0,0,580,340);

    for(let i = 0; i < 3; i++) {
      ctx.fillStyle = '#12141e';
      this._roundRect(ctx, 120+i*120, 70, 100, 170, 12);
      ctx.font = '64px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(reels[i], 170+i*120, 175);
    }

    // Gold frame
    ctx.strokeStyle = '#d4a843'; ctx.lineWidth = 2;
    this._roundRectStroke(ctx, 110, 60, 360, 190, 14);

    // Payline
    ctx.strokeStyle = 'rgba(212,168,67,0.4)'; ctx.lineWidth = 1;
    ctx.setLineDash([6,4]);
    ctx.beginPath(); ctx.moveTo(115, 155); ctx.lineTo(465, 155); ctx.stroke();
    ctx.setLineDash([]);

    const allSame = reels[0] === reels[1] && reels[1] === reels[2];
    const twoSame = reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2];
    const isDiamond = allSame && reels[0] === '💎';

    let winAmount = 0, msg = '';

    if(isDiamond) {
      winAmount = bet * 10;
      msg = '💎💎💎 JACKPOT! Won ' + this._fmt(winAmount);
    } else if(allSame) {
      winAmount = bet * 5;
      msg = 'THREE ' + reels[0] + '! Won ' + this._fmt(winAmount);
    } else if(twoSame) {
      winAmount = Math.floor(bet * 1.5);
      msg = 'Two match! Won ' + this._fmt(winAmount);
    }

    if(winAmount > 0) {
      RL.chips += winAmount; RL.updateChips();
      ctx.fillStyle = '#22c55e'; ctx.font = '700 26px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('WIN!', 290, 300);
      this._result(msg, 'win');
    } else {
      ctx.fillStyle = '#ef4444'; ctx.font = '500 18px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('No match', 290, 300);
      this._result('No match — Lost ' + this._fmt(bet), 'lose');
    }
  },

  // ═══ ROULETTE ═══
  _initRoulette() {
    document.getElementById('gameTitle').textContent = 'Roulette';
    document.getElementById('gameDesc').textContent = 'Pick Red, Black, or Green · Green pays 14x';
    document.getElementById('gameControls').innerHTML =
      '<input class="g-input" id="roulBet" value="1000" placeholder="Bet">' +
      '<button class="g-btn" style="background:linear-gradient(135deg,#cc2222,#991111);color:#fff" onclick="RL.games._spinRoul(\'red\')">RED</button>' +
      '<button class="g-btn" style="background:linear-gradient(135deg,#222,#111);color:#fff" onclick="RL.games._spinRoul(\'black\')">BLACK</button>' +
      '<button class="g-btn" style="background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff" onclick="RL.games._spinRoul(\'green\')">GREEN</button>';

    const ctx = document.getElementById('gameCanvas').getContext('2d');
    ctx.canvas.width = 580; ctx.canvas.height = 340;
    const grad = ctx.createLinearGradient(0,0,0,340);
    grad.addColorStop(0,'#0a0c14'); grad.addColorStop(1,'#060810');
    ctx.fillStyle = grad; ctx.fillRect(0,0,580,340);
    ctx.fillStyle = '#64748b'; ctx.font = '500 18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Pick your color', 290, 170);
  },

  _spinRoul(choice) {
    const bet = parseInt(document.getElementById('roulBet').value) || 1000;
    if(bet > RL.chips) { this._result('Not enough chips!', 'lose'); return; }
    RL.chips -= bet; RL.updateChips();

    const num = Math.floor(Math.random() * 37);
    const isGreen = num === 0;
    const isRed = !isGreen && [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(num);
    const result = isGreen ? 'green' : isRed ? 'red' : 'black';

    const ctx = document.getElementById('gameCanvas').getContext('2d');
    const grad = ctx.createLinearGradient(0,0,0,340);
    grad.addColorStop(0,'#0a0c14'); grad.addColorStop(1,'#060810');
    ctx.fillStyle = grad; ctx.fillRect(0,0,580,340);

    // Outer ring
    ctx.beginPath(); ctx.arc(290, 145, 88, 0, Math.PI*2);
    ctx.strokeStyle = '#d4a843'; ctx.lineWidth = 3; ctx.stroke();

    // Result circle
    const colors = {red:'#cc2222', black:'#1a1a1a', green:'#22c55e'};
    ctx.beginPath(); ctx.arc(290, 145, 80, 0, Math.PI*2);
    ctx.fillStyle = colors[result]; ctx.fill();

    // Number
    ctx.fillStyle = '#fff'; ctx.font = '800 44px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(num, 290, 162);

    ctx.fillStyle = '#64748b'; ctx.font = '500 14px sans-serif';
    ctx.fillText(result.toUpperCase(), 290, 260);

    const win = choice === result;
    const multi = choice === 'green' ? 14 : 2;

    if(win) {
      const winAmt = bet * multi;
      RL.chips += winAmt; RL.updateChips();
      this._result(num + ' ' + result.toUpperCase() + '! Won ' + this._fmt(winAmt), 'win');
    } else {
      this._result(num + ' ' + result.toUpperCase() + ' — Lost ' + this._fmt(bet), 'lose');
    }
  },

  // ═══ BLACKJACK ═══
  _bjDeck: [], _bjPlayer: [], _bjDealer: [], _bjBet: 0, _bjDone: false,

  _initBlackjack() {
    document.getElementById('gameTitle').textContent = 'Blackjack';
    document.getElementById('gameDesc').textContent = 'Beat the dealer — get closer to 21 without busting';
    document.getElementById('gameControls').innerHTML =
      '<input class="g-input" id="bjBet" value="1000" placeholder="Bet">' +
      '<button class="g-btn" onclick="RL.games._bjDeal()">DEAL</button>';

    const ctx = document.getElementById('gameCanvas').getContext('2d');
    ctx.canvas.width = 580; ctx.canvas.height = 340;
    const grad = ctx.createLinearGradient(0,0,0,340);
    grad.addColorStop(0,'#0a1a0f'); grad.addColorStop(1,'#060e08');
    ctx.fillStyle = grad; ctx.fillRect(0,0,580,340);
    ctx.fillStyle = '#64748b'; ctx.font = '500 18px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Place bet & deal', 290, 170);
  },

  _bjNewDeck() {
    this._bjDeck = [];
    const suits = ['♠','♥','♦','♣'];
    const ranks = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
    suits.forEach(s => ranks.forEach(r =>
      this._bjDeck.push({s, r, v: r==='A'?11 : isNaN(r)?10 : +r})
    ));
    this._bjDeck.sort(() => Math.random()-.5);
  },

  _bjHandVal(hand) {
    let v = hand.reduce((a,c) => a+c.v, 0);
    let aces = hand.filter(c => c.r==='A').length;
    while(v > 21 && aces) { v -= 10; aces--; }
    return v;
  },

  _bjDeal() {
    const bet = parseInt(document.getElementById('bjBet').value) || 1000;
    if(bet > RL.chips) { this._result('Not enough chips!', 'lose'); return; }
    RL.chips -= bet; RL.updateChips();
    this._bjBet = bet; this._bjDone = false;
    this._bjNewDeck();
    this._bjPlayer = [this._bjDeck.pop(), this._bjDeck.pop()];
    this._bjDealer = [this._bjDeck.pop(), this._bjDeck.pop()];

    document.getElementById('gameControls').innerHTML =
      '<button class="g-btn" onclick="RL.games._bjHit()">HIT</button>' +
      '<button class="g-btn red" onclick="RL.games._bjStand()">STAND</button>';

    this._bjDraw(false);
    if(this._bjHandVal(this._bjPlayer) === 21) { this._bjDone = true; this._bjStand(); }
  },

  _bjHit() {
    if(this._bjDone) return;
    this._bjPlayer.push(this._bjDeck.pop());
    this._bjDraw(false);
    if(this._bjHandVal(this._bjPlayer) > 21) {
      this._bjDone = true; this._bjDraw(true);
      this._result('BUST! Lost ' + this._fmt(this._bjBet), 'lose');
      document.getElementById('gameControls').innerHTML =
        '<input class="g-input" id="bjBet" value="'+this._bjBet+'">' +
        '<button class="g-btn" onclick="RL.games._bjDeal()">DEAL</button>';
    }
  },

  _bjStand() {
    this._bjDone = true;
    while(this._bjHandVal(this._bjDealer) < 17) this._bjDealer.push(this._bjDeck.pop());
    this._bjDraw(true);

    const pv = this._bjHandVal(this._bjPlayer);
    const dv = this._bjHandVal(this._bjDealer);

    if(pv > 21) {
      this._result('BUST! Lost ' + this._fmt(this._bjBet), 'lose');
    } else if(dv > 21 || pv > dv) {
      RL.chips += this._bjBet * 2; RL.updateChips();
      this._result('WIN! +' + this._fmt(this._bjBet*2), 'win');
    } else if(pv === dv) {
      RL.chips += this._bjBet; RL.updateChips();
      this._result('PUSH — bet returned', 'win');
    } else {
      this._result('Dealer wins — Lost ' + this._fmt(this._bjBet), 'lose');
    }

    document.getElementById('gameControls').innerHTML =
      '<input class="g-input" id="bjBet" value="'+this._bjBet+'">' +
      '<button class="g-btn" onclick="RL.games._bjDeal()">DEAL AGAIN</button>';
  },

  _bjDraw(reveal) {
    const ctx = document.getElementById('gameCanvas').getContext('2d');
    const grad = ctx.createLinearGradient(0,0,0,340);
    grad.addColorStop(0,'#0a1a0f'); grad.addColorStop(1,'#060e08');
    ctx.fillStyle = grad; ctx.fillRect(0,0,580,340);

    // Dealer label
    ctx.fillStyle = '#d4a843'; ctx.font = '600 13px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('DEALER' + (reveal ? '  ·  ' + this._bjHandVal(this._bjDealer) : ''), 25, 28);
    this._bjDealer.forEach((c,i) => this._drawCard(ctx, 25+i*68, 38, c, i===1 && !reveal));

    // Divider
    ctx.strokeStyle = 'rgba(212,168,67,0.15)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(20, 180); ctx.lineTo(560, 180); ctx.stroke();

    // Player label
    ctx.fillStyle = '#22c55e'; ctx.font = '600 13px sans-serif';
    ctx.fillText('YOU  ·  ' + this._bjHandVal(this._bjPlayer), 25, 198);
    this._bjPlayer.forEach((c,i) => this._drawCard(ctx, 25+i*68, 208, c, false));
  },

  _drawCard(ctx, x, y, card, hidden) {
    // Card shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    this._roundRect(ctx, x+2, y+2, 54, 76, 6);

    // Card bg
    ctx.fillStyle = hidden ? '#1a1e28' : '#f8f6f0';
    ctx.strokeStyle = hidden ? '#2a2e38' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    this._roundRect(ctx, x, y, 54, 76, 6);

    if(hidden) {
      // Pattern on back
      ctx.fillStyle = '#d4a843'; ctx.font = '24px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('◆', x+27, y+46);
      return;
    }

    const red = card.s === '♥' || card.s === '♦';
    ctx.fillStyle = red ? '#ef4444' : '#111';
    ctx.font = '700 13px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(card.r + card.s, x+5, y+17);
    ctx.font = '24px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(card.s, x+27, y+52);
    // Bottom-right rank
    ctx.font = '700 10px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(card.r, x+49, y+70);
  },

  _roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.fill(); ctx.stroke();
  },

  _roundRectStroke(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r, y);
    ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
    ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h);
    ctx.lineTo(x+r, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-r);
    ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
    ctx.stroke();
  }
};

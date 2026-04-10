// ═══════════════════════════════════════
// FURNITURE — Casino Machines & Tables
// Premium design, chrome/gold accents
// ═══════════════════════════════════════

RL.furniture = {
  build() {
    RL.load(35, 'Building slot machines...');
    const S = RL.scene;

    // Slot rows - left wing
    for(let r = 0; r < 3; r++) for(let i = 0; i < 5; i++) {
      const s = this.makeSlot();
      s.position.set(-20 + i*2.2, 0, 10 + r*4);
      s.rotation.y = r%2 ? Math.PI : 0;
      S.add(s);
    }
    // Slot rows - right wing
    for(let r = 0; r < 3; r++) for(let i = 0; i < 5; i++) {
      const s = this.makeSlot();
      s.position.set(12 + i*2.2, 0, 10 + r*4);
      s.rotation.y = r%2 ? Math.PI : 0;
      S.add(s);
    }

    RL.load(45, 'Setting up roulette...');

    // Roulette tables
    for(let i = 0; i < 3; i++) {
      const r = this.makeRoulette();
      r.position.set(-8 + i*8, 0, -10);
      S.add(r);
      RL.roulettes.push(r);
      RL.interactables.push(r);
    }

    RL.load(50, 'Card tables...');

    // Blackjack tables
    for(let i = 0; i < 4; i++) {
      const b = this.makeBlackjack();
      b.position.set(-12 + i*8, 0, -22);
      S.add(b);
      RL.interactables.push(b);
    }

    // Center dragon model on pedestal
    const gltfLoader = new THREE.GLTFLoader();
    
    // Build pedestal first
    const pedestal = new THREE.Group();
    const pedBase = new THREE.Mesh(new THREE.CylinderGeometry(2.5, 3, 1, 16), M.marbleLight);
    pedBase.position.y = .5; pedBase.castShadow = true; pedestal.add(pedBase);
    const pedTop = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.5, .3, 16), M.gold);
    pedTop.position.y = 1.15; pedestal.add(pedTop);
    const pedRing = new THREE.Mesh(new THREE.TorusGeometry(2.5, .08, 8, 24), M.gold);
    pedRing.rotation.x = Math.PI/2; pedRing.position.y = .15; pedestal.add(pedRing);
    S.add(pedestal);
    
    gltfLoader.load('models/chinese_dragon/scene.gltf', (gltf) => {
      const dragon = gltf.scene;
      const box = new THREE.Box3().setFromObject(dragon);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale = 10 / maxDim;
      dragon.scale.setScalar(scale);
      
      // Center on pedestal, sitting on top
      dragon.position.set(
        -center.x * scale, 
        1.3 - box.min.y * scale,  // sit on pedestal top
        -center.z * scale
      );

      dragon.traverse(c => {
        if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
      });
      RL._dragonModel = dragon;
      S.add(dragon);
    });

    // Dragon accent lights
    const dragonLight = new THREE.PointLight(0xd4a843, 2.5, 20);
    dragonLight.position.set(0, 8, 0); S.add(dragonLight);
    const dragonLight2 = new THREE.PointLight(0xf0c94d, 1.5, 15);
    dragonLight2.position.set(0, 2, 3); S.add(dragonLight2);
    const dragonLight3 = new THREE.PointLight(0xf0c94d, 1.0, 12);
    dragonLight3.position.set(3, 2, -2); S.add(dragonLight3);

    // Cashier booth
    const booth = this.makeBooth();
    booth.position.set(0, 0, 32);
    booth.rotation.y = Math.PI;
    S.add(booth);

    // Velvet rope barriers (VIP area boundary)
    for(let i = 0; i < 8; i++) {
      const a = (i/8) * Math.PI * 2;
      const a2 = ((i+1)/8) * Math.PI * 2;
      this._makeRopePost(Math.cos(a)*28, Math.sin(a)*28, S);
    }
  },

  _makeRopePost(x, z, scene) {
    const M = RL.M;
    // Post
    const post = new THREE.Mesh(new THREE.CylinderGeometry(.06, .08, 1, 8), M.gold);
    post.position.set(x, .5, z); scene.add(post);
    // Ball top
    const ball = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 8), M.gold);
    ball.position.set(x, 1.05, z); scene.add(ball);
  },

  // ── SLOT MACHINE ──
  makeSlot() {
    const g = new THREE.Group();
    g.userData.type = 'slot';
    g.userData.gameType = 'Slots';
    const M = RL.M;

    // Body (dark sleek)
    const body = new THREE.Mesh(new THREE.BoxGeometry(.9, 1.8, .7), M.slotBody);
    body.position.y = 1.2; body.castShadow = true; g.add(body);

    // Curved top
    const top = new THREE.Mesh(new THREE.CylinderGeometry(.45, .45, .7, 8, 1, false, 0, Math.PI), M.slotBody);
    top.rotation.z = Math.PI/2; top.rotation.y = Math.PI/2; top.position.set(0, 2.1, 0); g.add(top);

    // Screen with canvas
    const reelCanvas = document.createElement('canvas');
    reelCanvas.width = 128; reelCanvas.height = 96;
    const rx = reelCanvas.getContext('2d');
    rx.fillStyle = '#0a0c14'; rx.fillRect(0,0,128,96);
    rx.font = '28px sans-serif'; rx.textAlign = 'center';
    const symbols = ['💎','7️⃣','🔔','⭐','🎲','💰'];
    for(let i = 0; i < 3; i++) {
      rx.fillText(symbols[Math.floor(Math.random()*symbols.length)], 22+i*42, 55);
    }
    const reelMesh = new THREE.Mesh(new THREE.PlaneGeometry(.65, .48),
      new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(reelCanvas)}));
    reelMesh.position.set(0, 1.5, .361); g.add(reelMesh);

    // Chrome trims
    const t1 = new THREE.Mesh(new THREE.BoxGeometry(.95, .04, .75), M.chrome);
    t1.position.y = .95; g.add(t1);
    const t2 = new THREE.Mesh(new THREE.BoxGeometry(.95, .04, .75), M.chrome);
    t2.position.y = 1.78; g.add(t2);

    // Gold accent line
    const accent = new THREE.Mesh(new THREE.BoxGeometry(.96, .02, .76), M.gold);
    accent.position.y = 2.0; g.add(accent);

    // Lever
    const lever = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .6, 6), M.chrome);
    lever.position.set(.5, 1.5, .2); lever.rotation.z = .2; g.add(lever);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 8), M.gold);
    knob.position.set(.58, 1.78, .2); g.add(knob);

    // Stool (leather look)
    const stoolPole = new THREE.Mesh(new THREE.CylinderGeometry(.025, .025, .7, 6), M.chrome);
    stoolPole.position.set(0, .35, .8); g.add(stoolPole);
    const stoolSeat = new THREE.Mesh(new THREE.CylinderGeometry(.18, .15, .06, 8), M.velvet);
    stoolSeat.position.set(0, .72, .8); g.add(stoolSeat);

    // Base
    const base = new THREE.Mesh(new THREE.BoxGeometry(1, .15, .8), M.marbleDark);
    base.position.y = .08; g.add(base);

    RL.interactables.push(g);
    return g;
  },

  // ── ROULETTE TABLE ──
  makeRoulette() {
    const g = new THREE.Group();
    g.userData.type = 'roulette';
    g.userData.gameType = 'Roulette';
    const M = RL.M;

    // Table body (mahogany)
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, .15, 24), M.mahogany);
    body.position.y = .85; body.castShadow = true; g.add(body);

    // Chrome legs
    for(let i = 0; i < 4; i++) {
      const a = (i/4)*Math.PI*2 + Math.PI/4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.04, .06, .8, 6), M.chrome);
      leg.position.set(Math.cos(a)*.8, .4, Math.sin(a)*.8); g.add(leg);
    }

    // Green felt
    const felt = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, .02, 24), M.feltGreen);
    felt.position.y = .94; g.add(felt);

    // Gold wheel
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(.4, .4, .08, 20), M.gold);
    wheel.position.y = .98; wheel.name = 'wheel'; g.add(wheel);

    // Wheel rim
    const rim = new THREE.Mesh(new THREE.TorusGeometry(.4, .03, 8, 24), M.mahogany);
    rim.rotation.x = Math.PI/2; rim.position.y = .98; g.add(rim);

    // Number pockets
    for(let i = 0; i < 12; i++) {
      const a = (i/12)*Math.PI*2;
      const chip = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, .03, 6),
        i%2 ? M.rouletteRed : M.black);
      chip.position.set(Math.cos(a)*.32, .99, Math.sin(a)*.32); g.add(chip);
    }

    // Betting extension
    const bet = new THREE.Mesh(new THREE.BoxGeometry(1.4, .12, 1), M.feltGreen);
    bet.position.set(1.2, .87, 0); g.add(bet);
    const betRim = new THREE.Mesh(new THREE.BoxGeometry(1.45, .14, 1.05), M.mahogany);
    betRim.position.set(1.2, .84, 0); g.add(betRim);

    // Chip stacks
    const chipColors = [0xcc2222, 0x2255cc, 0xd4a843, 0x111111, 0xffffff, 0xa855f7];
    for(let i = 0; i < 6; i++) {
      const stack = new THREE.Group();
      for(let j = 0; j < 2 + Math.floor(Math.random()*4); j++) {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, .02, 8),
          new THREE.MeshStandardMaterial({color:chipColors[i], roughness:.4, metalness:.1}));
        c.position.y = j * .02; stack.add(c);
      }
      stack.position.set(.7 + Math.random()*.8, .93, (Math.random()-.5)*.7);
      g.add(stack);
    }

    return g;
  },

  // ── BLACKJACK TABLE ──
  makeBlackjack() {
    const g = new THREE.Group();
    g.userData.type = 'blackjack';
    g.userData.gameType = 'Blackjack';
    const M = RL.M;

    const shape = new THREE.Shape();
    shape.absarc(0, 0, 1.3, 0, Math.PI, false);
    shape.lineTo(-1.3, 0);

    const tableGeo = new THREE.ExtrudeGeometry(shape, {depth:.12, bevelEnabled:false});
    const table = new THREE.Mesh(tableGeo, M.feltGreen);
    table.rotation.x = -Math.PI/2; table.position.y = .88; table.castShadow = true; g.add(table);

    const rimGeo = new THREE.ExtrudeGeometry(shape, {depth:.15, bevelEnabled:false});
    const rim = new THREE.Mesh(rimGeo, M.mahogany);
    rim.rotation.x = -Math.PI/2; rim.position.y = .84; g.add(rim);

    // Chrome legs
    for(let i = 0; i < 3; i++) {
      const a = (i/4) * Math.PI;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(.04, .06, .8, 6), M.chrome);
      leg.position.set(Math.cos(a)*1, .42, Math.sin(a)*-.5); g.add(leg);
    }

    // Gold dealer chip tray
    const dealer = new THREE.Mesh(new THREE.BoxGeometry(.6, .01, .3), M.gold);
    dealer.position.set(0, .96, -.2); g.add(dealer);

    // Betting circles (gold inlay)
    for(let i = 0; i < 5; i++) {
      const a = (i/6)*Math.PI + Math.PI/6;
      const spot = new THREE.Mesh(new THREE.RingGeometry(.12, .15, 12),
        new THREE.MeshBasicMaterial({color:0xd4a843, transparent:true, opacity:.3}));
      spot.rotation.x = -Math.PI/2;
      spot.position.set(Math.cos(a)*1, .97, Math.sin(a)*.6); g.add(spot);
    }

    return g;
  },

  // ── CASHIER BOOTH ──
  makeBooth() {
    const g = new THREE.Group();
    g.userData.type = 'booth';
    const M = RL.M;

    const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.2, 1.2), M.mahogany);
    body.position.y = .6; g.add(body);

    const top = new THREE.Mesh(new THREE.BoxGeometry(2.6, .06, 1.3), M.marbleLight);
    top.position.y = 1.24; g.add(top);

    // Gold trim
    const trim = new THREE.Mesh(new THREE.BoxGeometry(2.62, .03, 1.32), M.gold);
    trim.position.y = 1.2; g.add(trim);

    // Sign
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 256; signCanvas.height = 64;
    const sx = signCanvas.getContext('2d');
    sx.fillStyle = '#d4a843'; sx.font = 'bold 20px sans-serif'; sx.textAlign = 'center';
    sx.fillText('CASHIER', 128, 40);
    const signMesh = new THREE.Mesh(new THREE.PlaneGeometry(2, .5),
      new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(signCanvas), transparent:true}));
    signMesh.position.set(0, 1.6, .61); g.add(signMesh);

    return g;
  },
};

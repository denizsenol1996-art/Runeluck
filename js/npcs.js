// ═══════════════════════════════════════
// NPCs — Custom Casino Characters
// Suited patrons, dealers, bouncers
// ═══════════════════════════════════════

RL.npcModule = {
  // Character types with visual presets
  presets: [
    {type:'patron',  suit:0x1a1e28, skin:0xd4a574, hair:0x1a1a1a, hairStyle:'short'},
    {type:'patron',  suit:0x28201a, skin:0xb88b6a, hair:0x3a2010, hairStyle:'short'},
    {type:'patron',  suit:0x1a2028, skin:0xd4a574, hair:0xd4a843, hairStyle:'slick'},
    {type:'dealer',  suit:0x2a0a0a, skin:0xc49464, hair:0x1a1a1a, hairStyle:'short'},
    {type:'patron',  suit:0x221a28, skin:0xd4a574, hair:0x5a3020, hairStyle:'short'},
    {type:'patron',  suit:0x1a2818, skin:0xa87a5a, hair:0x1a1a1a, hairStyle:'slick'},
    {type:'bouncer', suit:0x111115, skin:0x8b6b4a, hair:0x0a0a0a, hairStyle:'bald'},
    {type:'patron',  suit:0x28281a, skin:0xd4a574, hair:0xaa8844, hairStyle:'short'},
    {type:'dealer',  suit:0x2a0a0a, skin:0xd4a574, hair:0x3a2010, hairStyle:'slick'},
    {type:'patron',  suit:0x1a1a28, skin:0xb88b6a, hair:0x1a1a1a, hairStyle:'short'},
    {type:'patron',  suit:0x281a1a, skin:0xd4a574, hair:0xd4a843, hairStyle:'short'},
    {type:'bouncer', suit:0x111115, skin:0xd4a574, hair:0x0a0a0a, hairStyle:'bald'},
  ],

  build() {
    RL.load(55, 'Spawning characters...');
    for(let i = 0; i < this.presets.length; i++) {
      const p = this.presets[i];
      const npc = this.make(p);
      const a = (i / this.presets.length) * Math.PI * 2 + Math.random();
      const r = 6 + Math.random() * 25;
      npc.position.set(Math.cos(a)*r, 0, Math.sin(a)*r);
      RL.scene.add(npc);
      RL.npcs.push({
        mesh: npc, angle: a, radius: r,
        speed: .04 + Math.random() * .08,
        phase: Math.random() * 6
      });
    }
  },

  // ── Build one custom character ──
  make(opts) {
    const g = new THREE.Group();
    g.userData.type = 'npc';
    const M = RL.M;

    const type = opts.type || 'patron';
    const suitColor = opts.suit || 0x1a1e28;
    const skinColor = opts.skin || 0xd4a574;
    const hairColor = opts.hair || 0x1a1a1a;
    const hairStyle = opts.hairStyle || 'short';

    const suitMat = new THREE.MeshStandardMaterial({color:suitColor, roughness:.5, metalness:.05});
    const suitDark = new THREE.MeshStandardMaterial({color:new THREE.Color(suitColor).multiplyScalar(.7), roughness:.5});
    const skinMat = new THREE.MeshStandardMaterial({color:skinColor, roughness:.6});
    const hairMat = new THREE.MeshStandardMaterial({color:hairColor, roughness:.7});

    // ── Torso (fitted jacket) ──
    const torso = new THREE.Mesh(new THREE.BoxGeometry(.42, .5, .22), suitMat);
    torso.position.y = 1.15; g.add(torso);

    // Shirt/vest peek (V-shape at collar)
    if(type === 'dealer') {
      const vest = new THREE.Mesh(new THREE.BoxGeometry(.2, .12, .01), M.gold);
      vest.position.set(0, 1.35, .12); g.add(vest);
    } else {
      const shirtPeek = new THREE.Mesh(new THREE.BoxGeometry(.12, .08, .01), M.shirt);
      shirtPeek.position.set(0, 1.38, .12); g.add(shirtPeek);
    }

    // ── Head (rounder, more human) ──
    const head = new THREE.Mesh(new THREE.BoxGeometry(.24, .28, .24), skinMat);
    head.position.y = 1.58; g.add(head);

    // Eyes (small dark dots)
    for(const s of [-.06, .06]) {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(.03, .025, .01), M.black);
      eye.position.set(s, 1.6, .13); g.add(eye);
    }

    // ── Hair ──
    if(hairStyle === 'short') {
      const top = new THREE.Mesh(new THREE.BoxGeometry(.26, .08, .26), hairMat);
      top.position.y = 1.76; g.add(top);
      const back = new THREE.Mesh(new THREE.BoxGeometry(.26, .15, .06), hairMat);
      back.position.set(0, 1.65, -.13); g.add(back);
    } else if(hairStyle === 'slick') {
      const slick = new THREE.Mesh(new THREE.BoxGeometry(.26, .06, .3), hairMat);
      slick.position.set(0, 1.75, -.02); g.add(slick);
    }
    // bald = no hair

    // ── Bouncer extras ──
    if(type === 'bouncer') {
      // Wider shoulders
      for(const s of [-.28, .28]) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(.16, .1, .2), suitMat);
        sp.position.set(s, 1.38, 0); g.add(sp);
      }
      // Earpiece
      const earpiece = new THREE.Mesh(new THREE.BoxGeometry(.04, .04, .04), M.black);
      earpiece.position.set(-.14, 1.6, 0); g.add(earpiece);
      const wire = new THREE.Mesh(new THREE.BoxGeometry(.01, .15, .01), M.black);
      wire.position.set(-.14, 1.45, -.04); g.add(wire);
    }

    // ── Arms ──
    for(const s of [-.28, .28]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(.1, .42, .1), suitMat);
      arm.position.set(s, .95, 0); arm.name = 'arm'; g.add(arm);
      // Hand
      const hand = new THREE.Mesh(new THREE.BoxGeometry(.08, .07, .08), skinMat);
      hand.position.set(s, .71, 0); hand.name = 'arm'; g.add(hand);
    }

    // ── Legs (dark trousers) ──
    for(const s of [-.08, .08]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(.13, .48, .13), suitDark);
      leg.position.set(s, .47, 0); leg.name = 'leg'; g.add(leg);
    }

    // ── Shoes (polished) ──
    for(const s of [-.08, .08]) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(.14, .06, .18), M.black);
      shoe.position.set(s, .03, .02); g.add(shoe);
    }

    // ── Username tag (only for player) ──
    if(type === 'player') {
      // Optional: add glow effect
    }

    g.traverse(c => { if(c.isMesh) c.castShadow = true; });
    return g;
  }
};

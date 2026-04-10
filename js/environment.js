// ═══════════════════════════════════════
// ENVIRONMENT — Premium Casino Floor
// Dark marble, gold accents, warm lights
// ═══════════════════════════════════════

RL.environment = {
  spotMain: null,

  build() {
    RL.load(10, 'Building floor...');
    const S = RL.scene, M = RL.M;

    // ── Main floor (dark marble) ──
    const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 80), M.marble);
    floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; S.add(floor);

    // Inner VIP area
    const inner = new THREE.Mesh(new THREE.CircleGeometry(28, 64), M.marbleDark);
    inner.rotation.x = -Math.PI/2; inner.position.y = .01; S.add(inner);

    // Gold inlay ring
    const ring = new THREE.Mesh(new THREE.RingGeometry(27.5, 28.5, 64), M.gold);
    ring.rotation.x = -Math.PI/2; ring.position.y = .02; S.add(ring);

    // Outer decorative ring
    const outerRing = new THREE.Mesh(new THREE.RingGeometry(44, 45, 64), M.goldDark);
    outerRing.rotation.x = -Math.PI/2; outerRing.position.y = .015; S.add(outerRing);

    // Floor pattern — radial lines in gold
    for(let i = 0; i < 16; i++) {
      const a = (i/16) * Math.PI * 2;
      const line = new THREE.Mesh(
        new THREE.PlaneGeometry(.08, 20),
        new THREE.MeshBasicMaterial({color:0xd4a843, transparent:true, opacity:.04})
      );
      line.rotation.x = -Math.PI/2;
      line.rotation.z = a;
      line.position.set(Math.cos(a)*24, .025, Math.sin(a)*24);
      S.add(line);
    }

    RL.load(15, 'Raising walls...');

    // ── Walls (dark, sophisticated) ──
    const walls = new THREE.Mesh(
      new THREE.CylinderGeometry(55, 55, 18, 80, 1, true), M.wall
    );
    walls.position.y = 9; S.add(walls);

    // Wall base molding
    const baseMold = new THREE.Mesh(
      new THREE.TorusGeometry(55, .3, 8, 80),
      M.goldDark
    );
    baseMold.rotation.x = Math.PI/2;
    baseMold.position.y = .3; S.add(baseMold);

    // Wall crown molding
    const crownMold = new THREE.Mesh(
      new THREE.TorusGeometry(55, .2, 8, 80),
      M.gold
    );
    crownMold.rotation.x = Math.PI/2;
    crownMold.position.y = 16; S.add(crownMold);

    // Ceiling dome
    const ceil = new THREE.Mesh(
      new THREE.SphereGeometry(55, 40, 16, 0, Math.PI*2, 0, Math.PI/3.5), M.ceil
    );
    ceil.position.y = 14; S.add(ceil);

    RL.load(20, 'Carving pillars...');

    // ── Pillars (marble + gold bands) ──
    for(let i = 0; i < 16; i++) {
      const a = (i/16) * Math.PI * 2;
      this._makePillar(Math.cos(a)*48, Math.sin(a)*48);
    }

    // Inner ring of thinner pillars
    for(let i = 0; i < 8; i++) {
      const a = (i/8) * Math.PI * 2 + Math.PI/8;
      this._makeSlimPillar(Math.cos(a)*28, Math.sin(a)*28);
    }

    RL.load(25, 'Installing lights...');

    // ── Lighting (warm, atmospheric) ──
    S.add(new THREE.AmbientLight(0x111118, .6));
    S.add(new THREE.HemisphereLight(0x443322, 0x111118, .7));

    // Center warm spotlight
    this.spotMain = new THREE.SpotLight(0xf0d478, 2, 60, Math.PI/3, .5);
    this.spotMain.position.set(0, 16, 0);
    this.spotMain.castShadow = true;
    this.spotMain.shadow.mapSize.set(512, 512);
    S.add(this.spotMain);

    // Grid of warm point lights
    for(let x = -30; x <= 30; x += 15) {
      for(let z = -30; z <= 30; z += 15) {
        const pl = new THREE.PointLight(0xf0d478, .5, 18);
        pl.position.set(x, 5, z);
        S.add(pl);
      }
    }

    // Wall accent lights (brighter, warm amber)
    for(let i = 0; i < 16; i++) {
      const a = (i/16) * Math.PI * 2;
      const wl = new THREE.PointLight(0xd4a843, .6, 18);
      wl.position.set(Math.cos(a)*48, 7, Math.sin(a)*48);
      S.add(wl);
    }

    // Extra uplights on walls for visibility
    for(let i = 0; i < 8; i++) {
      const a = (i/8) * Math.PI * 2 + Math.PI/8;
      const ul = new THREE.SpotLight(0xf0d478, .8, 20, Math.PI/4, .6);
      ul.position.set(Math.cos(a)*46, 1, Math.sin(a)*46);
      ul.target.position.set(Math.cos(a)*50, 10, Math.sin(a)*50);
      S.add(ul); S.add(ul.target);
    }

    // Subtle purple accent under VIP area
    const vipLight = new THREE.PointLight(0x6633aa, .3, 20);
    vipLight.position.set(0, .5, 0); S.add(vipLight);
  },

  _makePillar(x, z) {
    const S = RL.scene, M = RL.M;
    const g = new THREE.Group();

    // Fluted column shaft
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.5, .6, 16, 12), M.marbleLight);
    shaft.position.y = 8; shaft.castShadow = true; g.add(shaft);

    // Gold accent bands
    for(let b = 0; b < 4; b++) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(.55, .55, .1, 12), M.gold);
      band.position.y = 2 + b * 4; g.add(band);
    }

    // Base
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.8, .9, .6, 12), M.marbleLight);
    base.position.y = .3; g.add(base);

    // Capital
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.7, .5, .4, 12), M.marbleLight);
    cap.position.y = 16.2; g.add(cap);

    // Gold cap ring
    const capRing = new THREE.Mesh(new THREE.CylinderGeometry(.72, .72, .08, 12), M.gold);
    capRing.position.y = 16; g.add(capRing);

    g.position.set(x, 0, z);
    S.add(g);
  },

  _makeSlimPillar(x, z) {
    const S = RL.scene, M = RL.M;
    const g = new THREE.Group();

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.2, .25, 8, 8), M.chrome);
    shaft.position.y = 4; g.add(shaft);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(.35, .4, .3, 8), M.marbleLight);
    base.position.y = .15; g.add(base);

    // Light on top
    const lightBall = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 8), M.neon);
    lightBall.position.y = 8.1; g.add(lightBall);
    const pl = new THREE.PointLight(0xd4a843, .4, 8);
    pl.position.y = 8.1; g.add(pl);

    g.position.set(x, 0, z);
    S.add(g);
  }
};

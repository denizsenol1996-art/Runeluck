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

    // ── Lighting (warm, atmospheric, well-lit casino) ──
    S.add(new THREE.AmbientLight(0x222233, .8));
    S.add(new THREE.HemisphereLight(0x554433, 0x111118, .9));

    // Center warm spotlight (dramatic, on dragon)
    this.spotMain = new THREE.SpotLight(0xf0d478, 3, 40, Math.PI/5, .6);
    this.spotMain.position.set(0, 14, 0);
    this.spotMain.target.position.set(0, 0, 0);
    this.spotMain.castShadow = true;
    this.spotMain.shadow.mapSize.set(1024, 1024);
    S.add(this.spotMain);
    S.add(this.spotMain.target);

    // Grid of warm point lights (ceiling mounted, pointing down)
    for(let x = -30; x <= 30; x += 15) {
      for(let z = -30; z <= 30; z += 15) {
        const pl = new THREE.PointLight(0xf0d478, .6, 25);
        pl.position.set(x, 12, z);
        S.add(pl);
        // Small visible lamp fixture
        const fix = new THREE.Mesh(new THREE.CylinderGeometry(.15, .25, .2, 8), M.gold);
        fix.position.set(x, 13.5, z); S.add(fix);
      }
    }

    // Wall accent lights (sconce-style, at eye level)
    for(let i = 0; i < 16; i++) {
      const a = (i/16) * Math.PI * 2;
      const wl = new THREE.PointLight(0xd4a843, .8, 20);
      const wx = Math.cos(a)*50, wz = Math.sin(a)*50;
      wl.position.set(wx, 5, wz);
      S.add(wl);
      // Visible sconce bracket
      const sconce = new THREE.Mesh(new THREE.BoxGeometry(.3, .4, .15), M.gold);
      sconce.position.set(wx, 5, wz);
      sconce.lookAt(0, 5, 0);
      S.add(sconce);
    }

    // Uplights along walls (ground level, pointing UP along wall)
    for(let i = 0; i < 8; i++) {
      const a = (i/8) * Math.PI * 2 + Math.PI/8;
      const ux = Math.cos(a)*52, uz = Math.sin(a)*52;
      const ul = new THREE.SpotLight(0xf0d478, 1.0, 18, Math.PI/6, .8);
      ul.position.set(ux, 0.3, uz);
      ul.target.position.set(ux, 12, uz);
      S.add(ul); S.add(ul.target);
      // Small ground light fixture
      const gf = new THREE.Mesh(new THREE.CylinderGeometry(.08, .12, .15, 6), M.gold);
      gf.position.set(ux, .08, uz); S.add(gf);
    }

    // Subtle purple accent for VIP area (above the floor)
    const vipLight = new THREE.PointLight(0x6633aa, .4, 25);
    vipLight.position.set(0, 3, 0); S.add(vipLight);
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

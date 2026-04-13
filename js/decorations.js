// ═══════════════════════════════════════
// DECORATIONS — Particles, Banners, Labels
// Premium casino atmosphere, no OSRS
// ═══════════════════════════════════════

RL.decorations = {
  pGeo: null, pCount: 120,
  gGeo: null, gCount: 40,

  build() {
    RL.load(65, 'Decorating...');
    const S = RL.scene;

    // (center banner removed — dragon is the centerpiece)

    // (standing banners removed — use build mode to place decorations)

    // ── IMAGE SCREENS on walls ──
    const images = [
      'media/army.png',
      'media/dex1.png',
      'media/Grue.png',
      'media/image.png',
      'media/Karl%20l0l.png',
      'media/Onlynows.png',
      'media/alt_stamp.png',
    ];
    this._videoTextures = [];

    const pillarStep = Math.PI * 2 / 16;
    const screenSlots = [1, 3, 5, 7, 9, 11, 13];
    for(let i = 0; i < images.length; i++) {
      const a = (screenSlots[i] + 0.5) * pillarStep;
      this._makeImageScreen(S, images[i], a, 7, 46);
    }

    // ── Floor pattern — diamond shapes ──
    for(let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 8 + Math.random() * 38;
      const dc = document.createElement('canvas');
      dc.width = 32; dc.height = 32;
      const dx = dc.getContext('2d');
      dx.globalAlpha = .03 + Math.random() * .03;
      dx.fillStyle = '#d4a843';
      dx.beginPath(); dx.moveTo(16,0); dx.lineTo(32,16); dx.lineTo(16,32); dx.lineTo(0,16); dx.closePath(); dx.fill();
      const dm = new THREE.Mesh(
        new THREE.PlaneGeometry(.6 + Math.random()*.4, .6 + Math.random()*.4),
        new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(dc), transparent:true})
      );
      dm.rotation.x = -Math.PI/2;
      dm.rotation.z = Math.random() * Math.PI;
      dm.position.set(Math.cos(a)*d, .02, Math.sin(a)*d);
      S.add(dm);
    }

    RL.load(75, 'Particles...');

    // ── Ambient dust/light particles (warm) ──
    this.pGeo = new THREE.BufferGeometry();
    const pP = new Float32Array(this.pCount * 3);
    for(let i = 0; i < this.pCount; i++) {
      pP[i*3] = (Math.random()-.5) * 80;
      pP[i*3+1] = Math.random() * 14;
      pP[i*3+2] = (Math.random()-.5) * 80;
    }
    this.pGeo.setAttribute('position', new THREE.BufferAttribute(pP, 3));
    S.add(new THREE.Points(this.pGeo, new THREE.PointsMaterial({
      color:0xf0d478, size:.03, transparent:true, opacity:.15,
      blending:THREE.AdditiveBlending, sizeAttenuation:true
    })));

    // ── Gold sparkles around center orb ──
    this.gGeo = new THREE.BufferGeometry();
    const gP = new Float32Array(this.gCount * 3);
    for(let i = 0; i < this.gCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 1 + Math.random() * 3;
      gP[i*3] = Math.cos(a) * r;
      gP[i*3+1] = 8 + Math.random() * 6;
      gP[i*3+2] = Math.sin(a) * r;
    }
    this.gGeo.setAttribute('position', new THREE.BufferAttribute(gP, 3));
    S.add(new THREE.Points(this.gGeo, new THREE.PointsMaterial({
      color:0xd4a843, size:.04, transparent:true, opacity:.4,
      blending:THREE.AdditiveBlending, sizeAttenuation:true
    })));

    RL.load(80, 'Labels...');

    // ── Area labels (stored for later repositioning) ──
    this._labels = {};
    this._labels.slotsL = this._label('SLOTS', -15, 4, 14, '#d4a843');
    this._labels.slotsR = this._label('SLOTS', 18, 4, 14, '#d4a843');
    this._labels.roulette = this._label('ROULETTE', 0, 3.5, -9, '#22c55e');
    this._labels.blackjack = this._label('BLACKJACK', 0, 3.5, -20, '#a855f7');
    this._labels.cashier = this._label('CASHIER', 0, 3, 30, '#d4a843');
  },

  moveLabel(key, x, y, z){
    var l = this._labels && this._labels[key];
    if(l) l.position.set(x, y, z);
  },

  _decoFrame: 0,
  animate(t) {
    // Throttle particle + video updates to every 2nd frame
    this._decoFrame = (this._decoFrame+1) & 1;
    if(this._decoFrame === 0){
      const pp = this.pGeo.attributes.position.array;
      for(let i = 0; i < this.pCount; i++) {
        pp[i*3+1] += .002;
        if(pp[i*3+1] > 14) {
          pp[i*3+1] = 0;
          pp[i*3] = (Math.random()-.5) * 80;
          pp[i*3+2] = (Math.random()-.5) * 80;
        }
      }
      this.pGeo.attributes.position.needsUpdate = true;

      const gp = this.gGeo.attributes.position.array;
      for(let i = 0; i < this.gCount; i++) {
        const ox = gp[i*3], oz = gp[i*3+2];
        const a = Math.atan2(oz, ox) + .01;
        const r = Math.hypot(ox, oz);
        gp[i*3] = Math.cos(a) * r;
        gp[i*3+2] = Math.sin(a) * r;
        gp[i*3+1] += .004;
        if(gp[i*3+1] > 14) gp[i*3+1] = 8;
      }
      this.gGeo.attributes.position.needsUpdate = true;

      // Lazy-start videos only when player is within range
      if(this._videoTextures) {
        var px = RL.player ? RL.player.position.x : 0;
        var pz = RL.player ? RL.player.position.z : 0;
        this._videoTextures.forEach(vt => {
          var d2 = (vt.x - px)*(vt.x - px) + (vt.z - pz)*(vt.z - pz);
          if(d2 > 625){ // >25 units away
            if(vt.video.src && !vt.video.paused) vt.video.pause();
          } else {
            // Attach src + start playing on first close approach
            if(!vt.video.src){ vt.video.src = vt.video._src; }
            if(vt.video.paused) vt.video.play().catch(function(){});
            if(vt.video.readyState >= vt.video.HAVE_CURRENT_DATA) {
              vt.texture.needsUpdate = true;
            }
          }
        });
      }
    }

    // Chandelier slow rotation + gentle sway
    if(RL._chandelier) {
      RL._chandelier.rotation.y = t * 0.08;
      RL._chandelier.position.y = 13 + Math.sin(t * 0.3) * 0.05;
    }
  },

  // ── VIDEO SCREEN on wall ──
  _makeVideoScreen(scene, src, angle, height, radius) {
    const g = new THREE.Group();

    // Create video element
    const video = document.createElement('video');
    // Lazy video: DON'T set src until player walks close.
    // The animate loop will set .src and call play() when player enters range.
    video._src = src;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'none';
    video.crossOrigin = 'anonymous';

    const videoTex = new THREE.VideoTexture(video);
    videoTex.minFilter = THREE.LinearFilter;
    videoTex.magFilter = THREE.LinearFilter;

    // Store world position so we can pause the video when the player is far
    var worldX = Math.cos(angle) * radius;
    var worldZ = Math.sin(angle) * radius;
    this._videoTextures.push({ video, texture: videoTex, x: worldX, z: worldZ });

    // Screen (16:9 aspect)
    const screenW = 6, screenH = 3.375;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(screenW, screenH),
      new THREE.MeshBasicMaterial({ map: videoTex })
    );

    // Gold frame around screen
    const frameThick = .12;
    const frameParts = [
      // top
      { w: screenW + frameThick*2, h: frameThick, x: 0, y: screenH/2 + frameThick/2 },
      // bottom
      { w: screenW + frameThick*2, h: frameThick, x: 0, y: -screenH/2 - frameThick/2 },
      // left
      { w: frameThick, h: screenH, x: -screenW/2 - frameThick/2, y: 0 },
      // right
      { w: frameThick, h: screenH, x: screenW/2 + frameThick/2, y: 0 },
    ];
    frameParts.forEach(fp => {
      const bar = new THREE.Mesh(
        new THREE.PlaneGeometry(fp.w, fp.h),
        new THREE.MeshBasicMaterial({ color: 0xd4a843 })
      );
      bar.position.set(fp.x, fp.y, 0.01);
      screen.add(bar);
    });

    // Corner accents (small gold squares)
    const corners = [
      [-screenW/2 - frameThick/2, screenH/2 + frameThick/2],
      [screenW/2 + frameThick/2, screenH/2 + frameThick/2],
      [-screenW/2 - frameThick/2, -screenH/2 - frameThick/2],
      [screenW/2 + frameThick/2, -screenH/2 - frameThick/2],
    ];
    corners.forEach(([cx, cy]) => {
      const dot = new THREE.Mesh(
        new THREE.PlaneGeometry(.2, .2),
        new THREE.MeshBasicMaterial({ color: 0xf0c94d })
      );
      dot.position.set(cx, cy, 0.02);
      screen.add(dot);
    });

    // Backlight glow behind screen
    const glow = new THREE.PointLight(0xd4a843, .3, 8);
    glow.position.set(0, 0, -0.5);
    screen.add(glow);

    // Position on wall, facing inward
    screen.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
    screen.lookAt(0, height, 0);

    scene.add(screen);
  },

  // ── IMAGE SCREEN on wall ──
  _makeImageScreen(scene, src, angle, height, radius) {
    const loader = new THREE.TextureLoader();
    const tex = loader.load(src);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;

    const screenW = 6, screenH = 3.375;
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(screenW, screenH),
      new THREE.MeshBasicMaterial({ map: tex })
    );

    const frameThick = .12;
    const frameParts = [
      { w: screenW + frameThick*2, h: frameThick, x: 0, y: screenH/2 + frameThick/2 },
      { w: screenW + frameThick*2, h: frameThick, x: 0, y: -screenH/2 - frameThick/2 },
      { w: frameThick, h: screenH, x: -screenW/2 - frameThick/2, y: 0 },
      { w: frameThick, h: screenH, x: screenW/2 + frameThick/2, y: 0 },
    ];
    frameParts.forEach(fp => {
      const bar = new THREE.Mesh(
        new THREE.PlaneGeometry(fp.w, fp.h),
        new THREE.MeshBasicMaterial({ color: 0xd4a843 })
      );
      bar.position.set(fp.x, fp.y, 0.01);
      screen.add(bar);
    });

    const corners = [
      [-screenW/2 - frameThick/2, screenH/2 + frameThick/2],
      [screenW/2 + frameThick/2, screenH/2 + frameThick/2],
      [-screenW/2 - frameThick/2, -screenH/2 - frameThick/2],
      [screenW/2 + frameThick/2, -screenH/2 - frameThick/2],
    ];
    corners.forEach(([cx, cy]) => {
      const dot = new THREE.Mesh(
        new THREE.PlaneGeometry(.2, .2),
        new THREE.MeshBasicMaterial({ color: 0xf0c94d })
      );
      dot.position.set(cx, cy, 0.02);
      screen.add(dot);
    });

    const glow = new THREE.PointLight(0xd4a843, .3, 8);
    glow.position.set(0, 0, -0.5);
    screen.add(glow);

    screen.position.set(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
    screen.lookAt(0, height, 0);

    scene.add(screen);
  },

  makeBanner() {
    const g = new THREE.Group();
    g.userData.type = 'banner';

    // Chrome pole
    const pole = new THREE.Mesh(
      new THREE.CylinderGeometry(.03, .03, 4, 6), RL.M.chrome
    );
    pole.position.y = 2; g.add(pole);

    // Banner canvas
    const bc = document.createElement('canvas');
    bc.width = 256; bc.height = 320;
    const bx = bc.getContext('2d');
    bx.fillStyle = '#0a0c10'; bx.fillRect(0,0,256,320);
    // Gold border
    bx.strokeStyle = '#d4a843'; bx.lineWidth = 2; bx.strokeRect(6,6,244,308);
    // Inner line
    bx.strokeStyle = 'rgba(212,168,67,0.3)'; bx.lineWidth = 1; bx.strokeRect(14,14,228,292);
    // Text
    bx.fillStyle = '#d4a843'; bx.font = 'bold 26px sans-serif'; bx.textAlign = 'center';
    bx.fillText('RUNE', 128, 80);
    bx.fillStyle = '#f0c94d'; bx.fillText('LUCK', 128, 112);
    // Diamond icon
    bx.font = '60px sans-serif'; bx.fillText('◆', 128, 200);
    // Subtitle
    bx.fillStyle = '#64748b'; bx.font = '12px sans-serif';
    bx.fillText('PREMIUM CASINO', 128, 260);

    const mat = new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(bc), transparent:true});
    const front = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.8), mat);
    front.position.y = 3; g.add(front);
    const back = front.clone();
    back.rotation.y = Math.PI; back.position.y = 3; g.add(back);

    // Gold finial on top
    const finial = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 8), RL.M.gold);
    finial.position.y = 4.05; g.add(finial);

    return g;
  },

  _centerBanner() {
    const banner = this.makeBanner();
    banner.position.set(0, 5, 0);
    banner.scale.set(2, 2, 2);
    RL.scene.add(banner);
  },

  _label(text, x, y, z, color) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 64;
    const ctx = c.getContext('2d');
    ctx.fillStyle = color || '#d4a843';
    ctx.font = '600 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000'; ctx.shadowBlur = 8;
    ctx.fillText(text, 256, 44);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c), transparent:true})
    );
    sprite.scale.set(4, .6, 1);
    sprite.position.set(x, y, z);
    RL.scene.add(sprite);
    return sprite;
  }
};

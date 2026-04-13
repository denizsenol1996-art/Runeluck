// ═══════════════════════════════════════
// NPCs — Dealers at tables only
// ═══════════════════════════════════════

RL.npcModule = {
  build() {
    RL.load(55, 'Ready...');
    // No hardcoded NPCs - add via Build Mode or when custom dealer models are ready
  },

  make(opts) {
    var g=new THREE.Group(), M=RL.M;
    var type=opts.type||'dealer';
    var suitMat=new THREE.MeshStandardMaterial({color:opts.suit||0x1a0808,roughness:.5,metalness:.05});
    var suitDark=new THREE.MeshStandardMaterial({color:new THREE.Color(opts.suit||0x1a0808).multiplyScalar(.7),roughness:.5});
    var skinMat=new THREE.MeshStandardMaterial({color:opts.skin||0xd4a574,roughness:.6});
    var hairMat=new THREE.MeshStandardMaterial({color:opts.hair||0x1a1a1a,roughness:.7});
    var m;

    // Torso
    m=new THREE.Mesh(new THREE.BoxGeometry(.42,.5,.22),suitMat); m.position.y=1.15; g.add(m);

    // Dealer vest
    if(type==='dealer'){m=new THREE.Mesh(new THREE.BoxGeometry(.2,.12,.01),M.gold);m.position.set(0,1.35,.12);g.add(m);}

    // Head
    m=new THREE.Mesh(new THREE.BoxGeometry(.24,.28,.24),skinMat);m.position.y=1.58;g.add(m);

    // Eyes
    [-0.06,0.06].forEach(function(s){m=new THREE.Mesh(new THREE.BoxGeometry(.03,.025,.01),M.black);m.position.set(s,1.6,.13);g.add(m);});

    // Hair
    if(opts.hairStyle==='short'){
      m=new THREE.Mesh(new THREE.BoxGeometry(.26,.08,.26),hairMat);m.position.y=1.76;g.add(m);
      m=new THREE.Mesh(new THREE.BoxGeometry(.26,.15,.06),hairMat);m.position.set(0,1.65,-.13);g.add(m);
    } else if(opts.hairStyle==='slick'){
      m=new THREE.Mesh(new THREE.BoxGeometry(.26,.06,.3),hairMat);m.position.set(0,1.75,-.02);g.add(m);
    }

    // Bouncer shoulders + earpiece
    if(type==='bouncer'){
      [-0.28,0.28].forEach(function(s){m=new THREE.Mesh(new THREE.BoxGeometry(.16,.1,.2),suitMat);m.position.set(s,1.38,0);g.add(m);});
      m=new THREE.Mesh(new THREE.BoxGeometry(.04,.04,.04),M.black);m.position.set(-.14,1.6,0);g.add(m);
      m=new THREE.Mesh(new THREE.BoxGeometry(.01,.15,.01),M.black);m.position.set(-.14,1.45,-.04);g.add(m);
    }

    // Arms + hands — grouped around shoulder pivot so rotation swings like a real arm
    [-0.28,0.28].forEach(function(s){
      var armG=new THREE.Group();
      armG.name='arm';
      armG.position.set(s,1.18,0);
      var upper=new THREE.Mesh(new THREE.BoxGeometry(.1,.42,.1),suitMat);
      upper.position.y=-.23; armG.add(upper);
      var hand=new THREE.Mesh(new THREE.BoxGeometry(.08,.07,.08),skinMat);
      hand.position.y=-.47; armG.add(hand);
      g.add(armG);
    });

    // Legs — grouped around hip pivot
    [-0.08,0.08].forEach(function(s){
      var legG=new THREE.Group();
      legG.name='leg';
      legG.position.set(s,.71,0);
      var thigh=new THREE.Mesh(new THREE.BoxGeometry(.13,.48,.13),suitDark);
      thigh.position.y=-.24; legG.add(thigh);
      var shoe=new THREE.Mesh(new THREE.BoxGeometry(.14,.06,.18),M.black);
      shoe.position.set(0,-.68,.02); legG.add(shoe);
      g.add(legG);
    });

    g.traverse(function(c){if(c.isMesh)c.castShadow=true;});
    return g;
  }
};

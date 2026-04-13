// ═══════════════════════════════════════
// FURNITURE — Luxury Casino v3
// Chandelier, red carpet, warm atmosphere
// ═══════════════════════════════════════

RL.furniture = {
  build() {
    RL.load(35,'Furnishing casino...');
    var S=RL.scene, M=RL.M;

    RL.load(38,'Grand chandelier...');

    // ═══ GRAND CHANDELIER ═══
    var ch = new THREE.Group();
    // Main ring (gold, ornate)
    var chRing = new THREE.Mesh(new THREE.TorusGeometry(3,.12,8,32), M.gold);
    chRing.rotation.x=Math.PI/2; ch.add(chRing);
    // Inner ring
    var chRing2 = new THREE.Mesh(new THREE.TorusGeometry(1.8,.08,8,24), M.gold);
    chRing2.rotation.x=Math.PI/2; ch.add(chRing2);
    // Tiny inner ring
    var chRing3 = new THREE.Mesh(new THREE.TorusGeometry(.8,.06,8,16), M.gold);
    chRing3.rotation.x=Math.PI/2; ch.add(chRing3);

    // Connecting spokes (gold)
    for(var i=0;i<8;i++){
      var a=(i/8)*Math.PI*2;
      var spoke = new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,3.2,4), M.gold);
      spoke.rotation.z=Math.PI/2;
      spoke.rotation.y=a;
      spoke.position.set(Math.cos(a)*1.5,0,Math.sin(a)*1.5);
      ch.add(spoke);
    }

    // Crystal drops (bright reflective)
    var crystalMat = new THREE.MeshStandardMaterial({color:0xffffff,roughness:.05,metalness:.8,transparent:true,opacity:.7});
    for(var ring=0;ring<3;ring++){
      var r=[3,1.8,.8][ring];
      var count=[16,10,6][ring];
      for(var i=0;i<count;i++){
        var a=(i/count)*Math.PI*2;
        var crystal = new THREE.Mesh(new THREE.ConeGeometry(.06,.35,4), crystalMat);
        crystal.position.set(Math.cos(a)*r,-(.3+ring*.15),Math.sin(a)*r);
        crystal.rotation.x=Math.PI;
        ch.add(crystal);
      }
    }

    // Warm lights on chandelier
    for(var i=0;i<8;i++){
      var a=(i/8)*Math.PI*2;
      var cl = new THREE.PointLight(0xffeedd,.8,18);
      cl.position.set(Math.cos(a)*2.5,-.2,Math.sin(a)*2.5);
      ch.add(cl);
      // Visible bulb
      var bulb = new THREE.Mesh(new THREE.SphereGeometry(.06,8,8), new THREE.MeshBasicMaterial({color:0xfff5e0}));
      bulb.position.copy(cl.position);
      ch.add(bulb);
    }
    // Center light
    var chCenter = new THREE.PointLight(0xffeedd,2,25);
    chCenter.position.y=-.1; ch.add(chCenter);
    var chBulb = new THREE.Mesh(new THREE.SphereGeometry(.1,8,8), new THREE.MeshBasicMaterial({color:0xfff5e0}));
    chBulb.position.y=-.1; ch.add(chBulb);

    // Ceiling chain
    var chain = new THREE.Mesh(new THREE.CylinderGeometry(.02,.02,3,4), M.gold);
    chain.position.y=1.5; ch.add(chain);

    ch.position.set(0,13,0);
    S.add(ch);
    RL._chandelier = ch;

    RL.load(48,'Setting the vibe...');

    // No hardcoded tables/slots/booth - place everything via Build Mode
    RL.load(65,'Ready!');
  },

  _label(text,x,y,z,color){
    var c=document.createElement('canvas');c.width=512;c.height=64;
    var ctx=c.getContext('2d');
    ctx.fillStyle=color||'#d4a843';ctx.font='700 28px sans-serif';ctx.textAlign='center';
    ctx.shadowColor=color||'#d4a843';ctx.shadowBlur=15;
    ctx.fillText(text,256,44);
    var sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true}));
    sprite.scale.set(4,.6,1);sprite.position.set(x,y,z);RL.scene.add(sprite);
  },

  makeSlot(){
    var g=new THREE.Group(),M=RL.M;
    g.userData.type='slot';
    var body=new THREE.Mesh(new THREE.BoxGeometry(1,2,.8),M.slotBody);body.position.y=1.3;body.castShadow=true;g.add(body);
    var top2=new THREE.Mesh(new THREE.CylinderGeometry(.5,.5,.8,8,1,false,0,Math.PI),M.slotBody);top2.rotation.z=Math.PI/2;top2.rotation.y=Math.PI/2;top2.position.y=2.3;g.add(top2);
    var rc=document.createElement('canvas');rc.width=160;rc.height=100;var rx=rc.getContext('2d');rx.fillStyle='#080c14';rx.fillRect(0,0,160,100);
    rx.font='32px sans-serif';rx.textAlign='center';
    ['\u{1F48E}','7\ufe0f\u20e3','\u2b50'].forEach(function(s,i){rx.fillText(s,28+i*52,60);});
    var screen2=new THREE.Mesh(new THREE.PlaneGeometry(.75,.5),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(rc)}));screen2.position.set(0,1.6,.41);g.add(screen2);
    [1.0,1.9,2.2].forEach(function(y){var t=new THREE.Mesh(new THREE.BoxGeometry(1.05,.04,.85),M.chrome);t.position.y=y;g.add(t);});
    var acc=new THREE.Mesh(new THREE.BoxGeometry(1.06,.02,.86),M.gold);acc.position.y=2.35;g.add(acc);
    var lever=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,.7,6),M.chrome);lever.position.set(.55,1.6,.2);lever.rotation.z=.2;g.add(lever);
    var knob=new THREE.Mesh(new THREE.SphereGeometry(.07,8,8),M.gold);knob.position.set(.62,1.92,.2);g.add(knob);
    var stPole=new THREE.Mesh(new THREE.CylinderGeometry(.03,.03,.7,6),M.chrome);stPole.position.set(0,.35,.9);g.add(stPole);
    var stSeat=new THREE.Mesh(new THREE.CylinderGeometry(.2,.17,.08,10),M.velvet);stSeat.position.set(0,.72,.9);g.add(stSeat);
    var glow2=new THREE.Mesh(new THREE.BoxGeometry(.7,.02,.01),M.neonGreen);glow2.position.set(0,1.32,.41);g.add(glow2);
    var base=new THREE.Mesh(new THREE.BoxGeometry(1.1,.2,.9),M.marbleDark);base.position.y=.1;g.add(base);
    return g;
  },

  makeRoulette(){
    var g=new THREE.Group(),M=RL.M;g.userData.type='roulette';
    var body=new THREE.Mesh(new THREE.CylinderGeometry(1.4,1.5,.18,32),M.mahogany);body.position.y=.88;body.castShadow=true;g.add(body);
    for(var i=0;i<4;i++){var a=(i/4)*Math.PI*2+Math.PI/4;var leg=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,.82,6),M.chrome);leg.position.set(Math.cos(a)*.9,.41,Math.sin(a)*.9);g.add(leg);}
    var felt=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.3,.02,32),M.feltGreen);felt.position.y=.98;g.add(felt);
    var wheel=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,.1,24),M.gold);wheel.position.y=1.02;wheel.name='wheel';g.add(wheel);
    var wRim=new THREE.Mesh(new THREE.TorusGeometry(.45,.035,8,24),M.mahogany);wRim.rotation.x=Math.PI/2;wRim.position.y=1.02;g.add(wRim);
    for(var i=0;i<14;i++){var a=(i/14)*Math.PI*2;var pk=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.035,6),i%2?M.rouletteRed:M.black);pk.position.set(Math.cos(a)*.36,1.03,Math.sin(a)*.36);g.add(pk);}
    var bet=new THREE.Mesh(new THREE.BoxGeometry(1.6,.14,1.2),M.feltGreen);bet.position.set(1.4,.89,0);g.add(bet);
    var betR=new THREE.Mesh(new THREE.BoxGeometry(1.65,.16,1.25),M.mahogany);betR.position.set(1.4,.86,0);g.add(betR);
    var gRail=new THREE.Mesh(new THREE.TorusGeometry(1.4,.03,8,32),M.gold);gRail.rotation.x=Math.PI/2;gRail.position.y=.97;g.add(gRail);
    return g;
  },

  makeBlackjack(){
    var g=new THREE.Group(),M=RL.M;g.userData.type='blackjack';
    var shape=new THREE.Shape();shape.absarc(0,0,1.6,0,Math.PI,false);shape.lineTo(-1.6,0);
    var tGeo=new THREE.ExtrudeGeometry(shape,{depth:.14,bevelEnabled:false});
    var table=new THREE.Mesh(tGeo,M.feltGreen);table.rotation.x=-Math.PI/2;table.position.y=.9;table.castShadow=true;g.add(table);
    var rGeo=new THREE.ExtrudeGeometry(shape,{depth:.18,bevelEnabled:false});
    var rim=new THREE.Mesh(rGeo,M.mahogany);rim.rotation.x=-Math.PI/2;rim.position.y=.86;g.add(rim);
    for(var i=0;i<4;i++){var a=(i/5)*Math.PI+Math.PI/10;var leg=new THREE.Mesh(new THREE.CylinderGeometry(.05,.07,.84,6),M.chrome);leg.position.set(Math.cos(a)*1.2,.43,Math.sin(a)*-.4);g.add(leg);}
    var tray=new THREE.Mesh(new THREE.BoxGeometry(.8,.015,.35),M.gold);tray.position.set(0,.98,-.15);g.add(tray);
    for(var i=0;i<5;i++){var a=(i/6)*Math.PI+Math.PI/6;var spot=new THREE.Mesh(new THREE.RingGeometry(.13,.16,16),new THREE.MeshBasicMaterial({color:0xd4a843,transparent:true,opacity:.35}));spot.rotation.x=-Math.PI/2;spot.position.set(Math.cos(a)*1.2,.99,Math.sin(a)*.7);g.add(spot);}
    return g;
  },

  makeBooth(){
    var g=new THREE.Group(),M=RL.M;g.userData.type='booth';
    var body=new THREE.Mesh(new THREE.BoxGeometry(3,1.3,1.4),M.mahogany);body.position.y=.65;body.castShadow=true;g.add(body);
    var top2=new THREE.Mesh(new THREE.BoxGeometry(3.1,.06,1.5),M.marbleLight);top2.position.y=1.34;g.add(top2);
    var trim=new THREE.Mesh(new THREE.BoxGeometry(3.12,.03,1.52),M.gold);trim.position.y=1.3;g.add(trim);
    var sc=document.createElement('canvas');sc.width=256;sc.height=64;var sx=sc.getContext('2d');
    sx.fillStyle='#d4a843';sx.font='bold 24px sans-serif';sx.textAlign='center';sx.fillText('\u25c6 CASHIER \u25c6',128,42);
    var sign=new THREE.Mesh(new THREE.PlaneGeometry(2.5,.6),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(sc),transparent:true}));
    sign.position.set(0,1.7,.71);g.add(sign);
    return g;
  },
};

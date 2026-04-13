// ═══════════════════════════════════════
// HOT & COLD — Duel Arena style
// 3D scene: custom planter character + real flower models
// Bet types: hot/cold, rainbow, assorted, BNW, black, white, individual colors
// ═══════════════════════════════════════

(function(){
  var root = null;
  var state = {
    balance: 100000,
    bet: 100,
    pickKey: null,     // selected bet key
    spinning: false,
    history: [],
    serverSeed: null,
    serverSeedHash: null,
    clientSeed: '',
    nonce: 0,
    revealedSeed: null,
  };

  // Flowers — weights tuned for fair hot/cold and long-shot rares
  var FLOWERS = [
    {key:'red',     name:'Red',     color:'#ff2244', weight:16, model:'red_rose'},
    {key:'orange',  name:'Orange',  color:'#ff7820', weight:16, model:'colored_flower'},
    {key:'yellow',  name:'Yellow',  color:'#f0c94d', weight:16, model:'geranium_flower'},
    {key:'blue',    name:'Blue',    color:'#3b82f6', weight:15, model:'colored_flower'},
    {key:'purple',  name:'Purple',  color:'#a060ff', weight:15, model:'red_rose'},
    {key:'pastel',  name:'Pastel',  color:'#ff99cc', weight:15, model:'geranium_flower'},
    {key:'rainbow', name:'Rainbow', color:'#ffffff', weight:3.0,model:'colored_flower'},
    {key:'assorted',name:'Assorted',color:'#ffd0a0', weight:2.5,model:'red_rose'},
    {key:'black',   name:'Black',   color:'#0a0a0a', weight:0.3,model:'red_rose'},
    {key:'white',   name:'White',   color:'#ffffff', weight:0.2,model:'colored_flower'},
  ];

  // Bet types and their winning conditions
  var BETS = {
    hot:     {label:'HOT',      sub:'Red · Orange · Yellow', pay:2,    wins:['red','orange','yellow']},
    cold:    {label:'COLD',     sub:'Blue · Purple · Pastel',pay:2.1,  wins:['blue','purple','pastel']},
    rainbow: {label:'RAINBOW',  sub:'',                       pay:5.5,  wins:['rainbow']},
    assorted:{label:'ASSORTED', sub:'',                       pay:8,    wins:['assorted']},
    bnw:     {label:'BNW',      sub:'Black or White',         pay:135,  wins:['black','white']},
    black:   {label:'BLACK',    sub:'',                       pay:200,  wins:['black']},
    white:   {label:'WHITE',    sub:'',                       pay:400,  wins:['white']},
    red:     {label:'RED',      sub:'',                       pay:5.5,  wins:['red']},
    orange:  {label:'ORANGE',   sub:'',                       pay:5.5,  wins:['orange']},
    yellow:  {label:'YELLOW',   sub:'',                       pay:5.5,  wins:['yellow']},
    blue:    {label:'BLUE',     sub:'',                       pay:5.5,  wins:['blue']},
    purple:  {label:'PURPLE',   sub:'',                       pay:5.5,  wins:['purple']},
  };

  // ─── Provably fair ───
  function randomHex(n){var a=new Uint8Array(n);crypto.getRandomValues(a);return Array.from(a).map(function(b){return b.toString(16).padStart(2,'0')}).join('')}
  function sha256Hex(m){var e=new TextEncoder();return crypto.subtle.digest('SHA-256',e.encode(m)).then(function(b){return Array.from(new Uint8Array(b)).map(function(x){return x.toString(16).padStart(2,'0')}).join('')})}
  function hmacHex(k,m){var e=new TextEncoder();return crypto.subtle.importKey('raw',e.encode(k),{name:'HMAC',hash:'SHA-256'},false,['sign']).then(function(key){return crypto.subtle.sign('HMAC',key,e.encode(m))}).then(function(s){return Array.from(new Uint8Array(s)).map(function(x){return x.toString(16).padStart(2,'0')}).join('')})}
  function newSeed(){
    state.serverSeed=randomHex(32);
    return sha256Hex(state.serverSeed).then(function(h){state.serverSeedHash=h;state.revealedSeed=null;updatePF()});
  }

  function pickFlowerIdx(roll){
    var total = FLOWERS.reduce(function(s,f){return s+f.weight},0);
    var r = roll * total;
    var acc = 0;
    for(var i=0; i<FLOWERS.length; i++){
      acc += FLOWERS[i].weight;
      if(r < acc) return i;
    }
    return FLOWERS.length-1;
  }

  // ─── 3D Scene ───
  var s3 = {
    renderer:null, scene:null, camera:null,
    planter:null, planterParts:null,
    flowerModels:{}, currentFlower:null, extraFlowers:[],
    particles:[], particleGroup:null,
    animFrame:null, ready:false,
    plantAnimT:-1, idleT:0,
    flowerSpawnT:-1, currentFlowerKey:null, baseFlowerScale:0,
    soilPos:null, seedMesh:null,
  };

  function buildPlanter(){
    var THREE = window.THREE;
    var group = new THREE.Group();

    var skin  = new THREE.MeshStandardMaterial({color:0xf0c090, roughness:0.8});
    var shirt = new THREE.MeshStandardMaterial({color:0x2a5fa0, roughness:0.7});
    var pants = new THREE.MeshStandardMaterial({color:0x2a1810, roughness:0.9});
    var hair  = new THREE.MeshStandardMaterial({color:0x3a1f10, roughness:0.85});
    var eyes  = new THREE.MeshBasicMaterial({color:0x0a0a0a});

    // Torso (body group — children will rotate with bend)
    var body = new THREE.Group();
    body.position.y = 0.95;
    group.add(body);

    var torso = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.20, 0.45, 12), shirt);
    torso.castShadow = true;
    body.add(torso);

    // Head
    var headGroup = new THREE.Group();
    headGroup.position.y = 0.35;
    body.add(headGroup);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), skin);
    head.castShadow = true;
    headGroup.add(head);
    // Hair cap
    var hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.165, 16, 12, 0, Math.PI*2, 0, Math.PI*0.55), hair);
    hairCap.position.y = 0.01;
    headGroup.add(hairCap);
    // Eyes facing +Z (forward)
    var le = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), eyes);
    le.position.set(-0.055, 0.01, 0.14);
    headGroup.add(le);
    var re = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 8), eyes);
    re.position.set(0.055, 0.01, 0.14);
    headGroup.add(re);
    // Smile
    var mouth = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 12, Math.PI), new THREE.MeshBasicMaterial({color:0x401010}));
    mouth.position.set(0, -0.05, 0.14);
    mouth.rotation.x = Math.PI;
    headGroup.add(mouth);

    // Arms — groups pivot at shoulder
    var leftArm = new THREE.Group();
    leftArm.position.set(-0.22, 0.18, 0);
    body.add(leftArm);
    var lUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.22, 8), shirt);
    lUpper.position.y = -0.11;
    lUpper.castShadow = true;
    leftArm.add(lUpper);
    var lForearm = new THREE.Group();
    lForearm.position.y = -0.22;
    leftArm.add(lForearm);
    var lFmesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.22, 8), skin);
    lFmesh.position.y = -0.11;
    lFmesh.castShadow = true;
    lForearm.add(lFmesh);
    var lHand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), skin);
    lHand.position.y = -0.24;
    lForearm.add(lHand);

    var rightArm = new THREE.Group();
    rightArm.position.set(0.22, 0.18, 0);
    body.add(rightArm);
    var rUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.22, 8), shirt);
    rUpper.position.y = -0.11;
    rUpper.castShadow = true;
    rightArm.add(rUpper);
    var rForearm = new THREE.Group();
    rForearm.position.y = -0.22;
    rightArm.add(rForearm);
    var rFmesh = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.22, 8), skin);
    rFmesh.position.y = -0.11;
    rFmesh.castShadow = true;
    rForearm.add(rFmesh);
    var rHand = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), skin);
    rHand.position.y = -0.24;
    rForearm.add(rHand);

    // Legs (don't bend with body)
    var leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.5, 10), pants);
    leftLeg.position.set(-0.1, 0.5, 0);
    leftLeg.castShadow = true;
    group.add(leftLeg);
    var rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.5, 10), pants);
    rightLeg.position.set(0.1, 0.5, 0);
    rightLeg.castShadow = true;
    group.add(rightLeg);

    // Boots
    var bootMat = new THREE.MeshStandardMaterial({color:0x1a0f08, roughness:0.9});
    var lBoot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.18), bootMat);
    lBoot.position.set(-0.1, 0.235, 0.03);
    lBoot.castShadow = true;
    group.add(lBoot);
    var rBoot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.18), bootMat);
    rBoot.position.set(0.1, 0.235, 0.03);
    rBoot.castShadow = true;
    group.add(rBoot);

    // Seed (held during planting anim)
    var seed = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 8, 8),
      new THREE.MeshStandardMaterial({color:0x88ccff, emissive:0x4488cc, emissiveIntensity:0.5, metalness:0.6, roughness:0.3})
    );
    seed.visible = false;
    group.add(seed);

    return {
      root: group,
      body: body,
      head: headGroup,
      leftArm: leftArm,
      rightArm: rightArm,
      lForearm: lForearm,
      rForearm: rForearm,
      lHand: lHand,
      rHand: rHand,
      seed: seed,
    };
  }

  function init3D(canvas){
    var THREE = window.THREE;
    if(!THREE || !THREE.GLTFLoader){ return; }

    var w = canvas.clientWidth || 600;
    var h = canvas.clientHeight || 360;

    s3.renderer = new THREE.WebGLRenderer({canvas:canvas, antialias:true, alpha:true});
    s3.renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
    s3.renderer.setSize(w, h, false);
    s3.renderer.shadowMap.enabled = true;
    s3.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    s3.scene = new THREE.Scene();
    s3.scene.fog = new THREE.Fog(0x140820, 7, 18);

    s3.camera = new THREE.PerspectiveCamera(38, w/h, 0.1, 100);
    s3.camera.position.set(0, 1.6, 4.2);
    s3.camera.lookAt(0, 0.9, 0);

    // Lights
    var hemi = new THREE.HemisphereLight(0xffd0e0, 0x402030, 0.55);
    s3.scene.add(hemi);
    var key = new THREE.DirectionalLight(0xffeecc, 1.2);
    key.position.set(2.5, 5, 3.5);
    key.castShadow = true;
    key.shadow.mapSize.set(1024,1024);
    key.shadow.camera.near=0.5; key.shadow.camera.far=20;
    key.shadow.camera.left=-4; key.shadow.camera.right=4;
    key.shadow.camera.top=4; key.shadow.camera.bottom=-4;
    s3.scene.add(key);
    var rim = new THREE.DirectionalLight(0x8090ff, 0.5);
    rim.position.set(-2, 2, -3);
    s3.scene.add(rim);

    // Ground
    var grassGeo = new THREE.CircleGeometry(4.5, 48);
    var grassMat = new THREE.MeshStandardMaterial({color:0x2a4020, roughness:0.95});
    var grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI/2;
    grass.receiveShadow = true;
    s3.scene.add(grass);

    // Soil patch (in front of character, facing camera)
    var soilGeo = new THREE.CircleGeometry(0.45, 24);
    var soilMat = new THREE.MeshStandardMaterial({color:0x3a2010, roughness:1});
    var soil = new THREE.Mesh(soilGeo, soilMat);
    soil.rotation.x = -Math.PI/2;
    soil.position.set(0, 0.005, 0.85);
    soil.receiveShadow = true;
    s3.scene.add(soil);
    s3.soilPos = soil.position.clone();

    // Stones around soil
    for(var i=0; i<10; i++){
      var ang = (i/10) * Math.PI * 2;
      var stone = new THREE.Mesh(
        new THREE.SphereGeometry(0.06 + Math.random()*0.03, 6, 6),
        new THREE.MeshStandardMaterial({color:0x555555, roughness:0.9})
      );
      stone.position.set(Math.cos(ang)*0.5, 0.04, 0.85 + Math.sin(ang)*0.5);
      stone.castShadow = true;
      s3.scene.add(stone);
    }

    // Particle group
    s3.particleGroup = new THREE.Group();
    s3.scene.add(s3.particleGroup);

    // Build planter
    var p = buildPlanter();
    p.root.position.set(0, 0, -0.15);
    // Faces +Z (toward camera & soil) by default
    s3.scene.add(p.root);
    s3.planter = p.root;
    s3.planterParts = p;

    // Load flower models
    var loader = new THREE.GLTFLoader();
    var loaded = 0, total = 3;
    function checkReady(){ if(++loaded >= total) s3.ready = true; }

    var flowerNames = ['red_rose','colored_flower','geranium_flower'];
    flowerNames.forEach(function(name){
      loader.load('models/'+name+'/scene.gltf', function(gltf){
        var f = gltf.scene;
        var box = new THREE.Box3().setFromObject(f);
        var sz = new THREE.Vector3(); box.getSize(sz);
        var s = 0.7 / Math.max(sz.y, 0.001);
        f.scale.setScalar(s);
        box.setFromObject(f);
        f.position.y = -box.min.y;
        f.traverse(function(c){if(c.isMesh){c.castShadow=true;}});
        s3.flowerModels[name] = f;
        checkReady();
      }, undefined, function(){checkReady();});
    });

    // Render loop
    function loop(){
      s3.animFrame = requestAnimationFrame(loop);
      tick3D();
      if(s3.renderer && s3.scene && s3.camera){
        s3.renderer.render(s3.scene, s3.camera);
      }
    }
    loop();
  }

  function tick3D(){
    var t = performance.now() / 1000;
    var dt = 0.016;
    s3.idleT += dt;

    // Planter animation
    if(s3.planterParts){
      var pp = s3.planterParts;
      if(s3.plantAnimT >= 0){
        var elapsed = t - s3.plantAnimT;
        var dur = 3.4;
        if(elapsed < dur){
          var bend = 0, armLift = 0, armForward = 0, forearmBend = 0, dig = 0, seedShow = false;
          if(elapsed < 0.5){
            // Raise hands up with seed
            var p1 = elapsed / 0.5;
            armLift = -p1 * 1.6;
            seedShow = true;
          } else if(elapsed < 1.0){
            // Bend forward
            var p2 = (elapsed - 0.5) / 0.5;
            bend = p2 * 0.9;
            armLift = -1.6 + p2 * 1.6;
            armForward = p2 * 0.5;
            forearmBend = p2 * -0.4;
            seedShow = true;
          } else if(elapsed < 1.5){
            // Hands down to soil, dig
            var p3 = (elapsed - 1.0) / 0.5;
            bend = 0.9 + p3 * 0.3;
            armLift = p3 * 0.4;
            armForward = 0.5 + p3 * 0.3;
            forearmBend = -0.4 + p3 * -0.3;
            dig = Math.sin(p3 * Math.PI * 3) * 0.15;
            seedShow = p3 < 0.5;
          } else if(elapsed < 2.4){
            // Dig motion (back and forth)
            var p4 = (elapsed - 1.5) / 0.9;
            bend = 1.2;
            armLift = 0.4;
            armForward = 0.8;
            forearmBend = -0.7;
            dig = Math.sin(p4 * Math.PI * 4) * 0.18;
          } else {
            // Stand back up
            var p5 = (elapsed - 2.4) / 1.0;
            if(p5 > 1) p5 = 1;
            var inv = 1 - p5;
            bend = 1.2 * inv;
            armLift = 0.4 * inv;
            armForward = 0.8 * inv;
            forearmBend = -0.7 * inv;
          }
          pp.body.rotation.x = bend;
          pp.leftArm.rotation.x = armLift + armForward + dig;
          pp.rightArm.rotation.x = armLift + armForward - dig;
          pp.lForearm.rotation.x = forearmBend;
          pp.rForearm.rotation.x = forearmBend;
          // Seed visibility & position
          pp.seed.visible = seedShow;
          if(seedShow){
            // Position seed at the world location of the hands
            var handWorld = new window.THREE.Vector3();
            pp.lHand.getWorldPosition(handWorld);
            s3.planter.worldToLocal(handWorld);
            // Average two hands
            var rh = new window.THREE.Vector3();
            pp.rHand.getWorldPosition(rh);
            s3.planter.worldToLocal(rh);
            pp.seed.position.copy(handWorld).add(rh).multiplyScalar(0.5);
          }
        } else {
          pp.body.rotation.x = 0;
          pp.leftArm.rotation.x = 0;
          pp.rightArm.rotation.x = 0;
          pp.lForearm.rotation.x = 0;
          pp.rForearm.rotation.x = 0;
          pp.seed.visible = false;
          s3.plantAnimT = -1;
        }
      } else {
        // Idle: gentle breathing
        var br = Math.sin(s3.idleT * 1.6) * 0.02;
        pp.body.scale.y = 1 + br;
        pp.body.rotation.x = Math.sin(s3.idleT * 0.8) * 0.02;
        pp.head.rotation.y = Math.sin(s3.idleT * 0.3) * 0.15;
      }
    }

    // Flower growth + special effects
    if(s3.currentFlower && s3.flowerSpawnT >= 0){
      var fe = t - s3.flowerSpawnT;
      var growDur = 1.0;
      if(fe < growDur){
        var p = fe / growDur;
        var e = 1 - Math.pow(2, -10*p) * Math.cos((p*10 - 0.75) * (2*Math.PI/3));
        if(e < 0) e = 0;
        s3.currentFlower.scale.setScalar(s3.baseFlowerScale * e);
        s3.currentFlower.rotation.y = p * Math.PI * 2;
      } else {
        s3.currentFlower.scale.setScalar(s3.baseFlowerScale);
        s3.currentFlower.rotation.y = Math.sin(t * 0.8) * 0.15;
      }
      // Special: rainbow hue cycling
      if(s3.currentFlowerKey === 'rainbow'){
        var hue = (t * 0.5) % 1;
        var col = new window.THREE.Color();
        col.setHSL(hue, 0.95, 0.55);
        s3.currentFlower.traverse(function(c){
          if(c.isMesh && c.material && c.material.color){
            c.material.color.copy(col);
            if(c.material.emissive) c.material.emissive.copy(col).multiplyScalar(0.25);
          }
        });
      }
      // Special: black/white pulsing glow
      if(s3.currentFlowerKey === 'white' || s3.currentFlowerKey === 'black'){
        var pulse = 0.4 + Math.sin(t * 4) * 0.2;
        s3.currentFlower.traverse(function(c){
          if(c.isMesh && c.material && c.material.emissive){
            var base = s3.currentFlowerKey === 'white' ? 0xffffff : 0xffd700;
            c.material.emissive.set(base).multiplyScalar(pulse);
          }
        });
      }
    }
    // Extra flowers (assorted)
    s3.extraFlowers.forEach(function(ef, i){
      ef.rotation.y = Math.sin(t * 0.7 + i) * 0.2;
    });

    // Particles
    for(var i=s3.particles.length-1; i>=0; i--){
      var pp2 = s3.particles[i];
      pp2.life -= dt;
      if(pp2.life <= 0){
        s3.particleGroup.remove(pp2.mesh);
        s3.particles.splice(i,1);
        continue;
      }
      pp2.vy -= 0.012;
      pp2.mesh.position.x += pp2.vx;
      pp2.mesh.position.y += pp2.vy;
      pp2.mesh.position.z += pp2.vz;
      pp2.mesh.scale.setScalar(Math.max(0.1, pp2.life * 1.5));
    }

    // Slow camera drift
    if(s3.camera){
      var ang = Math.sin(t * 0.12) * 0.1;
      s3.camera.position.x = Math.sin(ang) * 4.2;
      s3.camera.position.z = Math.cos(ang) * 4.2;
      s3.camera.lookAt(0, 0.9, 0.3);
    }
  }

  function spawnDirtBurst(){
    var THREE = window.THREE;
    if(!THREE || !s3.soilPos) return;
    for(var i=0; i<22; i++){
      var g = new THREE.SphereGeometry(0.05, 6, 6);
      var m = new THREE.MeshStandardMaterial({color:0x4a2810, roughness:1});
      var mesh = new THREE.Mesh(g, m);
      mesh.position.copy(s3.soilPos);
      mesh.position.y += 0.05;
      var ang = Math.random() * Math.PI * 2;
      var spd = 0.025 + Math.random() * 0.04;
      s3.particleGroup.add(mesh);
      s3.particles.push({
        mesh:mesh,
        vx:Math.cos(ang)*spd, vy:0.09+Math.random()*0.06, vz:Math.sin(ang)*spd,
        life:1.0,
      });
    }
  }

  function spawnSparkles(color){
    var THREE = window.THREE;
    if(!THREE || !s3.soilPos) return;
    var col = new THREE.Color(color);
    for(var i=0; i<24; i++){
      var g = new THREE.SphereGeometry(0.04, 6, 6);
      var m = new THREE.MeshBasicMaterial({color:col});
      var mesh = new THREE.Mesh(g, m);
      mesh.position.copy(s3.soilPos);
      mesh.position.y += 0.3;
      var ang = Math.random() * Math.PI * 2;
      var spd = 0.04 + Math.random() * 0.05;
      s3.particleGroup.add(mesh);
      s3.particles.push({
        mesh:mesh,
        vx:Math.cos(ang)*spd, vy:0.06+Math.random()*0.08, vz:Math.sin(ang)*spd,
        life:1.4,
      });
    }
  }

  function tintFlower(clone, color, emissiveStrength){
    var THREE = window.THREE;
    var tint = new THREE.Color(color);
    clone.traverse(function(c){
      if(c.isMesh && c.material){
        var mats = Array.isArray(c.material) ? c.material : [c.material];
        c.material = mats.map(function(m){
          var nm = m.clone();
          if(nm.color) nm.color.copy(tint);
          if(nm.emissive) nm.emissive.copy(tint).multiplyScalar(emissiveStrength || 0.15);
          return nm;
        });
        if(c.material.length === 1) c.material = c.material[0];
      }
    });
  }

  function clearFlower(){
    if(s3.currentFlower){
      s3.scene.remove(s3.currentFlower);
      s3.currentFlower = null;
    }
    s3.extraFlowers.forEach(function(f){s3.scene.remove(f);});
    s3.extraFlowers = [];
  }

  function showFlower(idx){
    var THREE = window.THREE;
    if(!THREE || !s3.ready) return;
    var f = FLOWERS[idx];
    var src = s3.flowerModels[f.model];
    if(!src) return;

    clearFlower();

    if(f.key === 'assorted'){
      // 3 small flowers in triangle
      var colors = ['#ff2244','#3b82f6','#f0c94d'];
      var modelKeys = ['red_rose','colored_flower','geranium_flower'];
      for(var i=0; i<3; i++){
        var src2 = s3.flowerModels[modelKeys[i]];
        if(!src2) continue;
        var c = src2.clone(true);
        var ang = (i/3) * Math.PI * 2;
        c.position.set(Math.cos(ang)*0.18, s3.soilPos.y + 0.02, s3.soilPos.z + Math.sin(ang)*0.18);
        c.scale.setScalar(src2.scale.x * 0.7);
        tintFlower(c, colors[i], 0.2);
        s3.scene.add(c);
        s3.extraFlowers.push(c);
      }
      // Use first as "current" for growth tracking
      s3.currentFlower = s3.extraFlowers[0];
      s3.baseFlowerScale = s3.extraFlowers[0].scale.x;
    } else {
      var clone = src.clone(true);
      clone.position.set(0, s3.soilPos.y + 0.02, s3.soilPos.z);
      var emissive = (f.key === 'rainbow' || f.key === 'white' || f.key === 'black') ? 0.4 : 0.15;
      tintFlower(clone, f.color, emissive);
      s3.scene.add(clone);
      s3.currentFlower = clone;
      s3.baseFlowerScale = src.scale.x;
      clone.scale.setScalar(0);
    }
    s3.currentFlowerKey = f.key;
    s3.flowerSpawnT = performance.now() / 1000;

    // Sparkles for rare flowers
    if(['rainbow','black','white','assorted','bnw'].indexOf(f.key) >= 0){
      spawnSparkles(f.color === '#0a0a0a' ? '#ffd700' : f.color);
    }
  }

  // ─── UI ───
  function build(){
    root = document.createElement('div');
    root.id = 'hcRoot';
    var betsHtml = '';
    function btn(key, cls){
      var b = BETS[key];
      cls = cls || '';
      return '<button class="hc-bet '+cls+'" data-key="'+key+'">'
        + '<div class="hc-bet-label">'+b.label+'</div>'
        + (b.sub ? '<div class="hc-bet-sub">'+b.sub+'</div>' : '')
        + '<div class="hc-bet-pay">'+b.pay+'×</div>'
        + '</button>';
    }
    root.innerHTML =
      '<div class="hc-topbar">'
      +   '<button class="hc-close" title="Close">\u2715</button>'
      +   '<div class="hc-title"><b>RUNE</b><i>LUCK</i><span>HOT &amp; COLD</span></div>'
      +   '<div class="hc-balance">GP: <span id="hcBal">100,000</span></div>'
      + '</div>'
      + '<div class="hc-body">'
      +   '<div class="hc-main">'
      +     '<div class="hc-stage">'
      +       '<canvas id="hcScene"></canvas>'
      +       '<div class="hc-flower-name" id="hcFlowerName">Pick a bet & plant a seed</div>'
      +     '</div>'
      +     '<div class="hc-bets">'
      +       '<div class="hc-bets-row hc-bets-main">'
      +         btn('hot','hc-hot')
      +         + btn('cold','hc-cold')
      +       '</div>'
      +       '<div class="hc-bets-row">'
      +         btn('rainbow','hc-rare')
      +         + btn('assorted','hc-rare')
      +         + btn('bnw','hc-jp')
      +         + btn('black','hc-jp')
      +         + btn('white','hc-jp')
      +       '</div>'
      +       '<div class="hc-bets-row">'
      +         btn('red','hc-c-red')
      +         + btn('orange','hc-c-orange')
      +         + btn('yellow','hc-c-yellow')
      +         + btn('blue','hc-c-blue')
      +         + btn('purple','hc-c-purple')
      +       '</div>'
      +     '</div>'
      +     '<div class="hc-controls">'
      +       '<div class="hc-bet-row">'
      +         '<label>Bet</label>'
      +         '<input type="number" id="hcBet" value="100" min="1">'
      +         '<button class="hc-sm" onclick="RL.hotcold._half()">½</button>'
      +         '<button class="hc-sm" onclick="RL.hotcold._dbl()">2×</button>'
      +         '<button class="hc-sm" onclick="RL.hotcold._max()">Max</button>'
      +       '</div>'
      +       '<button class="hc-pick-btn" id="hcPickBtn">PLANT SEED</button>'
      +     '</div>'
      +     '<div class="hc-result" id="hcResult"></div>'
      +     '<div class="hc-history" id="hcHistory"></div>'
      +   '</div>'
      +   '<div class="hc-pf">'
      +     '<div class="hc-pf-title">\u{1F512} Provably Fair</div>'
      +     '<div class="hc-pf-r"><span>Hash:</span><code id="hcPfHash">—</code></div>'
      +     '<div class="hc-pf-r"><span>Client seed:</span><code id="hcPfClient">—</code></div>'
      +     '<div class="hc-pf-r"><span>Nonce:</span><code id="hcPfNonce">0</code></div>'
      +     '<div class="hc-pf-r"><span>Revealed:</span><code id="hcPfReveal">(hidden)</code></div>'
      +   '</div>'
      + '</div>';
    document.body.appendChild(root);
    root.addEventListener('mousedown',function(e){e.stopPropagation()});
    root.addEventListener('mouseup',function(e){e.stopPropagation()});
    root.addEventListener('click',function(e){e.stopPropagation()});
    root.querySelector('.hc-close').addEventListener('click',close);
    document.getElementById('hcPickBtn').addEventListener('click',spin);
    var bets = root.querySelectorAll('.hc-bet');
    bets.forEach(function(b){
      b.addEventListener('click',function(){
        if(state.spinning) return;
        bets.forEach(function(x){x.classList.remove('selected')});
        b.classList.add('selected');
        state.pickKey = b.dataset.key;
      });
    });
    setTimeout(function(){
      var canvas = document.getElementById('hcScene');
      if(canvas) init3D(canvas);
    }, 50);
    window.addEventListener('resize', resize3D);
  }

  function resize3D(){
    if(!s3.renderer || !root || root.style.display !== 'flex') return;
    var canvas = document.getElementById('hcScene');
    if(!canvas) return;
    var w = canvas.clientWidth, h = canvas.clientHeight;
    s3.renderer.setSize(w, h, false);
    s3.camera.aspect = w / h;
    s3.camera.updateProjectionMatrix();
  }

  function updateBal(){
    document.getElementById('hcBal').textContent = state.balance.toLocaleString();
  }
  function updatePF(){
    var h=document.getElementById('hcPfHash');if(h)h.textContent=state.serverSeedHash?state.serverSeedHash.slice(0,20)+'...':'—';
    var c=document.getElementById('hcPfClient');if(c)c.textContent=state.clientSeed;
    var n=document.getElementById('hcPfNonce');if(n)n.textContent=state.nonce;
    var r=document.getElementById('hcPfReveal');if(r)r.textContent=state.revealedSeed?state.revealedSeed.slice(0,20)+'...':'(hidden)';
  }

  function spin(){
    if(state.spinning) return;
    if(!state.pickKey){
      var res = document.getElementById('hcResult');
      res.textContent = 'Pick a bet first!';
      res.style.color = '#f0c94d';
      return;
    }
    var bet = parseInt(document.getElementById('hcBet').value,10)||0;
    if(bet<=0 || bet>state.balance) return;
    state.bet = bet;
    state.balance -= bet;
    updateBal();
    state.spinning = true;
    document.getElementById('hcResult').textContent = '';
    document.getElementById('hcFlowerName').textContent = 'Planting seed...';
    document.getElementById('hcFlowerName').style.color = '#a07080';
    clearFlower();
    state.nonce++;
    var msg = state.clientSeed+':'+state.nonce;
    hmacHex(state.serverSeed, msg).then(function(hx){
      var roll = (parseInt(hx.slice(0,8),16) % 100000) / 100000;
      var idx = pickFlowerIdx(roll);
      // Start planting animation
      s3.plantAnimT = performance.now() / 1000;
      // Dirt burst when hands hit soil
      setTimeout(function(){ spawnDirtBurst(); playDig(); }, 1500);
      // Flower spawns near end of dig
      setTimeout(function(){
        showFlower(idx);
        var f = FLOWERS[idx];
        var nameEl = document.getElementById('hcFlowerName');
        nameEl.textContent = f.name + ' Flower';
        nameEl.style.color = f.color === '#0a0a0a' ? '#ffd700' : f.color;
      }, 2300);
      // Result after stand-up
      setTimeout(function(){ resolveResult(idx); }, 3500);
    });
  }

  function resolveResult(idx){
    var f = FLOWERS[idx];
    var bet = BETS[state.pickKey];
    var res = document.getElementById('hcResult');
    var won = bet.wins.indexOf(f.key) >= 0;
    if(won){
      var winnings = Math.floor(state.bet * bet.pay);
      state.balance += winnings;
      res.textContent = 'WIN +' + (winnings - state.bet).toLocaleString() + ' GP  ('+bet.pay+'×)';
      res.style.color = '#4ade80';
      playWin();
    } else {
      res.textContent = 'LOSE -' + state.bet.toLocaleString() + ' GP — ' + f.name + ' flower';
      res.style.color = '#ff5555';
      playLose();
    }
    updateBal();
    state.history.unshift({key:f.key, name:f.name, color:f.color, won:won});
    if(state.history.length>15) state.history.length=15;
    renderHistory();
    state.revealedSeed = state.serverSeed;
    updatePF();
    newSeed();
    state.spinning = false;
  }

  function renderHistory(){
    var el = document.getElementById('hcHistory');
    if(!el) return;
    el.innerHTML = state.history.map(function(h){
      var col = h.color === '#0a0a0a' ? '#444' : h.color;
      return '<span class="hc-h" style="background:'+col+'33;border-color:'+col+'aa;color:'+col+'" title="'+h.name+(h.won?' (WIN)':'')+'">'+(h.won?'\u2605':'\u25CF')+'</span>';
    }).join('');
  }

  // ─── Audio ───
  var audioCtx=null;
  function getCtx(){if(audioCtx)return audioCtx;try{audioCtx=new(window.AudioContext||window.webkitAudioContext)}catch(e){}return audioCtx}
  function playDig(){var c=getCtx();if(!c)return;var o=c.createOscillator();var g=c.createGain();o.type='sawtooth';o.frequency.value=80;g.gain.value=.06;o.connect(g).connect(c.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.15);o.stop(c.currentTime+.2)}
  function playWin(){var c=getCtx();if(!c)return;[700,900,1100,1300].forEach(function(f,i){setTimeout(function(){var o=c.createOscillator();var g=c.createGain();o.type='triangle';o.frequency.value=f;g.gain.value=.08;o.connect(g).connect(c.destination);o.start();g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.15);o.stop(c.currentTime+.2)},i*70)})}
  function playLose(){var c=getCtx();if(!c)return;var o=c.createOscillator();var g=c.createGain();o.type='sine';o.frequency.value=300;g.gain.value=.08;o.connect(g).connect(c.destination);o.start();o.frequency.exponentialRampToValueAtTime(120,c.currentTime+.25);g.gain.exponentialRampToValueAtTime(.001,c.currentTime+.3);o.stop(c.currentTime+.35)}

  var api = {
    _half:function(){var i=document.getElementById('hcBet');i.value=Math.max(1,Math.floor(i.value/2))},
    _dbl:function(){var i=document.getElementById('hcBet');i.value=Math.min(state.balance,i.value*2)},
    _max:function(){var i=document.getElementById('hcBet');i.value=state.balance},
    open:open, close:close
  };

  function open(){
    if(!root) build();
    root.style.display='flex';
    if(typeof RL!=='undefined'&&typeof RL.chips==='number') state.balance=RL.chips;
    if(!state.clientSeed) state.clientSeed=randomHex(8);
    updateBal();
    newSeed();
    setTimeout(resize3D, 100);
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
  RL.hotcold=api;

  function installHook(){
    if(RL.games&&RL.games.open){
      var orig=RL.games.open;
      RL.games.open=function(type){
        if(type==='HotCold'||type==='hotcold'){open();return}
        orig.apply(this,arguments);
      };
      return true;
    }
    return false;
  }
  if(!installHook()){var tries=0;var iv=setInterval(function(){tries++;if(installHook()||tries>20)clearInterval(iv)},100)}
})();

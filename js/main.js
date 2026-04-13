// ═══════════════════════════════════════
// RUNELUCK CASINO — MAIN ENGINE
// Custom characters, premium casino
// ═══════════════════════════════════════

const RL = {
  scene:null, camera:null, renderer:null, clock:null,
  chips:100000, M:{},
  npcs:[], roulettes:[], placed:[],
  player:null, playerTarget:null, playerSpeed:6, running:false, pendingSit:null, _sitting:false,
  camAngle:.3, camAngleTarget:.3, camPitch:.45, camPitchTarget:.45, camDist:12, camDistTarget:12,
  drag:false, didDrag:false, lmx:0, lmy:0,
  raycaster:new THREE.Raycaster(),
  floorPlane:new THREE.Plane(new THREE.Vector3(0,1,0),0),
  interactables:[], pendingInteract:null,
  clickMarkers:[], _mouseX:0, _mouseY:0,
};

RL.load=function(p,t){document.getElementById('lbar').style.width=p+'%';document.getElementById('ltxt').textContent=t};
RL.updateChips=function(){document.getElementById('chipDisplay').textContent=RL.chips.toLocaleString()};

RL.init=function(){
  RL.load(5,'Setting up renderer...');
  RL.scene=new THREE.Scene();
  RL.scene.background=new THREE.Color(0x06080c);
  RL.scene.fog=new THREE.FogExp2(0x06080c,.005);
  RL.camera=new THREE.PerspectiveCamera(50,innerWidth/innerHeight,.1,300);
  RL.renderer=new THREE.WebGLRenderer({antialias:true});
  RL.renderer.setSize(innerWidth,innerHeight);
  RL.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  RL.renderer.shadowMap.enabled=false; // disabled for perf — no shadow casters anyway
  RL.renderer.toneMapping=THREE.ACESFilmicToneMapping;
  RL.renderer.toneMappingExposure=1.1;
  document.body.prepend(RL.renderer.domElement);

  // ── Material library (premium casino) ──
  RL.M={
    marble:new THREE.MeshStandardMaterial({color:0x1a1d24,roughness:.85,metalness:0}),
    marbleDark:new THREE.MeshStandardMaterial({color:0x0c0e14,roughness:.85,metalness:0}),
    marbleLight:new THREE.MeshStandardMaterial({color:0x2a2d35,roughness:.8,metalness:.05}),
    gold:new THREE.MeshStandardMaterial({color:0xd4a843,metalness:.85,roughness:.15,emissive:0x6b4f1a,emissiveIntensity:.05}),
    goldDark:new THREE.MeshStandardMaterial({color:0x8b6d2a,metalness:.7,roughness:.25}),
    mahogany:new THREE.MeshStandardMaterial({color:0x2a1508,roughness:.5,metalness:.1}),
    velvet:new THREE.MeshStandardMaterial({color:0x1a0a2a,roughness:.85}),
    velvetRed:new THREE.MeshStandardMaterial({color:0x3a0a0a,roughness:.85}),
    chrome:new THREE.MeshStandardMaterial({color:0xaabbcc,metalness:.9,roughness:.1}),
    darkSteel:new THREE.MeshStandardMaterial({color:0x3a3e48,metalness:.6,roughness:.25}),
    black:new THREE.MeshStandardMaterial({color:0x111115,roughness:.4}),
    wall:new THREE.MeshStandardMaterial({color:0x121620,roughness:.4,metalness:.1,side:THREE.BackSide}),
    ceil:new THREE.MeshStandardMaterial({color:0x050810,roughness:.7,side:THREE.BackSide}),
    feltGreen:new THREE.MeshStandardMaterial({color:0x0a4a2a,roughness:.7,emissive:0x041a0a,emissiveIntensity:.15}),
    feltRed:new THREE.MeshStandardMaterial({color:0x4a0a0a,roughness:.7}),
    skin:new THREE.MeshStandardMaterial({color:0xd4a574,roughness:.6}),
    skinDark:new THREE.MeshStandardMaterial({color:0x8b6b4a,roughness:.6}),
    hair:new THREE.MeshStandardMaterial({color:0x1a1a1a,roughness:.7}),
    hairLight:new THREE.MeshStandardMaterial({color:0xd4a843,roughness:.7}),
    suit:new THREE.MeshStandardMaterial({color:0x1a1e28,roughness:.5,metalness:.05}),
    suitLight:new THREE.MeshStandardMaterial({color:0x2a2e38,roughness:.5}),
    shirt:new THREE.MeshStandardMaterial({color:0xd0d4da,roughness:.6}),
    slotBody:new THREE.MeshStandardMaterial({color:0x12141c,metalness:.4,roughness:.35}),
    neon:new THREE.MeshBasicMaterial({color:0xd4a843}),
    neonGreen:new THREE.MeshBasicMaterial({color:0x22c55e}),
    neonRed:new THREE.MeshBasicMaterial({color:0xef4444}),
    neonPurple:new THREE.MeshBasicMaterial({color:0xa855f7}),
    rouletteRed:new THREE.MeshStandardMaterial({color:0xcc2222,roughness:.5}),
  };
  RL.clock=new THREE.Clock();

  // Build world
  RL.environment.build();
  RL.furniture.build();
  RL.npcModule.build();
  RL.decorations.build();
  RL.build.init();
  RL.games.init();

  // ── YOUR player character (load GLB first) ──
  RL.load(80,'Loading character model...');
  RL.character.preload(function(){
    var saved=RL.character.load();
    if(saved){
      RL._createPlayer(saved);
      RL._finishInit();
    } else {
      document.getElementById('loader').classList.add('hide');
      RL.characterCreation.show(function(cfg){
        RL._createPlayer(cfg);
        RL._finishInit();
      });
    }
  });
};

RL._createPlayer=function(cfg){
  if(!cfg.inventory || !cfg.inventory.length) cfg.inventory = ['scream_mask','scream_robe','wizard_hat','iron_sword'];
  if(!cfg.equipment) cfg.equipment = {};
  RL.character.sanitizeInventory(cfg);
  RL.player=RL.character.build(cfg);
  RL.player.position.set(0,0,20);
  // Sync references — build() does Object.assign so re-equip the merged config
  var pcfg = RL.player.userData.config;
  Object.keys(pcfg.equipment || {}).forEach(function(slot){
    var itemId = pcfg.equipment[slot];
    if(itemId) try { RL.character.equip(RL.player, slot, itemId); } catch(e){}
  });
  // Marker above head (with name)
  const mc=document.createElement('canvas');mc.width=256;mc.height=64;
  const mx=mc.getContext('2d');
  mx.fillStyle='#d4a843';mx.font='bold 24px sans-serif';mx.textAlign='center';mx.fillText('▼',128,24);
  mx.fillStyle='#ffffff';mx.font='bold 14px sans-serif';mx.strokeStyle='#000';mx.lineWidth=3;
  var nm=(cfg&&cfg.name)||'You';
  mx.strokeText(nm,128,52);mx.fillText(nm,128,52);
  const marker=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(mc),transparent:true,depthTest:false}));
  marker.scale.set(2,.5,1);marker.position.y=2.3;
  RL.player.add(marker);
  // Glow circle under feet
  const glow=new THREE.Mesh(new THREE.CircleGeometry(.5,16),new THREE.MeshBasicMaterial({color:0xd4a843,transparent:true,opacity:.25}));
  glow.rotation.x=-Math.PI/2;glow.position.y=.02;RL.player.add(glow);
  RL.scene.add(RL.player);
};

RL._finishInit=function(){
  RL._setupControls();
  if(RL.contextMenu) RL.contextMenu.init();
  if(RL.osrsUI && RL.osrsUI.init) RL.osrsUI.init();
  RL.load(100,'Welcome to RuneLuck!');
  setTimeout(()=>document.getElementById('loader').classList.add('hide'),400);
  RL._animate();
  addEventListener('resize',()=>{RL.camera.aspect=innerWidth/innerHeight;RL.camera.updateProjectionMatrix();RL.renderer.setSize(innerWidth,innerHeight)});
  if(RL.multiplayer && RL.multiplayer.start) RL.multiplayer.start();
};

// ═══ OVERHEAD CHAT BUBBLES ═══
RL._overheads = [];
RL._spawnOverhead = function(group, text){
  if(!group || !text) return;
  text = String(text).slice(0, 120);
  // Remove any existing bubble on this group
  if(group.userData._chatBubble){
    var old = group.userData._chatBubble;
    if(old.parent) old.parent.remove(old);
    var idx = RL._overheads.indexOf(old);
    if(idx >= 0) RL._overheads.splice(idx, 1);
    group.userData._chatBubble = null;
  }
  // Render text on canvas (word wrap)
  var canvas = document.createElement('canvas');
  var ctx = canvas.getContext('2d');
  var font = 'bold 22px sans-serif';
  ctx.font = font;
  var maxWidth = 360;
  var words = text.split(/\s+/);
  var lines = [], line = '';
  for(var i = 0; i < words.length; i++){
    var test = line ? (line + ' ' + words[i]) : words[i];
    if(ctx.measureText(test).width > maxWidth && line){ lines.push(line); line = words[i]; }
    else line = test;
  }
  if(line) lines.push(line);
  var padX = 16, padY = 10, lineH = 28;
  var w = 0;
  for(var j = 0; j < lines.length; j++) w = Math.max(w, ctx.measureText(lines[j]).width);
  canvas.width = Math.max(80, Math.ceil(w + padX*2));
  canvas.height = Math.ceil(lines.length * lineH + padY*2);
  ctx = canvas.getContext('2d');
  ctx.font = font;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffff00';
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 4;
  for(var k = 0; k < lines.length; k++){
    var ty = padY + k * lineH;
    ctx.strokeText(lines[k], canvas.width/2, ty);
    ctx.fillText(lines[k], canvas.width/2, ty);
  }
  var tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  var sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false }));
  var scaleX = canvas.width / 128;
  var scaleY = canvas.height / 128;
  sprite.scale.set(scaleX, scaleY, 1);
  sprite.position.y = 2.95;
  sprite.renderOrder = 999;
  sprite._spawned = performance.now();
  sprite._life = 5.0; // seconds
  sprite._group = group;
  group.add(sprite);
  group.userData._chatBubble = sprite;
  RL._overheads.push(sprite);
};

RL._updateOverheads = function(t){
  var now = performance.now();
  for(var i = RL._overheads.length - 1; i >= 0; i--){
    var s = RL._overheads[i];
    var age = (now - s._spawned) / 1000;
    var remaining = s._life - age;
    if(remaining <= 0){
      if(s.parent) s.parent.remove(s);
      if(s._group && s._group.userData._chatBubble === s) s._group.userData._chatBubble = null;
      RL._overheads.splice(i, 1);
      continue;
    }
    // Fade out in last second
    if(remaining < 1 && s.material){
      s.material.opacity = Math.max(0, remaining);
      s.material.transparent = true;
    }
  }
};

// ═══ CURSOR CLICK MARKER (OSRS-style X at mouse position) ═══
RL._spawnCursorMarker=function(x,y,kind){
  var el=document.createElement('div');
  el.className='rl-cursor-mark rl-cursor-'+(kind||'walk');
  el.style.left=x+'px';
  el.style.top=y+'px';
  document.body.appendChild(el);
  setTimeout(function(){ el.classList.add('fade'); }, 10);
  setTimeout(function(){ if(el.parentNode) el.parentNode.removeChild(el); }, 700);
};
// Legacy stub (old 3D marker no longer used but kept for compatibility)
RL.spawnClickMarker=function(){};

// ═══ CONTROLS ═══
RL._setupControls=function(){
  const el=RL.renderer.domElement;
  el.style.cursor='default';
  el.addEventListener('contextmenu',e=>e.preventDefault());

  el.addEventListener('mousedown',e=>{
    RL.drag=true;RL.didDrag=false;RL.lmx=e.clientX;RL.lmy=e.clientY;
  });

  addEventListener('mousemove',e=>{
    RL._mouseX=(e.clientX/innerWidth)*2-1;
    RL._mouseY=-(e.clientY/innerHeight)*2+1;
    if(RL.drag){
      const dx=e.clientX-RL.lmx,dy=e.clientY-RL.lmy;
      if(Math.abs(dx)>3||Math.abs(dy)>3) RL.didDrag=true;
      if(RL.didDrag){
        RL.camAngleTarget-=dx*.004;
        RL.camPitchTarget=Math.max(.15,Math.min(1.55,RL.camPitchTarget-dy*.004));
        RL.lmx=e.clientX;RL.lmy=e.clientY;
        el.style.cursor='grabbing';
      }
    }
  });

  addEventListener('mouseup',e=>{
    const wasDrag=RL.didDrag;
    RL.drag=false;RL.didDrag=false;
    el.style.cursor='default';
    if(wasDrag) return;
    // Ignore clicks that started/ended on HUD elements (buttons, panels, modals)
    if(e.target!==RL.renderer.domElement) return;

    if(RL.build.active){RL.build.place(e);return}

    const mouse=new THREE.Vector2((e.clientX/innerWidth)*2-1,-(e.clientY/innerHeight)*2+1);
    RL.raycaster.setFromCamera(mouse,RL.camera);

    // RIGHT CLICK → context menu
    if(e.button===2){
      e.preventDefault();
      var rcHits=RL.raycaster.intersectObjects(RL.interactables.concat(RL.placed),true);
      var target=null;
      if(rcHits.length>0){
        var obj=rcHits[0].object;
        while(obj&&!obj.userData.gameType&&!obj.userData._buildType&&!obj.userData.type) obj=obj.parent;
        if(obj) target=obj;
      }
      var rcGround=new THREE.Vector3();
      RL.raycaster.ray.intersectPlane(RL.floorPlane,rcGround);
      RL.contextMenu._walkPos=rcGround;
      RL.contextMenu.show(e.clientX,e.clientY,target);
      return;
    }

    // LEFT CLICK → walk / interact
    const hits=RL.raycaster.intersectObjects(RL.interactables,true);
    if(hits.length>0){
      let obj=hits[0].object;
      while(obj&&!obj.userData.gameType) obj=obj.parent;
      if(obj&&obj.userData.gameType){
        const tp=obj.position.clone();
        const dir=new THREE.Vector3().subVectors(RL.player.position,tp).normalize();
        // Account for the object's block radius so we stop just outside it
        var objR=(obj.userData._blockR||1)+0.55;
        RL.playerTarget=tp.clone().add(dir.multiplyScalar(objR));
        RL.playerTarget.y=0;
        RL.pendingInteract=obj.userData.gameType;
        RL.pendingSit=obj.userData.gameType==='Slots'?obj:null;
        RL._interactTarget=obj;
        RL._spawnCursorMarker(e.clientX,e.clientY,'interact');
        return;
      }
    }

    const groundHit=new THREE.Vector3();
    RL.raycaster.ray.intersectPlane(RL.floorPlane,groundHit);
    if(groundHit){
      groundHit.y=0;
      const r2=Math.hypot(groundHit.x,groundHit.z);
      if(r2>48){groundHit.x*=48/r2;groundHit.z*=48/r2}
      RL.playerTarget=groundHit;
      RL.pendingInteract=null;
      RL.pendingSit=null;
      RL._interactTarget=null;
      RL._spawnCursorMarker(e.clientX,e.clientY,'walk');
    }
  });

  el.addEventListener('wheel',e=>{
    if(RL.build.active&&RL.build.mode==='place'){
      RL.build.rotation+=e.deltaY*.003;
      e.preventDefault();
    } else {
      RL.camDistTarget=Math.max(5,Math.min(30,RL.camDistTarget+e.deltaY*.015));
    }
  },{passive:false});

  // Touch
  let touchStart=0;
  el.addEventListener('touchstart',e=>{
    touchStart=Date.now();
    if(e.touches.length===2){RL.drag=true;RL.didDrag=true;RL.lmx=(e.touches[0].clientX+e.touches[1].clientX)/2;RL.lmy=(e.touches[0].clientY+e.touches[1].clientY)/2}
    else{RL.lmx=e.touches[0].clientX;RL.lmy=e.touches[0].clientY}
  },{passive:true});
  addEventListener('touchend',e=>{
    if(!RL.didDrag&&Date.now()-touchStart<300){
      const fake=new MouseEvent('mouseup',{clientX:RL.lmx,clientY:RL.lmy});
      el.dispatchEvent(fake);
    }
    RL.drag=false;RL.didDrag=false;
  });
  addEventListener('touchmove',e=>{
    if(e.touches.length===1){RL.lmx=e.touches[0].clientX;RL.lmy=e.touches[0].clientY}
    if(RL.drag&&e.touches.length===2){
      RL.didDrag=true;
      const mx2=(e.touches[0].clientX+e.touches[1].clientX)/2,my2=(e.touches[0].clientY+e.touches[1].clientY)/2;
      RL.camAngleTarget-=(mx2-RL.lmx)*.005;
      RL.camPitchTarget=Math.max(.15,Math.min(1.55,RL.camPitchTarget-(my2-RL.lmy)*.005));
      RL.lmx=mx2;RL.lmy=my2;
    }
  },{passive:true});

  addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(k==='b')RL.build.toggle();
    if(k==='r'&&RL.build.active)RL.build.rotation+=Math.PI/4;
    if(k==='q'&&RL.build.active){RL.build.rotation-=Math.PI/12;e.preventDefault();}
    if(k==='e'&&RL.build.active){RL.build.rotation+=Math.PI/12;e.preventDefault();}
    if(k==='x'&&RL.placed.length){RL.scene.remove(RL.placed.pop());RL.build._updateCount();RL.build.saveLayout(true);}
    if(k==='t'&&RL.build.active){RL.build.toggleRadial();}
    if(k==='v'){
      // Toggle top-down view
      if(RL.camPitchTarget>1.3){ RL.camPitchTarget=.45; RL.camDistTarget=12; }
      else { RL.camPitchTarget=1.55; RL.camDistTarget=28; }
    }
    if(k==='escape'){if(RL.build.active)RL.build.toggle();else RL.games.close();}
  });
};

// ═══ ANIMATION LOOP ═══
RL._animate=function(){
  requestAnimationFrame(RL._animate);
  const dt=Math.min(RL.clock.getDelta(),.05);
  RL._time=(RL._time||0)+dt;
  const t=RL._time;

  // Update character animation mixer (Idle/Walk from Soldier.glb)
  if(RL.player&&RL.player.userData&&RL.player.userData.mixer){
    RL.player.userData.mixer.update(dt);
  }

  // Multiplayer: sync local state + interpolate remote players
  if(RL.multiplayer && RL.multiplayer.update) RL.multiplayer.update(dt);

  // Player walking
  if(RL.playerTarget&&RL.player){
    const p=RL.player.position,tg=RL.playerTarget;
    const dx=tg.x-p.x,dz=tg.z-p.z,dist=Math.sqrt(dx*dx+dz*dz);
    // If we have an interact target and we're already adjacent, stop walking early
    var arrived = dist <= .3;
    if(!arrived && RL._interactTarget){
      var it=RL._interactTarget;
      var idx=p.x-it.position.x, idz=p.z-it.position.z;
      var idist=Math.sqrt(idx*idx+idz*idz);
      if(idist <= ((it.userData._blockR||1)+1.0)) arrived=true;
    }
    if(!arrived){
      const spd=RL.playerSpeed*(RL.running?2:1);
      const step=Math.min(spd*dt,dist);
      var ux=dx/dist, uz=dz/dist;
      var nx=p.x+ux*step, nz=p.z+uz*step;
      var pR=0.45;
      var exempt = RL._interactTarget;
      function _blk(cx,cz){
        for(var i=0;i<RL.placed.length;i++){
          var o=RL.placed[i];
          if(o===exempt) continue; // walking toward it — don't block
          var r=o.userData&&o.userData._blockR;
          if(!r) continue;
          var ex=cx-o.position.x, ez=cz-o.position.z;
          var c=r+pR;
          var newDSq = ex*ex+ez*ez;
          if(newDSq < c*c){
            // Allow moving OUT of an obstacle we're already inside (e.g., sitting on a stool)
            var curEx=p.x-o.position.x, curEz=p.z-o.position.z;
            var curDSq=curEx*curEx+curEz*curEz;
            if(curDSq < c*c){
              // Already inside — only block if moving deeper
              if(newDSq < curDSq) return true;
            } else {
              return true;
            }
          }
        }
        return false;
      }
      if(!_blk(nx,nz))      { p.x=nx; p.z=nz; }
      else if(!_blk(nx,p.z)){ p.x=nx; }
      else if(!_blk(p.x,nz)){ p.z=nz; }
      else                  { arrived=true; } // stuck → treat as arrived
      RL.player.rotation.y=Math.atan2(dx,dz);
      if(RL.character.setAction) RL.character.setAction(RL.player,'walk');
    }
    if(arrived){
      RL.playerTarget=null;
      if(RL.character.setAction) RL.character.setAction(RL.player,'idle');
      if(RL.pendingSit){
        // Just position the player at the stool (no bone pose since GLB is rigged)
        var slot=RL.pendingSit;
        var stoolPos=slot.position.clone();
        var forward=new THREE.Vector3(0,0,0.9).applyAxisAngle(new THREE.Vector3(0,1,0),slot.rotation.y);
        stoolPos.add(forward);
        RL.player.position.set(stoolPos.x,0,stoolPos.z);
        RL.player.rotation.y=slot.rotation.y+Math.PI;
        RL.pendingSit=null;
        if(RL.pendingInteract){
          var game=RL.pendingInteract;
          RL.pendingInteract=null;
          setTimeout(function(){RL.games.open(game);},400);
        }
      } else if(RL.pendingInteract){
        RL.games.open(RL.pendingInteract);RL.pendingInteract=null;
      }
      RL._interactTarget=null;
    }
  }

  // Click markers
  for(let i=RL.clickMarkers.length-1;i>=0;i--){
    const m=RL.clickMarkers[i];
    m._life-=dt*1.5;
    m.children.forEach(c=>{if(c.material)c.material.opacity=Math.max(0,m._life)});
    m.scale.setScalar(1+(.8*(1-m._life)));
    if(m._life<=0){RL.scene.remove(m);RL.clickMarkers.splice(i,1)}
  }

  // OSRS minimap + compass
  if(RL.osrsUI && RL.osrsUI.drawMinimap) RL.osrsUI.drawMinimap();

  // Camera
  RL.camAngle+=(RL.camAngleTarget-RL.camAngle)*.06;
  RL.camPitch+=(RL.camPitchTarget-RL.camPitch)*.06;
  RL.camDist+=(RL.camDistTarget-RL.camDist)*.06;
  const pp=RL.player?RL.player.position:new THREE.Vector3();
  RL.camera.position.x=pp.x+Math.sin(RL.camAngle)*RL.camDist*Math.cos(RL.camPitch);
  RL.camera.position.z=pp.z+Math.cos(RL.camAngle)*RL.camDist*Math.cos(RL.camPitch);
  RL.camera.position.y=1+RL.camDist*Math.sin(RL.camPitch);
  RL.camera.lookAt(pp.x,1.5,pp.z);

  // Hover detection
  RL.raycaster.setFromCamera(new THREE.Vector2(RL._mouseX,RL._mouseY),RL.camera);
  const hits=RL.raycaster.intersectObjects(RL.interactables,true);
  const prompt=document.getElementById('interactPrompt');
  if(hits.length>0&&!RL.build.active&&!RL.games.active){
    let obj=hits[0].object;
    while(obj&&!obj.userData.gameType)obj=obj.parent;
    if(obj){
      document.getElementById('interactText').textContent='Play '+obj.userData.gameType;
      prompt.classList.add('show');
      RL.renderer.domElement.style.cursor='pointer';
    } else {prompt.classList.remove('show');RL.renderer.domElement.style.cursor='default'}
  } else {prompt.classList.remove('show');if(!RL.drag)RL.renderer.domElement.style.cursor=RL.build.active?'cell':'default'}

  // NPCs
  RL.npcs.forEach(n=>{
    n.angle+=n.speed*.006;
    n.mesh.position.x=Math.cos(n.angle)*n.radius;
    n.mesh.position.z=Math.sin(n.angle)*n.radius;
    n.mesh.rotation.y=n.angle+Math.PI/2;
    n.phase+=n.speed*.1;
    n.mesh.children.forEach(c=>{
      if(c.name==='leg')c.rotation.x=Math.sin(n.phase)*.25;
      if(c.name==='arm')c.rotation.x=Math.sin(n.phase+Math.PI)*.15;
    });
    n.mesh.position.y=Math.abs(Math.sin(n.phase))*.04;
  });

  // Roulette wheels
  RL.roulettes.forEach(r=>r.traverse(c=>{if(c.name==='wheel')c.rotation.y=t*2}));

  // Decorations
  if(RL.decorations.animate)RL.decorations.animate(t);

  // Overhead chat bubbles
  if(RL._updateOverheads) RL._updateOverheads(t);

  // Build ghost preview
  if(RL.build.active) RL.build.updateGhostPosition();

  // Lights pulse
  if(RL.environment.spotMain)RL.environment.spotMain.intensity=2+Math.sin(t*.5)*.2;

  RL.renderer.render(RL.scene,RL.camera);
};

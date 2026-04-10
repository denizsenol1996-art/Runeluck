// ═══════════════════════════════════════
// RUNELUCK CASINO — MAIN ENGINE
// Custom characters, premium casino
// ═══════════════════════════════════════

const RL = {
  scene:null, camera:null, renderer:null, clock:null,
  chips:100000, M:{},
  npcs:[], roulettes:[], placed:[],
  player:null, playerTarget:null, playerSpeed:6,
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
  RL.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
  RL.renderer.shadowMap.enabled=true;
  RL.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  RL.renderer.toneMapping=THREE.ACESFilmicToneMapping;
  RL.renderer.toneMappingExposure=1.2;
  document.body.prepend(RL.renderer.domElement);

  // ── Material library (premium casino) ──
  RL.M={
    marble:new THREE.MeshStandardMaterial({color:0x1a1d24,roughness:.3,metalness:.1}),
    marbleDark:new THREE.MeshStandardMaterial({color:0x0c0e14,roughness:.25,metalness:.15}),
    marbleLight:new THREE.MeshStandardMaterial({color:0x2a2d35,roughness:.3,metalness:.1}),
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

  // ── YOUR player character ──
  RL.player=RL.npcModule.make({type:'player'});
  RL.player.position.set(0,0,20);
  // Marker above head
  const mc=document.createElement('canvas');mc.width=128;mc.height=48;
  const mx=mc.getContext('2d');
  mx.fillStyle='#d4a843';mx.font='bold 28px sans-serif';mx.textAlign='center';mx.fillText('▼',64,24);
  mx.fillStyle='#ffffff';mx.font='bold 12px sans-serif';mx.fillText('YOU',64,42);
  const marker=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(mc),transparent:true}));
  marker.scale.set(1,.5,1);marker.position.y=2.6;
  RL.player.add(marker);
  // Glow circle under feet
  const glow=new THREE.Mesh(new THREE.CircleGeometry(.5,16),new THREE.MeshBasicMaterial({color:0xd4a843,transparent:true,opacity:.2}));
  glow.rotation.x=-Math.PI/2;glow.position.y=.02;RL.player.add(glow);
  RL.scene.add(RL.player);

  RL._setupControls();

  RL.load(100,'Welcome to RuneLuck!');
  setTimeout(()=>document.getElementById('loader').classList.add('hide'),400);
  RL._animate();
  addEventListener('resize',()=>{RL.camera.aspect=innerWidth/innerHeight;RL.camera.updateProjectionMatrix();RL.renderer.setSize(innerWidth,innerHeight)});
};

// ═══ CLICK MARKER (gold for walk, red for interact) ═══
RL.spawnClickMarker=function(pos,color){
  const mat=new THREE.MeshBasicMaterial({color:color,transparent:true,opacity:1,side:THREE.DoubleSide,depthTest:false});
  const g=new THREE.Group();
  const p1=new THREE.Mesh(new THREE.PlaneGeometry(.35,.07),mat);
  p1.rotation.x=-Math.PI/2;p1.rotation.z=Math.PI/4;p1.position.y=.1;g.add(p1);
  const p2=new THREE.Mesh(new THREE.PlaneGeometry(.35,.07),mat);
  p2.rotation.x=-Math.PI/2;p2.rotation.z=-Math.PI/4;p2.position.y=.1;g.add(p2);
  const ring=new THREE.Mesh(new THREE.RingGeometry(.2,.27,12),mat.clone());
  ring.rotation.x=-Math.PI/2;ring.position.y=.1;g.add(ring);
  g.position.set(pos.x,.05,pos.z);
  g._life=1.0;
  RL.scene.add(g);
  RL.clickMarkers.push(g);
};

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
        RL.camPitchTarget=Math.max(.15,Math.min(1.1,RL.camPitchTarget-dy*.004));
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

    if(RL.build.active){RL.build.place(e);return}

    const mouse=new THREE.Vector2((e.clientX/innerWidth)*2-1,-(e.clientY/innerHeight)*2+1);
    RL.raycaster.setFromCamera(mouse,RL.camera);

    const hits=RL.raycaster.intersectObjects(RL.interactables,true);
    if(hits.length>0){
      let obj=hits[0].object;
      while(obj&&!obj.userData.gameType) obj=obj.parent;
      if(obj&&obj.userData.gameType){
        const tp=obj.position.clone();
        const dir=new THREE.Vector3().subVectors(RL.player.position,tp).normalize();
        RL.playerTarget=tp.clone().add(dir.multiplyScalar(1.8));
        RL.playerTarget.y=0;
        RL.pendingInteract=obj.userData.gameType;
        RL.spawnClickMarker(RL.playerTarget,0xef4444);
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
      RL.spawnClickMarker(groundHit,0xd4a843);
    }
  });

  el.addEventListener('wheel',e=>{RL.camDistTarget=Math.max(5,Math.min(30,RL.camDistTarget+e.deltaY*.015))});

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
      RL.camPitchTarget=Math.max(.15,Math.min(1.1,RL.camPitchTarget-(my2-RL.lmy)*.005));
      RL.lmx=mx2;RL.lmy=my2;
    }
  },{passive:true});

  addEventListener('keydown',e=>{
    const k=e.key.toLowerCase();
    if(k==='b')RL.build.toggle();
    if(k==='r')RL.build.rotation+=Math.PI/4;
    if(k==='x'&&RL.placed.length)RL.scene.remove(RL.placed.pop());
    if(k==='escape')RL.games.close();
  });
};

// ═══ ANIMATION LOOP ═══
RL._animate=function(){
  requestAnimationFrame(RL._animate);
  const dt=Math.min(RL.clock.getDelta(),.05);
  RL._time=(RL._time||0)+dt;
  const t=RL._time;

  // Player walking
  if(RL.playerTarget&&RL.player){
    const p=RL.player.position,tg=RL.playerTarget;
    const dx=tg.x-p.x,dz=tg.z-p.z,dist=Math.sqrt(dx*dx+dz*dz);
    if(dist>.3){
      const step=Math.min(RL.playerSpeed*dt,dist);
      p.x+=(dx/dist)*step;p.z+=(dz/dist)*step;
      RL.player.rotation.y=Math.atan2(dx,dz);
      RL.player._wp=(RL.player._wp||0)+dt*8;
      RL.player.children.forEach(c=>{
        if(c.name==='leg')c.rotation.x=Math.sin(RL.player._wp)*.35;
        if(c.name==='arm')c.rotation.x=Math.sin(RL.player._wp+Math.PI)*.25;
      });
      RL.player.position.y=Math.abs(Math.sin(RL.player._wp))*.06;
    } else {
      RL.playerTarget=null;RL.player.position.y=0;
      RL.player.children.forEach(c=>{if(c.name==='leg'||c.name==='arm')c.rotation.x=0});
      if(RL.pendingInteract){RL.games.open(RL.pendingInteract);RL.pendingInteract=null}
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

  // Build ghost preview
  if(RL.build.active) RL.build.updateGhostPosition();

  // Lights pulse
  if(RL.environment.spotMain)RL.environment.spotMain.intensity=2+Math.sin(t*.5)*.2;

  RL.renderer.render(RL.scene,RL.camera);
};

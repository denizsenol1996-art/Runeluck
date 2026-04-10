// ═══════════════════════════════════════
// BUILD MODE — Full casino editor
// ═══════════════════════════════════════

RL.build = {
  active: false,
  mode: 'place',
  rotation: 0,
  selectedType: 'slot',
  _ghost: null,
  _ghostReady: false,
  _gltfCache: {},

  ITEMS: [
    {id:'slot',      cat:'Games', name:'Slot Machine',    icon:'\u{1F3B0}', make:'makeSlot'},
    {id:'roulette',  cat:'Games', name:'Roulette Table',  icon:'\u{1F3A1}', make:'makeRoulette'},
    {id:'blackjack', cat:'Games', name:'Blackjack Table', icon:'\u{1F0CF}', make:'makeBlackjack'},
    {id:'booth',     cat:'Misc',  name:'Cashier Booth',   icon:'\u{1F4B0}', make:'makeBooth'},
    {id:'pillar',    cat:'Decor', name:'Gold Pillar',     icon:'\u{1F3DB}', make:'_pillar'},
    {id:'banner',    cat:'Decor', name:'Banner Stand',    icon:'\u{1F6A9}', make:'_banner'},
    {id:'light',     cat:'Decor', name:'Spot Light',      icon:'\u{1F4A1}', make:'_light'},
    {id:'rope',      cat:'Decor', name:'Velvet Rope',     icon:'\u{1F517}', make:'_rope'},
    {id:'gltf_dragon',     cat:'Models', name:'Chinese Dragon',  icon:'\u{1F409}', gltf:'chinese_dragon',       fit:8},
    {id:'gltf_poker',      cat:'Models', name:'Poker Table',     icon:'\u2660', gltf:'casino_poker_table',    fit:3},
    {id:'gltf_bj',         cat:'Models', name:'BJ Table (3D)',   icon:'\u{1F0A1}', gltf:'blackjack_table',       fit:3},
    {id:'gltf_roulette',   cat:'Models', name:'Roulette (3D)',   icon:'\u{1F3AF}', gltf:'rou_lp_test_09',        fit:3},
    {id:'gltf_roulette2',  cat:'Models', name:'Roulette Mini',   icon:'\u{1F534}', gltf:'roulette_table__1_',    fit:2},
    {id:'gltf_dice_blue',  cat:'Models', name:'Sapphire Dice',   icon:'\u{1F3B2}', gltf:'free_hq__pbr_game_model_metallic_sapphire_dice', fit:1.5},
    {id:'gltf_dice_red',   cat:'Models', name:'Red Dice',        icon:'\u{1F7E5}', gltf:'red_dice',              fit:1},
    {id:'gltf_spade',      cat:'Models', name:'Spade Symbol',    icon:'\u2660', gltf:'black_spade_suit',      fit:2},
    {id:'gltf_cards',      cat:'Models', name:'Playing Cards',   icon:'\u{1F0A0}', gltf:'playing_cards',         fit:1.5},
    {id:'gltf_card_syms',  cat:'Models', name:'Card Symbols',    icon:'\u2666', gltf:'playing-cards_symbols', fit:2},
    {id:'gltf_treasure',   cat:'Models', name:'Dragon Treasure', icon:'\u{1F48E}', gltf:'golden_dragon_treasure',fit:4},
    {id:'gltf_statue',     cat:'Models', name:'Pharaoh Statue',  icon:'\u{1F5FF}', gltf:'tutankhamen_and_ankhesenamun', fit:4},
    {id:'gltf_hitman',     cat:'Models', name:'Le Chiffre NPC',  icon:'\u{1F574}', gltf:'le_chiffre_-_hitman_3_world_of_assassination', fit:2},
  ],

  init() {
    this._buildPanel();
    this._loadLayout();
  },

  _buildPanel() {
    const p = document.getElementById('buildPanel');
    p.innerHTML = '<h3>\u{1F528} BUILD MODE</h3>' +
      '<div class="build-modes">' +
        '<button class="mode-btn active" data-mode="place" onclick="RL.build.setMode(\'place\')">Place</button>' +
        '<button class="mode-btn" data-mode="delete" onclick="RL.build.setMode(\'delete\')">Delete</button>' +
      '</div>' +
      '<div class="build-cats" id="buildCats"></div>' +
      '<div class="build-items" id="buildItems"></div>' +
      '<div class="build-hint">Click floor = place \u00b7 R = rotate \u00b7 X = undo</div>' +
      '<div class="build-actions">' +
        '<button class="build-act" onclick="RL.build.saveLayout()">\u{1F4BE} Save</button>' +
        '<button class="build-act" onclick="RL.build.clearAll()">\u{1F5D1} Clear</button>' +
      '</div>' +
      '<div class="build-count" id="buildCount">Objects: 0</div>';

    const cats = [...new Set(this.ITEMS.map(i => i.cat))];
    document.getElementById('buildCats').innerHTML = cats.map((c,i) =>
      '<button class="cat-btn'+(i===0?' active':'')+'" data-cat="'+c+'" onclick="RL.build.filterCat(\''+c+'\')">'+c+'</button>'
    ).join('');
    this.filterCat(cats[0]);
  },

  filterCat(cat) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.toggle('active', b.dataset.cat===cat));
    const c = document.getElementById('buildItems');
    c.innerHTML = '';
    this.ITEMS.filter(i => i.cat===cat).forEach(item => {
      const d = document.createElement('div');
      d.className = 'build-item' + (item.id===this.selectedType?' sel':'');
      d.dataset.type = item.id;
      d.onclick = () => this.selectItem(item.id);
      d.innerHTML = '<span class="ico">'+item.icon+'</span>'+item.name;
      c.appendChild(d);
    });
  },

  selectItem(id) {
    this.selectedType = id;
    document.querySelectorAll('.build-item').forEach(b => b.classList.toggle('sel', b.dataset.type===id));
    this._removeGhost();
    if(this.active && this.mode==='place') this._createGhost();
  },

  setMode(m) {
    this.mode = m;
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode===m));
    this._removeGhost();
    if(m==='place') this._createGhost();
    RL.renderer.domElement.style.cursor = m==='delete'?'crosshair':'cell';
  },

  toggle() {
    this.active = !this.active;
    document.getElementById('buildPanel').classList.toggle('show', this.active);
    document.getElementById('buildBtn').classList.toggle('active', this.active);
    if(this.active) { this._createGhost(); RL.renderer.domElement.style.cursor='cell'; }
    else { this._removeGhost(); RL.renderer.domElement.style.cursor='default'; }
  },

  _getDef(id) { return this.ITEMS.find(i => i.id===id); },

  _makeObj(def, cb) {
    if(def.gltf) {
      this._loadGLTF(def.gltf, def.fit||3, cb);
    } else if(def.make==='_pillar') { cb(this._mkPillar()); }
    else if(def.make==='_banner') { cb(RL.decorations.makeBanner()); }
    else if(def.make==='_light') { cb(this._mkLight()); }
    else if(def.make==='_rope') { cb(this._mkRope()); }
    else { cb(RL.furniture[def.make]()); }
  },

  _mkPillar() {
    const g = new THREE.Group(), M = RL.M;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.5,.6,16,12), M.marbleLight);
    shaft.position.y=8; shaft.castShadow=true; g.add(shaft);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(.8,.9,.6,12), M.marbleLight);
    base.position.y=.3; g.add(base);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(.7,.5,.4,12), M.marbleLight);
    cap.position.y=16.2; g.add(cap);
    for(let b=0;b<4;b++){const band=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.1,12),M.gold);band.position.y=2+b*4;g.add(band);}
    const capR = new THREE.Mesh(new THREE.CylinderGeometry(.72,.72,.08,12),M.gold);
    capR.position.y=16; g.add(capR);
    return g;
  },

  _mkLight() {
    const g = new THREE.Group(), M = RL.M;
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(.04,.05,3,6),M.chrome);
    pole.position.y=1.5; g.add(pole);
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(.01,.2,.3,8),M.darkSteel);
    hood.position.y=3.1; g.add(hood);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(.08,8,8),M.neon);
    bulb.position.y=3; g.add(bulb);
    const pl = new THREE.PointLight(0xf0d478,1,12);
    pl.position.y=3; g.add(pl);
    return g;
  },

  _mkRope() {
    const g = new THREE.Group(), M = RL.M;
    for(let i=0;i<2;i++){
      const post = new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,1,8),M.gold);
      post.position.set(i*2,.5,0); g.add(post);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(.08,8,8),M.gold);
      ball.position.set(i*2,1.05,0); g.add(ball);
    }
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0,.9,0),new THREE.Vector3(1,.6,0),new THREE.Vector3(2,.9,0)]);
    g.add(new THREE.Mesh(new THREE.TubeGeometry(curve,12,.025,6,false),M.velvetRed));
    return g;
  },

  _loadGLTF(name, fitSize, cb) {
    if(this._gltfCache[name]) { cb(this._gltfCache[name].clone()); return; }
    new THREE.GLTFLoader().load('models/'+name+'/scene.gltf', (gltf) => {
      const m = gltf.scene;
      const box = new THREE.Box3().setFromObject(m);
      const sz = box.getSize(new THREE.Vector3());
      const ctr = box.getCenter(new THREE.Vector3());
      const s = fitSize / Math.max(sz.x,sz.y,sz.z);
      m.scale.setScalar(s);
      m.position.set(-ctr.x*s, -box.min.y*s, -ctr.z*s);
      const w = new THREE.Group(); w.add(m);
      w.traverse(c => { if(c.isMesh){c.castShadow=true;c.receiveShadow=true;} });
      this._gltfCache[name] = w;
      cb(w.clone());
    }, undefined, (e) => console.warn('Model load failed:',name,e));
  },

  _createGhost() {
    this._removeGhost();
    if(!this.active || this.mode!=='place') return;
    const def = this._getDef(this.selectedType);
    if(!def) return;
    this._ghostReady = false;
    this._makeObj(def, (obj) => {
      obj.traverse(c => { if(c.isMesh){c.material=c.material.clone();c.material.transparent=true;c.material.opacity=0.4;} });
      obj.userData._isGhost = true;
      obj.userData._buildType = def.id;
      this._ghost = obj;
      RL.scene.add(obj);
      this._ghostReady = true;
    });
  },

  _removeGhost() {
    if(this._ghost){RL.scene.remove(this._ghost);this._ghost=null;this._ghostReady=false;}
  },

  updateGhostPosition() {
    if(!this._ghost||!this._ghostReady) return;
    const hit = new THREE.Vector3();
    RL.raycaster.setFromCamera(new THREE.Vector2(RL._mouseX,RL._mouseY),RL.camera);
    RL.raycaster.ray.intersectPlane(RL.floorPlane, hit);
    if(hit){this._ghost.position.set(hit.x,0,hit.z);this._ghost.rotation.y=this.rotation;}
  },

  place(e) {
    if(!this.active) return;
    const mouse = new THREE.Vector2((e.clientX/innerWidth)*2-1,-(e.clientY/innerHeight)*2+1);
    RL.raycaster.setFromCamera(mouse,RL.camera);

    if(this.mode==='delete'){
      const hits = RL.raycaster.intersectObjects(RL.placed, true);
      if(hits.length>0){
        let obj=hits[0].object;
        while(obj.parent&&!obj.userData._buildType) obj=obj.parent;
        if(obj.userData._buildType){
          RL.scene.remove(obj);
          RL.placed=RL.placed.filter(p=>p!==obj);
          RL.interactables=RL.interactables.filter(p=>p!==obj);
          RL.roulettes=RL.roulettes.filter(p=>p!==obj);
          this._updateCount();
        }
      }
      return;
    }

    if(this.mode==='place'&&this._ghostReady){
      const hit = new THREE.Vector3();
      RL.raycaster.ray.intersectPlane(RL.floorPlane,hit);
      if(!hit) return;
      const def = this._getDef(this.selectedType);
      if(!def) return;

      this._makeObj(def, (obj) => {
        obj.position.set(hit.x,0,hit.z);
        obj.rotation.y=this.rotation;
        obj.userData._buildType=def.id;
        if(def.cat==='Games'){
          obj.userData.gameType = def.id==='slot'?'Slots':def.id==='roulette'?'Roulette':def.id==='blackjack'?'Blackjack':null;
          if(obj.userData.gameType) RL.interactables.push(obj);
          if(def.id==='roulette') RL.roulettes.push(obj);
        }
        RL.scene.add(obj);
        RL.placed.push(obj);
        this._updateCount();
      });
    }
  },

  _updateCount() {
    const el=document.getElementById('buildCount');
    if(el) el.textContent='Objects: '+RL.placed.length;
  },

  saveLayout() {
    const data = RL.placed.map(o => ({
      t:o.userData._buildType,
      x:Math.round(o.position.x*100)/100,
      z:Math.round(o.position.z*100)/100,
      r:Math.round(o.rotation.y*100)/100
    }));
    localStorage.setItem('runeluck_layout',JSON.stringify(data));
    alert('Saved '+data.length+' objects!');
  },

  _loadLayout() {
    try{
      const raw=localStorage.getItem('runeluck_layout');
      if(!raw) return;
      const data=JSON.parse(raw);
      if(!Array.isArray(data)||!data.length) return;
      data.forEach(item => {
        const def=this._getDef(item.t);
        if(!def) return;
        this._makeObj(def, (obj) => {
          obj.position.set(item.x,0,item.z);
          obj.rotation.y=item.r||0;
          obj.userData._buildType=def.id;
          if(def.cat==='Games'){
            obj.userData.gameType=def.id==='slot'?'Slots':def.id==='roulette'?'Roulette':def.id==='blackjack'?'Blackjack':null;
            if(obj.userData.gameType) RL.interactables.push(obj);
            if(def.id==='roulette') RL.roulettes.push(obj);
          }
          RL.scene.add(obj);
          RL.placed.push(obj);
        });
      });
      setTimeout(()=>this._updateCount(),2000);
    }catch(e){console.warn('Layout load failed:',e);}
  },

  clearAll() {
    if(!confirm('Delete ALL objects?')) return;
    RL.placed.forEach(o=>RL.scene.remove(o));
    RL.placed=[];RL.interactables=[];RL.roulettes=[];
    localStorage.removeItem('runeluck_layout');
    this._updateCount();
  }
};

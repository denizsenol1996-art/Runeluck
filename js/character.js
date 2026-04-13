// ═══════════════════════════════════════
// CHARACTER — rigged human (Vanguard from Soldier.glb)
// Baked-in Idle / Walk / Run animations
// ═══════════════════════════════════════

RL.character = {
  BODY_TINTS: [
    {name:'Default',  color:0xffffff},
    {name:'Crimson',  color:0xff7a7a},
    {name:'Royal',    color:0x88aaff},
    {name:'Forest',   color:0x88dd88},
    {name:'Gold',     color:0xffd98a},
    {name:'Obsidian', color:0x5a5a5a},
    {name:'Ivory',    color:0xeeeeee},
    {name:'Amethyst', color:0xaa88ff}
  ],
  VISOR_TINTS: [
    {name:'Amber',  color:0xff9a30},
    {name:'Azure',  color:0x3fa8ff},
    {name:'Scarlet',color:0xff4040},
    {name:'Lime',   color:0x44dd70},
    {name:'Gold',   color:0xffd040},
    {name:'Violet', color:0xc070ff}
  ],

  DEFAULT: {
    name: 'Adventurer',
    bodyTintIdx: 0,
    visorTintIdx: 0,
    equipment: {},
    inventory: ['scream_mask','scream_robe','wizard_hat','iron_sword']
  },

  _prototype: null,
  _loaded: false,
  _loading: null,

  preload(cb) {
    if(this._loaded){ cb && cb(); return; }
    if(this._loading){ this._loading.push(cb); return; }
    this._loading = [cb];
    var self = this;
    new THREE.GLTFLoader().load('models/player.glb', function(gltf){
      self._prototype = gltf;
      self._loaded = true;
      var list = self._loading; self._loading = null;
      list.forEach(function(fn){ fn && fn(); });
    }, undefined, function(err){
      console.error('Failed to load player.glb:', err);
      var list = self._loading || []; self._loading = null;
      list.forEach(function(fn){ fn && fn(); });
    });
  },

  build(cfg) {
    cfg = Object.assign({}, this.DEFAULT, cfg || {});
    if(!this._prototype){
      console.warn('RL.character.build called before preload finished');
      return new THREE.Group();
    }
    var source = this._prototype.scene;
    var clone = THREE.SkeletonUtils.clone(source);

    // Wrapper group (what RL.player references)
    var g = new THREE.Group();
    g.userData.config = cfg;

    // Xbot is already ~1.81m tall at scale 1 (meters)
    clone.scale.setScalar(1.0);
    clone.position.y = 0;
    g.add(clone);

    // Clone & tint materials
    var bodyTint   = new THREE.Color(this.BODY_TINTS[cfg.bodyTintIdx % this.BODY_TINTS.length].color);
    var accentTint = new THREE.Color(this.VISOR_TINTS[cfg.visorTintIdx % this.VISOR_TINTS.length].color);
    clone.traverse(function(c){
      if((c.isMesh || c.isSkinnedMesh) && c.material){
        c.castShadow = true;
        c.receiveShadow = true;
        var mat = c.material.clone();
        c.material = mat;
        var mn = (mat.name || '').toLowerCase();
        // Xbot: main body = HighLimbs, joints = Joints_MAT
        if(mn.indexOf('joint') >= 0){
          if(mat.color) mat.color.copy(accentTint);
        } else {
          if(mat.color) mat.color.copy(bodyTint);
        }
      }
    });

    // Animation mixer + clip actions (store keys lowercased for consistent lookup)
    var mixer = new THREE.AnimationMixer(clone);
    var actions = {};
    (this._prototype.animations || []).forEach(function(clip){
      actions[clip.name.toLowerCase()] = mixer.clipAction(clip);
    });
    if(actions.idle){
      actions.idle.play();
    }
    // Flip walk cycle if it appears reversed in playback
    if(actions.walk){
      actions.walk.setEffectiveTimeScale(-1);
    }
    g.userData.mixer = mixer;
    g.userData.actions = actions;
    g.userData.currentAction = 'idle';

    return g;
  },

  // Crossfade to a named action ('idle', 'walk', 'run')
  setAction(charGroup, name, fadeSec) {
    var actions = charGroup.userData.actions;
    if(!actions) return;
    name = name.toLowerCase();
    if(!actions[name]) return;
    var cur = charGroup.userData.currentAction;
    if(cur === name) return;
    var to = actions[name];
    to.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).play();
    if(cur && actions[cur] && actions[cur] !== to){
      actions[cur].crossFadeTo(to, fadeSec || 0.25, false);
    }
    charGroup.userData.currentAction = name;
  },

  // Slot offsets relative to player group (Y up, Z forward). Xbot ~1.81m tall.
  SLOT_OFFSETS: {
    head:   {pos:[0, 1.78, 0],   scale:1.0},
    body:   {pos:[0, 1.30, 0],   scale:1.0},
    cape:   {pos:[0, 1.35, -.18],scale:1.0},
    legs:   {pos:[0, 0.75, 0],   scale:1.0},
    feet:   {pos:[0, 0.08, 0],   scale:1.0},
    hands:  {pos:[0.30, 1.10, 0],scale:1.0},
    weapon: {pos:[0.32, 1.05, .05],scale:1.0},
    shield: {pos:[-0.32, 1.10, 0],scale:1.0},
    neck:   {pos:[0, 1.55, .05], scale:1.0},
    ring:   {pos:[0.18, 0.95, 0],scale:0.7},
    ammo:   {pos:[-0.10, 1.40, -.20],scale:1.0}
  },

  // Equipment system — attach gear to player group with slot offsets
  equip(charGroup, slot, itemId) {
    if(!charGroup.userData._equipped) charGroup.userData._equipped = {};
    var prev = charGroup.userData._equipped[slot];
    if(prev && prev.parent) prev.parent.remove(prev);
    delete charGroup.userData._equipped[slot];
    charGroup.userData.config.equipment = charGroup.userData.config.equipment || {};
    if(!itemId){ delete charGroup.userData.config.equipment[slot]; return; }
    var item = this.ITEMS[itemId];
    if(!item){ console.warn('[equip] Unknown item:', itemId); return; }
    var mesh = item.build();
    mesh.traverse(function(c){ c.frustumCulled = false; });
    var off = this.SLOT_OFFSETS[slot] || {pos:[0,1.0,0], scale:1.0};
    mesh.position.set(off.pos[0], off.pos[1], off.pos[2]);
    if(off.scale !== 1) mesh.scale.setScalar(off.scale);
    charGroup.add(mesh);
    charGroup.userData._equipped[slot] = mesh;
    charGroup.userData.config.equipment[slot] = itemId;
  },

  // Remove duplicates: any item in equipment should not also be in inventory
  sanitizeInventory(cfg){
    if(!cfg || !cfg.inventory || !cfg.equipment) return;
    var equipped = {};
    Object.keys(cfg.equipment).forEach(function(s){
      var id = cfg.equipment[s];
      if(id) equipped[id] = (equipped[id]||0) + 1;
    });
    cfg.inventory = cfg.inventory.filter(function(id){
      if(equipped[id] && equipped[id] > 0){ equipped[id]--; return false; }
      return true;
    });
  },

  // Items — geometry centered around (0,0,0); SLOT_OFFSETS handles world placement.
  ITEMS: {
    iron_sword: {
      name: 'Iron Sword', slot:'weapon', icon:'⚔',
      build(){
        var g = new THREE.Group();
        var blade = new THREE.Mesh(new THREE.BoxGeometry(.04,.7,.10),
          new THREE.MeshStandardMaterial({color:0xc0c4cc,metalness:.9,roughness:.2}));
        blade.position.y = .25; g.add(blade);
        var guard = new THREE.Mesh(new THREE.BoxGeometry(.20,.04,.06),
          new THREE.MeshStandardMaterial({color:0xd4a843,metalness:.8,roughness:.3}));
        guard.position.y = -.10; g.add(guard);
        var hilt = new THREE.Mesh(new THREE.BoxGeometry(.05,.18,.05),
          new THREE.MeshStandardMaterial({color:0x3a1a08}));
        hilt.position.y = -.20; g.add(hilt);
        return g;
      }
    },
    scream_mask: {
      name:'Scream Mask', slot:'head', icon:'👻',
      build(){
        var g = new THREE.Group();
        var face = new THREE.Mesh(
          new THREE.SphereGeometry(.16, 20, 20),
          new THREE.MeshStandardMaterial({color:0xf2efe6, roughness:.55, metalness:.05})
        );
        face.scale.set(1.0, 1.35, .9);
        g.add(face);
        var eyeMat = new THREE.MeshBasicMaterial({color:0x000000});
        var eL = new THREE.Mesh(new THREE.SphereGeometry(.028, 10, 10), eyeMat);
        eL.position.set(-.055, .03, .14); eL.scale.set(1.4, 2.2, .5);
        g.add(eL);
        var eR = eL.clone(); eR.position.x = .055; g.add(eR);
        var mouth = new THREE.Mesh(new THREE.SphereGeometry(.022, 10, 10), eyeMat);
        mouth.position.set(0, -.10, .14); mouth.scale.set(.9, 2.8, .4);
        g.add(mouth);
        return g;
      }
    },
    scream_robe: {
      name:'Scream Robe', slot:'body', icon:'🧥',
      build(){
        var g = new THREE.Group();
        var torso = new THREE.Mesh(
          new THREE.CylinderGeometry(.32, .50, 1.10, 16),
          new THREE.MeshStandardMaterial({color:0x080808, roughness:.95})
        );
        g.add(torso);
        return g;
      }
    },
    wizard_hat: {
      name:'Wizard Hat', slot:'head', icon:'🎩',
      build(){
        var g = new THREE.Group();
        var hat = new THREE.Mesh(
          new THREE.ConeGeometry(.16, .42, 16),
          new THREE.MeshStandardMaterial({color:0x2a1860, roughness:.7})
        );
        hat.position.y = .22;
        hat.rotation.z = .08;
        g.add(hat);
        var brim = new THREE.Mesh(
          new THREE.CylinderGeometry(.22, .22, .03, 18),
          new THREE.MeshStandardMaterial({color:0x2a1860, roughness:.7})
        );
        brim.position.y = .02;
        g.add(brim);
        var star = new THREE.Mesh(
          new THREE.SphereGeometry(.022, 8, 8),
          new THREE.MeshBasicMaterial({color:0xffd700})
        );
        star.position.set(.05, .28, .12);
        g.add(star);
        return g;
      }
    }
  },

  save(cfg){ try { localStorage.setItem('rl_character', JSON.stringify(cfg)); } catch(e){} },
  load(){ try { var r=localStorage.getItem('rl_character'); if(r) return JSON.parse(r); } catch(e){} return null; },
  reset(){ try { localStorage.removeItem('rl_character'); } catch(e){} }
};

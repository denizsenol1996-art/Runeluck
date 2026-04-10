// ═══════════════════════════════════════
// BUILD MODE — Full Editor
// Ghost preview, select, delete, move, rotate, scale
// ═══════════════════════════════════════

RL.build = {
  active: false,
  mode: 'place',     // 'place' | 'select'
  type: 'slot',
  rotation: 0,
  modelScale: 1,
  _modelCache: {},
  _ghost: null,       // preview object
  _selected: null,    // currently selected placed object
  _selBox: null,      // selection highlight
  _dragging: false,
  _ghostReady: false,

  init() {
    // Build keyboard controls
    addEventListener('keydown', e => {
      if(!this.active) return;
      const k = e.key.toLowerCase();
      if(k === 'r') { this.rotation += Math.PI/4; if(this._ghost) this._ghost.rotation.y = this.rotation; if(this._selected) this._selected.rotation.y += Math.PI/4; }
      if(k === '=' || k === '+') { this.modelScale *= 1.2; this._applyScale(); }
      if(k === '-') { this.modelScale /= 1.2; this._applyScale(); }
      if(k === 'delete' || k === 'backspace') { this._deleteSelected(); e.preventDefault(); }
      if(k === 'x') { this._deleteSelected(); }
      if(k === 'escape') { this._deselect(); this.mode = 'place'; this._updateModeUI(); }
      if(k === '1') { this.mode = 'place'; this._deselect(); this._updateModeUI(); }
      if(k === '2') { this.mode = 'select'; this._removeGhost(); this._updateModeUI(); }
    });
  },

  _applyScale() {
    if(this._ghost) this._ghost.scale.setScalar(this.modelScale);
    if(this._selected) {
      this._selected.scale.setScalar(this.modelScale);
      this._updateSelBox();
    }
    this._showStatus('Scale: ' + this.modelScale.toFixed(1) + 'x');
  },

  _showStatus(msg) {
    const el = document.getElementById('buildStatus');
    if(el) { el.textContent = msg; el.style.opacity = 1; clearTimeout(this._statusTimer); this._statusTimer = setTimeout(() => el.style.opacity = 0, 1500); }
  },

  _updateModeUI() {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    const active = document.querySelector('.mode-btn[data-mode="'+this.mode+'"]');
    if(active) active.classList.add('active');
    RL.renderer.domElement.style.cursor = this.mode === 'select' ? 'pointer' : 'cell';
    if(this.mode === 'place') this._createGhost();
    if(this.mode === 'select') this._removeGhost();
  },

  toggle() {
    this.active = !this.active;
    document.getElementById('buildPanel').classList.toggle('show', this.active);
    document.getElementById('buildBtn').classList.toggle('active', this.active);
    if(this.active) {
      this.mode = 'place';
      this._updateModeUI();
      this._createGhost();
    } else {
      this._removeGhost();
      this._deselect();
    }
  },

  select(el) {
    document.querySelectorAll('.build-item').forEach(e => e.classList.remove('sel'));
    el.classList.add('sel');
    this.type = el.dataset.type;
    this.modelScale = parseFloat(el.dataset.scale) || 1;
    this.mode = 'place';
    this._updateModeUI();
    this._createGhost();
  },

  // ═══ GHOST PREVIEW ═══
  _createGhost() {
    this._removeGhost();
    this._ghostReady = false;

    if(this.type.startsWith('m:')) {
      const modelName = this.type.substring(2);
      this._loadModel(modelName, (obj) => {
        this._setupGhost(obj);
      });
    } else {
      let obj = this._makeBuiltIn(this.type);
      if(obj) this._setupGhost(obj);
    }
  },

  _setupGhost(obj) {
    // Make transparent
    obj.traverse(c => {
      if(c.isMesh) {
        c.material = c.material.clone();
        c.material.transparent = true;
        c.material.opacity = 0.4;
        c.material.depthWrite = false;
      }
    });
    obj.scale.setScalar(this.modelScale);
    obj.rotation.y = this.rotation;
    obj.position.y = -100; // hide until mouse moves
    obj.userData._isGhost = true;
    RL.scene.add(obj);
    this._ghost = obj;
    this._ghostReady = true;
  },

  _removeGhost() {
    if(this._ghost) { RL.scene.remove(this._ghost); this._ghost = null; this._ghostReady = false; }
  },

  // Update ghost position on mouse move (called from main loop)
  updateGhostPosition() {
    if(!this.active || this.mode !== 'place' || !this._ghost || !this._ghostReady) return;
    const mouse = new THREE.Vector2(RL._mouseX, RL._mouseY);
    RL.raycaster.setFromCamera(mouse, RL.camera);
    const hit = new THREE.Vector3();
    RL.raycaster.ray.intersectPlane(RL.floorPlane, hit);
    if(hit) {
      this._ghost.position.set(hit.x, hit.y, hit.z);
      this._ghost.rotation.y = this.rotation;
    }
  },

  // ═══ SELECTION ═══
  _deselect() {
    if(this._selBox) { RL.scene.remove(this._selBox); this._selBox = null; }
    this._selected = null;
  },

  _selectObject(obj) {
    this._deselect();
    this._selected = obj;
    this._updateSelBox();
    // Show scale of selected
    this.modelScale = obj.scale.x;
    this._showStatus('Selected — DEL to remove, R rotate, +/- scale, drag to move');
  },

  _updateSelBox() {
    if(this._selBox) RL.scene.remove(this._selBox);
    if(!this._selected) return;
    const box = new THREE.Box3().setFromObject(this._selected);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const geo = new THREE.BoxGeometry(size.x + .2, size.y + .2, size.z + .2);
    const mat = new THREE.MeshBasicMaterial({ color: 0xd4a843, wireframe: true, transparent: true, opacity: 0.5 });
    this._selBox = new THREE.Mesh(geo, mat);
    this._selBox.position.copy(center);
    RL.scene.add(this._selBox);
  },

  _deleteSelected() {
    if(!this._selected) { 
      // Fallback: delete last placed
      if(RL.placed.length) { RL.scene.remove(RL.placed.pop()); this._showStatus('Removed last object'); }
      return; 
    }
    RL.scene.remove(this._selected);
    const idx = RL.placed.indexOf(this._selected);
    if(idx > -1) RL.placed.splice(idx, 1);
    // Also remove from interactables/roulettes/npcs
    const iIdx = RL.interactables.indexOf(this._selected);
    if(iIdx > -1) RL.interactables.splice(iIdx, 1);
    this._showStatus('Deleted');
    this._deselect();
  },

  // ═══ CLICK HANDLER ═══
  place(e) {
    if(!this.active) return;

    const mx = (e.clientX / innerWidth) * 2 - 1;
    const my = -(e.clientY / innerHeight) * 2 + 1;
    RL.raycaster.setFromCamera(new THREE.Vector2(mx, my), RL.camera);

    // ── SELECT MODE ──
    if(this.mode === 'select') {
      // Try to click on a placed object
      const hits = RL.raycaster.intersectObjects(RL.placed, true);
      if(hits.length > 0) {
        // Walk up to find the root placed object
        let obj = hits[0].object;
        while(obj.parent && !RL.placed.includes(obj)) obj = obj.parent;
        if(RL.placed.includes(obj)) {
          this._selectObject(obj);
          return;
        }
      }
      // Clicked empty — deselect, or drag selected to new position
      if(this._selected) {
        const hit = new THREE.Vector3();
        RL.raycaster.ray.intersectPlane(RL.floorPlane, hit);
        if(hit) {
          this._selected.position.set(hit.x, 0, hit.z);
          this._updateSelBox();
          this._showStatus('Moved');
        }
      } else {
        this._deselect();
      }
      return;
    }

    // ── PLACE MODE ──
    const hit = new THREE.Vector3();
    RL.raycaster.ray.intersectPlane(RL.floorPlane, hit);
    if(!hit) return;

    if(this.type.startsWith('m:')) {
      const modelName = this.type.substring(2);
      const scale = this.modelScale;
      const rot = this.rotation;
      this._loadModel(modelName, (obj) => {
        obj.scale.setScalar(scale);
        obj.position.copy(hit);
        obj.rotation.y = rot;
        RL.scene.add(obj);
        RL.placed.push(obj);
        this._showStatus('Placed');
      });
    } else {
      let obj = this._makeBuiltIn(this.type);
      if(obj) {
        obj.position.copy(hit);
        obj.rotation.y = this.rotation;
        RL.scene.add(obj);
        RL.placed.push(obj);
        if(obj.userData.gameType) RL.interactables.push(obj);
        this._showStatus('Placed');
      }
    }
  },

  // ═══ MODEL LOADER ═══
  _loadModel(modelName, callback) {
    if(this._modelCache[modelName]) {
      callback(this._modelCache[modelName].clone());
      return;
    }
    const loader = new THREE.GLTFLoader();
    loader.load('models/' + modelName + '/scene.gltf', (gltf) => {
      const box = new THREE.Box3().setFromObject(gltf.scene);
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const normScale = 1 / maxDim;
      gltf.scene.scale.setScalar(normScale);
      const center = box.getCenter(new THREE.Vector3());
      gltf.scene.position.set(-center.x * normScale, -box.min.y * normScale, -center.z * normScale);
      const wrapper = new THREE.Group();
      wrapper.add(gltf.scene);
      wrapper.traverse(c => { if(c.isMesh) { c.castShadow = true; c.receiveShadow = true; }});
      this._modelCache[modelName] = wrapper;
      callback(wrapper.clone());
    }, undefined, (err) => { console.warn('Model load failed:', modelName, err); this._showStatus('Failed to load model'); });
  },

  // ═══ BUILT-IN OBJECTS ═══
  _makeBuiltIn(type) {
    const M = RL.M;
    let obj = null;
    switch(type) {
      case 'slot': obj = RL.furniture.makeSlot(); break;
      case 'roulette': obj = RL.furniture.makeRoulette(); RL.roulettes.push(obj); break;
      case 'blackjack': obj = RL.furniture.makeBlackjack(); break;
      case 'npc':
        const p = RL.npcModule.presets[Math.floor(Math.random() * RL.npcModule.presets.length)];
        obj = RL.npcModule.make(p);
        break;
      case 'pillar':
        obj = new THREE.Group();
        const sh = new THREE.Mesh(new THREE.CylinderGeometry(.5,.6,16,12), M.marbleLight);
        sh.position.y=8; sh.castShadow=true; obj.add(sh);
        for(let b=0;b<4;b++){const bd=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.1,12),M.gold);bd.position.y=2+b*4;obj.add(bd)}
        const base=new THREE.Mesh(new THREE.CylinderGeometry(.8,.9,.6,12),M.marbleLight);base.position.y=.3;obj.add(base);
        break;
      case 'banner': obj = RL.decorations.makeBanner(); break;
      case 'booth': obj = RL.furniture.makeBooth(); break;
      case 'light':
        obj = new THREE.Group();
        const pl = new THREE.PointLight(0xf0d478,1,18); pl.position.y=4; obj.add(pl);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(.12,8,8),M.neon); bulb.position.y=4; obj.add(bulb);
        const ch = new THREE.Mesh(new THREE.CylinderGeometry(.01,.01,3,4),M.chrome); ch.position.y=2.5; obj.add(ch);
        break;
    }
    return obj;
  }
};

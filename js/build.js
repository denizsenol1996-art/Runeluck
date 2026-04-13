// ═══════════════════════════════════════
// BUILD MODE v5 — Robust & Simple
// ═══════════════════════════════════════

RL.build = {
  active: false,
  mode: 'place', // 'place' | 'delete' | 'move'
  _moveTarget: null, // object currently being dragged
  rotation: 0,
  radialMode: false,
  radialCenter: {x:0, z:0},
  snapSize: 0, // 0 = no snap. >0 snaps placement to nearest multiple.
  lineMode: false,
  _lineStart: null,
  _lineStartMarker: null,
  selectedType: 'slot',
  _ghost: null,
  _ghostReady: false,
  _scaleMult: 1,
  _gltfCache: {},

  ITEMS: [
    {id:'pillar',      cat:'Decor', name:'Gold Pillar',   icon:'\u{1F3DB}', make:'_pillar'},
    {id:'banner',      cat:'Decor', name:'Banner Stand',  icon:'\u{1F6A9}', make:'_banner'},
    {id:'light',       cat:'Decor', name:'Spot Light',    icon:'\u{1F4A1}', make:'_light'},
    {id:'rope',        cat:'Decor', name:'Velvet Rope',   icon:'\u{1F517}', make:'_rope'},
    {id:'carpet',      cat:'Decor', name:'Red Carpet',    icon:'\u{1F9F5}', make:'_carpet'},
    // Tile overlays — use Snap=1 or 2 to line up neatly
    {id:'tile_marble', cat:'Tiles', name:'Marble Tile',   icon:'\u{25FB}', make:'_tile', color:0x8a8d94, size:2},
    {id:'tile_dark',   cat:'Tiles', name:'Dark Marble',   icon:'\u{25FC}', make:'_tile', color:0x1a1d24, size:2},
    {id:'tile_wood',   cat:'Tiles', name:'Wood Tile',     icon:'\u{25A3}', make:'_tile', color:0x5a3018, size:2},
    {id:'tile_red',    cat:'Tiles', name:'Red Tile',      icon:'\u{25A0}', make:'_tile', color:0x8b1a1a, size:2},
    {id:'tile_gold',   cat:'Tiles', name:'Gold Tile',     icon:'\u{25A1}', make:'_tile', color:0xd4a843, size:2},
    {id:'tile_purple', cat:'Tiles', name:'Purple Tile',   icon:'\u{25C6}', make:'_tile', color:0x3a1a5a, size:2},
    {id:'tile_check',  cat:'Tiles', name:'Check 2x2',     icon:'\u{25A8}', make:'_tileCheck', size:4},
    {id:'tile_geluk',  cat:'Tiles', name:'Geluk op je pad',icon:'\u{1F340}', make:'_tileImage', image:'images/Geluk%20op%20je%20pad.png', size:3},
  ],

  // ─── INIT ───
  init: function() {
    var self = this;
    // Load manifest then build panel
    fetch('models/manifest.json').then(function(r){ return r.json(); }).then(function(models){
      for(var i=0;i<models.length;i++){
        var m = models[i];
        self.ITEMS.push({
          id: m.id,
          cat: 'Models',
          name: m.name,
          icon: '\u{1F4E6}',
          gltf: m.folder,
          fit: m.fit || 3
        });
      }
      console.log('Loaded '+models.length+' models from manifest');
      self._buildPanel();
      self._loadLayout();
    }).catch(function(e){
      console.warn('No manifest.json found');
      self._buildPanel();
      self._loadLayout();
    });
  },

  // ─── BUILD THE SIDE PANEL ───
  _buildPanel: function() {
    var p = document.getElementById('buildPanel');
    var cats = [];
    for(var i=0;i<this.ITEMS.length;i++){
      var c = this.ITEMS[i].cat;
      if(cats.indexOf(c)===-1) cats.push(c);
    }

    var html = '<h3>\u{1F528} BUILD MODE</h3>';
    html += '<div class="build-modes">';
    html += '<button class="mode-btn active" data-mode="place" onclick="RL.build.setMode(\'place\')">Place</button>';
    html += '<button class="mode-btn" data-mode="move" onclick="RL.build.setMode(\'move\')">Move</button>';
    html += '<button class="mode-btn" data-mode="delete" onclick="RL.build.setMode(\'delete\')">Delete</button>';
    html += '</div>';

    html += '<div class="build-cats" id="buildCats">';
    for(var i=0;i<cats.length;i++){
      html += '<button class="cat-btn'+(i===0?' active':'')+'" data-cat="'+cats[i]+'" onclick="RL.build.filterCat(\''+cats[i]+'\')">'+cats[i]+'</button>';
    }
    html += '</div>';
    html += '<div class="build-items" id="buildItems"></div>';
    html += '<div class="build-hint">Click = place \u00b7 Scroll = rotate 360\u00b0</div>';
    html += '<div class="build-hint">Q/E = fine \u00b7 R = snap 45\u00b0 \u00b7 X = undo \u00b7 T = radial</div>';
    html += '<div class="build-rot">Rotation: <span id="rotVal">0\u00b0</span></div>';
    html += '<button class="build-act" id="radialBtn" onclick="RL.build.toggleRadial()" style="width:100%;margin-top:6px">\u21bb Radial: auto-face center</button>';
    html += '<div style="display:flex;gap:4px;margin-top:6px;align-items:center">';
    html += '<label style="font-size:11px;color:#aa9566;text-transform:uppercase;letter-spacing:1px">Snap</label>';
    html += '<select onchange="RL.build.setSnapSize(this.value)" style="flex:1;background:#0a0d14;border:1px solid #2a2e38;color:#f0d478;padding:3px;font-size:11px">';
    html += '<option value="0">off</option>';
    html += '<option value="0.25">0.25</option>';
    html += '<option value="0.5">0.5</option>';
    html += '<option value="1">1</option>';
    html += '<option value="2">2</option>';
    html += '<option value="5">5</option>';
    html += '</select></div>';
    // ─── LINE TOOL ───
    html += '<div style="margin-top:8px;padding:6px;border:1px dashed #2a2e38;border-radius:4px">';
    html += '<div style="font-size:11px;color:#aa9566;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Line Tool</div>';
    html += '<div style="display:flex;gap:4px;margin-bottom:4px;align-items:center">';
    html += '<label style="font-size:11px;color:#c0c0c0">Count</label>';
    html += '<input type="number" id="lineCount" value="5" min="2" max="50" style="width:40px;background:#0a0d14;border:1px solid #2a2e38;color:#f0d478;padding:3px;font-size:11px">';
    html += '<label style="font-size:11px;color:#c0c0c0"><input type="checkbox" id="lineFace"> Face line</label>';
    html += '</div>';
    html += '<div style="display:flex;gap:4px;margin-bottom:4px;align-items:center">';
    html += '<label style="font-size:11px;color:#c0c0c0">Alternate w/</label>';
    html += '<select id="lineSecond" style="flex:1;background:#0a0d14;border:1px solid #2a2e38;color:#f0d478;padding:3px;font-size:11px">';
    html += '<option value="">(none)</option>';
    for(var i=0;i<this.ITEMS.length;i++){
      html += '<option value="'+this.ITEMS[i].id+'">'+this.ITEMS[i].name+'</option>';
    }
    html += '</select></div>';
    html += '<button class="build-act" id="lineBtn" onclick="RL.build.toggleLineMode()" style="width:100%">\u2500\u25cf\u2500 Start line tool</button>';
    html += '</div>';
    html += '<div class="build-ring" style="margin-top:8px;padding:6px;border:1px dashed #2a2e38;border-radius:4px">';
    html += '<div style="font-size:11px;color:#aa9566;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">Arrange on Ring</div>';
    html += '<div style="display:flex;gap:4px;margin-bottom:4px">';
    html += '<input type="number" id="ringRadius" value="28.5" step="0.5" title="Radius" style="width:50%;background:#0a0d14;border:1px solid #2a2e38;color:#f0d478;padding:3px;font-size:11px">';
    html += '<input type="number" id="ringCount" value="20" min="2" max="60" title="Count" style="width:50%;background:#0a0d14;border:1px solid #2a2e38;color:#f0d478;padding:3px;font-size:11px">';
    html += '</div>';
    html += '<button class="build-act" onclick="RL.build.arrangeOnRing(parseFloat(document.getElementById(\'ringRadius\').value), parseInt(document.getElementById(\'ringCount\').value))" style="width:100%">\u25cb Arrange selected (full circle)</button>';
    html += '<button class="build-act" onclick="RL.build.clearSelectedType()" style="width:100%;margin-top:4px">\u2716 Clear selected type</button>';
    html += '<button class="build-act" onclick="RL.build.clearType(\'slot_machine_tripo\');RL.build.arrangeItemOnRing(\'slot_machine_tripo\',28,14,200,340)" style="width:100%;margin-top:6px;background:#d4a843;color:#0c1018">\u2b50 Slots in boog (goude rand)</button>';
    html += '<button class="build-act" onclick="RL.build.addCarpetsUnderBlackjack()" style="width:100%;margin-top:4px">\u{1F9F5} Carpets under blackjack</button>';
    html += '<button class="build-act" onclick="if(confirm(\'Auto-organize everything?\')) RL.build.autoCurate()" style="width:100%;margin-top:8px;background:linear-gradient(180deg,#e8bc50,#c49a30);color:#0c1018;font-weight:700">\u2728 Auto-organize layout</button>';
    html += '<button class="build-act" onclick="RL.build.placeCenterRoulette()" style="width:100%;margin-top:4px">\u{1F3B0} Center Roulette (low-poly)</button>';
    html += '</div>';
    html += '<div class="build-size"><label>Size: <span id="sizeVal">1.0x</span></label>';
    html += '<input type="range" min="0.2" max="5" step="0.1" value="1" id="sizeSlider" oninput="RL.build._onSizeChange(parseFloat(this.value))"></div>';
    html += '<div class="build-actions">';
    html += '<button class="build-act" onclick="RL.build.saveLayout()">\u{1F4BE} Save</button>';
    html += '<button class="build-act" onclick="RL.build.clearAll()">\u{1F5D1} Clear</button>';
    html += '</div>';
    html += '<div class="build-actions" style="margin-top:4px">';
    html += '<button class="build-act" onclick="RL.build.exportLayoutFile()">\u{1F4E4} Export file</button>';
    html += '<button class="build-act" onclick="RL.build.importLayoutFile()">\u{1F4E5} Import file</button>';
    html += '</div>';
    html += '<div class="build-count" id="buildCount">Objects: 0</div>';

    p.innerHTML = html;
    this.filterCat(cats[0]);
  },

  filterCat: function(cat) {
    var btns = document.querySelectorAll('.cat-btn');
    for(var i=0;i<btns.length;i++) btns[i].classList.toggle('active', btns[i].dataset.cat===cat);
    var container = document.getElementById('buildItems');
    container.innerHTML = '';
    for(var i=0;i<this.ITEMS.length;i++){
      var item = this.ITEMS[i];
      if(item.cat !== cat) continue;
      var div = document.createElement('div');
      div.className = 'build-item' + (item.id===this.selectedType?' sel':'');
      div.dataset.type = item.id;
      div.setAttribute('onclick', 'RL.build.selectItem("'+item.id+'")');
      div.innerHTML = '<span class="ico">'+item.icon+'</span>'+item.name;
      container.appendChild(div);
    }
  },

  selectItem: function(id) {
    this.selectedType = id;
    var items = document.querySelectorAll('.build-item');
    for(var i=0;i<items.length;i++) items[i].classList.toggle('sel', items[i].dataset.type===id);
    this._removeGhost();
    if(this.active && this.mode==='place') this._createGhost();
  },

  setMode: function(m) {
    this.mode = m;
    var btns = document.querySelectorAll('.mode-btn');
    for(var i=0;i<btns.length;i++) btns[i].classList.toggle('active', btns[i].dataset.mode===m);
    this._removeGhost();
    // Drop any object we were dragging
    if(this._moveTarget){ this._moveTarget = null; this.saveLayout(true); }
    if(m==='place') this._createGhost();
    RL.renderer.domElement.style.cursor =
      m==='delete' ? 'crosshair' :
      m==='move'   ? 'move' : 'cell';
  },

  toggle: function() {
    this.active = !this.active;
    document.getElementById('buildPanel').classList.toggle('show', this.active);
    document.getElementById('buildBtn').classList.toggle('active', this.active);
    if(this.active) { this._createGhost(); RL.renderer.domElement.style.cursor='cell'; }
    else { this._removeGhost(); RL.renderer.domElement.style.cursor='default'; }
  },

  _getDef: function(id) {
    for(var i=0;i<this.ITEMS.length;i++) if(this.ITEMS[i].id===id) return this.ITEMS[i];
    return null;
  },

  // ─── GHOST: Simple wireframe box with label ───
  _createGhost: function() {
    this._removeGhost();
    if(!this.active || this.mode!=='place') return;
    var def = this._getDef(this.selectedType);
    if(!def) return;

    var size = def.fit || 2;
    var g = new THREE.Group();

    // Wireframe box
    var geo = new THREE.BoxGeometry(size, size, size);
    var mat = new THREE.MeshBasicMaterial({color:0x4ade80, wireframe:true, transparent:true, opacity:0.7});
    var box = new THREE.Mesh(geo, mat);
    box.position.y = size/2;
    g.add(box);

    // Ground circle
    var ring = new THREE.Mesh(
      new THREE.RingGeometry(size*0.5, size*0.6, 24),
      new THREE.MeshBasicMaterial({color:0x4ade80, transparent:true, opacity:0.4, side:THREE.DoubleSide})
    );
    ring.rotation.x = -Math.PI/2;
    ring.position.y = 0.05;
    g.add(ring);

    // Name label
    var canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 48;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#4ade80';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(def.name, 128, 32);
    var label = new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(canvas), transparent:true}));
    label.scale.set(3, 0.6, 1);
    label.position.y = size + 0.8;
    g.add(label);

    g.userData._isGhost = true;
    this._ghost = g;
    this._ghostReady = true;
    RL.scene.add(g);

    // Pre-cache the model if it's GLTF
    if(def.gltf) {
      this._setStatus('Pre-loading model...');
      this._loadGLTF(def.gltf, def.fit||3, function(){
        RL.build._setStatus('Ready! Click to place.');
      });
    }
  },

  _removeGhost: function() {
    if(this._ghost) {
      RL.scene.remove(this._ghost);
      this._ghost = null;
      this._ghostReady = false;
    }
  },

  _setStatus: function(txt) {
    var el = document.getElementById('buildCount');
    if(el) el.textContent = txt;
  },

  // ─── UPDATE GHOST POSITION ───
  updateGhostPosition: function() {
    // MOVE MODE: drag target object with mouse
    if(this.mode === 'move' && this._moveTarget){
      var mhit = new THREE.Vector3();
      RL.raycaster.setFromCamera(new THREE.Vector2(RL._mouseX, RL._mouseY), RL.camera);
      var mres = RL.raycaster.ray.intersectPlane(RL.floorPlane, mhit);
      if(mres){
        var mx = this._snap(mhit.x), mz = this._snap(mhit.z);
        this._moveTarget.position.x = mx;
        this._moveTarget.position.z = mz;
        this._moveTarget.rotation.y = this.rotation || this._moveTarget.rotation.y;
      }
      return;
    }
    if(!this._ghost || !this._ghostReady) return;
    var hit = new THREE.Vector3();
    RL.raycaster.setFromCamera(new THREE.Vector2(RL._mouseX, RL._mouseY), RL.camera);
    var result = RL.raycaster.ray.intersectPlane(RL.floorPlane, hit);
    if(result) {
      var sx = this._snap(hit.x), sz = this._snap(hit.z);
      this._ghost.position.set(sx, 0, sz);
      this._ghost.rotation.y = this._effectiveRotation(sx, sz);
      this._ghost.scale.setScalar(this._scaleMult);
    }
    var rotEl = document.getElementById('rotVal');
    if(rotEl) rotEl.textContent = Math.round(((this.rotation * 180 / Math.PI) % 360 + 360) % 360) + '\u00b0'
      + (this.radialMode ? ' ↻' : '')
      + (this.snapSize>0 ? ' ['+this.snapSize+']' : '');
  },

  _snap: function(v){
    if(!this.snapSize || this.snapSize <= 0) return v;
    return Math.round(v / this.snapSize) * this.snapSize;
  },

  setSnapSize: function(s){
    this.snapSize = parseFloat(s) || 0;
    this._setStatus(this.snapSize>0 ? 'Snap: '+this.snapSize : 'Snap: off');
  },

  // Arrange items in a straight line between two points
  arrangeItemOnLine: function(itemId, x1, z1, x2, z2, count, faceForward){
    var def = this._getDef(itemId);
    if(!def) return;
    count = Math.max(2, count|0);
    var scl = this._scaleMult;
    var dx = x2 - x1, dz = z2 - z1;
    var rot = faceForward ? Math.atan2(dx, dz) : this.rotation;
    for(var i=0; i<count; i++){
      var t = i/(count-1);
      var px = x1 + dx*t, pz = z1 + dz*t;
      this._spawnAt(def, px, pz, rot, scl);
    }
    this._updateCount();
    this.saveLayout(true);
    this._setStatus('Placed '+count+' in line');
  },

  // Dump everything placed to console for inspection
  dumpLayout: function(){
    var out = RL.placed.map(function(o){return {t:o.userData._buildType, x:+o.position.x.toFixed(2), z:+o.position.z.toFixed(2), r:+o.rotation.y.toFixed(2)}});
    console.log('[build] placed:', out);
    console.log('[build] saved:', JSON.parse(localStorage.runeluck_layout||'[]'));
    return out;
  },

  // Auto-organize everything practical — arranges known categories into a nice layout.
  // Leaves unknown/custom items in place.
  autoCurate: function(){
    var groups = {slots:[], roulette:[], blackjack:[], angel:[], throne:[], other:[]};
    for(var i=0;i<RL.placed.length;i++){
      var o = RL.placed[i];
      var t = (o.userData._buildType||'').toLowerCase();
      if(t.indexOf('slot') >= 0)          groups.slots.push(o);
      else if(t.indexOf('roulette') >= 0) groups.roulette.push(o);
      else if(t.indexOf('blackjack') >= 0)groups.blackjack.push(o);
      else if(t === 'angel_statue')       groups.angel.push(o);
      else if(t === 'throne_angel')       groups.throne.push(o);
      else if(t === 'carpet')             { /* drop old carpets; we'll regenerate */ }
      else                                groups.other.push(o);
    }

    // Remember types & counts before wiping
    var slotType     = groups.slots[0]     && groups.slots[0].userData._buildType;
    var rouletteType = groups.roulette[0]  && groups.roulette[0].userData._buildType;
    var blackjackType= groups.blackjack[0] && groups.blackjack[0].userData._buildType;

    // Wipe the curated categories (keeps 'other')
    ['slot_machine_tripo','roulette_v2','roulette_tripo','roulette_v1','roulette_lp',
     'blackjack_v2','blackjack_orig','blackjack_table_tripo',
     'angel_statue','throne_angel','carpet'].forEach(function(k){ this.clearType(k); }, this);
    // Also clear whatever specific types appeared even if not in the list above
    if(slotType)     this.clearType(slotType);
    if(rouletteType) this.clearType(rouletteType);
    if(blackjackType)this.clearType(blackjackType);

    // ─── 1. SLOTS on inner gold ring (north arc) ───
    if(slotType && groups.slots.length > 0){
      var n = Math.max(groups.slots.length, 10);
      this.arrangeItemOnRing(slotType, 28, n, 200, 340);
    }

    // ─── 2. ROULETTE — small cluster at south-east ───
    if(rouletteType && groups.roulette.length > 0){
      var count = groups.roulette.length;
      var startX = 10, startZ = -8, spacing = 7;
      for(var i=0;i<count;i++){
        var px = startX + i*spacing, pz = startZ;
        this._spawnAt(this._getDef(rouletteType), px, pz, Math.PI, this._scaleMult);
      }
    }

    // ─── 3. BLACKJACK — line at south-west, with carpets ───
    if(blackjackType && groups.blackjack.length > 0){
      var count = groups.blackjack.length;
      var startX = -10, startZ = -8, spacing = 6;
      for(var i=0;i<count;i++){
        var px = startX - i*spacing, pz = startZ;
        this._spawnAt(this._getDef(blackjackType), px, pz, Math.PI, this._scaleMult);
      }
      // Carpets under each blackjack (needs a tick for spawns to register)
      var self = this;
      setTimeout(function(){ self.addCarpetsUnderBlackjack(); }, 50);
    }

    // ─── 4. ANGELS alternating on east-west line in the back ───
    if(groups.angel.length > 0 && groups.throne.length > 0){
      var total = groups.angel.length + groups.throne.length;
      this.arrangeAlternatingOnLine('angel_statue','throne_angel', -18, -14, 18, -14, total, true);
    } else if(groups.angel.length > 1){
      this.arrangeItemOnLine('angel_statue', -18, -14, 18, -14, groups.angel.length, true);
    }

    // ─── 5. Move labels to match new cluster positions ───
    if(RL.decorations && RL.decorations.moveLabel){
      RL.decorations.moveLabel('slotsL', -22, 4, -22);
      RL.decorations.moveLabel('slotsR',  22, 4, -22);
      RL.decorations.moveLabel('roulette', 20, 3.5, -3);
      RL.decorations.moveLabel('blackjack', -20, 3.5, -3);
      RL.decorations.moveLabel('cashier', 0, 3, 30);
    }

    this._setStatus('Auto-organized!');
    this.saveLayout(true);
  },

  // Re-align existing placements of typeA + typeB alternating on a line
  // automatically derived from their current bounding box.
  realignAlternating: function(typeA, typeB, faceForward){
    var items = RL.placed.filter(function(o){
      var t = o.userData._buildType;
      return t === typeA || t === typeB;
    });
    if(items.length < 2){
      this._setStatus('Need at least 2 items of these types');
      return;
    }
    // Bounding box over their positions
    var minX=Infinity, maxX=-Infinity, minZ=Infinity, maxZ=-Infinity;
    items.forEach(function(o){
      if(o.position.x<minX) minX=o.position.x;
      if(o.position.x>maxX) maxX=o.position.x;
      if(o.position.z<minZ) minZ=o.position.z;
      if(o.position.z>maxZ) maxZ=o.position.z;
    });
    // Use longer axis as line direction
    var dx = maxX - minX, dz = maxZ - minZ;
    var x1, z1, x2, z2;
    if(dx >= dz){
      var zc = (minZ + maxZ) / 2;
      x1 = minX; z1 = zc; x2 = maxX; z2 = zc;
    } else {
      var xc = (minX + maxX) / 2;
      x1 = xc; z1 = minZ; x2 = xc; z2 = maxZ;
    }
    var count = items.length;
    this.clearType(typeA);
    this.clearType(typeB);
    this.arrangeAlternatingOnLine(typeA, typeB, x1, z1, x2, z2, count, faceForward || false);
  },

  // Alternate two item types in a line
  arrangeAlternatingOnLine: function(typeA, typeB, x1, z1, x2, z2, count, faceForward){
    var defA = this._getDef(typeA), defB = this._getDef(typeB);
    if(!defA || !defB){ this._setStatus('Unknown item type'); return; }
    count = Math.max(2, count|0);
    var scl = this._scaleMult;
    var dx = x2 - x1, dz = z2 - z1;
    var rot = faceForward ? Math.atan2(dx, dz) : this.rotation;
    for(var i=0; i<count; i++){
      var t = count>1 ? i/(count-1) : 0;
      var px = x1 + dx*t, pz = z1 + dz*t;
      var def = (i % 2 === 0) ? defA : defB;
      this._spawnAt(def, px, pz, rot, scl);
    }
    this._updateCount();
    this.saveLayout(true);
    this._setStatus('Alternating '+count+' placed');
  },

  // ─── LINE TOOL (visual, click 2 points) ───
  toggleLineMode: function(){
    this.lineMode = !this.lineMode;
    this._clearLineStart();
    var btn = document.getElementById('lineBtn');
    if(btn) btn.classList.toggle('active', this.lineMode);
    this._setStatus(this.lineMode ? 'Line: click START point' : 'Line: off');
  },

  _clearLineStart: function(){
    if(this._lineStartMarker){
      RL.scene.remove(this._lineStartMarker);
      this._lineStartMarker = null;
    }
    this._lineStart = null;
  },

  _spawnLineMarker: function(x, z){
    var m = new THREE.Mesh(
      new THREE.SphereGeometry(0.25, 12, 10),
      new THREE.MeshBasicMaterial({color: 0xd4a843, transparent:true, opacity:0.8})
    );
    m.position.set(x, 0.5, z);
    RL.scene.add(m);
    this._lineStartMarker = m;
  },

  // Called from place() when lineMode is active
  _handleLineClick: function(hit){
    var sx = this._snap(hit.x), sz = this._snap(hit.z);
    if(!this._lineStart){
      this._lineStart = {x: sx, z: sz};
      this._spawnLineMarker(sx, sz);
      this._setStatus('Line: click END point');
      return;
    }
    var count = parseInt(document.getElementById('lineCount').value, 10) || 5;
    var face  = document.getElementById('lineFace').checked;
    var itemA = this.selectedType;
    var itemB = document.getElementById('lineSecond').value;
    if(itemB && itemB !== '' && itemB !== itemA){
      this.arrangeAlternatingOnLine(itemA, itemB, this._lineStart.x, this._lineStart.z, sx, sz, count, face);
    } else {
      this.arrangeItemOnLine(itemA, this._lineStart.x, this._lineStart.z, sx, sz, count, face);
    }
    this._clearLineStart();
    this.lineMode = false;
    var btn = document.getElementById('lineBtn');
    if(btn) btn.classList.remove('active');
  },

  // Computed rotation at given world position. In radial mode auto-faces the center.
  _effectiveRotation: function(x, z) {
    if(this.radialMode){
      var dx = x - this.radialCenter.x;
      var dz = z - this.radialCenter.z;
      // Face toward center → rotate so front (+Z) points from (x,z) toward center
      return Math.atan2(-dx, -dz) + this.rotation;
    }
    return this.rotation;
  },

  toggleRadial: function(){
    this.radialMode = !this.radialMode;
    var btn = document.getElementById('radialBtn');
    if(btn) btn.classList.toggle('active', this.radialMode);
    this._setStatus(this.radialMode ? 'Radial: ON (auto-face center)' : 'Radial: OFF');
  },

  // ─── ARRANGE ON RING ───
  // Places `count` copies of selected type in a circle of given radius.
  // Each copy auto-rotates to face the center point (0,0) by default.
  arrangeOnRing: function(radius, count, startDeg, endDeg, cx, cz){
    var def = this._getDef(this.selectedType);
    if(!def){ this._setStatus('No item selected'); return; }
    radius = radius || 28.5;
    count  = count  || 20;
    cx = cx || 0; cz = cz || 0;
    startDeg = (startDeg == null) ? 0 : startDeg;
    endDeg   = (endDeg   == null) ? 360 : endDeg;
    var self = this;
    var scl = this._scaleMult;
    var arc = (endDeg - startDeg) * Math.PI / 180;
    var full = Math.abs(endDeg - startDeg) >= 359.99;
    var step = arc / (full ? count : Math.max(1, count-1));
    var start = startDeg * Math.PI / 180;
    var placed = 0;
    for(var i=0; i<count; i++){
      var a = start + i*step;
      var px = cx + Math.cos(a)*radius;
      var pz = cz + Math.sin(a)*radius;
      // Face center: front (+Z after rotation) points from object toward center
      var rot = Math.atan2(-(px-cx), -(pz-cz));
      this._spawnAt(def, px, pz, rot, scl);
      placed++;
    }
    this._updateCount();
    this.saveLayout(true);
    this._setStatus('Arranged '+placed+' on ring');
  },

  // Downscale a loaded texture to a canvas to cut GPU memory dramatically.
  // Called once per texture (idempotent via _downscaled flag).
  _downscaleTexture: function(tex, maxSize){
    if(!tex || tex._downscaled) return;
    var img = tex.image;
    if(!img) return;
    var w = img.width || img.videoWidth || 0;
    var h = img.height || img.videoHeight || 0;
    // If the image is still loading, defer until it's ready
    if(!w || !h){
      if(img.addEventListener){
        var self = this;
        var onload = function(){
          img.removeEventListener('load', onload);
          self._downscaleTexture(tex, maxSize);
        };
        img.addEventListener('load', onload);
      }
      return;
    }
    tex._downscaled = true;
    if(Math.max(w, h) <= maxSize) return;
    var scale = maxSize / Math.max(w, h);
    var nw = Math.max(1, Math.floor(w * scale));
    var nh = Math.max(1, Math.floor(h * scale));
    try {
      var canvas = document.createElement('canvas');
      canvas.width = nw;
      canvas.height = nh;
      var ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, nw, nh);
      tex.image = canvas;
      tex.needsUpdate = true;
    } catch(e){
      // Cross-origin or other error — skip silently
    }
  },

  // Compute a collision radius from an object's current bounding box.
  // Passable types (tiles, carpets, ropes) return 0 = no collision.
  _computeBlockRadius: function(obj){
    var t = (obj.userData._buildType||'').toLowerCase();
    if(/tile|carpet|rope|banner|light/.test(t)) return 0;
    try {
      var box = new THREE.Box3().setFromObject(obj);
      var size = box.getSize(new THREE.Vector3());
      return Math.max(size.x, size.z) * 0.40;
    } catch(e){ return 0.8; }
  },

  _tagBlock: function(obj){
    // Queue the expensive Box3 bbox compute instead of stacking setTimeouts
    var self = this;
    this._tagQueue = this._tagQueue || [];
    this._tagQueue.push(obj);
    if(!this._tagQueueRunning){
      this._tagQueueRunning = true;
      var drain = function(){
        if(!self._tagQueue.length){ self._tagQueueRunning = false; return; }
        // Process up to 4 items per tick
        var n = Math.min(4, self._tagQueue.length);
        for(var i=0;i<n;i++){
          var o = self._tagQueue.shift();
          if(o) o.userData._blockR = self._computeBlockRadius(o);
        }
        setTimeout(drain, 50);
      };
      setTimeout(drain, 200);
    }
  },

  // Mark an object as an interactable game station based on its type id
  _tagInteractable: function(obj){
    var t = (obj.userData._buildType||'').toLowerCase();
    if(t.indexOf('roulette') >= 0){ obj.userData.gameType = 'Roulette'; }
    else if(t.indexOf('blackjack') >= 0){ obj.userData.gameType = 'Blackjack'; }
    else if(t.indexOf('slot') >= 0){ obj.userData.gameType = 'Slots'; }
    else if(t.indexOf('mines') >= 0 || t === 'mines_bomb'){ obj.userData.gameType = 'Mines'; }
    else if(t.indexOf('dice') >= 0){ obj.userData.gameType = 'Dice'; }
    else if(t.indexOf('flower') >= 0){ obj.userData.gameType = 'FlowerPoker'; }
    else if(t.indexOf('rocket') >= 0){ obj.userData.gameType = 'Crash'; }
    else if(t.indexOf('plinko') >= 0){ obj.userData.gameType = 'Plinko'; }
    else if(t.indexOf('rose') >= 0){ obj.userData.gameType = 'HotCold'; }
    if(obj.userData.gameType && RL.interactables.indexOf(obj) < 0){
      RL.interactables.push(obj);
    }
  },

  // Rebuild interactables + collision from everything currently placed
  retagAll: function(){
    for(var i=0;i<RL.placed.length;i++){
      this._tagInteractable(RL.placed[i]);
      this._tagBlock(RL.placed[i]);
    }
  },

  // Internal helper: spawn an item at an exact pos/rot without using raycast
  _spawnAt: function(def, px, pz, rot, scl){
    if(def.gltf){
      var fit = def.fit || 3;
      var ph = new THREE.Mesh(
        new THREE.BoxGeometry(fit*0.8, fit*0.8, fit*0.8),
        new THREE.MeshStandardMaterial({color:0xd4a843, roughness:0.5, metalness:0.3, transparent:true, opacity:0.7})
      );
      ph.position.set(px, fit*0.4*scl, pz);
      ph.rotation.y = rot;
      ph.scale.setScalar(scl);
      ph.castShadow = true;
      ph.userData._buildType = def.id;
      ph.userData._scale = scl;
      ph.userData._placeholder = true;
      RL.scene.add(ph);
      RL.placed.push(ph);
      var self2 = this;
      this._loadGLTF(def.gltf, def.fit||3, function(realObj){
        realObj.position.set(px, 0, pz);
        realObj.rotation.y = rot;
        realObj.scale.setScalar(scl);
        realObj.userData._buildType = def.id;
        realObj.userData._scale = scl;
        RL.scene.remove(ph);
        var idx = RL.placed.indexOf(ph);
        if(idx >= 0) RL.placed[idx] = realObj;
        RL.scene.add(realObj);
        self2._tagInteractable(realObj);
      });
    } else {
      var obj = this._makeProc(def);
      if(!obj) return;
      obj.position.set(px, 0, pz);
      obj.rotation.y = rot;
      obj.scale.setScalar(scl);
      obj.userData._buildType = def.id;
      obj.userData._scale = scl;
      RL.scene.add(obj);
      RL.placed.push(obj);
      this._tagInteractable(obj); this._tagBlock(obj);
      if(def.id==='roulette') RL.roulettes.push(obj);
    }
  },

  // Remove all placed copies of the currently selected type (useful before re-arranging)
  clearSelectedType: function(){ this.clearType(this.selectedType); },

  clearType: function(typeId){
    var keep = [];
    var removed = 0;
    for(var i=0;i<RL.placed.length;i++){
      var o = RL.placed[i];
      if(o.userData._buildType === typeId){
        RL.scene.remove(o);
        RL.interactables = RL.interactables.filter(function(p){return p!==o;});
        RL.roulettes = RL.roulettes.filter(function(p){return p!==o;});
        removed++;
      } else {
        keep.push(o);
      }
    }
    RL.placed = keep;
    this._updateCount();
    this.saveLayout(true);
    this._setStatus('Removed '+removed+' '+typeId);
    return removed;
  },

  // Place the low-poly roulette at center with larger scale
  // Uses the same _spawnAt path as normal build placement (proven working)
  placeCenterRoulette: function(scale){
    scale = scale || 2.5;
    var def = this._getDef('roulette_lp') || {
      id: 'roulette_lp', cat:'Models',
      name:'Roulette (Low-Poly)', icon:'\u{1F4E6}',
      gltf: 'rou_lp_test_09', fit: 3
    };
    this.clearType('roulette_lp');
    this._scaleMult = scale;
    this._spawnAt(def, 0, 0, 0, scale);
    this._scaleMult = 1;
    this._updateCount();
    this.saveLayout(true);
    this._setStatus('Placed roulette at center (scale '+scale+')');
  },

  // Arrange a SPECIFIC item type (doesn't require it to be selected in the UI)
  arrangeItemOnRing: function(itemId, radius, count, startDeg, endDeg, cx, cz){
    var prev = this.selectedType;
    this.selectedType = itemId;
    this.arrangeOnRing(radius, count, startDeg, endDeg, cx, cz);
    this.selectedType = prev;
  },

  // ─── PLACE OBJECT ───
  place: function(e) {
    if(!this.active) return;
    if(e.button !== 0) return; // LEFT CLICK ONLY

    var mouse = new THREE.Vector2((e.clientX/innerWidth)*2-1, -(e.clientY/innerHeight)*2+1);
    RL.raycaster.setFromCamera(mouse, RL.camera);

    // MOVE MODE — click to pick up, click again to drop
    if(this.mode==='move') {
      if(this._moveTarget){
        // Drop
        this._moveTarget = null;
        this._setStatus('Dropped');
        this.saveLayout(true);
      } else {
        // Pick up
        var hits = RL.raycaster.intersectObjects(RL.placed, true);
        if(hits.length > 0) {
          var obj = hits[0].object;
          while(obj.parent && !obj.userData._buildType) obj = obj.parent;
          if(obj.userData._buildType) {
            this._moveTarget = obj;
            this.rotation = obj.rotation.y; // sync so scroll rotates from current
            // Sync size slider to object's current scale
            var curScale = obj.userData._scale || obj.scale.x || 1;
            this._scaleMult = curScale;
            var sl = document.getElementById('sizeSlider');
            var sv = document.getElementById('sizeVal');
            if(sl) sl.value = curScale;
            if(sv) sv.textContent = curScale.toFixed(1)+'x';
            this._setStatus('Moving '+obj.userData._buildType+' — slider resizes, scroll rotates, click drops');
          }
        }
      }
      return;
    }

    // DELETE MODE
    if(this.mode==='delete') {
      var hits = RL.raycaster.intersectObjects(RL.placed, true);
      if(hits.length > 0) {
        var obj = hits[0].object;
        while(obj.parent && !obj.userData._buildType) obj = obj.parent;
        if(obj.userData._buildType) {
          RL.scene.remove(obj);
          RL.placed = RL.placed.filter(function(p){return p!==obj;});
          RL.interactables = RL.interactables.filter(function(p){return p!==obj;});
          RL.roulettes = RL.roulettes.filter(function(p){return p!==obj;});
          this._updateCount();
          this.saveLayout(true);
        }
      }
      return;
    }

    // PLACE MODE
    if(this.mode==='place' && this._ghostReady) {
      var hit = new THREE.Vector3();
      var result = RL.raycaster.ray.intersectPlane(RL.floorPlane, hit);
      if(!result) return; // No floor hit

      // LINE TOOL: collect two points then delegate
      if(this.lineMode){
        this._handleLineClick(hit);
        return;
      }

      var def = this._getDef(this.selectedType);
      if(!def) return;
      var px = this._snap(hit.x), pz = this._snap(hit.z);
      var rot = this._effectiveRotation(px, pz);
      var scl = this._scaleMult;

      if(def.gltf) {
        // INSTANT gold placeholder
        var fit = def.fit || 3;
        var ph = new THREE.Mesh(
          new THREE.BoxGeometry(fit*0.8, fit*0.8, fit*0.8),
          new THREE.MeshStandardMaterial({color:0xd4a843, roughness:0.5, metalness:0.3, transparent:true, opacity:0.7})
        );
        ph.position.set(px, fit*0.4*scl, pz);
        ph.rotation.y = rot;
        ph.scale.setScalar(scl);
        ph.castShadow = true;
        ph.userData._buildType = def.id;
        ph.userData._scale = scl;
        ph.userData._placeholder = true;
        RL.scene.add(ph);
        RL.placed.push(ph);
        this._updateCount();
        this._setStatus('Loading model...');
        this.saveLayout(true);

        // Load real model and swap
        this._loadGLTF(def.gltf, def.fit||3, function(realObj) {
          realObj.position.set(px, 0, pz);
          realObj.rotation.y = rot;
          realObj.scale.setScalar(scl);
          realObj.userData._buildType = def.id;
          realObj.userData._scale = scl;
          // Swap
          RL.scene.remove(ph);
          var idx = RL.placed.indexOf(ph);
          if(idx >= 0) RL.placed[idx] = realObj;
          RL.scene.add(realObj);
          RL.build._tagInteractable(realObj); RL.build._tagBlock(realObj);
          RL.build._setStatus('Placed!');
          setTimeout(function(){ RL.build._updateCount(); }, 500);
          RL.build.saveLayout(true);
        });
      } else {
        // Procedural object — instant
        var obj = this._makeProc(def);
        if(obj) {
          obj.position.set(px, 0, pz);
          obj.rotation.y = rot;
          obj.scale.setScalar(scl);
          obj.userData._buildType = def.id;
          obj.userData._scale = scl;
          if(def.cat==='Games') {
            obj.userData.gameType = def.id==='slot'?'Slots':def.id==='roulette'?'Roulette':def.id==='blackjack'?'Blackjack':null;
            if(obj.userData.gameType) RL.interactables.push(obj);
            if(def.id==='roulette') RL.roulettes.push(obj);
          }
          RL.scene.add(obj);
          RL.placed.push(obj);
          this._tagInteractable(obj); this._tagBlock(obj);
          this._updateCount();
          this.saveLayout(true);
        }
      }
    }
  },

  // ─── MAKE PROCEDURAL OBJECTS ───
  _makeProc: function(def) {
    if(def.make==='_pillar') return this._mkPillar();
    if(def.make==='_banner') return RL.decorations.makeBanner();
    if(def.make==='_light') return this._mkLight();
    if(def.make==='_rope') return this._mkRope();
    if(def.make==='_carpet') return this._mkCarpet();
    if(def.make==='_tile')   return this._mkTile(def.color, def.size);
    if(def.make==='_tileCheck') return this._mkTileCheck(def.size);
    if(def.make==='_tileImage') return this._mkTileImage(def.image, def.size);
    if(RL.furniture[def.make]) return RL.furniture[def.make]();
    return null;
  },

  _mkTile: function(color, size){
    size = size || 2;
    var g = new THREE.Group();
    var main = new THREE.Mesh(
      new THREE.BoxGeometry(size, .03, size),
      new THREE.MeshStandardMaterial({color:color, roughness:.45, metalness:.15})
    );
    main.position.y = .02;
    main.receiveShadow = true;
    g.add(main);
    // Subtle gold rim
    var rimMat = new THREE.MeshStandardMaterial({color:0xd4a843, metalness:.7, roughness:.3});
    var rt = new THREE.Mesh(new THREE.BoxGeometry(size, .035, .04), rimMat); rt.position.set(0,.026, size/2-.02); g.add(rt);
    var rb = new THREE.Mesh(new THREE.BoxGeometry(size, .035, .04), rimMat); rb.position.set(0,.026,-size/2+.02); g.add(rb);
    var rl = new THREE.Mesh(new THREE.BoxGeometry(.04, .035, size), rimMat); rl.position.set(-size/2+.02,.026,0); g.add(rl);
    var rr = new THREE.Mesh(new THREE.BoxGeometry(.04, .035, size), rimMat); rr.position.set( size/2-.02,.026,0); g.add(rr);
    return g;
  },

  _mkTileImage: function(imagePath, size){
    size = size || 3;
    var g = new THREE.Group();
    var loader = new THREE.TextureLoader();
    var tex = loader.load(imagePath);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    var plane = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    plane.rotation.x = -Math.PI/2;
    plane.position.y = 0.025; // just above floor
    plane.receiveShadow = true;
    g.add(plane);
    return g;
  },

  _mkTileCheck: function(size){
    size = size || 4;
    var g = new THREE.Group();
    var half = size/2;
    var matA = new THREE.MeshStandardMaterial({color:0xeeeeee, roughness:.45, metalness:.1});
    var matB = new THREE.MeshStandardMaterial({color:0x121218, roughness:.45, metalness:.1});
    for(var i=0;i<2;i++) for(var j=0;j<2;j++){
      var mat = ((i+j)%2===0) ? matA : matB;
      var tile = new THREE.Mesh(new THREE.BoxGeometry(half, .03, half), mat);
      tile.position.set(-half/2 + i*half, .02, -half/2 + j*half);
      tile.receiveShadow = true;
      g.add(tile);
    }
    var rimMat = new THREE.MeshStandardMaterial({color:0xd4a843, metalness:.7, roughness:.3});
    var rt = new THREE.Mesh(new THREE.BoxGeometry(size, .035, .05), rimMat); rt.position.set(0,.026, half-.025); g.add(rt);
    var rb = new THREE.Mesh(new THREE.BoxGeometry(size, .035, .05), rimMat); rb.position.set(0,.026,-half+.025); g.add(rb);
    var rl = new THREE.Mesh(new THREE.BoxGeometry(.05, .035, size), rimMat); rl.position.set(-half+.025,.026,0); g.add(rl);
    var rr = new THREE.Mesh(new THREE.BoxGeometry(.05, .035, size), rimMat); rr.position.set( half-.025,.026,0); g.add(rr);
    return g;
  },

  _mkCarpet: function(w, d){
    w = w || 5; d = d || 3;
    var g = new THREE.Group();
    var mat = new THREE.MeshStandardMaterial({color:0x8b1a1a, roughness:.75, metalness:.02});
    var trim = new THREE.MeshStandardMaterial({color:0xd4a843, roughness:.4, metalness:.3});
    var rug = new THREE.Mesh(new THREE.BoxGeometry(w, .02, d), mat);
    rug.position.y = .015;
    rug.receiveShadow = true;
    g.add(rug);
    // gold trim edges
    var t1 = new THREE.Mesh(new THREE.BoxGeometry(w, .026, .10), trim); t1.position.set(0,.022,-d/2+.08); g.add(t1);
    var t2 = new THREE.Mesh(new THREE.BoxGeometry(w, .026, .10), trim); t2.position.set(0,.022, d/2-.08); g.add(t2);
    var t3 = new THREE.Mesh(new THREE.BoxGeometry(.10, .026, d), trim); t3.position.set(-w/2+.08,.022,0); g.add(t3);
    var t4 = new THREE.Mesh(new THREE.BoxGeometry(.10, .026, d), trim); t4.position.set( w/2-.08,.022,0); g.add(t4);
    return g;
  },

  // List unique placed types (debug helper)
  listPlacedTypes: function(){
    var counts = {};
    for(var i=0;i<RL.placed.length;i++){
      var t = RL.placed[i].userData._buildType || '(unknown)';
      counts[t] = (counts[t]||0)+1;
    }
    console.log('[build] placed types:', counts);
    var summary = Object.keys(counts).map(function(k){return k+':'+counts[k]}).join(' · ');
    this._setStatus(summary || 'nothing placed');
    return counts;
  },

  // Scan placed objects and drop a carpet under every blackjack-ish table.
  // Matches broadly: any _buildType containing 'black', 'jack', or 'bj'.
  addCarpetsUnderBlackjack: function(){
    var def = this._getDef('carpet');
    if(!def) return;
    var targets = RL.placed.filter(function(o){
      var t = (o.userData._buildType || '').toLowerCase();
      return t.indexOf('black') >= 0 || t.indexOf('jack') >= 0 || /\bbj\b/.test(t);
    });
    console.log('[build] blackjack targets found:', targets.length, targets.map(function(t){return t.userData._buildType}));
    if(targets.length === 0){
      // Fallback: show all placed types so we know what to match against
      var counts = this.listPlacedTypes();
      this._setStatus('No blackjack found. Types: '+Object.keys(counts).join(','));
      return;
    }
    var self = this;
    var added = 0;
    targets.forEach(function(tbl){
      var rug = self._mkCarpet(5, 3);
      rug.position.set(tbl.position.x, 0, tbl.position.z);
      rug.rotation.y = tbl.rotation.y;
      rug.userData._buildType = 'carpet';
      rug.userData._scale = 1;
      RL.scene.add(rug);
      RL.placed.push(rug);
      added++;
    });
    this._updateCount();
    this.saveLayout(true);
    this._setStatus('Added '+added+' carpets under blackjack');
  },

  _mkPillar: function() {
    var g = new THREE.Group(), M = RL.M;
    var shaft = new THREE.Mesh(new THREE.CylinderGeometry(.5,.6,16,12), M.marbleLight);
    shaft.position.y=8; shaft.castShadow=true; g.add(shaft);
    var base = new THREE.Mesh(new THREE.CylinderGeometry(.8,.9,.6,12), M.marbleLight);
    base.position.y=.3; g.add(base);
    var cap = new THREE.Mesh(new THREE.CylinderGeometry(.7,.5,.4,12), M.marbleLight);
    cap.position.y=16.2; g.add(cap);
    for(var b=0;b<4;b++){
      var band=new THREE.Mesh(new THREE.CylinderGeometry(.55,.55,.1,12),M.gold);
      band.position.y=2+b*4; g.add(band);
    }
    return g;
  },

  _mkLight: function() {
    var g = new THREE.Group(), M = RL.M;
    var pole = new THREE.Mesh(new THREE.CylinderGeometry(.04,.05,3,6), M.chrome);
    pole.position.y=1.5; g.add(pole);
    var hood = new THREE.Mesh(new THREE.CylinderGeometry(.01,.2,.3,8), M.darkSteel);
    hood.position.y=3.1; g.add(hood);
    var bulb = new THREE.Mesh(new THREE.SphereGeometry(.08,8,8), M.neon);
    bulb.position.y=3; g.add(bulb);
    var pl = new THREE.PointLight(0xf0d478, 1, 12);
    pl.position.y=3; g.add(pl);
    return g;
  },

  _mkRope: function() {
    var g = new THREE.Group(), M = RL.M;
    for(var i=0;i<2;i++){
      var post = new THREE.Mesh(new THREE.CylinderGeometry(.06,.08,1,8), M.gold);
      post.position.set(i*2,.5,0); g.add(post);
      var ball = new THREE.Mesh(new THREE.SphereGeometry(.08,8,8), M.gold);
      ball.position.set(i*2,1.05,0); g.add(ball);
    }
    var curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0,.9,0), new THREE.Vector3(1,.6,0), new THREE.Vector3(2,.9,0)
    ]);
    var rope = new THREE.Mesh(new THREE.TubeGeometry(curve,12,.025,6,false), M.velvetRed);
    g.add(rope);
    return g;
  },

  // ─── GLTF LOADER (robust, cached) ───
  _loadGLTF: function(folder, fitSize, cb) {
    var self = this;

    // Return cached clone
    if(this._gltfCache[folder]) {
      cb(this._gltfCache[folder].clone());
      return;
    }

    var url = 'models/' + folder + '/scene.gltf';
    var loader = new THREE.GLTFLoader();

    loader.load(url,
      // Success
      function(gltf) {
        var model = gltf.scene;
        var box = new THREE.Box3().setFromObject(model);
        var size = box.getSize(new THREE.Vector3());
        var center = box.getCenter(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z);
        if(maxDim === 0) maxDim = 1;
        var scale = fitSize / maxDim;

        model.scale.setScalar(scale);
        model.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);

        // Wrap in group
        var wrapper = new THREE.Group();
        wrapper.add(model);
        wrapper.traverse(function(c) {
          if(c.isMesh) {
            c.castShadow = false;
            c.receiveShadow = true;
            if(c.material){
              var mats = Array.isArray(c.material) ? c.material : [c.material];
              mats.forEach(function(m){
                ['map','normalMap','roughnessMap','metalnessMap','emissiveMap','aoMap'].forEach(function(k){
                  if(m[k]){
                    RL.build._downscaleTexture(m[k], 512);
                    m[k].generateMipmaps = false;
                    m[k].minFilter = THREE.LinearFilter;
                  }
                });
              });
            }
          }
        });

        // Cache it
        self._gltfCache[folder] = wrapper;
        cb(wrapper.clone());
      },
      // Progress
      function(xhr) {
        if(xhr.total > 0) {
          var pct = Math.round(xhr.loaded / xhr.total * 100);
          self._setStatus('Loading: ' + pct + '%');
        }
      },
      // Error
      function(err) {
        console.warn('Failed to load model:', folder, err);
        self._setStatus('Load failed: ' + folder);
      }
    );
  },

  // ─── UTILITY ───
  _updateCount: function() {
    var el = document.getElementById('buildCount');
    if(el) el.textContent = 'Objects: ' + RL.placed.length;
  },

  _onSizeChange: function(v){
    this._scaleMult = v;
    var el = document.getElementById('sizeVal');
    if(el) el.textContent = v.toFixed(1)+'x';
    // Live resize the object currently being moved
    if(this._moveTarget){
      this._moveTarget.scale.setScalar(v);
      this._moveTarget.userData._scale = v;
      this.saveLayout(true);
    }
  },

  // Export current layout as a downloadable JSON file
  exportLayoutFile: function(){
    var data = [];
    for(var i=0;i<RL.placed.length;i++){
      var o = RL.placed[i];
      data.push({
        t: o.userData._buildType,
        x: Math.round(o.position.x*100)/100,
        z: Math.round(o.position.z*100)/100,
        r: Math.round(o.rotation.y*100)/100,
        s: o.userData._scale || 1
      });
    }
    var blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'current.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this._setStatus('Exported '+data.length+' objects. Save to layouts/current.json');
  },

  // Import a layout from a user-selected file (file picker)
  importLayoutFile: function(){
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    var self = this;
    input.onchange = function(){
      var file = input.files && input.files[0];
      if(!file) return;
      var reader = new FileReader();
      reader.onload = function(){
        try {
          var data = JSON.parse(reader.result);
          if(!Array.isArray(data)){ self._setStatus('Invalid layout file'); return; }
          // Clear current placements
          for(var i=0;i<RL.placed.length;i++) RL.scene.remove(RL.placed[i]);
          RL.placed = [];
          RL.interactables = [];
          RL.roulettes = [];
          self._layoutLoaded = false;
          self._applyLayout(data);
          self.saveLayout(true);
          self._setStatus('Imported '+data.length+' objects');
        } catch(e){
          self._setStatus('Import failed: '+e.message);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  },

  saveLayout: function(silent) {
    var data = [];
    for(var i=0;i<RL.placed.length;i++){
      var o = RL.placed[i];
      data.push({
        t: o.userData._buildType,
        x: Math.round(o.position.x*100)/100,
        z: Math.round(o.position.z*100)/100,
        r: Math.round(o.rotation.y*100)/100,
        s: o.userData._scale || 1
      });
    }
    localStorage.setItem('runeluck_layout', JSON.stringify(data));
    // Fire-and-forget POST to the local server (ignored if server doesn't support it)
    try {
      fetch('/api/save-layout', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(data)
      }).catch(function(){});
    } catch(e){}
    if(!silent){
      this._setStatus('Saved '+data.length+' objects');
      setTimeout(function(){ RL.build._updateCount(); }, 1500);
    }
  },

  _loadLayout: function() {
    if(this._layoutLoaded) return; // guard against double-load
    this._layoutLoaded = true;
    var self = this;
    // Try layouts/current.json first (project file); fall back to localStorage
    fetch('layouts/current.json', {cache:'no-store'}).then(function(r){
      if(!r.ok) throw new Error('no file');
      return r.json();
    }).then(function(data){
      if(data && data.length){
        self._applyLayout(data);
        console.log('[build] loaded '+data.length+' items from layouts/current.json');
      } else {
        self._loadLayoutFromStorage();
      }
    }).catch(function(){
      self._loadLayoutFromStorage();
    });
  },

  _loadLayoutFromStorage: function() {
    try {
      var raw = localStorage.getItem('runeluck_layout');
      if(!raw) return;
      var data = JSON.parse(raw);
      if(!data || !data.length) return;
      // Immediately push localStorage state to server so layouts/current.json reflects reality
      try {
        fetch('/api/save-layout', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify(data)
        }).catch(function(){});
      } catch(e){}
      this._applyLayout(data);
      console.log('[build] loaded '+data.length+' items from localStorage');
    } catch(e) { console.warn('Layout load failed:', e); }
  },

  _applyLayout: function(data){
    try {
      // One-time cleanup: drop any dice items from the saved layout
      if(!localStorage.getItem('rl_dice_cleaned')){
        var filtered = data.filter(function(it){
          return !/dice/i.test(it.t||'');
        });
        if(filtered.length !== data.length){
          localStorage.setItem('runeluck_layout', JSON.stringify(filtered));
          data = filtered;
        }
        localStorage.setItem('rl_dice_cleaned','1');
      }
      var self = this;

      // Process layout in small batches with delays between batches
      // so the browser can breathe and the user sees something quickly.
      var queue = data.slice();
      function processBatch(){
        var BATCH = 3;
        var n = Math.min(BATCH, queue.length);
        for(var b=0;b<n;b++){
          (function(item){
            var def = self._getDef(item.t);
            if(!def) return;
            if(def.gltf) {
              self._loadGLTF(def.gltf, def.fit||3, function(obj) {
                obj.position.set(item.x, 0, item.z);
                obj.rotation.y = item.r || 0;
                obj.scale.setScalar(item.s || 1);
                obj.userData._buildType = def.id;
                obj.userData._scale = item.s || 1;
                RL.scene.add(obj);
                RL.placed.push(obj);
                self._tagInteractable(obj); self._tagBlock(obj);
              });
            } else {
              var obj = self._makeProc(def);
              if(obj) {
                obj.position.set(item.x, 0, item.z);
                obj.rotation.y = item.r || 0;
                obj.scale.setScalar(item.s || 1);
                obj.userData._buildType = def.id;
                obj.userData._scale = item.s || 1;
                if(def.cat==='Games') {
                  obj.userData.gameType = def.id==='slot'?'Slots':def.id==='roulette'?'Roulette':def.id==='blackjack'?'Blackjack':null;
                  if(obj.userData.gameType) RL.interactables.push(obj);
                  if(def.id==='roulette') RL.roulettes.push(obj);
                }
                RL.scene.add(obj);
                RL.placed.push(obj);
                self._tagInteractable(obj); self._tagBlock(obj);
              }
            }
          })(queue.shift());
        }
        if(queue.length) setTimeout(processBatch, 120);
      }
      processBatch();
      setTimeout(function(){ self._updateCount(); }, 6000);
    } catch(e) {
      console.warn('Layout load failed:', e);
    }
  },

  clearAll: function() {
    if(!confirm('Delete ALL placed objects?')) return;
    for(var i=0;i<RL.placed.length;i++) RL.scene.remove(RL.placed[i]);
    RL.placed = [];
    RL.interactables = [];
    RL.roulettes = [];
    localStorage.removeItem('runeluck_layout');
    this._updateCount();
  }
};

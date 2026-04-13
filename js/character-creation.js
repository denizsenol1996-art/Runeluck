// ═══════════════════════════════════════
// CHARACTER CREATION UI — live 3D preview
// ═══════════════════════════════════════

RL.characterCreation = {
  config: null,
  _modal: null,
  _renderer: null,
  _scene: null,
  _cam: null,
  _preview: null,
  _clock: null,
  _raf: 0,

  show(onComplete) {
    var self = this;
    this.config = JSON.parse(JSON.stringify(RL.character.DEFAULT));
    this._onComplete = onComplete;

    var modal = document.createElement('div');
    modal.id = 'charCreate';
    modal.innerHTML =
      '<div class="cc-panel">' +
        '<h2>Create Your Character</h2>' +
        '<div class="cc-content">' +
          '<div class="cc-preview"><canvas id="ccCanvas"></canvas></div>' +
          '<div class="cc-controls">' +
            '<div class="cc-row"><label>Name</label>' +
              '<input type="text" id="ccName" value="Adventurer" maxlength="16">' +
            '</div>' +
            '<div class="cc-row"><label>Outfit Color</label>' +
              '<div class="cc-btns cc-swatches" data-opt="bodyTintIdx" data-pal="BODY_TINTS"></div>' +
            '</div>' +
            '<div class="cc-row"><label>Visor Color</label>' +
              '<div class="cc-btns cc-swatches" data-opt="visorTintIdx" data-pal="VISOR_TINTS"></div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<button id="ccConfirm" class="cc-confirm">Enter 3DC</button>' +
      '</div>';
    document.body.appendChild(modal);
    this._modal = modal;

    this._buildControls();
    this._initPreview();
    this._refreshPreview();
    this._clock = new THREE.Clock();
    this._loop();

    document.getElementById('ccName').addEventListener('input', function(e){
      self.config.name = e.target.value || 'Adventurer';
    });

    document.getElementById('ccConfirm').onclick = function(){
      self.config.name = (document.getElementById('ccName').value || 'Adventurer').slice(0,16);
      RL.character.save(self.config);
      var done = self._onComplete;
      var cfg = self.config;
      self._cleanup();
      if(done) done(cfg);
    };
  },

  _buildControls(){
    var self = this;
    this._modal.querySelectorAll('.cc-swatches').forEach(function(div){
      var key = div.dataset.opt;
      var pal = RL.character[div.dataset.pal];
      pal.forEach(function(item, i){
        var color = item.color;
        var sw = document.createElement('button');
        sw.className = 'cc-swatch' + (i === self.config[key] ? ' sel' : '');
        sw.style.background = '#' + color.toString(16).padStart(6,'0');
        sw.title = item.name;
        sw.onclick = function(){
          self.config[key] = i;
          div.querySelectorAll('.cc-swatch').forEach(function(s){s.classList.remove('sel');});
          sw.classList.add('sel');
          self._refreshPreview();
        };
        div.appendChild(sw);
      });
    });
  },

  _initPreview(){
    var canvas = document.getElementById('ccCanvas');
    var w = 320, h = 440;
    this._renderer = new THREE.WebGLRenderer({canvas: canvas, antialias: true});
    this._renderer.setSize(w, h, false);
    this._renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this._renderer.setClearColor(0x0a0e18);
    this._renderer.shadowMap.enabled = true;

    this._scene = new THREE.Scene();
    this._cam = new THREE.PerspectiveCamera(32, w/h, .1, 30);
    this._cam.position.set(0, 1.5, 4.2);
    this._cam.lookAt(0, 1, 0);

    this._scene.add(new THREE.AmbientLight(0xffffff, .55));
    var key = new THREE.DirectionalLight(0xffeedd, 1.4);
    key.position.set(2, 4, 3);
    this._scene.add(key);
    var fill = new THREE.DirectionalLight(0x88aadd, .4);
    fill.position.set(-2, 2, -1);
    this._scene.add(fill);

    var plat = new THREE.Mesh(
      new THREE.CylinderGeometry(.9, .9, .05, 32),
      new THREE.MeshStandardMaterial({color: 0x1a1d24, metalness:.3, roughness:.5})
    );
    plat.receiveShadow = true;
    this._scene.add(plat);
    var ring = new THREE.Mesh(
      new THREE.TorusGeometry(.92, .02, 8, 32),
      new THREE.MeshStandardMaterial({color: 0xd4a843, metalness:.8, roughness:.2})
    );
    ring.rotation.x = Math.PI/2;
    ring.position.y = .03;
    this._scene.add(ring);
  },

  _loop(){
    var self = this;
    function tick(){
      if(!self._modal) return;
      self._raf = requestAnimationFrame(tick);
      var dt = self._clock.getDelta();
      if(self._preview){
        self._preview.rotation.y += .012;
        if(self._preview.userData.mixer) self._preview.userData.mixer.update(dt);
      }
      self._renderer.render(self._scene, self._cam);
    }
    tick();
  },

  _refreshPreview(){
    if(this._preview){
      this._scene.remove(this._preview);
    }
    this._preview = RL.character.build(this.config);
    this._scene.add(this._preview);
  },

  _cleanup(){
    cancelAnimationFrame(this._raf);
    if(this._preview){
      this._scene.remove(this._preview);
    }
    if(this._renderer) this._renderer.dispose();
    if(this._modal && this._modal.parentNode) this._modal.parentNode.removeChild(this._modal);
    this._modal = null;
    this._renderer = null;
    this._scene = null;
    this._preview = null;
  }
};

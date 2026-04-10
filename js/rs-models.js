// ═══════════════════════════════════════
// RS MODEL LOADER — Load 317 cache models in Three.js
// Works with JSON files from export-models.js
// ═══════════════════════════════════════

RL.rsModels = {
  cache: {},  // loaded model geometries by ID

  // Load a model JSON file and return a Three.js Mesh
  async load(modelId, basePath = 'models/rs/') {
    // Check cache
    if (this.cache[modelId]) return this._createMesh(this.cache[modelId]);

    try {
      const resp = await fetch(basePath + modelId + '.json');
      const data = await resp.json();

      // Build BufferGeometry from flat arrays
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
      geo.computeVertexNormals();

      this.cache[modelId] = geo;
      return this._createMesh(geo);
    } catch (e) {
      console.warn('Failed to load RS model', modelId, e);
      return null;
    }
  },

  // Create a mesh from cached geometry
  _createMesh(geo) {
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.6,
      metalness: 0.1,
      flatShading: true,  // OSRS low-poly look
    });
    const mesh = new THREE.Mesh(geo.clone(), mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  },

  // Load multiple models and group them
  async loadGroup(modelIds, basePath) {
    const group = new THREE.Group();
    for (const id of modelIds) {
      const mesh = await this.load(id, basePath);
      if (mesh) group.add(mesh);
    }
    return group;
  },

  // Load and place in scene at position
  async place(modelId, x, y, z, rotY = 0, scale = 1) {
    const mesh = await this.load(modelId);
    if (!mesh) return null;
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.scale.setScalar(scale);
    RL.scene.add(mesh);
    return mesh;
  }
};

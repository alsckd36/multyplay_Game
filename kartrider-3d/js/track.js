// Procedural 3D Track: Village Circuit with Curbs, Barriers, Start Gate, Boost Pads, and Waypoints
class RaceTrack {
  constructor(scene) {
    this.scene = scene;
    this.trackWidth = 14;
    this.waypoints = [];
    this.curve = null;
    this.boostPads = [];
    this.itemBoxes = [];
    this.bounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  }

  generate() {
    // 1. Define closed spline path (Boomhill Village Circuit)
    const points = [
      new THREE.Vector3(0, 0, 0),        // Start line
      new THREE.Vector3(0, 0, -80),      // Straightaway 1
      new THREE.Vector3(20, 0, -140),    // Curve 1 entry
      new THREE.Vector3(70, 0.5, -180),  // Hairpin turn 1
      new THREE.Vector3(120, 1.5, -160),
      new THREE.Vector3(140, 3.2, -100), // Gentle hill rise
      new THREE.Vector3(130, 4.0, -40),  // Hill peak
      new THREE.Vector3(90, 2.0, 10),    // S-curve right descent
      new THREE.Vector3(120, 0.5, 80),   // S-curve left
      new THREE.Vector3(110, 0, 150),    // Hairpin turn 2
      new THREE.Vector3(50, 0, 170),
      new THREE.Vector3(-10, 0, 140),
      new THREE.Vector3(-40, 0, 80),     // Chicanes
      new THREE.Vector3(-30, 0, 30),
    ];

    this.curve = new THREE.CatmullRomCurve3(points, true); // closed loop
    this.curve.tension = 0.5;

    // 2. Sample dense waypoints for navigation and ranking
    const sampleCount = 180;
    this.waypoints = [];
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;

    for (let i = 0; i < sampleCount; i++) {
      const t = i / sampleCount;
      const pt = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
      this.waypoints.push({ pt, tangent, normal, t, index: i });

      minX = Math.min(minX, pt.x);
      maxX = Math.max(maxX, pt.x);
      minZ = Math.min(minZ, pt.z);
      maxZ = Math.max(maxZ, pt.z);
    }
    this.bounds = { minX: minX - 30, maxX: maxX + 30, minZ: minZ - 30, maxZ: maxZ + 30 };

    // 3. Build Road Geometry (Asphalt + Curbs)
    this.buildRoadMesh(sampleCount);

    // 4. Build Safety Guardrails
    this.buildGuardrails(sampleCount);

    // 5. Build Start / Finish Arch & Checkered Grid
    this.buildStartGate();

    // 6. Build Environment (Grass, Trees, Buildings, Lights)
    this.buildEnvironment();

    // 7. Build Boost Pads (Yellow Speed Strips)
    this.buildBoostPads();

    return this;
  }

  buildRoadMesh(sampleCount) {
    const halfW = this.trackWidth / 2;
    const curbW = 1.4;

    const roadGeo = new THREE.BufferGeometry();
    const curbGeo = new THREE.BufferGeometry();

    const roadVerts = [];
    const roadNorms = [];
    const roadUvs = [];
    const roadIndices = [];

    const curbVerts = [];
    const curbNorms = [];
    const curbColors = [];
    const curbIndices = [];

    let rVertIdx = 0;
    let cVertIdx = 0;

    for (let i = 0; i <= sampleCount; i++) {
      const t = (i % sampleCount) / sampleCount;
      const pt = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      // Road left and right points
      const left = pt.clone().addScaledVector(normal, halfW);
      const right = pt.clone().addScaledVector(normal, -halfW);

      roadVerts.push(left.x, left.y + 0.05, left.z);
      roadVerts.push(right.x, right.y + 0.05, right.z);
      roadNorms.push(0, 1, 0, 0, 1, 0);
      roadUvs.push(0, i * 0.1, 1, i * 0.1);

      if (i < sampleCount) {
        const row1 = i * 2;
        const row2 = (i + 1) * 2;
        roadIndices.push(row1, row1 + 1, row2);
        roadIndices.push(row1 + 1, row2 + 1, row2);
      }

      // Curbs on left and right
      const curbLeftOuter = left.clone().addScaledVector(normal, curbW);
      const curbRightOuter = right.clone().addScaledVector(normal, -curbW);

      // Alternating Red/White curbs
      const isRed = (Math.floor(i / 2) % 2 === 0);
      const rColor = isRed ? [0.95, 0.15, 0.15] : [0.95, 0.95, 0.95];

      // Left curb
      curbVerts.push(left.x, left.y + 0.08, left.z);
      curbVerts.push(curbLeftOuter.x, curbLeftOuter.y + 0.15, curbLeftOuter.z);
      curbNorms.push(0, 1, 0, 0, 1, 0);
      curbColors.push(...rColor, ...rColor);

      // Right curb
      curbVerts.push(right.x, right.y + 0.08, right.z);
      curbVerts.push(curbRightOuter.x, curbRightOuter.y + 0.15, curbRightOuter.z);
      curbNorms.push(0, 1, 0, 0, 1, 0);
      curbColors.push(...rColor, ...rColor);

      if (i < sampleCount) {
        // Left curb quads
        const l1 = i * 4;
        const l2 = (i + 1) * 4;
        curbIndices.push(l1, l1 + 1, l2);
        curbIndices.push(l1 + 1, l2 + 1, l2);

        // Right curb quads
        const r1 = i * 4 + 2;
        const r2 = (i + 1) * 4 + 2;
        curbIndices.push(r1, r2, r1 + 1);
        curbIndices.push(r1 + 1, r2, r2 + 1);
      }
    }

    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadVerts, 3));
    roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roadNorms, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
    roadGeo.setIndex(roadIndices);

    // Create dark asphalt material with road center stripes
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x22262e,
      roughness: 0.8,
      metalness: 0.1
    });
    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    this.scene.add(roadMesh);

    curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbVerts, 3));
    curbGeo.setAttribute('normal', new THREE.Float32BufferAttribute(curbNorms, 3));
    curbGeo.setAttribute('color', new THREE.Float32BufferAttribute(curbColors, 3));
    curbGeo.setIndex(curbIndices);

    const curbMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.7
    });
    const curbMesh = new THREE.Mesh(curbGeo, curbMat);
    this.scene.add(curbMesh);

    // Add yellow center dashed line
    this.buildCenterStripes(sampleCount);
  }

  buildCenterStripes(sampleCount) {
    const lineGeo = new THREE.BufferGeometry();
    const linePositions = [];

    for (let i = 0; i < sampleCount; i += 2) {
      const t1 = i / sampleCount;
      const t2 = (i + 0.8) / sampleCount;
      const p1 = this.curve.getPointAt(t1);
      const p2 = this.curve.getPointAt(t2);
      linePositions.push(p1.x, p1.y + 0.08, p1.z);
      linePositions.push(p2.x, p2.y + 0.08, p2.z);
    }
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const lineMat = new THREE.LineBasicMaterial({ color: 0xffd700, linewidth: 3 });
    const centerLines = new THREE.LineSegments(lineGeo, lineMat);
    this.scene.add(centerLines);
  }

  buildGuardrails(sampleCount) {
    const halfW = this.trackWidth / 2 + 1.2;
    const railHeight = 1.0;
    const baseElevation = 0.15;

    // Create striped safety rail texture (Red & White diagonals)
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 128, 32);
    ctx.fillStyle = '#ef4444';
    for (let x = -32; x < 160; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 20, 0);
      ctx.lineTo(x + 4, 32);
      ctx.lineTo(x - 16, 32);
      ctx.closePath();
      ctx.fill();
    }
    const railTex = new THREE.CanvasTexture(canvas);
    railTex.wrapS = THREE.RepeatWrapping;
    railTex.wrapT = THREE.ClampToEdgeWrapping;
    railTex.repeat.set(50, 1);

    const railMat = new THREE.MeshStandardMaterial({
      map: railTex,
      roughness: 0.4,
      metalness: 0.3,
      side: THREE.DoubleSide
    });

    const buildSideRail = (sideMultiplier) => {
      const geo = new THREE.BufferGeometry();
      const verts = [];
      const uvs = [];
      const indices = [];

      for (let i = 0; i <= sampleCount; i++) {
        const t = (i % sampleCount) / sampleCount;
        const pt = this.curve.getPointAt(t);
        const tangent = this.curve.getTangentAt(t).normalize();
        const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

        const base = pt.clone().addScaledVector(normal, halfW * sideMultiplier);
        verts.push(base.x, base.y + baseElevation, base.z);
        verts.push(base.x, base.y + baseElevation + railHeight, base.z);

        uvs.push(i * 0.3, 0);
        uvs.push(i * 0.3, 1);

        if (i < sampleCount) {
          const row1 = i * 2;
          const row2 = (i + 1) * 2;
          indices.push(row1, row1 + 1, row2);
          indices.push(row1 + 1, row2 + 1, row2);
        }

        // Support post every 4 waypoints
        if (i % 4 === 0) {
          const postGeo = new THREE.CylinderGeometry(0.12, 0.12, railHeight + 0.3, 6);
          const postMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 });
          const post = new THREE.Mesh(postGeo, postMat);
          post.position.set(base.x, base.y + baseElevation + (railHeight / 2), base.z);
          this.scene.add(post);
        }
      }

      geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, railMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    };

    buildSideRail(1);  // Left barrier
    buildSideRail(-1); // Right barrier
  }

  buildStartGate() {
    const startPoint = this.waypoints[0].pt;
    const tangent = this.waypoints[0].tangent;
    const normal = this.waypoints[0].normal;
    const halfW = this.trackWidth / 2 + 1.2;

    const gateGroup = new THREE.Group();

    // Left & Right Pillars
    const pillarGeo = new THREE.CylinderGeometry(0.5, 0.6, 9, 12);
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3, metalness: 0.6 });

    const pLeft = new THREE.Mesh(pillarGeo, pillarMat);
    pLeft.position.copy(startPoint).addScaledVector(normal, halfW);
    pLeft.position.y += 4.5;
    gateGroup.add(pLeft);

    const pRight = new THREE.Mesh(pillarGeo, pillarMat);
    pRight.position.copy(startPoint).addScaledVector(normal, -halfW);
    pRight.position.y += 4.5;
    gateGroup.add(pRight);

    // Overhead Arch Banner
    const beamGeo = new THREE.BoxGeometry(halfW * 2 + 1, 2.2, 1.2);
    const beamMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4 });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.copy(startPoint);
    beam.position.y += 8.2;
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), normal);
    gateGroup.add(beam);

    // Checkered Start Line on Ground
    const checkGeo = new THREE.PlaneGeometry(this.trackWidth, 3.5);
    checkGeo.rotateX(-Math.PI / 2);
    // Procedural checkered texture
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    const cols = 8;
    const rows = 2;
    const cellW = 128 / cols;
    const cellH = 32 / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#1e293b';
        ctx.fillRect(c * cellW, r * cellH, cellW, cellH);
      }
    }
    const checkTex = new THREE.CanvasTexture(canvas);
    const checkMat = new THREE.MeshBasicMaterial({ map: checkTex });
    const checkMesh = new THREE.Mesh(checkGeo, checkMat);
    checkMesh.position.copy(startPoint);
    checkMesh.position.y += 0.08;
    checkMesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), normal);
    gateGroup.add(checkMesh);

    this.scene.add(gateGroup);
  }

  buildEnvironment() {
    // 1. Broad ground landscape
    const groundGeo = new THREE.PlaneGeometry(600, 600, 32, 32);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80, // vibrant cartoon grass
      roughness: 0.9,
      metalness: 0.05
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.position.y = -0.1;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // 2. Add Stylized Trees along the landscape
    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = 50 + Math.random() * 180;
      const x = Math.cos(angle) * radius + 50;
      const z = Math.sin(angle) * radius;

      // Check distance from all waypoints to ensure trees don't block the road
      let tooClose = false;
      for (let j = 0; j < this.waypoints.length; j += 4) {
        const wp = this.waypoints[j].pt;
        const distSq = (wp.x - x) ** 2 + (wp.z - z) ** 2;
        if (distSq < (this.trackWidth + 6) ** 2) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
        this.buildTree(x, z);
      }
    }

    // 3. Add Colorful Village Buildings / Grandstands
    const bldgColors = [0x38bdf8, 0xf43f5e, 0xfbbf24, 0xa855f7, 0x10b981];
    for (let i = 0; i < 20; i++) {
      const wp = this.waypoints[Math.floor(Math.random() * this.waypoints.length)];
      const offsetDist = 18 + Math.random() * 25;
      const side = Math.random() > 0.5 ? 1 : -1;
      const pos = wp.pt.clone().addScaledVector(wp.normal, offsetDist * side);

      const bW = 10 + Math.random() * 12;
      const bH = 12 + Math.random() * 18;
      const bD = 10 + Math.random() * 10;
      const bGeo = new THREE.BoxGeometry(bW, bH, bD);
      const bMat = new THREE.MeshStandardMaterial({
        color: bldgColors[Math.floor(Math.random() * bldgColors.length)],
        roughness: 0.5
      });
      const building = new THREE.Mesh(bGeo, bMat);
      building.position.set(pos.x, bH / 2, pos.z);
      building.castShadow = true;
      this.scene.add(building);

      // Roof
      const roofGeo = new THREE.ConeGeometry(bW * 0.75, 5, 4);
      roofGeo.rotateY(Math.PI / 4);
      const roofMat = new THREE.MeshStandardMaterial({ color: 0xef4444 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(pos.x, bH + 2.5, pos.z);
      this.scene.add(roof);
    }
  }

  buildTree(x, z) {
    const treeGroup = new THREE.Group();
    // Trunk
    const trunkGeo = new THREE.CylinderGeometry(0.4, 0.6, 3, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 1.5;
    treeGroup.add(trunk);

    // Leaves (Cartoon Puff)
    const leavesGeo = new THREE.DodecahedronGeometry(2.2, 1);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.8 });
    const leaves = new THREE.Mesh(leavesGeo, leavesMat);
    leaves.position.y = 3.8;
    treeGroup.add(leaves);

    treeGroup.position.set(x, 0, z);
    const scale = 0.8 + Math.random() * 0.5;
    treeGroup.scale.set(scale, scale, scale);
    this.scene.add(treeGroup);
  }

  buildBoostPads() {
    // Strategic boost pad zones on the track
    const padIndices = [35, 95, 145];
    padIndices.forEach((idx) => {
      const wp = this.waypoints[idx];
      const geo = new THREE.PlaneGeometry(6, 4);
      geo.rotateX(-Math.PI / 2);

      // Create glowing chevron boost pad texture
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(0, 0, 64, 64);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.moveTo(32, 8);
      ctx.lineTo(56, 40);
      ctx.lineTo(44, 40);
      ctx.lineTo(32, 24);
      ctx.lineTo(20, 40);
      ctx.lineTo(8, 40);
      ctx.closePath();
      ctx.fill();

      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, mat);

      mesh.position.copy(wp.pt);
      mesh.position.y += 0.09;
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), wp.tangent);

      this.scene.add(mesh);
      this.boostPads.push({ position: wp.pt.clone(), radius: 3.5 });
    });
  }

  // Find nearest waypoint index to a given 3D position
  getNearestWaypoint(pos) {
    let minDistSq = Infinity;
    let nearestIdx = 0;
    for (let i = 0; i < this.waypoints.length; i++) {
      const wp = this.waypoints[i].pt;
      const dSq = (wp.x - pos.x) ** 2 + (wp.z - pos.z) ** 2;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        nearestIdx = i;
      }
    }
    return { index: nearestIdx, dist: Math.sqrt(minDistSq) };
  }

  // Calculate normalized race progress [0..1]
  getProgress(pos) {
    const { index, dist } = this.getNearestWaypoint(pos);
    return index / this.waypoints.length;
  }
}

window.RaceTrack = RaceTrack;

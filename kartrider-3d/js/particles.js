// Particle systems: Booster flames, Drift smoke, Skid marks, Explosions, Shields
class ParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.skidMarks = [];
    this.maxSkidMarks = 150;

    // Reusable geometries and materials
    this.smokeGeo = new THREE.DodecahedronGeometry(0.2, 0);
    this.smokeMat = new THREE.MeshBasicMaterial({
      color: 0xcccccc,
      transparent: true,
      opacity: 0.6
    });

    this.flameGeo = new THREE.ConeGeometry(0.15, 0.6, 6);
    this.flameGeo.rotateX(-Math.PI / 2); // points backward
    this.flameMat = new THREE.MeshBasicMaterial({
      color: 0xff3b00,
      transparent: true,
      opacity: 0.9
    });

    this.sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array([0, 0, 0]);
    this.sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
    this.sparkMat = new THREE.PointsMaterial({
      color: 0xffff55,
      size: 0.3,
      transparent: true,
      opacity: 0.9
    });
  }

  createDriftSmoke(position, velocity) {
    const mesh = new THREE.Mesh(this.smokeGeo, this.smokeMat.clone());
    mesh.position.copy(position);
    mesh.position.y += 0.1;
    mesh.scale.setScalar(0.4 + Math.random() * 0.4);

    this.scene.add(mesh);
    this.particles.push({
      mesh,
      life: 1.0,
      maxLife: 1.0,
      decay: 2.0 + Math.random() * 1.5,
      vel: new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        0.5 + Math.random() * 0.5,
        (Math.random() - 0.5) * 1.5
      ).addScaledVector(velocity, 0.1),
      grow: 1.8
    });
  }

  addSkidMark(p1, p2) {
    if (!p1 || !p2) return;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      p1.x, p1.y + 0.02, p1.z,
      p2.x, p2.y + 0.02, p2.z
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const material = new THREE.LineBasicMaterial({
      color: 0x111111,
      linewidth: 3,
      transparent: true,
      opacity: 0.55
    });

    const line = new THREE.Line(geometry, material);
    this.scene.add(line);
    this.skidMarks.push({ line, life: 1.0, decay: 0.08 });

    // Limit maximum active skid marks
    if (this.skidMarks.length > this.maxSkidMarks) {
      const old = this.skidMarks.shift();
      this.scene.remove(old.line);
      old.line.geometry.dispose();
      old.line.material.dispose();
    }
  }

  createExplosion(position) {
    const count = 30;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.DodecahedronGeometry(0.3 + Math.random() * 0.4, 0);
      const isFire = Math.random() > 0.4;
      const mat = new THREE.MeshBasicMaterial({
        color: isFire ? 0xff4500 : 0xffcc00,
        transparent: true,
        opacity: 0.95
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      this.scene.add(mesh);

      const speed = 4 + Math.random() * 8;
      const angle = Math.random() * Math.PI * 2;
      const up = 2 + Math.random() * 6;
      this.particles.push({
        mesh,
        life: 1.0,
        decay: 1.8 + Math.random() * 1.2,
        vel: new THREE.Vector3(Math.cos(angle) * speed, up, Math.sin(angle) * speed),
        grow: 0.5
      });
    }
  }

  createWaterSplash(position) {
    const count = 20;
    for (let i = 0; i < count; i++) {
      const geo = new THREE.SphereGeometry(0.15 + Math.random() * 0.2, 6, 6);
      const mat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.75
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(position);
      this.scene.add(mesh);

      const speed = 2 + Math.random() * 4;
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        mesh,
        life: 1.0,
        decay: 2.0,
        vel: new THREE.Vector3(Math.cos(angle) * speed, 3 + Math.random() * 4, Math.sin(angle) * speed),
        grow: -0.2
      });
    }
  }

  update(dt) {
    // Update active particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= p.decay * dt;

      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }

      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.material.opacity = p.life;
      if (p.grow) {
        p.mesh.scale.addScalar(p.grow * dt);
      }
    }

    // Fade skid marks
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      const s = this.skidMarks[i];
      s.life -= s.decay * dt;
      if (s.life <= 0) {
        this.scene.remove(s.line);
        s.line.geometry.dispose();
        s.line.material.dispose();
        this.skidMarks.splice(i, 1);
      } else {
        s.line.material.opacity = s.life * 0.55;
      }
    }
  }
}
window.ParticleManager = ParticleManager;

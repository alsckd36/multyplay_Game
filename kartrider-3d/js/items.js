// Item Box spawns and Items System (Missile, Banana, Water Bomb, Shield, Booster, Magnet)
class ItemManager {
  constructor(scene, particleManager) {
    this.scene = scene;
    this.particleManager = particleManager;
    this.itemBoxes = [];
    this.activeBananas = [];
    this.activeMissiles = [];
    this.itemTypes = ['booster', 'missile', 'banana', 'waterbomb', 'shield', 'magnet'];

    // Item icons and display names
    this.itemData = {
      booster: { name: '부스터', icon: '⚡', color: '#f59e0b' },
      missile: { name: '미사일', icon: '🚀', color: '#ef4444' },
      banana: { name: '바나나', icon: '🍌', color: '#eab308' },
      waterbomb: { name: '물폭탄', icon: '💧', color: '#0ea5e9' },
      shield: { name: '쉴드', icon: '🛡️', color: '#10b981' },
      magnet: { name: '자석', icon: '🧲', color: '#8b5cf6' }
    };

    // Shared Geometries
    this.boxGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    this.missileGeo = new THREE.CylinderGeometry(0.2, 0.2, 1.2, 8);
    this.missileGeo.rotateX(Math.PI / 2);
    this.bananaGeo = new THREE.CylinderGeometry(0.12, 0.2, 0.8, 6);
    this.bananaGeo.rotateZ(Math.PI / 3);
  }

  initTrackItems(track) {
    // Clear existing
    this.itemBoxes.forEach(b => this.scene.remove(b.group));
    this.itemBoxes = [];

    // Place rows of 3 item boxes across track width at strategic checkpoints
    const boxLocations = [25, 75, 125];
    boxLocations.forEach(idx => {
      const wp = track.waypoints[idx];
      const offsets = [-4.0, 0, 4.0];

      offsets.forEach(offset => {
        const group = new THREE.Group();
        const pos = wp.pt.clone().addScaledVector(wp.normal, offset);
        pos.y = 1.3;
        group.position.copy(pos);

        // Holographic Glowing Cube
        const mat = new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          roughness: 0.2,
          metalness: 0.8,
          emissive: 0xd97706,
          emissiveIntensity: 0.6,
          transparent: true,
          opacity: 0.85
        });
        const cube = new THREE.Mesh(this.boxGeo, mat);
        group.add(cube);

        // Floating Question Mark Inside
        const innerGeo = new THREE.OctahedronGeometry(0.6, 0);
        const innerMat = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
        const inner = new THREE.Mesh(innerGeo, innerMat);
        group.add(inner);

        this.scene.add(group);
        this.itemBoxes.push({
          group,
          cube,
          inner,
          baseY: pos.y,
          active: true,
          respawnTimer: 0
        });
      });
    });
  }

  update(dt, allKarts) {
    const time = Date.now() * 0.003;

    // 1. Update item boxes (floating, rotation, collisions)
    this.itemBoxes.forEach(box => {
      if (!box.active) {
        box.respawnTimer -= dt;
        if (box.respawnTimer <= 0) {
          box.active = true;
          box.group.visible = true;
        }
        return;
      }

      box.cube.rotation.x = time;
      box.cube.rotation.y = time * 1.5;
      box.inner.rotation.y = -time * 2;
      box.group.position.y = box.baseY + Math.sin(time * 2) * 0.3;

      // Check collision with karts
      allKarts.forEach(kart => {
        if (!box.active || kart.finished) return;
        const distSq = (kart.position.x - box.group.position.x) ** 2 + (kart.position.z - box.group.position.z) ** 2;
        if (distSq < 3.2 ** 2) {
          // Kart collected item!
          box.active = false;
          box.group.visible = false;
          box.respawnTimer = 4.0; // 4s respawn

          if (kart.items.length < 2) {
            const randomItem = this.getRandomItem();
            kart.items.push(randomItem);
            if (kart.isPlayer && window.soundManager) {
              window.soundManager.playItemPickup();
            }
          }
        }
      });
    });

    // 2. Update active bananas on track
    for (let i = this.activeBananas.length - 1; i >= 0; i--) {
      const b = this.activeBananas[i];
      b.life -= dt;
      if (b.life <= 0) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mesh.material.dispose();
        this.activeBananas.splice(i, 1);
        continue;
      }

      // Check collision with karts
      allKarts.forEach(kart => {
        if (kart.isSpinningOut || kart.finished) return;
        const dSq = (kart.position.x - b.mesh.position.x) ** 2 + (kart.position.z - b.mesh.position.z) ** 2;
        if (dSq < 2.0 ** 2) {
          kart.applyBananaSlip();
          // Remove banana after triggering
          this.scene.remove(b.mesh);
          b.mesh.geometry.dispose();
          b.mesh.material.dispose();
          this.activeBananas.splice(i, 1);
        }
      });
    }

    // 3. Update active homing missiles
    for (let i = this.activeMissiles.length - 1; i >= 0; i--) {
      const m = this.activeMissiles[i];
      m.life -= dt;

      if (m.life <= 0 || !m.target) {
        this.destroyMissile(i);
        continue;
      }

      // Home towards target kart
      const targetPos = m.target.position.clone();
      targetPos.y += 0.8;

      const dir = targetPos.clone().sub(m.mesh.position);
      const dist = dir.length();

      if (dist < 1.8) {
        // Direct Hit!
        m.target.applyMissileHit();
        this.destroyMissile(i);
        continue;
      }

      dir.normalize();
      m.mesh.position.addScaledVector(dir, m.speed * dt);
      m.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

      // Rocket exhaust smoke
      if (this.particleManager && Math.random() < 0.4) {
        this.particleManager.createDriftSmoke(m.mesh.position, dir.clone().multiplyScalar(-5));
      }
    }
  }

  destroyMissile(index) {
    const m = this.activeMissiles[index];
    this.scene.remove(m.mesh);
    m.mesh.geometry.dispose();
    m.mesh.material.dispose();
    this.activeMissiles.splice(index, 1);
  }

  getRandomItem() {
    return this.itemTypes[Math.floor(Math.random() * this.itemTypes.length)];
  }

  useItem(kart, itemType, allKarts) {
    switch (itemType) {
      case 'booster':
        kart.triggerBooster(3.2);
        break;

      case 'shield':
        kart.activateShield(5.0);
        break;

      case 'banana':
        this.dropBanana(kart);
        break;

      case 'missile':
        this.fireMissile(kart, allKarts);
        break;

      case 'waterbomb':
        this.launchWaterBomb(kart, allKarts);
        break;

      case 'magnet':
        this.useMagnet(kart, allKarts);
        break;
    }
  }

  dropBanana(kart) {
    const bMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.3 });
    const mesh = new THREE.Mesh(this.bananaGeo, bMat);

    // Drop behind kart
    const forwardX = -Math.sin(kart.heading);
    const forwardZ = -Math.cos(kart.heading);
    const dropPos = kart.position.clone().add(new THREE.Vector3(-forwardX * 2.8, 0, -forwardZ * 2.8));
    dropPos.y = 0.2;

    mesh.position.copy(dropPos);
    this.scene.add(mesh);
    this.activeBananas.push({ mesh, life: 35.0 });

    if (kart.isPlayer && window.soundManager) {
      window.soundManager.playBananaSlip();
    }
  }

  fireMissile(kart, allKarts) {
    // Find closest kart ahead in distance
    let target = null;
    let minAheadDist = Infinity;

    allKarts.forEach(other => {
      if (other === kart || other.finished) return;
      const ahead = other.totalDistance - kart.totalDistance;
      if (ahead > 0 && ahead < minAheadDist) {
        minAheadDist = ahead;
        target = other;
      }
    });

    // Fallback: if in 1st place, fire forward
    if (!target) {
      target = allKarts.find(k => k !== kart && !k.finished);
    }
    if (!target) return;

    const mMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.8 });
    const mesh = new THREE.Mesh(this.missileGeo, mMat);
    mesh.position.copy(kart.position);
    mesh.position.y += 1.2;
    this.scene.add(mesh);

    this.activeMissiles.push({
      mesh,
      target,
      speed: 75,
      life: 4.5
    });

    if (kart.isPlayer && window.soundManager) {
      window.soundManager.playMissileLaunch();
    }
  }

  launchWaterBomb(kart, allKarts) {
    // Target leader kart (1st place)
    let leader = allKarts[0];
    let maxDist = -Infinity;
    allKarts.forEach(k => {
      if (k.totalDistance > maxDist) {
        maxDist = k.totalDistance;
        leader = k;
      }
    });

    if (leader && leader !== kart) {
      leader.applyWaterBomb();
    } else {
      // If user is leader, hit 2nd place
      const runnerUp = allKarts.filter(k => k !== kart).sort((a, b) => b.totalDistance - a.totalDistance)[0];
      if (runnerUp) runnerUp.applyWaterBomb();
    }
  }

  useMagnet(kart, allKarts) {
    // Boost towards kart ahead
    kart.triggerBooster(2.2);
    kart.speed = Math.max(kart.speed + 20, 65);
    if (kart.isPlayer && window.soundManager) {
      window.soundManager.playBooster();
    }
  }
}

window.ItemManager = ItemManager;

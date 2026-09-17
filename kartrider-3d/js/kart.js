// 3D Procedural Kart Model, Arcade Drift Physics, AI Logic
class Kart {
  constructor(scene, particleManager, isPlayer = false, config = {}) {
    this.scene = scene;
    this.particleManager = particleManager;
    this.isPlayer = isPlayer;

    this.name = config.name || (isPlayer ? '라이더' : 'AI 레이서');
    this.bodyColor = config.bodyColor || (isPlayer ? 0x2563eb : 0xdc2626);
    this.helmetColor = config.helmetColor || (isPlayer ? 0x60a5fa : 0xf87171);

    // Physics parameters
    this.position = new THREE.Vector3(0, 0.4, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.heading = 0; // yaw angle in radians
    this.speed = 0;   // scalar forward speed

    this.baseMaxSpeed = 48; // ~130 km/h display
    this.maxSpeed = this.baseMaxSpeed;
    this.accel = 32;
    this.decel = 22;
    this.turnSpeed = 1.7; // Tuned for smooth, stable arcade turning
    this.currentSteer = 0; // Interpolated steer value to eliminate twitching

    // Drift system
    this.isDrifting = false;
    this.driftDir = 0; // -1 = left, 1 = right
    this.driftAngle = 0; // visual yaw offset
    this.driftGauge = 0; // 0 to 100
    this.driftTime = 0;
    this.canShortBoost = false;
    this.shortBoostTimer = 0;

    // Boost system
    this.boosterActive = false;
    this.boosterTimer = 0;
    this.shortBoosterActive = false;
    this.shortBoosterTimer = 0;

    // Status debuffs / items
    this.isShieldActive = false;
    this.shieldTimer = 0;
    this.isTrappedInWater = false;
    this.waterTimer = 0;
    this.isAirborneHit = false;
    this.airborneTimer = 0;
    this.isSpinningOut = false;
    this.spinTimer = 0;
    this.spinAngle = 0;

    // Race progress tracking
    this.currentLap = 1;
    this.lastWaypointIdx = 0;
    this.totalDistance = 0;
    this.finished = false;
    this.finishTime = 0;

    // Inventory
    this.items = []; // max 2 items

    // 3D Objects
    this.group = new THREE.Group();
    this.meshKart = null;
    this.wheels = [];
    this.flames = [];
    this.shieldMesh = null;
    this.waterBubbleMesh = null;

    // Skid mark history positions
    this.lastLeftTirePos = null;
    this.lastRightTirePos = null;

    this.buildKartModel();
    this.scene.add(this.group);
  }

  buildKartModel() {
    this.meshKart = new THREE.Group();

    // 1. Chassis Body (Aerodynamic Kart Shell)
    const bodyGeo = new THREE.BoxGeometry(1.8, 0.6, 3.0);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: this.bodyColor,
      roughness: 0.3,
      metalness: 0.6
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.5;
    body.castShadow = true;
    this.meshKart.add(body);

    // Front nose cone / bumper
    const noseGeo = new THREE.CylinderGeometry(0.7, 1.0, 1.2, 8);
    noseGeo.rotateX(Math.PI / 2);
    const noseMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });
    const nose = new THREE.Mesh(noseGeo, noseMat);
    nose.position.set(0, 0.45, -1.6);
    this.meshKart.add(nose);

    // Rear spoiler
    const wingGeo = new THREE.BoxGeometry(2.0, 0.1, 0.6);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x0f172a });
    const wing = new THREE.Mesh(wingGeo, wingMat);
    wing.position.set(0, 1.2, 1.4);
    this.meshKart.add(wing);

    const pillarGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.6);
    const p1 = new THREE.Mesh(pillarGeo, wingMat);
    p1.position.set(-0.6, 0.9, 1.4);
    const p2 = new THREE.Mesh(pillarGeo, wingMat);
    p2.position.set(0.6, 0.9, 1.4);
    this.meshKart.add(p1, p2);

    // 2. Cute Driver Character (Dao/Bazzi style)
    const driverGroup = new THREE.Group();
    driverGroup.position.set(0, 0.8, -0.1);

    // Helmet (Spherical head)
    const helmetGeo = new THREE.SphereGeometry(0.55, 16, 16);
    const helmetMat = new THREE.MeshStandardMaterial({ color: this.helmetColor, roughness: 0.2 });
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    driverGroup.add(helmet);

    // Helmet Goggles / Visor
    const visorGeo = new THREE.BoxGeometry(0.65, 0.22, 0.3);
    const visorMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.1 });
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(0, 0.05, -0.42);
    driverGroup.add(visor);

    // Cute ears on helmet
    const earGeo = new THREE.SphereGeometry(0.18, 8, 8);
    const earLeft = new THREE.Mesh(earGeo, helmetMat);
    earLeft.position.set(-0.52, 0.25, 0);
    const earRight = new THREE.Mesh(earGeo, helmetMat);
    earRight.position.set(0.52, 0.25, 0);
    driverGroup.add(earLeft, earRight);

    this.meshKart.add(driverGroup);

    // 3. Wheels (4 Big Chunky Kart Tires)
    const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.35, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.8, roughness: 0.2 });

    const wheelPositions = [
      { x: -1.05, y: 0.38, z: -1.0, isFront: true },
      { x: 1.05, y: 0.38, z: -1.0, isFront: true },
      { x: -1.05, y: 0.38, z: 1.0, isFront: false },
      { x: 1.05, y: 0.38, z: 1.0, isFront: false }
    ];

    this.wheels = [];
    wheelPositions.forEach((wp) => {
      const wGroup = new THREE.Group();
      wGroup.position.set(wp.x, wp.y, wp.z);

      const tire = new THREE.Mesh(wheelGeo, wheelMat);
      tire.castShadow = true;
      wGroup.add(tire);

      // Rim
      const rimGeo = new THREE.CylinderGeometry(0.2, 0.2, 0.37, 8);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wGroup.add(rim);

      this.meshKart.add(wGroup);
      this.wheels.push({ group: wGroup, tire, isFront: wp.isFront });
    });

    // 4. Dual Exhaust Pipes & Booster Flame Cones
    const pipeGeo = new THREE.CylinderGeometry(0.12, 0.16, 0.4, 8);
    pipeGeo.rotateX(Math.PI / 2);
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });

    const pipeL = new THREE.Mesh(pipeGeo, pipeMat);
    pipeL.position.set(-0.5, 0.4, 1.55);
    const pipeR = new THREE.Mesh(pipeGeo, pipeMat);
    pipeR.position.set(0.5, 0.4, 1.55);
    this.meshKart.add(pipeL, pipeR);

    // Flames (visible when boosting)
    const flameGeo = new THREE.ConeGeometry(0.2, 1.2, 8);
    flameGeo.rotateX(-Math.PI / 2);
    const flameMat = new THREE.MeshBasicMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.85 });

    const f1 = new THREE.Mesh(flameGeo, flameMat);
    f1.position.set(-0.5, 0.4, 2.2);
    f1.visible = false;
    const f2 = new THREE.Mesh(flameGeo, flameMat);
    f2.position.set(0.5, 0.4, 2.2);
    f2.visible = false;
    this.meshKart.add(f1, f2);
    this.flames = [f1, f2];

    // 5. Shield Forcefield Dome (Hidden by default)
    const shieldGeo = new THREE.SphereGeometry(2.3, 16, 16);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.7
    });
    this.shieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
    this.shieldMesh.position.y = 0.8;
    this.shieldMesh.visible = false;
    this.meshKart.add(this.shieldMesh);

    // 6. Water Bubble Trap Mesh (Hidden by default)
    const bubbleGeo = new THREE.SphereGeometry(2.5, 20, 20);
    const bubbleMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.1,
      metalness: 0.1,
      transparent: true,
      opacity: 0.55
    });
    this.waterBubbleMesh = new THREE.Mesh(bubbleGeo, bubbleMat);
    this.waterBubbleMesh.position.y = 1.0;
    this.waterBubbleMesh.visible = false;
    this.meshKart.add(this.waterBubbleMesh);

    this.group.add(this.meshKart);
  }

  update(dt, input = {}, track) {
    if (this.finished) {
      this.speed = Math.max(0, this.speed - this.decel * 0.5 * dt);
      this.updateMovement(dt, track);
      return;
    }

    // Status timers
    if (this.isTrappedInWater) {
      this.waterTimer -= dt;
      this.speed = Math.max(0, this.speed - this.decel * 2 * dt);
      this.waterBubbleMesh.visible = true;
      this.group.position.y = 1.5 + Math.sin(Date.now() * 0.006) * 0.4;
      this.meshKart.rotation.y += 3.0 * dt;
      if (this.waterTimer <= 0) {
        this.isTrappedInWater = false;
        this.waterBubbleMesh.visible = false;
        this.group.position.y = 0.4;
        this.meshKart.rotation.y = 0;
      }
      return;
    }

    if (this.isAirborneHit) {
      this.airborneTimer -= dt;
      this.speed = Math.max(0, this.speed - this.decel * dt);
      this.meshKart.rotation.x += 8.0 * dt;
      this.meshKart.rotation.z += 5.0 * dt;
      const tNorm = 1.0 - (this.airborneTimer / 1.5);
      this.group.position.y = 0.4 + Math.sin(tNorm * Math.PI) * 4.0;
      if (this.airborneTimer <= 0) {
        this.isAirborneHit = false;
        this.meshKart.rotation.set(0, 0, 0);
        this.group.position.y = 0.4;
      }
      return;
    }

    if (this.isSpinningOut) {
      this.spinTimer -= dt;
      this.speed = Math.max(0, this.speed - this.decel * dt);
      this.spinAngle += 10.0 * dt;
      this.meshKart.rotation.y = this.spinAngle;
      if (this.spinTimer <= 0) {
        this.isSpinningOut = false;
        this.meshKart.rotation.y = 0;
      }
      this.updateMovement(dt, track);
      return;
    }

    // Shield update
    if (this.isShieldActive) {
      this.shieldTimer -= dt;
      this.shieldMesh.visible = true;
      this.shieldMesh.rotation.y += 2.0 * dt;
      if (this.shieldTimer <= 0) {
        this.isShieldActive = false;
        this.shieldMesh.visible = false;
      }
    } else {
      this.shieldMesh.visible = false;
    }

    // Booster timers
    if (this.boosterActive) {
      this.boosterTimer -= dt;
      this.maxSpeed = this.baseMaxSpeed * 1.65; // ~215 km/h
      if (this.boosterTimer <= 0) {
        this.boosterActive = false;
        this.maxSpeed = this.baseMaxSpeed;
      }
    } else if (this.shortBoosterActive) {
      this.shortBoosterTimer -= dt;
      this.maxSpeed = this.baseMaxSpeed * 1.35;
      if (this.shortBoosterTimer <= 0) {
        this.shortBoosterActive = false;
        this.maxSpeed = this.baseMaxSpeed;
      }
    } else {
      this.maxSpeed = this.baseMaxSpeed;
    }

    // Short boost trigger window countdown
    if (this.canShortBoost) {
      this.shortBoostTimer -= dt;
      if (this.shortBoostTimer <= 0) {
        this.canShortBoost = false;
      }
    }

    // Acceleration & Braking
    if (input.forward) {
      // Check if instant booster can trigger on forward press
      if (this.canShortBoost) {
        this.triggerShortBooster();
      }

      const accelRate = (this.boosterActive ? this.accel * 2.2 : this.accel);
      this.speed = Math.min(this.maxSpeed, this.speed + accelRate * dt);
    } else if (input.backward) {
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - this.decel * 1.8 * dt);
      } else {
        this.speed = Math.max(-this.reverseMax, this.speed - this.accel * 0.6 * dt);
      }
    } else {
      // Natural rolling friction
      if (this.speed > 0) {
        this.speed = Math.max(0, this.speed - this.decel * 0.45 * dt);
      } else if (this.speed < 0) {
        this.speed = Math.min(0, this.speed + this.decel * 0.45 * dt);
      }
    }

    // Steering & Drifting
    let targetSteer = 0;
    if (input.left) targetSteer += 1;
    if (input.right) targetSteer -= 1;

    // Smooth steering interpolation (eliminates sudden twitching)
    const steerResponsiveness = 8.5; // Smooth yet responsive lerp
    this.currentSteer = THREE.MathUtils.lerp(this.currentSteer, targetSteer, steerResponsiveness * dt);

    // Drifting check (Shift held + steering input + sufficient forward speed)
    const wantsDrift = input.drift && Math.abs(targetSteer) > 0 && this.speed > 16;

    if (wantsDrift) {
      if (!this.isDrifting) {
        this.isDrifting = true;
        this.driftDir = Math.sign(targetSteer);
        this.driftTime = 0;
      }
      this.driftTime += dt;

      // Charge drift gauge
      this.driftGauge = Math.min(100, this.driftGauge + 35 * dt);

      // Kart body yaws sideways
      const targetDriftAngle = this.driftDir * 0.48;
      this.driftAngle = THREE.MathUtils.lerp(this.driftAngle, targetDriftAngle, 8 * dt);

      // Balanced turning rate during drift
      this.heading += this.currentSteer * this.turnSpeed * 1.25 * dt;

      // Skid marks & smoke
      this.spawnDriftEffects();
    } else {
      if (this.isDrifting) {
        // Drift ended! Offer Short Boost window
        if (this.driftTime > 0.22) {
          this.canShortBoost = true;
          this.shortBoostTimer = 0.7; // ~0.7s reaction window
        }
        this.isDrifting = false;
      }
      this.driftAngle = THREE.MathUtils.lerp(this.driftAngle, 0, 10 * dt);

      // Normal steering (scaled smoothly by speed and speed damping for stability)
      if (Math.abs(this.speed) > 0.5) {
        const speedRatio = Math.min(1.0, Math.abs(this.speed) / 12.0); // gradual build up
        const speedDamping = 1.0 - Math.min(0.2, (Math.abs(this.speed) / this.baseMaxSpeed) * 0.2);
        const turnDir = (this.speed >= 0 ? 1 : -1);
        this.heading += this.currentSteer * this.turnSpeed * turnDir * speedRatio * speedDamping * dt;
      }
    }

    // Visual flame jets
    const showFlames = this.boosterActive || this.shortBoosterActive;
    this.flames.forEach(f => {
      f.visible = showFlames;
      if (showFlames) {
        const scale = 0.8 + Math.random() * 0.6;
        f.scale.set(scale, scale, 1.2 + Math.random() * 0.5);
      }
    });

    // Update physical movement & 3D transformation
    this.updateMovement(dt, track);

    // Front wheels steering visual (smooth rotation)
    this.wheels.forEach(w => {
      if (w.isFront) {
        w.group.rotation.y = this.currentSteer * 0.42;
      }
      // Wheel rolling rotation
      w.tire.rotation.x -= (this.speed / 0.38) * dt;
    });

    // Body tilt during turning
    this.meshKart.rotation.y = this.driftAngle;
    this.meshKart.rotation.z = -this.currentSteer * 0.07;

    // Check boost pad collisions
    this.checkBoostPads(track);

    // Sound updates for player
    if (this.isPlayer && window.soundManager) {
      window.soundManager.updateEngine(Math.abs(this.speed), this.baseMaxSpeed, input.forward);
      window.soundManager.setDrifting(this.isDrifting, Math.min(1.0, this.driftTime * 2));
    }
  }

  updateMovement(dt, track) {
    // Travel direction is based on kart heading
    const forwardX = -Math.sin(this.heading);
    const forwardZ = -Math.cos(this.heading);

    this.velocity.set(forwardX * this.speed, 0, forwardZ * this.speed);
    this.position.addScaledVector(this.velocity, dt);

    // Waypoint, lap tracking, elevation & boundary collision
    if (track && track.waypoints && track.waypoints.length > 0) {
      const nearest = track.getNearestWaypoint(this.position);
      const totalWp = track.waypoints.length;
      const currentWp = track.waypoints[nearest.index];

      // 1. Follow track road height smoothly
      const targetY = currentWp.pt.y + 0.4;
      this.position.y = THREE.MathUtils.lerp(this.position.y, targetY, 15 * dt);

      // 2. Pitch kart body according to track elevation slope
      const nextIdx = (nearest.index + 2) % totalWp;
      const nextWp = track.waypoints[nextIdx];
      const dy = nextWp.pt.y - currentWp.pt.y;
      const dxz = Math.hypot(nextWp.pt.x - currentWp.pt.x, nextWp.pt.z - currentWp.pt.z);
      const slopeAngle = Math.atan2(dy, Math.max(0.1, dxz));
      this.meshKart.rotation.x = THREE.MathUtils.lerp(this.meshKart.rotation.x, -slopeAngle, 10 * dt);

      // 3. Track lateral boundary & guardrail collision check
      const relX = this.position.x - currentWp.pt.x;
      const relZ = this.position.z - currentWp.pt.z;
      // Normal vector points perpendicular to track direction
      const lateralDist = relX * currentWp.normal.x + relZ * currentWp.normal.z;
      const maxLateral = (track.trackWidth / 2) - 0.5; // ~6.5m

      if (Math.abs(lateralDist) > maxLateral) {
        // Hit guardrail!
        const sign = Math.sign(lateralDist);
        const excess = Math.abs(lateralDist) - maxLateral;
        // Push back inward
        this.position.x -= currentWp.normal.x * sign * excess;
        this.position.z -= currentWp.normal.z * sign * excess;

        // Bounce velocity & speed penalty
        this.speed = Math.max(0, this.speed * 0.75);

        // Turn heading slightly inward
        this.heading += (sign * 0.4) * dt * 10;

        // Sparks particle
        if (this.particleManager && Math.abs(this.speed) > 10) {
          this.particleManager.createExplosion(this.position);
        }

        // Sound effect
        if (this.isPlayer && window.soundManager) {
          window.soundManager.playWallHit();
        }
      }

      // 4. Lap completion check
      const diff = nearest.index - this.lastWaypointIdx;
      if (diff > 0 || diff < -totalWp / 2) {
        if (this.lastWaypointIdx > totalWp * 0.8 && nearest.index < totalWp * 0.2) {
          this.currentLap++;
        }
        this.lastWaypointIdx = nearest.index;
      }
      this.totalDistance = (this.currentLap - 1) * totalWp + this.lastWaypointIdx;
    }

    this.group.position.copy(this.position);
    this.group.rotation.y = this.heading;
  }

  spawnDriftEffects() {
    const leftTireWp = new THREE.Vector3(-0.9, 0, 1.0).applyMatrix4(this.group.matrixWorld);
    const rightTireWp = new THREE.Vector3(0.9, 0, 1.0).applyMatrix4(this.group.matrixWorld);

    if (this.particleManager) {
      this.particleManager.createDriftSmoke(leftTireWp, this.velocity);
      this.particleManager.createDriftSmoke(rightTireWp, this.velocity);

      if (this.lastLeftTirePos && this.lastRightTirePos) {
        this.particleManager.addSkidMark(this.lastLeftTirePos, leftTireWp);
        this.particleManager.addSkidMark(this.lastRightTirePos, rightTireWp);
      }
    }

    this.lastLeftTirePos = leftTireWp.clone();
    this.lastRightTirePos = rightTireWp.clone();
  }

  triggerBooster(duration = 3.2) {
    this.boosterActive = true;
    this.boosterTimer = duration;
    this.maxSpeed = this.baseMaxSpeed * 1.65;
    this.speed = Math.max(this.speed + 18, this.baseMaxSpeed * 1.2);
    if (this.isPlayer && window.soundManager) {
      window.soundManager.playBooster();
    }
  }

  triggerShortBooster() {
    this.canShortBoost = false;
    this.shortBoosterActive = true;
    this.shortBoosterTimer = 1.1;
    this.maxSpeed = this.baseMaxSpeed * 1.35;
    this.speed = Math.min(this.maxSpeed, Math.max(this.speed + 16, this.baseMaxSpeed * 1.1));
    if (this.isPlayer && window.soundManager) {
      window.soundManager.playShortBooster();
      const alertElem = document.getElementById('alert-message');
      if (alertElem) {
        alertElem.textContent = '⚡ 순간 부스터!';
        alertElem.classList.add('show');
        setTimeout(() => alertElem.classList.remove('show'), 700);
      }
    }
  }

  checkBoostPads(track) {
    if (!track || !track.boostPads) return;
    track.boostPads.forEach(pad => {
      const distSq = (this.position.x - pad.position.x) ** 2 + (this.position.z - pad.position.z) ** 2;
      if (distSq < (pad.radius) ** 2) {
        this.triggerBooster(2.0);
      }
    });
  }

  applyMissileHit() {
    if (this.isShieldActive) {
      this.isShieldActive = false;
      this.shieldMesh.visible = false;
      return false; // blocked
    }
    this.isAirborneHit = true;
    this.airborneTimer = 1.5;
    this.speed *= 0.2;
    if (this.particleManager) {
      this.particleManager.createExplosion(this.position);
    }
    if (window.soundManager) {
      window.soundManager.playExplosion();
    }
    return true;
  }

  applyWaterBomb() {
    if (this.isShieldActive) {
      this.isShieldActive = false;
      this.shieldMesh.visible = false;
      return false;
    }
    this.isTrappedInWater = true;
    this.waterTimer = 3.0;
    this.speed = 0;
    if (this.particleManager) {
      this.particleManager.createWaterSplash(this.position);
    }
    if (window.soundManager) {
      window.soundManager.playWaterBomb();
    }
    return true;
  }

  applyBananaSlip() {
    if (this.isShieldActive) {
      this.isShieldActive = false;
      this.shieldMesh.visible = false;
      return false;
    }
    this.isSpinningOut = true;
    this.spinTimer = 1.2;
    this.spinAngle = 0;
    this.speed *= 0.3;
    if (window.soundManager) {
      window.soundManager.playBananaSlip();
    }
    return true;
  }

  activateShield(duration = 4.5) {
    this.isShieldActive = true;
    this.shieldTimer = duration;
    if (this.isPlayer && window.soundManager) {
      window.soundManager.playShield();
    }
  }

  resetToTrack(track) {
    if (!track) return;
    const { index } = track.getNearestWaypoint(this.position);
    const wp = track.waypoints[index];
    this.position.copy(wp.pt);
    this.position.y = 0.4;
    this.speed = 0;
    this.velocity.set(0, 0, 0);
    this.heading = Math.atan2(-wp.tangent.x, -wp.tangent.z);
    this.isDrifting = false;
    this.driftAngle = 0;
  }

  // AI navigation update
  updateAI(dt, track, allKarts) {
    if (this.finished || this.isTrappedInWater || this.isAirborneHit || this.isSpinningOut) {
      this.update(dt, {}, track);
      return;
    }

    // Look ahead 4-6 waypoints
    const lookAhead = 5;
    const targetIdx = (this.lastWaypointIdx + lookAhead) % track.waypoints.length;
    const targetWp = track.waypoints[targetIdx];

    // Compute angle to target
    const toTarget = new THREE.Vector2(targetWp.pt.x - this.position.x, targetWp.pt.z - this.position.z);
    const targetHeading = Math.atan2(-toTarget.x, -toTarget.y);

    let diff = targetHeading - this.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;

    const input = {
      forward: true,
      backward: false,
      left: diff > 0.08,
      right: diff < -0.08,
      drift: Math.abs(diff) > 0.55 && this.speed > 25
    };

    // AI Item Usage (random opportunistic)
    if (this.items.length > 0 && Math.random() < 0.015) {
      const item = this.items.shift();
      if (window.itemManager) {
        window.itemManager.useItem(this, item, allKarts);
      }
    }

    this.update(dt, input, track);
  }
}

window.Kart = Kart;

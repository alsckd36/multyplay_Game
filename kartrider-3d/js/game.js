// Main Game Controller: Three.js Loop, Dynamic Camera, HUD, Minimap, Countdown & Results
class KartRiderGame {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.scene = null;
    this.camera = null;
    this.renderer = null;

    this.track = null;
    this.particleManager = null;
    this.itemManager = null;

    this.player = null;
    this.aiKarts = [];
    this.allKarts = [];

    this.totalLaps = 2;
    this.gameState = 'READY'; // READY, COUNTDOWN, RACING, FINISHED
    this.raceStartTime = 0;
    this.elapsedTime = 0;

    this.input = {
      forward: false,
      backward: false,
      left: false,
      right: false,
      drift: false
    };

    this.cameraMode = 0; // 0: Chase, 1: Close, 2: Far
    this.cameraOffset = new THREE.Vector3(0, 3.8, 7.5);
    this.lookAheadDistance = 6.0;
    this.cameraLookOffset = new THREE.Vector3(0, 1.2, 6.0);

    this.countdownStep = 3;
    this.countdownTimer = null;
    this.canStartBoost = false;

    // DOM UI elements
    this.domSpeed = document.getElementById('speed-val');
    this.domRank = document.getElementById('rank-val');
    this.domLap = document.getElementById('lap-val');
    this.domTime = document.getElementById('time-val');
    this.domDriftGauge = document.getElementById('drift-gauge-fill');
    this.domItem1 = document.getElementById('item-slot-1');
    this.domItem2 = document.getElementById('item-slot-2');
    this.domSpeedLines = document.getElementById('speed-lines');
    this.domCountdown = document.getElementById('countdown-text');
    this.domAlert = document.getElementById('alert-message');
    this.domMinimap = document.getElementById('minimap-canvas');
    this.minimapCtx = this.domMinimap ? this.domMinimap.getContext('2d') : null;

    this.init();
  }

  init() {
    // 1. Scene & Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x7dd3fc); // Bright animated sky blue
    this.scene.fog = new THREE.FogExp2(0xbae6fd, 0.0035);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(65, aspect, 0.5, 800);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 2. Lights
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x445566, 0.85);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xfffaed, 1.2);
    dirLight.position.set(60, 120, 80);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 400;
    const shadowDist = 140;
    dirLight.shadow.camera.left = -shadowDist;
    dirLight.shadow.camera.right = shadowDist;
    dirLight.shadow.camera.top = shadowDist;
    dirLight.shadow.camera.bottom = -shadowDist;
    this.scene.add(dirLight);

    // 3. Subsystems
    this.particleManager = new ParticleManager(this.scene);
    this.itemManager = new ItemManager(this.scene, this.particleManager);
    window.itemManager = this.itemManager;

    this.track = new RaceTrack(this.scene).generate();
    this.itemManager.initTrackItems(this.track);

    // 4. Spawn Karts on Starting Grid
    this.spawnKarts();

    // 5. Input Listeners
    this.bindInputs();

    // 6. Resize handling
    window.addEventListener('resize', () => this.onWindowResize());

    // 7. Start Render Loop
    this.clock = new THREE.Clock();
    this.animate();
  }

  spawnKarts() {
    // Starting grid positions (staggered behind start line)
    const gridOffsets = [
      { lateral: -2.8, back: 2.0 },  // Player (Pole position)
      { lateral: 2.8, back: 6.0 },   // AI 1 (Bazzi)
      { lateral: -2.8, back: 10.0 }, // AI 2 (Dao Rival)
      { lateral: 2.8, back: 14.0 },  // AI 3 (Marid)
      { lateral: -2.8, back: 18.0 }  // AI 4 (Uni)
    ];

    const startWp = this.track.waypoints[0];
    const tangent = startWp.tangent;
    const normal = startWp.normal;
    const startHeading = Math.atan2(-tangent.x, -tangent.z);

    // 1. Player
    this.player = new Kart(this.scene, this.particleManager, true, {
      name: '나 (Dao)',
      bodyColor: 0x2563eb,
      helmetColor: 0x60a5fa
    });
    const pPos = startWp.pt.clone()
      .addScaledVector(normal, gridOffsets[0].lateral)
      .addScaledVector(tangent, -gridOffsets[0].back);
    pPos.y = 0.4;
    this.player.position.copy(pPos);
    this.player.group.position.copy(pPos);
    this.player.heading = startHeading;
    this.player.group.rotation.y = startHeading;

    // 2. AI Karts
    const aiConfigs = [
      { name: '배찌 (Bazzi)', bodyColor: 0xdc2626, helmetColor: 0xf87171 },
      { name: '디지니 (Dizni)', bodyColor: 0xf59e0b, helmetColor: 0xfde047 },
      { name: '마리드 (Marid)', bodyColor: 0xdb2777, helmetColor: 0xf472b6 },
      { name: '우니 (Uni)', bodyColor: 0x16a34a, helmetColor: 0x4ade80 }
    ];

    this.aiKarts = [];
    aiConfigs.forEach((cfg, i) => {
      const ai = new Kart(this.scene, this.particleManager, false, cfg);
      const pos = startWp.pt.clone()
        .addScaledVector(normal, gridOffsets[i + 1].lateral)
        .addScaledVector(tangent, -gridOffsets[i + 1].back);
      pos.y = 0.4;
      ai.position.copy(pos);
      ai.group.position.copy(pos);
      ai.heading = startHeading;
      ai.group.rotation.y = startHeading;
      this.aiKarts.push(ai);
    });

    this.allKarts = [this.player, ...this.aiKarts];
  }

  startRace() {
    if (window.soundManager) {
      window.soundManager.init();
    }

    document.getElementById('instructions-modal').classList.add('hidden');
    document.getElementById('podium-modal').classList.add('hidden');

    this.gameState = 'COUNTDOWN';
    this.countdownStep = 3;
    this.showCountdownText('3');
    if (window.soundManager) window.soundManager.playCountdown(3);

    this.countdownTimer = setInterval(() => {
      this.countdownStep--;
      if (this.countdownStep > 0) {
        this.showCountdownText(String(this.countdownStep));
        if (window.soundManager) window.soundManager.playCountdown(this.countdownStep);
      } else if (this.countdownStep === 0) {
        this.showCountdownText('GO!');
        if (window.soundManager) window.soundManager.playCountdown(0);
        this.gameState = 'RACING';
        this.raceStartTime = performance.now();
        this.canStartBoost = true;

        // Start boost window (0.35s)
        setTimeout(() => {
          this.canStartBoost = false;
        }, 380);

        setTimeout(() => {
          this.domCountdown.classList.remove('show');
          clearInterval(this.countdownTimer);
        }, 800);
      }
    }, 1000);
  }

  showCountdownText(text) {
    this.domCountdown.textContent = text;
    this.domCountdown.classList.remove('show');
    void this.domCountdown.offsetWidth; // trigger reflow
    this.domCountdown.classList.add('show');
  }

  bindInputs() {
    window.addEventListener('keydown', (e) => {
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        e.preventDefault();
      }

      if (e.code === 'ArrowUp' || e.code === 'KeyW') {
        // Check for Starting Booster (출발 부스터)
        if (this.canStartBoost) {
          this.canStartBoost = false;
          this.player.triggerBooster(2.2);
          this.showAlert('출발 부스터!');
        }
        this.input.forward = true;
      }
      if (e.code === 'ArrowDown' || e.code === 'KeyS') this.input.backward = true;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.input.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.input.right = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.input.drift = true;

      // Use Item / Booster
      if (e.code === 'ControlLeft' || e.code === 'ControlRight' || e.code === 'Space') {
        this.usePlayerItem();
      }

      // Reset Kart
      if (e.code === 'KeyR') {
        this.player.resetToTrack(this.track);
        this.showAlert('위치 리셋!');
      }

      // Toggle Camera View
      if (e.code === 'KeyC') {
        this.cameraMode = (this.cameraMode + 1) % 3;
      }

      // Toggle Mute
      if (e.code === 'KeyM') {
        if (window.soundManager) {
          const isMuted = window.soundManager.toggleMute();
          this.showAlert(isMuted ? '음소거 됨' : '소리 켬');
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.code === 'ArrowUp' || e.code === 'KeyW') this.input.forward = false;
      if (e.code === 'ArrowDown' || e.code === 'KeyS') this.input.backward = false;
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') this.input.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') this.input.right = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') this.input.drift = false;
    });

    // Touch / On-screen Virtual Controls Binding
    const bindTouch = (elemId, onStart, onEnd) => {
      const el = document.getElementById(elemId);
      if (!el) return;
      const startFn = (e) => {
        e.preventDefault();
        onStart();
      };
      const endFn = (e) => {
        e.preventDefault();
        onEnd();
      };
      el.addEventListener('touchstart', startFn, { passive: false });
      el.addEventListener('touchend', endFn, { passive: false });
      el.addEventListener('mousedown', startFn);
      el.addEventListener('mouseup', endFn);
      el.addEventListener('mouseleave', endFn);
    };

    bindTouch('btn-touch-up', () => {
      if (this.canStartBoost) {
        this.canStartBoost = false;
        this.player.triggerBooster(2.2);
        this.showAlert('출발 부스터!');
      }
      this.input.forward = true;
    }, () => { this.input.forward = false; });

    bindTouch('btn-touch-down', () => { this.input.backward = true; }, () => { this.input.backward = false; });
    bindTouch('btn-touch-left', () => { this.input.left = true; }, () => { this.input.left = false; });
    bindTouch('btn-touch-right', () => { this.input.right = true; }, () => { this.input.right = false; });
    bindTouch('btn-touch-drift', () => { this.input.drift = true; }, () => { this.input.drift = false; });
    bindTouch('btn-touch-item', () => { this.usePlayerItem(); }, () => {});
    bindTouch('btn-touch-reset', () => { this.player.resetToTrack(this.track); this.showAlert('위치 리셋!'); }, () => {});
  }

  usePlayerItem() {
    if (this.player.items.length > 0) {
      const item = this.player.items.shift();
      this.itemManager.useItem(this.player, item, this.allKarts);
      const data = this.itemManager.itemData[item];
      this.showAlert(`${data.icon} ${data.name} 사용!`);
    }
  }

  showAlert(text) {
    if (!this.domAlert) return;
    this.domAlert.textContent = text;
    this.domAlert.classList.add('show');
    setTimeout(() => {
      this.domAlert.classList.remove('show');
    }, 1000);
  }

  handleKartCollisions() {
    const karts = this.allKarts;
    const minDist = 2.1;
    const minDistSq = minDist * minDist;

    for (let i = 0; i < karts.length; i++) {
      for (let j = i + 1; j < karts.length; j++) {
        const k1 = karts[i];
        const k2 = karts[j];
        if (k1.finished || k2.finished) continue;

        const dx = k2.position.x - k1.position.x;
        const dz = k2.position.z - k1.position.z;
        const distSq = dx * dx + dz * dz;

        if (distSq < minDistSq && distSq > 0.001) {
          const dist = Math.sqrt(distSq);
          const overlap = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const nz = dz / dist;

          // Push apart
          k1.position.x -= nx * overlap;
          k1.position.z -= nz * overlap;
          k2.position.x += nx * overlap;
          k2.position.z += nz * overlap;

          k1.group.position.x = k1.position.x;
          k1.group.position.z = k1.position.z;
          k2.group.position.x = k2.position.x;
          k2.group.position.z = k2.position.z;

          // Elastic bounce impulse
          const relSpeed = k1.speed - k2.speed;
          k1.speed -= relSpeed * 0.2;
          k2.speed += relSpeed * 0.2;

          // Sound effect if player involved
          if ((k1.isPlayer || k2.isPlayer) && window.soundManager) {
            window.soundManager.playKartBump();
          }
        }
      }
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const dt = Math.min(this.clock.getDelta(), 0.1);

    if (this.gameState === 'RACING') {
      this.elapsedTime = (performance.now() - this.raceStartTime) / 1000;

      // Update Player
      this.player.update(dt, this.input, this.track);

      // Convert full drift gauge to Booster item
      if (this.player.driftGauge >= 100) {
        this.player.driftGauge = 0;
        if (this.player.items.length < 2) {
          this.player.items.push('booster');
          this.showAlert('⚡ 부스터 충전 완료!');
          if (window.soundManager) window.soundManager.playItemPickup();
        }
      }

      // Check Player Lap Completion
      if (this.player.currentLap > this.totalLaps && !this.player.finished) {
        this.player.finished = true;
        this.player.finishTime = this.elapsedTime;
        this.onRaceFinish();
      }

      // Update AI Karts
      this.aiKarts.forEach(ai => {
        ai.updateAI(dt, this.track, this.allKarts);
        if (ai.currentLap > this.totalLaps && !ai.finished) {
          ai.finished = true;
          ai.finishTime = this.elapsedTime;
        }
      });

      // Kart-to-Kart Collisions (몸싸움)
      this.handleKartCollisions();

      // Update Items & Particles
      this.itemManager.update(dt, this.allKarts);
      this.particleManager.update(dt);

      // Update Dynamic Camera
      this.updateCamera(dt);

      // Update HUD & Radar
      this.updateHUD();
      this.renderMinimap();
    } else {
      // In ready/countdown state, keep camera smoothly focused on player
      this.updateCamera(dt);
      this.particleManager.update(dt);
    }

    this.renderer.render(this.scene, this.camera);
  }

  updateCamera(dt) {
    let offset = this.cameraOffset;
    if (this.cameraMode === 1) { // Close view
      offset = new THREE.Vector3(0, 2.6, 5.0);
    } else if (this.cameraMode === 2) { // Far view
      offset = new THREE.Vector3(0, 5.5, 11.5);
    }

    // Dynamic FOV & pull back during booster
    const isBoosting = this.player.boosterActive || this.player.shortBoosterActive;
    const targetFov = isBoosting ? 78 : 65;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 6 * dt);
    this.camera.updateProjectionMatrix();

    if (this.domSpeedLines) {
      if (isBoosting) this.domSpeedLines.classList.add('active');
      else this.domSpeedLines.classList.remove('active');
    }

    // Transform camera offset to world coords behind kart
    const forwardX = -Math.sin(this.player.heading);
    const forwardZ = -Math.cos(this.player.heading);
    const rightX = -forwardZ;
    const rightZ = forwardX;

    const targetCamPos = this.player.position.clone()
      .add(new THREE.Vector3(-forwardX * offset.z, offset.y, -forwardZ * offset.z));

    this.camera.position.lerp(targetCamPos, 12 * dt);

    const lookTarget = this.player.position.clone()
      .add(new THREE.Vector3(forwardX * this.cameraLookOffset.z, this.cameraLookOffset.y, forwardZ * this.cameraLookOffset.z));
    this.camera.lookAt(lookTarget);
  }

  updateHUD() {
    // 1. Speedometer (km/h)
    const kmh = Math.max(0, Math.round(this.player.speed * 2.85));
    if (this.domSpeed) this.domSpeed.textContent = kmh;

    // 2. Drift Gauge
    if (this.domDriftGauge) {
      this.domDriftGauge.style.width = `${Math.min(100, this.player.driftGauge)}%`;
      if (this.player.driftGauge >= 99) {
        this.domDriftGauge.classList.add('full');
      } else {
        this.domDriftGauge.classList.remove('full');
      }
    }

    // 3. Race Rank Sorting
    const sorted = [...this.allKarts].sort((a, b) => b.totalDistance - a.totalDistance);
    const rank = sorted.indexOf(this.player) + 1;
    if (this.domRank) this.domRank.textContent = `${rank}`;

    // 4. Lap counter
    if (this.domLap) {
      const displayLap = Math.min(this.player.currentLap, this.totalLaps);
      this.domLap.textContent = `LAP ${displayLap}/${this.totalLaps}`;
    }

    // 5. Time display
    if (this.domTime) {
      const m = Math.floor(this.elapsedTime / 60);
      const s = Math.floor(this.elapsedTime % 60);
      const ms = Math.floor((this.elapsedTime * 100) % 100);
      this.domTime.textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
    }

    // 6. Item Slots
    this.updateItemSlot(this.domItem1, this.player.items[0]);
    this.updateItemSlot(this.domItem2, this.player.items[1]);

    // 7. Shield effect overlay
    const shieldOverlay = document.getElementById('shield-overlay');
    if (shieldOverlay) {
      if (this.player.isShieldActive) shieldOverlay.classList.add('active');
      else shieldOverlay.classList.remove('active');
    }

    // 8. Water bubble overlay
    const waterOverlay = document.getElementById('water-overlay');
    if (waterOverlay) {
      if (this.player.isTrappedInWater) waterOverlay.classList.add('active');
      else waterOverlay.classList.remove('active');
    }
  }

  updateItemSlot(element, itemKey) {
    if (!element) return;
    const iconElem = element.querySelector('.item-icon');
    const badgeElem = element.querySelector('.item-badge');

    if (itemKey) {
      const data = this.itemManager.itemData[itemKey];
      iconElem.textContent = data.icon;
      badgeElem.textContent = data.name;
      badgeElem.style.display = 'block';
      element.classList.add('has-item');
    } else {
      iconElem.textContent = '';
      badgeElem.style.display = 'none';
      element.classList.remove('has-item');
    }
  }

  renderMinimap() {
    if (!this.minimapCtx || !this.track) return;
    const ctx = this.minimapCtx;
    const w = this.domMinimap.width;
    const h = this.domMinimap.height;
    ctx.clearRect(0, 0, w, h);

    const b = this.track.bounds;
    const toScreenX = (x) => ((x - b.minX) / (b.maxX - b.minX)) * (w - 24) + 12;
    const toScreenY = (z) => ((z - b.minZ) / (b.maxZ - b.minZ)) * (h - 24) + 12;

    // Draw Track Ribbon
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < this.track.waypoints.length; i++) {
      const pt = this.track.waypoints[i].pt;
      const sx = toScreenX(pt.x);
      const sy = toScreenY(pt.z);
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
    ctx.stroke();

    // Draw Start/Finish Line
    const startPt = this.track.waypoints[0].pt;
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(toScreenX(startPt.x) - 3, toScreenY(startPt.z) - 3, 6, 6);

    // Draw AI Karts (Colored dots)
    this.aiKarts.forEach(ai => {
      const sx = toScreenX(ai.position.x);
      const sy = toScreenY(ai.position.z);
      ctx.beginPath();
      ctx.arc(sx, sy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#' + ai.bodyColor.toString(16).padStart(6, '0');
      ctx.fill();
    });

    // Draw Player (Highlighted glowing dot)
    const px = toScreenX(this.player.position.x);
    const py = toScreenY(this.player.position.z);
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  onRaceFinish() {
    this.gameState = 'FINISHED';
    if (window.soundManager) window.soundManager.playFanfare();

    // Sort rankings
    const sorted = [...this.allKarts].sort((a, b) => b.totalDistance - a.totalDistance);
    const playerRank = sorted.indexOf(this.player) + 1;

    this.showCountdownText('FINISH!');
    setTimeout(() => {
      this.domCountdown.classList.remove('show');
      this.showPodium(sorted, playerRank);
    }, 1800);
  }

  showPodium(sortedKarts, playerRank) {
    const listElem = document.getElementById('podium-list');
    if (!listElem) return;
    listElem.innerHTML = '';

    sortedKarts.forEach((k, idx) => {
      const row = document.createElement('div');
      row.className = `podium-row ${k.isPlayer ? 'player' : ''}`;

      const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}위`;
      const timeStr = k.finishTime > 0 ? `${k.finishTime.toFixed(2)}s` : '완주 중...';

      row.innerHTML = `
        <span class="podium-rank">${medal}</span>
        <span class="podium-name">${k.name}</span>
        <span class="podium-time">${timeStr}</span>
      `;
      listElem.appendChild(row);
    });

    const podiumModal = document.getElementById('podium-modal');
    if (podiumModal) podiumModal.classList.remove('hidden');
  }

  restart() {
    // Reset positions and state
    document.getElementById('podium-modal').classList.add('hidden');
    this.spawnKarts();
    this.startRace();
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}

// Global bootstrap
window.addEventListener('DOMContentLoaded', () => {
  const game = new KartRiderGame();
  window.kartGame = game;

  document.getElementById('btn-start').addEventListener('click', () => {
    game.startRace();
  });

  document.getElementById('btn-restart').addEventListener('click', () => {
    game.restart();
  });
});

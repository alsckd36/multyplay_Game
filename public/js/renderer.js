// public/js/renderer.js
// HTML5 Canvas 렌더링 및 파티클 시스템 엔진

class Renderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimapCanvas = minimapCanvas;
    this.mCtx = minimapCanvas.getContext('2d');

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera = { x: 1500, y: 1500 };
    this.particles = [];

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.canvas.width = this.width;
    this.canvas.height = this.height;
  }

  // 파티클 스폰 (피격, 보석 섭취, 폭발)
  addParticles(x, y, color, count = 8, speed = 4) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const velocity = (Math.random() * 0.7 + 0.3) * speed;
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * velocity,
        vy: Math.sin(angle) * velocity,
        radius: Math.random() * 3 + 2,
        color: color,
        alpha: 1,
        decay: Math.random() * 0.03 + 0.02
      });
    }
  }

  // 파티클 업데이트 및 렌더링
  renderParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= p.decay;

      if (p.alpha <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      this.ctx.save();
      this.ctx.globalAlpha = p.alpha;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowBlur = 8;
      this.ctx.shadowColor = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }
  }

  // 월드 배경 그리드 및 테두리 렌더링
  renderBackground(world) {
    const startX = Math.floor((this.camera.x - this.width / 2) / 60) * 60;
    const endX = this.camera.x + this.width / 2;
    const startY = Math.floor((this.camera.y - this.height / 2) / 60) * 60;
    const endY = this.camera.y + this.height / 2;

    this.ctx.strokeStyle = 'rgba(0, 240, 255, 0.06)';
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();

    for (let x = startX; x <= endX; x += 60) {
      this.ctx.moveTo(x, startY);
      this.ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += 60) {
      this.ctx.moveTo(startX, y);
      this.ctx.lineTo(endX, y);
    }
    this.ctx.stroke();

    // 월드 외곽 경계선 (경고 테두리)
    if (world) {
      this.ctx.save();
      this.ctx.strokeStyle = '#ff0055';
      this.ctx.lineWidth = 6;
      this.ctx.shadowColor = '#ff0055';
      this.ctx.shadowBlur = 15;
      this.ctx.strokeRect(0, 0, world.width, world.height);
      this.ctx.restore();
    }
  }

  // 보석 렌더링
  renderGems(gems, now) {
    for (const gem of gems) {
      const pulse = Math.sin(now / 200 + gem.id) * 1.5;
      const radius = Math.max(3, gem.radius + pulse);

      this.ctx.save();
      this.ctx.fillStyle = gem.color;
      this.ctx.shadowColor = gem.color;
      this.ctx.shadowBlur = 10;

      // 크리스탈 마름모 모양 렌더링
      this.ctx.beginPath();
      this.ctx.moveTo(gem.x, gem.y - radius);
      this.ctx.lineTo(gem.x + radius, gem.y);
      this.ctx.lineTo(gem.x, gem.y + radius);
      this.ctx.lineTo(gem.x - radius, gem.y);
      this.ctx.closePath();
      this.ctx.fill();

      // 내부 광택
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(gem.x, gem.y, radius * 0.35, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.restore();
    }
  }

  // 투사체(총알) 렌더링
  renderProjectiles(projectiles) {
    for (const p of projectiles) {
      this.ctx.save();
      this.ctx.fillStyle = '#ffffff';
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 12;

      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fill();

      // 외곽 링
      this.ctx.strokeStyle = p.color;
      this.ctx.lineWidth = 2;
      this.ctx.stroke();

      this.ctx.restore();
    }
  }

  // 플레이어 기체 렌더링
  renderPlayers(players, myId) {
    for (const p of players) {
      if (p.isDead) continue;

      this.ctx.save();
      this.ctx.translate(p.x, p.y);

      // 1. 발사 포신 (터렛) - 마우스 각도로 회전
      this.ctx.save();
      this.ctx.rotate(p.angle);
      this.ctx.fillStyle = '#222d3d';
      this.ctx.strokeStyle = p.color;
      this.ctx.lineWidth = 2;
      this.ctx.fillRect(0, -5, p.radius + 12, 10);
      this.ctx.strokeRect(0, -5, p.radius + 12, 10);
      this.ctx.restore();

      // 2. 기체 본체 원형 & 네온 글로우
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = (p.id === myId) ? 18 : 10;
      this.ctx.fillStyle = '#0f172a';
      this.ctx.strokeStyle = p.color;
      this.ctx.lineWidth = 3;

      this.ctx.beginPath();
      this.ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      // 내부 코어
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(0, 0, p.radius * 0.45, 0, Math.PI * 2);
      this.ctx.fill();

      // 3. 머리 위 HP 바
      const hpBarW = p.radius * 2.2;
      const hpBarH = 5;
      const hpBarY = -p.radius - 14;
      const hpPercent = Math.max(0, p.hp / p.maxHp);

      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      this.ctx.fillRect(-hpBarW / 2, hpBarY, hpBarW, hpBarH);

      this.ctx.fillStyle = hpPercent > 0.3 ? '#00ff66' : '#ff0055';
      this.ctx.fillRect(-hpBarW / 2, hpBarY, hpBarW * hpPercent, hpBarH);

      // 4. 머리 위 닉네임 & 레벨
      this.ctx.shadowBlur = 0;
      this.ctx.font = 'bold 12px Pretendard, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillStyle = (p.id === myId) ? '#ffffff' : '#cbd5e1';
      this.ctx.fillText(`${p.nickname} (Lv.${p.level})`, 0, hpBarY - 6);

      this.ctx.restore();
    }
  }

  // 우하단 미니맵 렌더링
  renderMinimap(world, players, myId) {
    if (!world) return;
    const mW = this.minimapCanvas.width;
    const mH = this.minimapCanvas.height;

    this.mCtx.clearRect(0, 0, mW, mH);

    // 미니맵 테두리
    this.mCtx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    this.mCtx.lineWidth = 1.5;
    this.mCtx.strokeRect(0, 0, mW, mH);

    const scaleX = mW / world.width;
    const scaleY = mH / world.height;

    // 플레이어 점 표시
    for (const p of players) {
      if (p.isDead) continue;
      const mx = p.x * scaleX;
      const my = p.y * scaleY;

      this.mCtx.beginPath();
      if (p.id === myId) {
        this.mCtx.fillStyle = '#ffffff';
        this.mCtx.arc(mx, my, 4, 0, Math.PI * 2);
        this.mCtx.fill();
        this.mCtx.strokeStyle = '#00f0ff';
        this.mCtx.lineWidth = 2;
        this.mCtx.stroke();
      } else {
        this.mCtx.fillStyle = p.color;
        this.mCtx.arc(mx, my, 2.5, 0, Math.PI * 2);
        this.mCtx.fill();
      }
    }
  }

  // 메인 렌더 프레임
  render(gameState, myId) {
    const now = performance.now();

    // 1. 카메라 추적 (로컬 플레이어 중심)
    if (gameState && gameState.players) {
      const myPlayer = gameState.players.find(p => p.id === myId);
      if (myPlayer) {
        // 부드러운 카메라 보간 (Lerp)
        this.camera.x += (myPlayer.x - this.camera.x) * 0.12;
        this.camera.y += (myPlayer.y - this.camera.y) * 0.12;
      }
    }

    // 2. 화면 초기화
    this.ctx.fillStyle = '#0b0e14';
    this.ctx.fillRect(0, 0, this.width, this.height);

    // 3. 카메라 좌표계 변환
    this.ctx.save();
    this.ctx.translate(this.width / 2 - this.camera.x, this.height / 2 - this.camera.y);

    if (gameState) {
      this.renderBackground(gameState.world);
      this.renderGems(gameState.gems, now);
      this.renderProjectiles(gameState.projectiles);
      this.renderPlayers(gameState.players, myId);
    }

    this.renderParticles();
    this.ctx.restore();

    // 4. 미니맵 렌더링
    if (gameState) {
      this.renderMinimap(gameState.world, gameState.players, myId);
    }
  }
}

// server/gameLogic.js
// 2D 실시간 아레나 서바이벌 게임 로직 엔진

class GameLogic {
  constructor() {
    this.WORLD_WIDTH = 3000;
    this.WORLD_HEIGHT = 3000;
    this.MAX_GEMS = 150;

    this.players = new Map();
    this.projectiles = [];
    this.gems = [];
    this.events = []; // 일회성 이벤트 (피격, 처치, 보석 획득 등)

    this.projectileIdCounter = 1;
    this.gemIdCounter = 1;

    // 초기 보석 생성
    for (let i = 0; i < this.MAX_GEMS; i++) {
      this.spawnGem();
    }
  }

  // 보석 스폰
  spawnGem(x = null, y = null, value = null) {
    const gemColors = ['#00ffcc', '#ff007f', '#ffff00', '#00e5ff', '#a6ff00', '#bd00ff'];
    const radius = 7;
    this.gems.push({
      id: this.gemIdCounter++,
      x: x !== null ? x : Math.random() * (this.WORLD_WIDTH - 100) + 50,
      y: y !== null ? y : Math.random() * (this.WORLD_HEIGHT - 100) + 50,
      radius: radius,
      color: gemColors[Math.floor(Math.random() * gemColors.length)],
      value: value || Math.floor(Math.random() * 15) + 10
    });
  }

  // 플레이어 추가
  addPlayer(id, nickname, color) {
    const colors = ['#00f0ff', '#ff0055', '#ffe600', '#00ff66', '#bd00ff', '#ff7700'];
    const safeColor = color || colors[Math.floor(Math.random() * colors.length)];
    const safeNickname = (nickname || 'Survivor').trim().substring(0, 14);

    const player = {
      id: id,
      nickname: safeNickname,
      color: safeColor,
      x: Math.random() * (this.WORLD_WIDTH - 400) + 200,
      y: Math.random() * (this.WORLD_HEIGHT - 400) + 200,
      radius: 22,
      speed: 5.5,
      hp: 100,
      maxHp: 100,
      score: 0,
      level: 1,
      kills: 0,
      angle: 0,
      isDead: false,
      inputs: {
        up: false,
        down: false,
        left: false,
        right: false,
        angle: 0,
        shooting: false
      },
      lastShotTime: 0,
      fireRateMs: 220
    };

    this.players.set(id, player);
    return player;
  }

  // 플레이어 제거
  removePlayer(id) {
    this.players.delete(id);
  }

  // 플레이어 입력 업데이트
  handleInput(id, inputData) {
    const player = this.players.get(id);
    if (!player || player.isDead) return;

    if (inputData) {
      if (typeof inputData.up === 'boolean') player.inputs.up = inputData.up;
      if (typeof inputData.down === 'boolean') player.inputs.down = inputData.down;
      if (typeof inputData.left === 'boolean') player.inputs.left = inputData.left;
      if (typeof inputData.right === 'boolean') player.inputs.right = inputData.right;
      if (typeof inputData.angle === 'number') player.inputs.angle = inputData.angle;
      if (typeof inputData.shooting === 'boolean') player.inputs.shooting = inputData.shooting;
    }
  }

  // 플레이어 부활
  respawnPlayer(id) {
    const player = this.players.get(id);
    if (!player) return null;

    player.hp = 100;
    player.maxHp = 100;
    player.score = Math.floor(player.score * 0.5); // 점수 50% 보존
    player.level = Math.max(1, Math.floor(player.score / 100) + 1);
    player.radius = Math.min(40, 22 + (player.level - 1) * 1.5);
    player.x = Math.random() * (this.WORLD_WIDTH - 400) + 200;
    player.y = Math.random() * (this.WORLD_HEIGHT - 400) + 200;
    player.isDead = false;
    player.inputs = {
      up: false,
      down: false,
      left: false,
      right: false,
      angle: 0,
      shooting: false
    };

    return player;
  }

  // 메인 게임 틱 업데이트 (60 FPS 기준)
  update() {
    const now = Date.now();
    this.events = [];

    // 1. 플레이어 이동 및 발사 처리
    for (const [id, player] of this.players.entries()) {
      if (player.isDead) continue;

      let dx = 0;
      let dy = 0;
      if (player.inputs.up) dy -= 1;
      if (player.inputs.down) dy += 1;
      if (player.inputs.left) dx -= 1;
      if (player.inputs.right) dx += 1;

      // 대각선 이동 시 속도 정규화
      if (dx !== 0 && dy !== 0) {
        const factor = 1 / Math.SQRT2;
        dx *= factor;
        dy *= factor;
      }

      player.x += dx * player.speed;
      player.y += dy * player.speed;
      player.angle = player.inputs.angle;

      // 맵 경계 제한
      player.x = Math.max(player.radius, Math.min(this.WORLD_WIDTH - player.radius, player.x));
      player.y = Math.max(player.radius, Math.min(this.WORLD_HEIGHT - player.radius, player.y));

      // 발사 처리
      if (player.inputs.shooting && now - player.lastShotTime >= player.fireRateMs) {
        player.lastShotTime = now;
        const projectileSpeed = 13;
        const spawnDist = player.radius + 6;
        const projX = player.x + Math.cos(player.angle) * spawnDist;
        const projY = player.y + Math.sin(player.angle) * spawnDist;

        this.projectiles.push({
          id: this.projectileIdCounter++,
          ownerId: id,
          x: projX,
          y: projY,
          vx: Math.cos(player.angle) * projectileSpeed,
          vy: Math.sin(player.angle) * projectileSpeed,
          radius: 6,
          color: player.color,
          damage: 22 + Math.floor(player.level * 1.5),
          distance: 0,
          maxDistance: 850
        });
      }
    }

    // 2. 투사체 이동 및 충돌 판정
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.distance += Math.hypot(p.vx, p.vy);

      // 최대 사거리 또는 맵 경계 초과 시 소멸
      let destroyed = false;
      if (
        p.distance >= p.maxDistance ||
        p.x < 0 || p.x > this.WORLD_WIDTH ||
        p.y < 0 || p.y > this.WORLD_HEIGHT
      ) {
        destroyed = true;
      }

      // 플레이어와 투사체 충돌 검사
      if (!destroyed) {
        for (const [targetId, target] of this.players.entries()) {
          if (targetId === p.ownerId || target.isDead) continue;

          const dist = Math.hypot(p.x - target.x, p.y - target.y);
          if (dist < target.radius + p.radius) {
            // 피격
            target.hp = Math.max(0, target.hp - p.damage);
            destroyed = true;

            this.events.push({
              type: 'hit',
              x: p.x,
              y: p.y,
              color: p.color,
              targetId: targetId
            });

            // 사망 판정
            if (target.hp <= 0) {
              target.isDead = true;
              const killer = this.players.get(p.ownerId);
              if (killer) {
                killer.kills += 1;
                killer.score += 200;
                this.checkLevelUp(killer);
              }

              // 사망 시 보석 드랍 (화려한 연출)
              const dropCount = Math.min(25, 5 + Math.floor(target.score / 50));
              for (let k = 0; k < dropCount; k++) {
                const angle = Math.random() * Math.PI * 2;
                const spread = Math.random() * 70;
                this.spawnGem(
                  Math.max(50, Math.min(this.WORLD_WIDTH - 50, target.x + Math.cos(angle) * spread)),
                  Math.max(50, Math.min(this.WORLD_HEIGHT - 50, target.y + Math.sin(angle) * spread)),
                  20
                );
              }

              this.events.push({
                type: 'kill',
                killerName: killer ? killer.nickname : 'Unknown',
                victimName: target.nickname,
                x: target.x,
                y: target.y
              });
            }
            break;
          }
        }
      }

      if (destroyed) {
        this.projectiles.splice(i, 1);
      }
    }

    // 3. 플레이어와 보석 충돌 검사
    for (const [id, player] of this.players.entries()) {
      if (player.isDead) continue;

      for (let j = this.gems.length - 1; j >= 0; j--) {
        const gem = this.gems[j];
        const dist = Math.hypot(player.x - gem.x, player.y - gem.y);
        if (dist < player.radius + gem.radius + 5) {
          // 보석 섭취
          player.score += gem.value;
          player.hp = Math.min(player.maxHp, player.hp + 4); // 약간의 체력 회복
          this.checkLevelUp(player);

          this.events.push({
            type: 'gemCollect',
            playerId: id,
            x: gem.x,
            y: gem.y,
            color: gem.color
          });

          this.gems.splice(j, 1);
        }
      }
    }

    // 부족해진 보석 보충
    while (this.gems.length < this.MAX_GEMS) {
      this.spawnGem();
    }
  }

  // 레벨업 체크 및 스탯 반영
  checkLevelUp(player) {
    const newLevel = Math.floor(player.score / 120) + 1;
    if (newLevel !== player.level) {
      player.level = newLevel;
      player.maxHp = 100 + (player.level - 1) * 10;
      player.hp = Math.min(player.maxHp, player.hp + 20);
      player.radius = Math.min(42, 22 + (player.level - 1) * 1.5);
      player.speed = Math.max(4.2, 5.5 - (player.level - 1) * 0.08); // 레벨이 높으면 살짝 묵직해짐
    }
  }

  // 클라이언트에 브로드캐스트할 게임 상태 스냅샷
  getStateSnapshot() {
    const playersArray = [];
    for (const p of this.players.values()) {
      playersArray.push({
        id: p.id,
        nickname: p.nickname,
        color: p.color,
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        radius: p.radius,
        hp: p.hp,
        maxHp: p.maxHp,
        score: p.score,
        level: p.level,
        kills: p.kills,
        angle: Math.round(p.angle * 100) / 100,
        isDead: p.isDead
      });
    }

    // 점수 순 랭킹보드 (Top 10)
    const leaderboard = [...playersArray]
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map(p => ({
        id: p.id,
        nickname: p.nickname,
        score: p.score,
        kills: p.kills,
        color: p.color
      }));

    return {
      players: playersArray,
      projectiles: this.projectiles.map(p => ({
        id: p.id,
        x: Math.round(p.x),
        y: Math.round(p.y),
        radius: p.radius,
        color: p.color
      })),
      gems: this.gems.map(g => ({
        id: g.id,
        x: Math.round(g.x),
        y: Math.round(g.y),
        radius: g.radius,
        color: g.color
      })),
      events: this.events,
      leaderboard: leaderboard,
      world: {
        width: this.WORLD_WIDTH,
        height: this.WORLD_HEIGHT
      }
    };
  }
}

module.exports = GameLogic;

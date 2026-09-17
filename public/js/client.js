// public/js/client.js
// 클라이언트 메인 오케스트레이터 및 소켓 통신

(() => {
  const socket = io();
  const canvas = document.getElementById('gameCanvas');
  const minimapCanvas = document.getElementById('minimapCanvas');

  const renderer = new Renderer(canvas, minimapCanvas);

  let myId = null;
  let myPlayer = null;
  let isPlaying = false;
  let currentGameState = null;

  // 입력 상태
  const inputState = {
    up: false,
    down: false,
    left: false,
    right: false,
    angle: 0,
    shooting: false
  };

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;

  // 1. UI 초기화 콜백 연결
  UI.init(
    // onJoin
    (nickname, color) => {
      socket.emit('join', { nickname, color });
    },
    // onRespawn
    () => {
      socket.emit('respawn');
    },
    // onChatSend
    (text) => {
      socket.emit('chat', text);
    }
  );

  // 2. 키보드 입력 핸들러
  window.addEventListener('keydown', (e) => {
    // 채팅 입력 중일 때는 게임 조작 차단
    if (document.activeElement === UI.elements.chatInput) return;

    if (e.code === 'KeyW' || e.code === 'ArrowUp') inputState.up = true;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') inputState.down = true;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputState.left = true;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') inputState.right = true;
    if (e.code === 'Space') inputState.shooting = true;
  });

  window.addEventListener('keyup', (e) => {
    if (document.activeElement === UI.elements.chatInput) return;

    if (e.code === 'KeyW' || e.code === 'ArrowUp') inputState.up = false;
    if (e.code === 'KeyS' || e.code === 'ArrowDown') inputState.down = false;
    if (e.code === 'KeyA' || e.code === 'ArrowLeft') inputState.left = false;
    if (e.code === 'KeyD' || e.code === 'ArrowRight') inputState.right = false;
    if (e.code === 'Space') inputState.shooting = false;
  });

  // 3. 마우스 조준 및 사격 핸들러
  window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    calculateAngle();
  });

  window.addEventListener('mousedown', (e) => {
    if (e.button === 0 && isPlaying) {
      if (document.activeElement !== UI.elements.chatInput) {
        inputState.shooting = true;
      }
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
      inputState.shooting = false;
    }
  });

  function calculateAngle() {
    // 화면 중앙(내 기체 위치) 기준 마우스 각도 계산
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    inputState.angle = Math.atan2(mouseY - centerY, mouseX - centerX);
  }

  // 입력값을 주기적으로 서버로 전송 (40 FPS = 25ms 간격)
  setInterval(() => {
    if (isPlaying && myId) {
      calculateAngle();
      socket.emit('input', inputState);
    }
  }, 25);

  // 4. 소켓 이벤트 리스너

  // 입장 성공
  socket.on('joined', (data) => {
    myId = socket.id;
    myPlayer = data.player;
    isPlaying = true;

    renderer.camera.x = myPlayer.x;
    renderer.camera.y = myPlayer.y;

    UI.showGameUI(myPlayer);
  });

  // 부활 성공
  socket.on('respawned', (player) => {
    myPlayer = player;
    isPlaying = true;
    UI.hideDeathModal();
    UI.updatePlayerStats(player);
  });

  // 게임 상태 브로드캐스트 수신
  socket.on('gameState', (state) => {
    currentGameState = state;

    if (!isPlaying || !myId) return;

    // 내 플레이어 찾기
    const updatedMe = state.players.find(p => p.id === myId);
    if (updatedMe) {
      // 사망 판정 전환
      if (!myPlayer.isDead && updatedMe.isDead) {
        isPlaying = false;
        // 킬러 이름 찾기
        const killEvent = state.events.find(e => e.type === 'kill' && e.victimName === updatedMe.nickname);
        UI.showDeathModal(updatedMe, killEvent ? killEvent.killerName : null);
      }
      myPlayer = updatedMe;
      UI.updatePlayerStats(myPlayer);
    }

    // 일회성 시각 효과 이벤트 처리 (파티클)
    if (state.events && state.events.length > 0) {
      state.events.forEach(ev => {
        if (ev.type === 'hit') {
          renderer.addParticles(ev.x, ev.y, ev.color, 8, 4);
        } else if (ev.type === 'gemCollect') {
          renderer.addParticles(ev.x, ev.y, ev.color, 6, 2.5);
        } else if (ev.type === 'kill') {
          renderer.addParticles(ev.x, ev.y, '#ff0055', 24, 7);
          renderer.addParticles(ev.x, ev.y, '#ffe600', 16, 5);
        }
      });
    }

    // 리더보드 갱신
    if (state.leaderboard) {
      UI.updateLeaderboard(state.leaderboard, myId);
    }
  });

  // 채팅 메시지 수신
  socket.on('chat', (data) => {
    UI.addChatMessage(data.sender, data.color, data.text);
  });

  // 5. 렌더 루프
  function animationLoop() {
    renderer.render(currentGameState, myId);
    requestAnimationFrame(animationLoop);
  }

  requestAnimationFrame(animationLoop);
})();

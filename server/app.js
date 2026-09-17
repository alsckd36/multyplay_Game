// server/app.js
// Express & Socket.io 기반 멀티플레이어 서버

const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const GameLogic = require('./gameLogic');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// 정적 파일 호스팅 (public 디렉터리)
app.use(express.static(path.join(__dirname, '../public')));

// 카트라이더 3D 호스팅 (/kartrider 경로)
app.use('/kartrider', express.static(path.join(__dirname, '../kartrider-3d')));

// 기본 라우트
app.get('/health', (req, res) => {
  res.json({ status: 'ok', playersCount: game.players.size });
});

// 게임 엔진 인스턴스 생성
const game = new GameLogic();

// Socket.io 연결 처리
io.on('connection', (socket) => {
  console.log(`[+] 새로운 소켓 연결: ${socket.id}`);

  // 1. 게임 참가 요청
  socket.on('join', (data) => {
    const { nickname, color } = data || {};
    const player = game.addPlayer(socket.id, nickname, color);

    // 참가 성공 응답 (내 플레이어 정보 및 월드 규격 전달)
    socket.emit('joined', {
      player: player,
      world: {
        width: game.WORLD_WIDTH,
        height: game.WORLD_HEIGHT
      }
    });

    // 시스템 공지 메시지 브로드캐스트
    io.emit('chat', {
      sender: '[시스템]',
      color: '#ffff00',
      text: `${player.nickname} 님이 아레나에 입장하셨습니다!`
    });

    console.log(`[입장] ${player.nickname} (${socket.id}) - 색상: ${player.color}`);
  });

  // 2. 조작 입력 수신
  socket.on('input', (inputData) => {
    game.handleInput(socket.id, inputData);
  });

  // 3. 부활 요청
  socket.on('respawn', () => {
    const respawnedPlayer = game.respawnPlayer(socket.id);
    if (respawnedPlayer) {
      socket.emit('respawned', respawnedPlayer);
      io.emit('chat', {
        sender: '[시스템]',
        color: '#00ffcc',
        text: `${respawnedPlayer.nickname} 님이 전장으로 복귀했습니다!`
      });
    }
  });

  // 4. 인게임 채팅 메시지 수신 및 전달
  socket.on('chat', (messageText) => {
    const player = game.players.get(socket.id);
    if (!player) return;

    const safeText = String(messageText || '').trim().substring(0, 100);
    if (safeText.length === 0) return;

    io.emit('chat', {
      sender: player.nickname,
      color: player.color,
      text: safeText
    });
  });

  // 5. 접속 종료 처리
  socket.on('disconnect', () => {
    const player = game.players.get(socket.id);
    if (player) {
      console.log(`[-] 플레이어 퇴장: ${player.nickname} (${socket.id})`);
      io.emit('chat', {
        sender: '[시스템]',
        color: '#ff4444',
        text: `${player.nickname} 님이 아레나를 떠났습니다.`
      });
      game.removePlayer(socket.id);
    }
  });
});

// 게임 서버 틱 루프 (60 FPS: 16.6ms)
const TICK_INTERVAL = 1000 / 60;
setInterval(() => {
  game.update();
  const snapshot = game.getStateSnapshot();
  io.emit('gameState', snapshot);
}, TICK_INTERVAL);

// 서버 실행
server.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`🎮 2D 멀티플레이어 아레나 서버 구동 완료!`);
  console.log(`🌐 로컬 접속 주소: http://localhost:${PORT}`);
  console.log(`=============================================`);
});

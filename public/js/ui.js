// public/js/ui.js
// HUD, 모달, 채팅 및 리더보드 관리 모듈

const UI = {
  selectedColor: '#00f0ff',

  elements: {
    loginModal: document.getElementById('loginModal'),
    respawnModal: document.getElementById('respawnModal'),
    gameHud: document.getElementById('gameHud'),
    nicknameInput: document.getElementById('nicknameInput'),
    joinBtn: document.getElementById('joinBtn'),
    respawnBtn: document.getElementById('respawnBtn'),
    colorPalette: document.getElementById('colorPalette'),

    // HUD 요소
    hudLevelBadge: document.getElementById('hudLevelBadge'),
    hudNickname: document.getElementById('hudNickname'),
    hudHpFill: document.getElementById('hudHpFill'),
    hudHpText: document.getElementById('hudHpText'),
    hudScore: document.getElementById('hudScore'),
    hudKills: document.getElementById('hudKills'),

    // 리더보드
    leaderboardList: document.getElementById('leaderboardList'),

    // 채팅
    chatMessages: document.getElementById('chatMessages'),
    chatForm: document.getElementById('chatForm'),
    chatInput: document.getElementById('chatInput'),

    // 사망 통계
    finalScore: document.getElementById('finalScore'),
    finalKills: document.getElementById('finalKills'),
    deathReason: document.getElementById('deathReason')
  },

  init(onJoin, onRespawn, onChatSend) {
    // 1. 색상 팔레트 선택 이벤트
    const colorBtns = this.elements.colorPalette.querySelectorAll('.color-btn');
    colorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        colorBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedColor = btn.getAttribute('data-color');
      });
    });

    // 2. 입장 버튼 클릭 및 Enter 이벤트
    this.elements.joinBtn.addEventListener('click', () => {
      const nickname = this.elements.nicknameInput.value.trim() || 'Survivor';
      onJoin(nickname, this.selectedColor);
    });

    this.elements.nicknameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const nickname = this.elements.nicknameInput.value.trim() || 'Survivor';
        onJoin(nickname, this.selectedColor);
      }
    });

    // 3. 부활 버튼 클릭
    this.elements.respawnBtn.addEventListener('click', () => {
      onRespawn();
    });

    // 4. 채팅 전송 이벤트
    this.elements.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = this.elements.chatInput.value.trim();
      if (text) {
        onChatSend(text);
        this.elements.chatInput.value = '';
      }
      this.elements.chatInput.blur();
    });

    // 키보드 엔터 누르면 채팅창 포커스
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        // 모달이 열려있지 않을 때만 인게임 채팅 포커스
        if (this.elements.loginModal.classList.contains('hidden') &&
            this.elements.respawnModal.classList.contains('hidden')) {
          if (document.activeElement !== this.elements.chatInput) {
            e.preventDefault();
            this.elements.chatInput.focus();
          }
        }
      } else if (e.key === 'Escape') {
        if (document.activeElement === this.elements.chatInput) {
          this.elements.chatInput.blur();
        }
      }
    });
  },

  // 게임 시작 시 HUD 표시
  showGameUI(player) {
    this.elements.loginModal.classList.add('hidden');
    this.elements.respawnModal.classList.add('hidden');
    this.elements.gameHud.classList.remove('hidden');
    this.updatePlayerStats(player);
  },

  // 플레이어 스탯 업데이트
  updatePlayerStats(player) {
    if (!player) return;
    this.elements.hudNickname.textContent = player.nickname;
    this.elements.hudLevelBadge.textContent = `LV. ${player.level}`;

    const hpPercent = Math.max(0, Math.min(100, (player.hp / player.maxHp) * 100));
    this.elements.hudHpFill.style.width = `${hpPercent}%`;
    this.elements.hudHpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
    this.elements.hudScore.textContent = player.score.toLocaleString();
    this.elements.hudKills.textContent = player.kills;
  },

  // 리더보드 갱신
  updateLeaderboard(leaderboard, myId) {
    this.elements.leaderboardList.innerHTML = '';
    leaderboard.forEach(item => {
      const li = document.createElement('li');
      if (item.id === myId) {
        li.style.color = '#00f0ff';
        li.style.fontWeight = 'bold';
      }

      const nameSpan = document.createElement('span');
      nameSpan.className = 'lb-name';
      nameSpan.textContent = item.nickname;

      const scoreSpan = document.createElement('span');
      scoreSpan.className = 'lb-score';
      scoreSpan.textContent = item.score.toLocaleString();

      li.appendChild(nameSpan);
      li.appendChild(scoreSpan);
      this.elements.leaderboardList.appendChild(li);
    });
  },

  // 채팅 메시지 추가
  addChatMessage(sender, color, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'chat-msg';

    const senderSpan = document.createElement('span');
    senderSpan.className = 'chat-sender';
    senderSpan.style.color = color || '#00f0ff';
    senderSpan.textContent = `${sender}:`;

    const textSpan = document.createElement('span');
    textSpan.textContent = ` ${text}`;

    msgDiv.appendChild(senderSpan);
    msgDiv.appendChild(textSpan);
    this.elements.chatMessages.appendChild(msgDiv);

    // 스크롤 최하단 유지 및 50개 제한
    while (this.elements.chatMessages.children.length > 50) {
      this.elements.chatMessages.removeChild(this.elements.chatMessages.firstChild);
    }
    this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;
  },

  // 플레이어 사망 시 모달 표시
  showDeathModal(player, killerName) {
    this.elements.finalScore.textContent = player.score.toLocaleString();
    this.elements.finalKills.textContent = player.kills;
    this.elements.deathReason.textContent = killerName
      ? `[${killerName}] 님의 공격에 기체가 격추되었습니다!`
      : '전투 중 기체가 파괴되었습니다.';
    this.elements.respawnModal.classList.remove('hidden');
  },

  hideDeathModal() {
    this.elements.respawnModal.classList.add('hidden');
  }
};

/**
 * Catur Sekolah - Main Application Controller
 * Handles UI, User Interactions, Board Rendering, Timers, and Game Loops
 */

function initCaturApp() {
  console.log('Inisialisasi Catur Sekolah dimuat...');
  // --- UI References ---
  const boardEl = document.getElementById('chessboard');
  const practiceBoardEl = document.getElementById('practice-board');
  const statusTextEl = document.getElementById('game-status-text');
  const moveHistoryListEl = document.getElementById('move-history-list');
  const evalBarFillEl = document.getElementById('eval-bar-fill');
  const evalScoreTextEl = document.getElementById('eval-score-text');

  // Player Elements
  const topPlayerNameEl = document.getElementById('top-player-name');
  const topPlayerSubEl = document.getElementById('top-player-sub');
  const bottomPlayerNameEl = document.getElementById('bottom-player-name');
  const bottomPlayerSubEl = document.getElementById('bottom-player-sub');
  const clockTopEl = document.getElementById('clock-top');
  const clockBottomEl = document.getElementById('clock-bottom');
  const capturedWhiteEl = document.getElementById('captured-by-white');
  const capturedBlackEl = document.getElementById('captured-by-black');

  // Navigation
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabPanes = document.querySelectorAll('.tab-pane');

  // Mode Selection
  const modeCards = document.querySelectorAll('.mode-card');
  const aiSubpanel = document.getElementById('ai-config-subpanel');
  const onlineSubpanel = document.getElementById('online-config-subpanel');
  const diffBtns = document.querySelectorAll('.diff-btn');
  const timeBtns = document.querySelectorAll('.time-btn');

  // Modals
  const profileModal = document.getElementById('modal-profile');
  const btnUserProfile = document.getElementById('btn-user-profile');
  const btnCloseProfile = document.getElementById('btn-close-profile');
  const btnSaveProfile = document.getElementById('btn-save-profile');
  const inputProfileName = document.getElementById('input-profile-name');
  const selectProfileClass = document.getElementById('input-profile-class');
  const avatarOptions = document.querySelectorAll('.avatar-option');
  const promoModal = document.getElementById('modal-promotion');
  const promoOptions = document.querySelectorAll('.promo-btn');

  // Online Room Elements
  const btnCreateRoom = document.getElementById('btn-create-room');
  const btnJoinRoom = document.getElementById('btn-join-room');
  const inputRoomCode = document.getElementById('input-room-code');
  const displayRoomPin = document.getElementById('display-room-pin');
  const btnCopyPin = document.getElementById('btn-copy-pin');
  const btnCopyLink = document.getElementById('btn-copy-link');
  const btnLeaveRoom = document.getElementById('btn-leave-room');
  const btnRematchRoom = document.getElementById('btn-rematch-room');
  const btnNetP2p = document.getElementById('btn-net-p2p');
  const btnNetLan = document.getElementById('btn-net-lan');

  // App State
  let currentMode = 'local'; // 'local', 'online' (mode bot AI disembunyikan)
  let currentNetworkType = 'p2p'; // 'p2p' (Internet Jarak Jauh) atau 'lan' (WiFi Lokal)
  let isFlipped = false;
  let selectedSquare = null;
  let legalMovesForSelected = [];
  let pendingPromotionMove = null;
  let isAiThinking = false;
  let currentRoomPin = null;
  let myOnlineColor = null; // 'w' or 'b'
  let onlineRoomData = null;
  let onlineEventSource = null;
  let onlinePollTimer = null;
  const practiceEngine = new ChessEngine();
  let practiceSelectedSquare = null;

  // Timers State
  let timePreset = 600; // Default 10 min
  let whiteTime = 600;
  let blackTime = 600;
  let clockInterval = null;

  // Piece Symbols Unicode Map
  const PIECE_SYMBOLS = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙',
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'
  };

  function requireLoginToPlay(message) {
    if (schoolDb && typeof schoolDb.isLoggedIn === 'function' && schoolDb.isLoggedIn()) return true;
    showToast(message || 'Silakan masuk/login terlebih dahulu sebelum bermain.', 'info');
    const btn = document.getElementById('btn-open-auth');
    if (btn) btn.click();
    return false;
  }

  // ==================== 1. BOARD INITIALIZATION & RENDERING ====================
  function initBoard() {
    boardEl.innerHTML = '';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = document.createElement('div');
        sq.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
        sq.dataset.row = r;
        sq.dataset.col = c;
        sq.addEventListener('click', () => onSquareClicked(r, c));
        boardEl.appendChild(sq);
      }
    }
  }

  function renderBoard() {
    const squares = boardEl.querySelectorAll('.square');
    const lastMove = chessEngine.history.length > 0 ? chessEngine.history[chessEngine.history.length - 1].move : null;
    const kingInCheck = chessEngine.isKingInCheck(chessEngine.turn) ? chessEngine.findKing(chessEngine.turn) : null;

    squares.forEach(sq => {
      let r = parseInt(sq.dataset.row, 10);
      let c = parseInt(sq.dataset.col, 10);

      // Handle board flip view
      if (isFlipped) {
        r = 7 - r;
        c = 7 - c;
      }

      sq.innerHTML = '';
      sq.classList.remove('selected', 'legal-move', 'legal-capture', 'last-move', 'in-check');

      // Check king in check highlight
      if (kingInCheck && kingInCheck.r === r && kingInCheck.c === c) {
        sq.classList.add('in-check');
      }

      // Last move highlight
      if (lastMove && ((lastMove.fromR === r && lastMove.fromC === c) || (lastMove.toR === r && lastMove.toC === c))) {
        sq.classList.add('last-move');
      }

      // Selected square highlight
      if (selectedSquare && selectedSquare.r === r && selectedSquare.c === c) {
        sq.classList.add('selected');
      }

      // Legal moves highlights
      const isLegal = legalMovesForSelected.find(m => m.toR === r && m.toC === c);
      if (isLegal) {
        if (isLegal.capture || isLegal.isEnPassant) {
          sq.classList.add('legal-capture');
        } else {
          sq.classList.add('legal-move');
        }
      }

      // Place piece
      const piece = chessEngine.board[r][c];
      if (piece) {
        const pieceEl = document.createElement('span');
        pieceEl.className = `piece ${chessEngine.isWhite(piece) ? 'white-piece' : 'black-piece'}`;
        pieceEl.textContent = PIECE_SYMBOLS[piece] || piece;
        sq.appendChild(pieceEl);
      }
    });

    updateCapturedPieces();
    updateStatusDisplay();
    updateEvaluation();
  }

  // ==================== 2. INTERACTION & MOVE LOGIC ====================
  function onSquareClicked(visualR, visualC) {
    if (chessEngine.isGameOver || isAiThinking) return;

    // Online Mode Checks
    if (currentMode === 'online') {
      if (!currentRoomPin || !onlineRoomData || onlineRoomData.status !== 'playing') {
        showToast('Menunggu lawan bergabung ke ruang PIN sebelum bermain!', 'info');
        return;
      }
      if (chessEngine.turn !== myOnlineColor) {
        showToast('Bukan giliran Anda! Menunggu langkah lawan...', 'warning');
        return;
      }
    }

    const r = isFlipped ? 7 - visualR : visualR;
    const c = isFlipped ? 7 - visualC : visualC;
    const piece = chessEngine.board[r][c];
    const isPlayerTurn = currentMode === 'online'
      ? (chessEngine.turn === myOnlineColor)
      : (currentMode !== 'ai' || chessEngine.turn === 'w');

    if (!isPlayerTurn) return;

    // Prevent selecting opponent piece directly in online mode unless capturing
    if (currentMode === 'online' && !selectedSquare && piece && chessEngine.getColor(piece) !== myOnlineColor) {
      return;
    }

    // If square is already selected, deselect or check move
    if (selectedSquare) {
      const targetMove = legalMovesForSelected.find(m => m.toR === r && m.toC === c);

      if (targetMove) {
        // Check if move requires promotion choice
        if (targetMove.promotion) {
          pendingPromotionMove = targetMove;
          showPromotionModal();
          return;
        }
        executePlayerMove(targetMove);
        return;
      }

      // If clicked own other piece, switch selection
      if (piece && chessEngine.getColor(piece) === chessEngine.turn) {
        selectPieceAt(r, c);
        return;
      }

      // Clicked empty or illegal square, clear selection
      clearSelection();
      renderBoard();
      return;
    }

    // Select piece
    if (piece && chessEngine.getColor(piece) === chessEngine.turn) {
      selectPieceAt(r, c);
    }
  }

  function selectPieceAt(r, c) {
    selectedSquare = { r, c };
    legalMovesForSelected = chessEngine.getLegalMoves(r, c);
    renderBoard();
  }

  function clearSelection() {
    selectedSquare = null;
    legalMovesForSelected = [];
  }

  function executePlayerMove(move) {
    const isCapture = move.capture || move.isEnPassant;
    const san = chessEngine.moveToSan(move);

    chessEngine.executeMove(move);
    clearSelection();

    // Play Sound Effect
    if (chessEngine.isKingInCheck(chessEngine.turn)) {
      soundCtrl.playCheck();
    } else if (isCapture) {
      soundCtrl.playCapture();
    } else {
      soundCtrl.playMove();
    }

    addMoveToHistory(san);
    renderBoard();
    switchClocks();

    // Check game over
    if (chessEngine.isGameOver) {
      handleGameOver();
      return;
    }

    // Trigger AI move if in AI Mode
    if (currentMode === 'ai' && chessEngine.turn === 'b') {
      triggerAiMove();
    }

    // Trigger Online Sync if in Room Mode
    if (currentMode === 'online' && currentRoomPin) {
      sendOnlineMove(move, san);
    }
  }

  function triggerAiMove() {
    isAiThinking = true;
    statusTextEl.textContent = 'Bot sedang memikirkan taktik terbaik...';

    setTimeout(() => {
      const bestMove = chessAI.getBestMove(chessEngine);
      isAiThinking = false;

      if (bestMove) {
        const isCapture = bestMove.capture || bestMove.isEnPassant;
        const san = chessEngine.moveToSan(bestMove);
        chessEngine.executeMove(bestMove);

        if (chessEngine.isKingInCheck(chessEngine.turn)) {
          soundCtrl.playCheck();
        } else if (isCapture) {
          soundCtrl.playCapture();
        } else {
          soundCtrl.playMove();
        }

        addMoveToHistory(san);
        renderBoard();
        switchClocks();

        if (chessEngine.isGameOver) {
          handleGameOver();
        }
      }
    }, 450);
  }

  // Promotion handling
  function showPromotionModal() {
    promoModal.style.setProperty('display', 'flex', 'important');
    promoModal.style.setProperty('pointer-events', 'auto', 'important');
    promoModal.classList.remove('hidden');
    promoModal.classList.add('active');
  }

  promoOptions.forEach(btn => {
    btn.addEventListener('click', () => {
      const chosen = btn.dataset.piece;
      promoModal.style.setProperty('display', 'none', 'important');
      promoModal.style.setProperty('pointer-events', 'none', 'important');
      promoModal.classList.add('hidden');
      promoModal.classList.remove('active');
      if (pendingPromotionMove) {
        const finalMove = {
          ...pendingPromotionMove,
          promotion: chessEngine.turn === 'w' ? chosen.toUpperCase() : chosen
        };
        pendingPromotionMove = null;
        executePlayerMove(finalMove);
      }
    });
  });

  // ==================== 3. CHESS CLOCKS & TIMERS ====================
  function startClocks() {
    clearInterval(clockInterval);
    if (timePreset === 0) {
      clockTopEl.textContent = 'âˆž';
      clockBottomEl.textContent = 'âˆž';
      return;
    }

    whiteTime = timePreset;
    blackTime = timePreset;
    updateClockDisplays();

    clockInterval = setInterval(() => {
      if (chessEngine.isGameOver) return;

      if (chessEngine.turn === 'w') {
        whiteTime--;
        if (whiteTime <= 0) {
          whiteTime = 0;
          onTimeOut('w');
        }
      } else {
        blackTime--;
        if (blackTime <= 0) {
          blackTime = 0;
          onTimeOut('b');
        }
      }
      updateClockDisplays();
    }, 1000);
  }

  function updateClockDisplays() {
    if (isFlipped) {
      clockBottomEl.textContent = formatTime(blackTime);
      clockTopEl.textContent = formatTime(whiteTime);
      clockBottomEl.classList.toggle('active', chessEngine.turn === 'b' && timePreset > 0);
      clockTopEl.classList.toggle('active', chessEngine.turn === 'w' && timePreset > 0);
      clockBottomEl.classList.toggle('danger', blackTime < 30 && timePreset > 0);
      clockTopEl.classList.toggle('danger', whiteTime < 30 && timePreset > 0);
    } else {
      clockBottomEl.textContent = formatTime(whiteTime);
      clockTopEl.textContent = formatTime(blackTime);
      clockBottomEl.classList.toggle('active', chessEngine.turn === 'w' && timePreset > 0);
      clockTopEl.classList.toggle('active', chessEngine.turn === 'b' && timePreset > 0);
      clockBottomEl.classList.toggle('danger', whiteTime < 30 && timePreset > 0);
      clockTopEl.classList.toggle('danger', blackTime < 30 && timePreset > 0);
    }
  }

  function switchClocks() {
    updateClockDisplays();
  }

  function formatTime(seconds) {
    if (timePreset === 0) return 'âˆž';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  function onTimeOut(color) {
    clearInterval(clockInterval);
    chessEngine.isGameOver = true;
    chessEngine.gameResult = color === 'w' ? '0-1' : '1-0';
    showToast(`Waktu habis! ${color === 'w' ? 'Hitam' : 'Putih'} Menang atas waktu.`, 'info');
    handleGameOver();
  }

  // ==================== 4. STATUS & EVALUATION ====================
  function updateStatusDisplay() {
    if (chessEngine.isGameOver) {
      if (chessEngine.gameResult === '1-0') {
        const reason = chessEngine.gameOverReason ? ` (${chessEngine.gameOverReason})` : '';
        statusTextEl.textContent = `Putih Menang (1 - 0)${reason}`;
      } else if (chessEngine.gameResult === '0-1') {
        const reason = chessEngine.gameOverReason ? ` (${chessEngine.gameOverReason})` : '';
        statusTextEl.textContent = `Hitam Menang (0 - 1)${reason}`;
      } else {
        const reason = chessEngine.gameOverReason || 'Remis';
        statusTextEl.textContent = `Permainan Berakhir Remis (1/2 - 1/2) — ${reason}`;
      }
      return;
    }

    if (currentMode === 'online') {
      if (!currentRoomPin || !onlineRoomData || onlineRoomData.status !== 'playing') {
        statusTextEl.textContent = `Menunggu lawan bergabung dengan PIN: ${currentRoomPin || '----'}...`;
        return;
      }
      const oppName = myOnlineColor === 'w' ? (onlineRoomData.guest?.name || 'Lawan') : (onlineRoomData.host?.name || 'Lawan');
      if (chessEngine.turn === myOnlineColor) {
        statusTextEl.textContent = `Giliran Anda untuk melangkah (${myOnlineColor === 'w' ? 'Putih' : 'Hitam'})!`;
      } else {
        statusTextEl.textContent = `Giliran ${oppName} untuk melangkah...`;
      }
      if (chessEngine.isKingInCheck(chessEngine.turn)) {
        statusTextEl.textContent = `âš ï¸ Skak! ${statusTextEl.textContent}`;
      }
      return;
    }

    const currentTurn = chessEngine.turn === 'w' ? 'Putih' : 'Hitam';
    if (chessEngine.isKingInCheck(chessEngine.turn)) {
      statusTextEl.textContent = `Skak! Giliran ${currentTurn} harus menyelamatkan Raja!`;
    } else {
      statusTextEl.textContent = `Giliran ${currentTurn} untuk melangkah`;
    }
  }

  function updateEvaluation() {
    const rawScore = chessEngine.evaluatePosition(); // centipawns
    // Clamp score between -1000 and 1000 for visual bar
    const clamped = Math.max(-1000, Math.min(1000, rawScore));
    const percentage = 50 + (clamped / 1000) * 45;
    evalBarFillEl.style.width = `${percentage}%`;

    const pawnScore = (rawScore / 100).toFixed(1);
    if (Math.abs(rawScore) < 25) {
      evalScoreTextEl.textContent = 'Posisi Imbang';
    } else if (rawScore > 0) {
      evalScoreTextEl.textContent = `Putih (+${pawnScore})`;
    } else {
      evalScoreTextEl.textContent = `Hitam (${pawnScore})`;
    }
  }

  function updateCapturedPieces() {
    capturedWhiteEl.textContent = chessEngine.capturedPieces.w.map(p => PIECE_SYMBOLS[p] || p).join(' ');
    capturedBlackEl.textContent = chessEngine.capturedPieces.b.map(p => PIECE_SYMBOLS[p] || p).join(' ');
  }

  function addMoveToHistory(san) {
    const historyList = moveHistoryListEl;
    if (chessEngine.turn === 'b') { // White just moved
      const moveNum = chessEngine.fullMoves;
      const row = document.createElement('div');
      row.className = 'move-row';
      row.id = `move-row-${moveNum}`;
      row.innerHTML = `<span>${moveNum}.</span><span>${san}</span><span></span>`;
      historyList.appendChild(row);
    } else { // Black just moved
      const prevRow = document.getElementById(`move-row-${chessEngine.fullMoves - 1}`);
      if (prevRow) {
        prevRow.children[2].textContent = san;
      }
    }
    historyList.scrollTop = historyList.scrollHeight;
  }

  function handleGameOver() {
    clearInterval(clockInterval);
    const profile = schoolDb.getProfile();
    const isPlayerWin = currentMode === 'online'
      ? (myOnlineColor === 'w' ? chessEngine.gameResult === '1-0' : chessEngine.gameResult === '0-1')
      : (chessEngine.gameResult === '1-0');
    const isDraw = (chessEngine.gameResult === '1/2-1/2');
    const isBotMatch = currentMode === 'ai';

    if (isPlayerWin) {
      soundCtrl.playVictory();
      if (isBotMatch) {
        showToast(`Selamat ${profile.name}! Kamu menang melawan bot. ELO tidak berubah saat melawan bot.`, 'success');
      } else {
        showToast(`Selamat ${profile.name}! Kemenangan dicatat (+20 ELO).`, 'success');
        schoolDb.recordGameResult(true, false);
      }
    } else if (isDraw) {
      const reason = chessEngine.gameOverReason ? ` Alasan: ${chessEngine.gameOverReason}.` : '';
      if (isBotMatch) {
        showToast(`Permainan remis melawan bot.${reason} ELO tidak berubah.`, 'info');
      } else {
        showToast(`Permainan remis!${reason} Hasil imbang dicatat (+5 ELO).`, 'info');
        schoolDb.recordGameResult(false, true);
      }
    } else {
      if (isBotMatch) {
        showToast('Kamu kalah melawan bot. ELO tidak berubah saat melawan bot.', 'info');
      } else {
        showToast('Permainan berakhir. Hasil kalah dicatat (-10 ELO).', 'info');
        schoolDb.recordGameResult(false, false);
      }
    }

    if (currentMode === 'online' && btnRematchRoom) {
      btnRematchRoom.classList.remove('hidden');
    }

    // Simpan catatan riwayat pertandingan ke Firestore 'games'
    try {
      const opponentName = currentMode === 'online'
        ? (myOnlineColor === 'w' ? (onlineRoomData?.guest?.name || 'Lawan') : (onlineRoomData?.host?.name || 'Host'))
        : (currentMode === 'ai' ? `Bot Level ${chessAI.difficulty}` : 'Pemain 2 (Lokal)');
      const opponentUid = currentMode === 'online'
        ? (myOnlineColor === 'w' ? (onlineRoomData?.guest?.uid || 'guest') : (onlineRoomData?.host?.uid || 'host'))
        : (currentMode === 'ai' ? 'bot_ai' : 'local_p2');

      const playerRating = Number.isFinite(Number(profile.rating)) ? Number(profile.rating) : 0;
      const whiteData = (currentMode === 'online' && myOnlineColor === 'b')
        ? { uid: opponentUid, name: opponentName, rating: 0 }
        : { uid: profile.id, name: profile.name, rating: playerRating };

      const blackData = (currentMode === 'online' && myOnlineColor === 'b')
        ? { uid: profile.id, name: profile.name, rating: playerRating }
        : { uid: opponentUid, name: opponentName, rating: 0 };

      schoolDb.saveGameRecord({
        players: [profile.id, opponentUid],
        white: whiteData,
        black: blackData,
        result: chessEngine.gameResult,
        winner: isPlayerWin ? profile.name : (isDraw ? 'draw' : opponentName),
        isWin: isPlayerWin,
        isDraw: isDraw,
        mode: currentMode,
        movesCount: chessEngine.fullMoves
      });
    } catch (e) {
      console.warn('Gagal mencatat game ke riwayat:', e);
    }

    renderStudentLeaderboard();
    renderClassLeaderboard();
  }

  // ==================== 5. QUICK CONTROLS & NEW GAME ====================
  function startNewGame() {
    if (schoolDb && typeof schoolDb.isLoggedIn === 'function' && !schoolDb.isLoggedIn()) {
      chessEngine.reset();
      clearSelection();
      if (moveHistoryListEl) moveHistoryListEl.innerHTML = '';
      renderBoard();
      requireLoginToPlay('Silakan login terlebih dahulu untuk memulai permainan.');
      return;
    }
    chessEngine.reset();
    clearSelection();
    moveHistoryListEl.innerHTML = '';
    renderBoard();

    // Update Player Names
    const profile = schoolDb.getProfile();

    if (currentMode === 'ai') {
      isFlipped = false;
      startClocks();
      bottomPlayerNameEl.textContent = `${profile.name} (Putih)`;
      bottomPlayerSubEl.textContent = `${profile.studentClass} • ${Number.isFinite(Number(profile.rating)) ? Number(profile.rating) : 0} ELO`;
      const diffLabel = ['Pemula', 'Ekskul', 'Master'][chessAI.difficulty - 1];
      topPlayerNameEl.textContent = `Bot ${diffLabel} (Hitam)`;
      topPlayerSubEl.textContent = 'Mesin Taktik AI Sekolah';
      showToast('Pertandingan catur baru dimulai!', 'info');
    } else if (currentMode === 'local') {
      isFlipped = false;
      startClocks();
      bottomPlayerNameEl.textContent = 'Pemain 1 (Putih)';
      bottomPlayerSubEl.textContent = 'Lokal';
      topPlayerNameEl.textContent = 'Pemain 2 (Hitam)';
      topPlayerSubEl.textContent = 'PvP 1 Layar Bersama';
      showToast('Pertandingan catur baru dimulai!', 'info');
    } else {
      // Online mode setup
      if (myOnlineColor === 'b') {
        isFlipped = true;
        bottomPlayerNameEl.textContent = `${profile.name} (Hitam)`;
        bottomPlayerSubEl.textContent = `${profile.studentClass} • ${Number.isFinite(Number(profile.rating)) ? Number(profile.rating) : 0} ELO`;
        const hostName = onlineRoomData?.host?.name || 'Lawan Online';
        const hostClass = onlineRoomData?.host?.studentClass || 'Putih';
        topPlayerNameEl.textContent = `${hostName} (Putih)`;
        topPlayerSubEl.textContent = `${hostClass} â€¢ Lawan Tanding`;
      } else {
        isFlipped = false;
        bottomPlayerNameEl.textContent = `${profile.name} (Putih)`;
        bottomPlayerSubEl.textContent = `${profile.studentClass} • ${Number.isFinite(Number(profile.rating)) ? Number(profile.rating) : 0} ELO`;
        const guestName = onlineRoomData?.guest?.name || 'Menunggu Lawan...';
        const guestClass = onlineRoomData?.guest?.studentClass || 'PIN: ' + (currentRoomPin || '----');
        topPlayerNameEl.textContent = `${guestName} (Hitam)`;
        topPlayerSubEl.textContent = `${guestClass}`;
      }

      if (onlineRoomData && onlineRoomData.status === 'playing') {
        startClocks();
      } else {
        clearInterval(clockInterval);
        clockBottomEl.textContent = formatTime(timePreset);
        clockTopEl.textContent = formatTime(timePreset);
      }
      updateStatusDisplay();
    }
  }

  document.getElementById('btn-start-game').addEventListener('click', () => {
    if (!requireLoginToPlay('Silakan login terlebih dahulu untuk memulai permainan.')) return;
    startNewGame();
  });

  document.getElementById('btn-flip-board').addEventListener('click', () => {
    isFlipped = !isFlipped;
    renderBoard();
  });

  document.getElementById('btn-undo-move').addEventListener('click', () => {
    if (currentMode === 'online') {
      showToast('Fitur Undo tidak tersedia pada mode tanding online.', 'info');
      return;
    }
    // In AI mode, undo 2 moves (AI move and player move)
    if (currentMode === 'ai') {
      chessEngine.undo();
      chessEngine.undo();
    } else {
      chessEngine.undo();
    }
    clearSelection();
    renderBoard();
    showToast('Langkah dibatalkan.', 'info');
  });

  document.getElementById('btn-hint').addEventListener('click', () => {
    if (chessEngine.isGameOver) return;
    const best = chessAI.getBestMove(chessEngine);
    if (best) {
      selectedSquare = { r: best.fromR, c: best.fromC };
      legalMovesForSelected = [best];
      renderBoard();
      showToast(`Petunjuk: Coba gerakkan ${chessEngine.moveToSan(best)}`, 'success');
    }
  });

  const btnOfferDraw = document.getElementById('btn-offer-draw');
  if (btnOfferDraw) btnOfferDraw.addEventListener('click', () => {
    if (chessEngine.isGameOver) return;
    if (currentMode === 'ai') {
      showToast('Bot menolak tawaran remis. Lanjutkan permainan!', 'info');
      return;
    }
    if (currentMode === 'local') {
      if (confirm('Tawarkan remis? Tekan OK jika kedua pemain setuju remis (Kesepakatan Bersama).')) {
        if (chessEngine.acceptDraw()) {
          renderBoard();
          updateStatusDisplay();
          handleGameOver();
        }
      }
      return;
    }
    if (currentMode === 'online') {
      showToast('Tawaran remis online: minta lawan setuju secara manual. (Sinkronisasi tawaran remis otomatis belum tersedia di mode ini.)', 'info');
      return;
    }
  });

  document.getElementById('btn-resign').addEventListener('click', () => {
    if (chessEngine.isGameOver) return;
    if (confirm('Apakah Anda yakin ingin menyerah pada pertandingan ini?')) {
      if (currentMode === 'online') {
        if (currentNetworkType === 'p2p' && window.p2pChess) {
          window.p2pChess.sendResign(myOnlineColor);
        } else if (currentRoomPin) {
          schoolDb.resignOnlineRoom(currentRoomPin, myOnlineColor, isCurrentRoomCloud);
        }
      }
      chessEngine.isGameOver = true;
      chessEngine.gameResult = currentMode === 'online'
        ? (myOnlineColor === 'w' ? '0-1' : '1-0')
        : (chessEngine.turn === 'w' ? '0-1' : '1-0');
      handleGameOver();
    }
  });

  // Mode Selection Tabs
  modeCards.forEach(card => {
    card.addEventListener('click', () => {
      if (!requireLoginToPlay('Silakan login terlebih dahulu untuk memilih mode dan bermain.')) return;
      modeCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      currentMode = card.dataset.mode;

      if (aiSubpanel) aiSubpanel.classList.toggle('active', currentMode === 'ai');
      if (onlineSubpanel) onlineSubpanel.classList.toggle('active', currentMode === 'online');

      if (currentMode === 'online') {
        loadLanInfo();
      }

      startNewGame();
    });
  });

  diffBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!requireLoginToPlay('Silakan login terlebih dahulu untuk bermain.')) return;
      diffBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      chessAI.setDifficulty(btn.dataset.diff);
      startNewGame();
    });
  });

  timeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (!requireLoginToPlay('Silakan login terlebih dahulu untuk bermain.')) return;
      timeBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      timePreset = parseInt(btn.dataset.time, 10);
      startNewGame();
    });
  });

  // ==================== ONLINE MULTIPLAYER ENGINE ====================
  let isCurrentRoomCloud = false;
  let firestoreRoomUnsubscribe = null;

  function setNetworkType(type) {
    currentNetworkType = type;
    if (btnNetP2p) btnNetP2p.classList.toggle('active', type === 'p2p');
    if (btnNetLan) btnNetLan.classList.toggle('active', type === 'lan');

    const tipTitle = document.getElementById('online-mode-tip-title');
    const lanEl = document.getElementById('lan-ip-display');
    const tipIcon = document.getElementById('online-tip-icon');

    if (type === 'p2p') {
      if (tipTitle) tipTitle.textContent = 'Mode: Internet Jarak Jauh (P2P WebRTC)';
      if (lanEl) lanEl.textContent = 'Siap tanding antar-kota & beda jaringan';
      if (tipIcon) tipIcon.textContent = 'ðŸŒ';
    } else {
      if (tipTitle) tipTitle.textContent = 'Mode: Jaringan WiFi / Lab Komputer Lokal';
      if (tipIcon) tipIcon.textContent = 'ðŸ«';
      loadLanInfo();
    }
  }

  if (btnNetP2p) btnNetP2p.addEventListener('click', () => setNetworkType('p2p'));
  if (btnNetLan) btnNetLan.addEventListener('click', () => setNetworkType('lan'));

  function loadLanInfo() {
    const lanEl = document.getElementById('lan-ip-display');
    const tipTitle = document.getElementById('online-mode-tip-title');

    if (schoolDb.isFirebaseReady) {
      if (tipTitle) tipTitle.textContent = 'Mode Cloud Online (Firebase):';
      if (lanEl) lanEl.innerHTML = '<span style="color:#10b981; font-weight:700;">â˜ï¸ Cloud Firestore Aktif (Bisa Main Lintas Jaringan / HP)</span>';
    } else {
      fetch('/api/info')
        .then(res => res.json())
        .then(info => {
          if (currentNetworkType === 'lan') {
            if (tipTitle) tipTitle.textContent = 'Akses Antar-Perangkat (WiFi/Lab):';
            if (lanEl) lanEl.textContent = `http://${info.lanIp}:${info.port}`;
          }
        })
        .catch(() => {});
    }
  }

  function setupP2PListeners() {
    if (!window.p2pChess) return;

    window.p2pChess.on('start', (data) => {
      onlineRoomData = data.room;
      showToast(`Lawan (${data.room.guest.name}) telah bergabung! Pertandingan dimulai!`, 'success');
      soundCtrl.playMove();
      showActiveRoomUI(currentRoomPin, 'Terhubung dengan ' + data.room.guest.name + ' (Jarak Jauh)', 'â™” Bidak Anda: Putih (Langkah Pertama)', 'Lawan: ' + data.room.guest.name + ' (' + data.room.guest.studentClass + ')');
      startNewGame();
    });

    window.p2pChess.on('move', (data) => {
      handleIncomingOnlineMove(data);
    });

    window.p2pChess.on('gameOver', (data) => {
      handleOnlineGameOver(data);
    });

    window.p2pChess.on('rematch', () => {
      const rematchBtn = document.getElementById('btn-rematch-room');
      if (rematchBtn) rematchBtn.classList.add('hidden');
      startNewGame();
      showToast('Pertandingan ulang (rematch) telah dimulai!', 'success');
    });

    window.p2pChess.on('opponentLeft', () => {
      showToast('Lawan telah meninggalkan ruangan.', 'warning');
      statusTextEl.textContent = 'Lawan telah keluar dari ruang.';
    });
  }

  async function createOnlineRoom() {
    if (!requireLoginToPlay('Silakan login terlebih dahulu untuk membuat ruang online.')) return;
    const profile = schoolDb.getProfile();
    try {
      if (currentNetworkType === 'p2p') {
        showToast('Menyiapkan ruang catur online jarak jauh...', 'info');
        const data = await window.p2pChess.createRoom(profile, timePreset);
        currentRoomPin = data.pin;
        myOnlineColor = 'w';
        onlineRoomData = data.room;
        isCurrentRoomCloud = false;
        isFlipped = false;

        setupP2PListeners();
        showActiveRoomUI(data.pin, 'Menunggu lawan bergabung (Jarak Jauh)...', 'â™” Bidak Anda: Putih (Langkah Pertama)', 'Lawan: Menunggu...');
        startNewGame();
        showToast(`Ruang PIN ${data.pin} siap! Salin link atau bagikan PIN ke lawan Anda.`, 'success');
        return;
      }

      // LAN / Server Lokal fallback
      const data = await schoolDb.createOnlineRoom(profile, timePreset);
      if (!data.success) {
        showToast(data.message || 'Gagal membuat ruang', 'error');
        return;
      }

      currentRoomPin = data.pin;
      myOnlineColor = 'w';
      onlineRoomData = data.room;
      isCurrentRoomCloud = !!data.isCloud;
      isFlipped = false;

      const cloudLabel = isCurrentRoomCloud ? ' (Cloud)' : ' (Lokal)';
      showActiveRoomUI(data.pin, 'Menunggu lawan bergabung...' + cloudLabel, 'â™” Bidak Anda: Putih (Langkah Pertama)', 'Lawan: Menunggu...');
      connectOnlineEvents(data.pin);
      startNewGame();
      showToast(`Ruang PIN ${data.pin} berhasil dibuat${cloudLabel}! Bagikan PIN ke teman Anda.`, 'success');
    } catch (err) {
      showToast('Gagal membuat ruang online: ' + err.message, 'error');
    }
  }

  async function joinOnlineRoom() {
    if (!requireLoginToPlay('Silakan login terlebih dahulu untuk bergabung ke ruang online.')) return;
    const input = document.getElementById('input-room-code');
    const pin = (input ? input.value : '').trim();
    if (!pin || pin.length < 4) {
      showToast('Masukkan 4 digit kode PIN ruangan!', 'error');
      return;
    }

    const profile = schoolDb.getProfile();
    try {
      if (currentNetworkType === 'p2p') {
        showToast(`Menghubungi ruang ${pin} lewat internet...`, 'info');
        const data = await window.p2pChess.joinRoom(pin, profile);
        currentRoomPin = data.pin;
        myOnlineColor = 'b';
        onlineRoomData = data.room;
        isCurrentRoomCloud = false;
        isFlipped = true; // Auto flip board for black

        setupP2PListeners();
        showActiveRoomUI(data.pin, 'Terhubung dengan ' + (data.room?.host?.name || 'Host') + ' (Jarak Jauh)', 'â™š Bidak Anda: Hitam', 'Lawan: ' + (data.room?.host?.name || 'Host'));
        startNewGame();
        showToast(`Berhasil bergabung ke Ruang PIN ${data.pin}! Pertandingan dimulai.`, 'success');
        return;
      }

      // LAN / Server Lokal
      const data = await schoolDb.joinOnlineRoom(pin, profile);
      if (!data.success) {
        showToast(data.message || 'Gagal bergabung ke ruangan', 'error');
        return;
      }

      currentRoomPin = data.pin;
      myOnlineColor = 'b';
      onlineRoomData = data.room;
      isCurrentRoomCloud = !!data.isCloud;
      isFlipped = true; // Auto flip board for black

      const cloudLabel = isCurrentRoomCloud ? ' (Cloud)' : ' (Lokal)';
      showActiveRoomUI(data.pin, 'Terhubung dengan ' + data.room.host.name + cloudLabel, 'â™š Bidak Anda: Hitam', 'Lawan: ' + data.room.host.name + ' (' + data.room.host.studentClass + ')');
      connectOnlineEvents(data.pin);
      startNewGame();
      showToast(`Berhasil bergabung ke Ruang PIN ${data.pin}! Pertandingan dimulai.`, 'success');
    } catch (err) {
      showToast('Gagal terhubung ke ruang: ' + err.message, 'error');
    }
  }

  function showActiveRoomUI(pin, statusLabel, roleText, opponentText) {
    const formView = document.getElementById('online-form-view');
    const activeCard = document.getElementById('active-room-card');
    const displayPin = document.getElementById('display-room-pin');
    const statusLbl = document.getElementById('room-status-label');
    const statusInd = document.getElementById('room-status-indicator');
    const roleBadge = document.getElementById('online-my-role');
    const oppBadge = document.getElementById('online-opponent-badge');

    if (formView) formView.classList.add('hidden');
    if (activeCard) activeCard.classList.remove('hidden');
    if (displayPin) displayPin.textContent = pin;
    if (statusLbl) statusLbl.textContent = statusLabel;
    if (statusInd) {
      statusInd.className = 'room-status-indicator ' + (onlineRoomData && onlineRoomData.status === 'playing' ? 'playing' : 'waiting');
    }
    if (roleBadge) roleBadge.textContent = roleText;
    if (oppBadge) oppBadge.textContent = opponentText;
  }

  function resetOnlineRoomUI() {
    const formView = document.getElementById('online-form-view');
    const activeCard = document.getElementById('active-room-card');
    const rematchBtn = document.getElementById('btn-rematch-room');
    if (formView) formView.classList.remove('hidden');
    if (activeCard) activeCard.classList.add('hidden');
    if (rematchBtn) rematchBtn.classList.add('hidden');
  }

  function connectOnlineEvents(pin) {
    if (onlineEventSource) {
      onlineEventSource.close();
      onlineEventSource = null;
    }
    if (onlinePollTimer) {
      clearInterval(onlinePollTimer);
      onlinePollTimer = null;
    }
    if (firestoreRoomUnsubscribe) {
      firestoreRoomUnsubscribe();
      firestoreRoomUnsubscribe = null;
    }

    // 1. Jika ruang berjalan di Cloud Firestore:
    if (isCurrentRoomCloud) {
      let lastProcessedFen = chessEngine.generateFen ? chessEngine.generateFen() : '';
      firestoreRoomUnsubscribe = schoolDb.listenOnlineRoom(pin, ({ exists, room }) => {
        if (!exists || !room) {
          showToast('Ruangan online telah ditutup.', 'info');
          return;
        }

        const prevRoom = onlineRoomData;
        onlineRoomData = room;

        // Lawan bergabung (Host side)
        if (myOnlineColor === 'w' && prevRoom && prevRoom.status === 'waiting' && room.status === 'playing' && room.guest) {
          showToast(`Lawan (${room.guest.name}) telah bergabung! Pertandingan dimulai!`, 'success');
          soundCtrl.playMove();
          showActiveRoomUI(pin, 'Terhubung dengan ' + room.guest.name + ' (Cloud)', 'â™” Bidak Anda: Putih (Langkah Pertama)', 'Lawan: ' + room.guest.name + ' (' + room.guest.studentClass + ')');
          startNewGame();
          return;
        }

        // Langkah baru dari lawan
        if (room.lastMove && room.turn === myOnlineColor && room.fen && room.fen !== lastProcessedFen) {
          lastProcessedFen = room.fen;
          handleIncomingOnlineMove({
            moveEntry: {
              move: room.lastMove,
              san: room.lastMove.san || 'Langkah',
              whiteTime: room.whiteTime,
              blackTime: room.blackTime
            },
            room: room
          });
        }

        // Status permainan selesai
        if (room.status === 'finished' && !chessEngine.isGameOver) {
          handleOnlineGameOver({
            winner: room.winner,
            resultReason: room.resultReason,
            room: room
          });
        }

        // Rematch dimulai
        if (prevRoom && prevRoom.status === 'finished' && room.status === 'playing') {
          const rematchBtn = document.getElementById('btn-rematch-room');
          if (rematchBtn) rematchBtn.classList.add('hidden');
          startNewGame();
          showToast('Pertandingan ulang (rematch) telah dimulai!', 'success');
        }

        // Lawan keluar
        if (room.status === 'closed') {
          showToast('Lawan telah meninggalkan ruangan.', 'warning');
          statusTextEl.textContent = 'Lawan telah keluar dari ruang.';
        }
      });
      return;
    }

    // 2. Jika menggunakan Server Node.js Lokal (SSE & Polling):
    try {
      onlineEventSource = new EventSource(`/api/rooms/${pin}/events`);

      onlineEventSource.addEventListener('start', (e) => {
        const data = JSON.parse(e.data);
        onlineRoomData = data.room;
        showToast(`Lawan (${data.room.guest.name}) telah bergabung! Pertandingan dimulai!`, 'success');
        soundCtrl.playMove();
        showActiveRoomUI(pin, 'Terhubung dengan ' + data.room.guest.name, 'â™” Bidak Anda: Putih (Langkah Pertama)', 'Lawan: ' + data.room.guest.name + ' (' + data.room.guest.studentClass + ')');
        startNewGame();
      });

      onlineEventSource.addEventListener('move', (e) => {
        const data = JSON.parse(e.data);
        handleIncomingOnlineMove(data);
      });

      onlineEventSource.addEventListener('game_over', (e) => {
        const data = JSON.parse(e.data);
        handleOnlineGameOver(data);
      });

      onlineEventSource.addEventListener('rematch', (e) => {
        const data = JSON.parse(e.data);
        onlineRoomData = data.room;
        const rematchBtn = document.getElementById('btn-rematch-room');
        if (rematchBtn) rematchBtn.classList.add('hidden');
        startNewGame();
        showToast('Pertandingan ulang (rematch) telah dimulai!', 'success');
      });

      onlineEventSource.addEventListener('player_left', () => {
        showToast('Lawan telah keluar dari ruangan.', 'warning');
        statusTextEl.textContent = 'Lawan telah keluar dari ruang.';
      });
    } catch (e) {
      console.warn('SSE connection error:', e);
    }

    // Polling fallback lokal
    let lastKnownMovesCount = 0;
    onlinePollTimer = setInterval(async () => {
      if (!currentRoomPin || currentMode !== 'online') return;
      try {
        const res = await fetch(`/api/rooms/${pin}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.success || !data.room) return;

        const serverRoom = data.room;

        if (onlineRoomData && onlineRoomData.status === 'waiting' && serverRoom.status === 'playing') {
          onlineRoomData = serverRoom;
          showToast(`Lawan (${serverRoom.guest.name}) telah bergabung! Pertandingan dimulai!`, 'success');
          showActiveRoomUI(pin, 'Terhubung dengan ' + serverRoom.guest.name, 'â™” Bidak Anda: Putih (Langkah Pertama)', 'Lawan: ' + serverRoom.guest.name + ' (' + serverRoom.guest.studentClass + ')');
          startNewGame();
        }

        if (serverRoom.moves && serverRoom.moves.length > lastKnownMovesCount) {
          const latestMove = serverRoom.moves[serverRoom.moves.length - 1];
          if (latestMove.color !== myOnlineColor) {
            handleIncomingOnlineMove({ moveEntry: latestMove, room: serverRoom });
          }
          lastKnownMovesCount = serverRoom.moves.length;
        }

        if (serverRoom.status === 'finished' && !chessEngine.isGameOver) {
          handleOnlineGameOver({ winner: serverRoom.winner, resultReason: serverRoom.resultReason, room: serverRoom });
        }
      } catch (err) {}
    }, 1200);
  }

  function handleIncomingOnlineMove(data) {
    if (!data || !data.moveEntry) return;
    const { move, san, whiteTime: wTime, blackTime: bTime } = data.moveEntry;

    // Check if move is already played locally
    const lastHistory = chessEngine.history[chessEngine.history.length - 1];
    if (lastHistory && lastHistory.move.fromR === move.fromR && lastHistory.move.fromC === move.fromC && lastHistory.move.toR === move.toR && lastHistory.move.toC === move.toC) {
      return;
    }

    const isCapture = move.capture || move.isEnPassant;
    chessEngine.executeMove(move);

    if (chessEngine.isKingInCheck(chessEngine.turn)) {
      soundCtrl.playCheck();
    } else if (isCapture) {
      soundCtrl.playCapture();
    } else {
      soundCtrl.playMove();
    }

    addMoveToHistory(san);
    if (typeof wTime === 'number') whiteTime = wTime;
    if (typeof bTime === 'number') blackTime = bTime;
    updateClockDisplays();
    renderBoard();

    if (chessEngine.isGameOver) {
      handleGameOver();
      const rematchBtn = document.getElementById('btn-rematch-room');
      if (rematchBtn) rematchBtn.classList.remove('hidden');
    } else {
      updateStatusDisplay();
    }
  }

  function handleOnlineGameOver(data) {
    chessEngine.isGameOver = true;
    chessEngine.gameResult = data.winner === 'w' ? '1-0' : data.winner === 'b' ? '0-1' : '1/2-1/2';
    handleGameOver();
    const rematchBtn = document.getElementById('btn-rematch-room');
    if (rematchBtn) rematchBtn.classList.remove('hidden');
    if (data.resultReason) {
      showToast(`Permainan selesai: ${data.resultReason}`, 'info');
    }
  }

  function leaveOnlineRoom() {
    if (currentNetworkType === 'p2p' && window.p2pChess) {
      window.p2pChess.leaveRoom();
    } else if (currentRoomPin) {
      schoolDb.leaveOnlineRoom(currentRoomPin, myOnlineColor, isCurrentRoomCloud);
    }

    if (firestoreRoomUnsubscribe) {
      firestoreRoomUnsubscribe();
      firestoreRoomUnsubscribe = null;
    }
    if (onlineEventSource) {
      onlineEventSource.close();
      onlineEventSource = null;
    }
    if (onlinePollTimer) {
      clearInterval(onlinePollTimer);
      onlinePollTimer = null;
    }

    currentRoomPin = null;
    myOnlineColor = null;
    onlineRoomData = null;
    isCurrentRoomCloud = false;
    isFlipped = false;

    resetOnlineRoomUI();
    startNewGame();
    showToast('Anda telah keluar dari ruangan online.', 'info');
  }

  function requestOnlineRematch() {
    if (!currentRoomPin) return;

    if (currentNetworkType === 'p2p' && window.p2pChess) {
      window.p2pChess.sendRematch(timePreset);
      showToast('Permintaan tanding ulang diajukan!', 'info');
      return;
    }

    schoolDb.rematchOnlineRoom(currentRoomPin, timePreset, isCurrentRoomCloud).then(() => {
      showToast('Permintaan tanding ulang diajukan!', 'info');
    }).catch(err => {
      showToast('Gagal mengajukan tanding ulang: ' + err.message, 'error');
    });
  }

  function sendOnlineMove(move, san) {
    if (!currentRoomPin) return;
    const isGameOver = chessEngine.isGameOver;
    const winner = isGameOver ? (chessEngine.gameResult === '1-0' ? 'w' : chessEngine.gameResult === '0-1' ? 'b' : 'draw') : null;
    const resultReason = isGameOver ? 'Skakmat / Berakhir' : null;

    const movePayload = {
      color: myOnlineColor,
      move: move,
      san: san,
      fen: chessEngine.generateFen ? chessEngine.generateFen() : '',
      turn: chessEngine.turn,
      lastMove: { ...move, san },
      fullMoves: chessEngine.fullMoves,
      whiteTime: whiteTime,
      blackTime: blackTime,
      isGameOver: isGameOver,
      winner: winner,
      result: chessEngine.gameResult,
      resultReason: resultReason
    };

    if (currentNetworkType === 'p2p' && window.p2pChess) {
      window.p2pChess.sendMove(movePayload, {
        pin: currentRoomPin,
        turn: chessEngine.turn,
        fen: movePayload.fen,
        isGameOver
      });
      return;
    }

    schoolDb.sendOnlineMove(currentRoomPin, movePayload, isCurrentRoomCloud).catch(err => {
      console.warn('Gagal sinkronisasi langkah online:', err);
    });
  }

  // Button Listeners for Online Room
  if (btnCreateRoom) btnCreateRoom.addEventListener('click', createOnlineRoom);
  if (btnJoinRoom) btnJoinRoom.addEventListener('click', joinOnlineRoom);
  if (btnLeaveRoom) btnLeaveRoom.addEventListener('click', leaveOnlineRoom);
  if (btnRematchRoom) btnRematchRoom.addEventListener('click', requestOnlineRematch);

  if (btnCopyPin) {
    btnCopyPin.addEventListener('click', () => {
      if (currentRoomPin) {
        navigator.clipboard.writeText(currentRoomPin);
        showToast(`PIN ${currentRoomPin} berhasil disalin!`, 'success');
      }
    });
  }

  if (btnCopyLink) {
    btnCopyLink.addEventListener('click', () => {
      if (currentRoomPin) {
        const url = new URL(window.location.href);
        url.searchParams.set('pin', currentRoomPin);
        url.searchParams.set('net', currentNetworkType);
        navigator.clipboard.writeText(url.toString());
        showToast(`ðŸ”— Link tanding berhasil disalin! Kirim link ini ke teman Anda via WhatsApp/Chat.`, 'success');
      }
    });
  }

  // ==================== 6. TAB 2: LATIHAN & PUZZLE ====================

  let activeTacticLevelId = null;

  function initPractice() {
    if (!practiceBoardEl) return;
    practiceBoardEl.innerHTML = '';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = document.createElement('div');
        sq.className = `square ${(r + c) % 2 === 0 ? 'light' : 'dark'}`;
        sq.dataset.row = r;
        sq.dataset.col = c;
        sq.addEventListener('click', () => onPracticeSquareClicked(r, c));
        practiceBoardEl.appendChild(sq);
      }
    }

    if (typeof tacticsMgr !== 'undefined' && tacticsMgr.refreshUser) tacticsMgr.refreshUser();
    renderTacticsPath();
    const next = (typeof tacticsMgr !== 'undefined' && tacticsMgr.getNextPlayable) ? tacticsMgr.getNextPlayable() : null;
    if (next && next.level) loadTacticLevel(next.level.id);
    else if (typeof tacticsMgr !== 'undefined' && tacticsMgr.allLevels) {
      const all = tacticsMgr.allLevels();
      if (all[0]) loadTacticLevel(all[0].level.id);
    }
  }

  function renderTacticsPath() {
    const container = document.getElementById('tactics-path-container');
    const xpBadge = document.getElementById('tactics-xp-badge');
    const fill = document.getElementById('tactics-progress-fill');
    const meta = document.getElementById('tactics-progress-meta');
    if (!container || typeof tacticsMgr === 'undefined') return;

    const all = tacticsMgr.allLevels();
    const done = all.filter(x => tacticsMgr.isCompleted(x.level.id)).length;
    const total = all.length || 1;
    const pct = Math.round((done / total) * 100);
    if (xpBadge) xpBadge.textContent = `${tacticsMgr.state.xp || 0} XP`;
    if (fill) fill.style.width = pct + '%';
    if (meta) meta.textContent = `${done}/${total} level selesai`;

    container.innerHTML = '';
    tacticsMgr.stages.forEach((stage) => {
      const progress = tacticsMgr.getStageProgress(stage);
      const stageEl = document.createElement('section');
      stageEl.className = 'tactics-stage';
      stageEl.innerHTML = `
        <div class="tactics-stage-header">
          <div>
            <div class="tactics-stage-title">${stage.title}</div>
            <div class="tactics-stage-sub">${stage.subtitle || ''}</div>
          </div>
          <div class="tactics-stage-pct">${progress.done}/${progress.total}</div>
        </div>
        <div class="tactics-level-list"></div>
      `;
      const list = stageEl.querySelector('.tactics-level-list');
      stage.levels.forEach((level, idx) => {
        const completed = tacticsMgr.isCompleted(level.id);
        const unlocked = tacticsMgr.isUnlocked(level.id);
        const stars = tacticsMgr.getStars(level.id);
        const active = activeTacticLevelId === level.id;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `tactics-level-node ${completed ? 'is-completed' : ''} ${unlocked ? 'is-unlocked' : 'is-locked'} ${active ? 'is-active' : ''}`;
        btn.disabled = !unlocked;
        btn.innerHTML = `
          <div class="tactics-node-left">
            <div class="tactics-node-index">${completed ? '✓' : (unlocked ? (idx + 1) : '🔒')}</div>
            <div class="tactics-node-info">
              <div class="tactics-node-title">${level.title}</div>
              <div class="tactics-node-meta">${level.difficulty || 'Taktik'}${completed ? ' • Selesai' : (unlocked ? ' • Siap' : ' • Terkunci')}</div>
            </div>
          </div>
          <div class="tactics-node-stars">${'★'.repeat(stars)}${'☆'.repeat(Math.max(0, 3 - stars))}</div>
        `;
        btn.addEventListener('click', () => {
          if (!tacticsMgr.isUnlocked(level.id)) {
            showToast('Selesaikan level sebelumnya untuk membuka level ini.', 'info');
            return;
          }
          loadTacticLevel(level.id);
        });
        list.appendChild(btn);
      });
      container.appendChild(stageEl);
    });
  }

  function getActiveTacticLevel() {
    if (typeof tacticsMgr === 'undefined') return null;
    if (activeTacticLevelId) return tacticsMgr.getLevelById(activeTacticLevelId);
    return tacticsMgr.getNextPlayable();
  }

  function loadTacticLevel(levelId) {
    if (typeof tacticsMgr === 'undefined') return;
    const found = tacticsMgr.getLevelById(levelId);
    if (!found || !tacticsMgr.isUnlocked(levelId)) return;
    activeTacticLevelId = levelId;
    const { stage, level } = found;

    const titleEl = document.getElementById('puzzle-title');
    const descEl = document.getElementById('puzzle-desc');
    const badgeEl = document.getElementById('puzzle-difficulty-badge');
    const stageLabel = document.getElementById('tactics-stage-label');
    const starsEl = document.getElementById('tactics-stars');
    const feedback = document.getElementById('tactics-feedback-text');
    if (titleEl) titleEl.textContent = level.title;
    if (descEl) descEl.textContent = level.desc;
    if (badgeEl) badgeEl.textContent = level.difficulty || 'Taktik';
    if (stageLabel) stageLabel.textContent = stage.title;
    const stars = tacticsMgr.getStars(level.id);
    if (starsEl) starsEl.textContent = `${'★'.repeat(stars)}${'☆'.repeat(Math.max(0, 3 - stars))}`;
    if (feedback) feedback.textContent = tacticsMgr.isCompleted(level.id)
      ? 'Level ini sudah selesai. Kamu bisa ulangi untuk latihan, atau lanjut ke level berikutnya.'
      : 'Temukan langkah terbaik. Setelah benar, level berikutnya akan terbuka.';

    practiceEngine.loadFen(level.fen);
    practiceSelectedSquare = null;
    renderPracticeBoard();
    renderTacticsPath();
  }

  function renderPracticeBoard() {
    if (!practiceBoardEl) return;
    const squares = practiceBoardEl.querySelectorAll('.square');
    squares.forEach(sq => {
      const r = parseInt(sq.dataset.row, 10);
      const c = parseInt(sq.dataset.col, 10);
      sq.innerHTML = '';
      sq.classList.remove('selected', 'legal-move', 'legal-capture', 'last-move');

      if (practiceSelectedSquare && practiceSelectedSquare.r === r && practiceSelectedSquare.c === c) {
        sq.classList.add('selected');
      }

      const piece = practiceEngine.board[r][c];
      if (piece) {
        const pieceEl = document.createElement('span');
        pieceEl.className = `piece ${practiceEngine.isWhite(piece) ? 'white-piece' : 'black-piece'}`;
        pieceEl.textContent = PIECE_SYMBOLS[piece] || piece;
        sq.appendChild(pieceEl);
      }
    });
  }

  function onPracticeSquareClicked(r, c) {
    const active = getActiveTacticLevel();
    const level = active ? active.level : null;
    if (!level) return;
    if (practiceEngine.isGameOver) return;

    const piece = practiceEngine.board[r][c];
    if (practiceSelectedSquare) {
      const moves = practiceEngine.getLegalMoves(practiceSelectedSquare.r, practiceSelectedSquare.c);
      const targetMove = moves.find(m => m.toR === r && m.toC === c);

      if (targetMove) {
        const san = practiceEngine.moveToSan(targetMove);
        practiceEngine.executeMove(targetMove);
        if (typeof soundCtrl !== 'undefined' && soundCtrl.playMove) soundCtrl.playMove();
        renderPracticeBoard();

        if (typeof tacticsMgr !== 'undefined' && tacticsMgr.validate(level, san)) {
          if (typeof soundCtrl !== 'undefined' && soundCtrl.playVictory) soundCtrl.playVictory();
          tacticsMgr.markCompleted(level.id, 3);
          showToast(`Benar! ${level.explanation || 'Langkah tepat.'} (+XP)`, 'success');
          renderTacticsPath();
          loadTacticLevel(level.id); // refresh stars/status
          setTimeout(() => {
            const next = tacticsMgr.getNextPlayable();
            if (next && next.level && next.level.id !== level.id) {
              showToast('Level berikutnya terbuka! Klik "Lanjut Level Berikutnya".', 'info');
            } else if (next && next.level && next.level.id === level.id) {
              showToast('Semua level pada jalur ini sudah selesai. Kerja bagus!', 'success');
            }
          }, 400);
        } else {
          showToast('Belum tepat. Coba lagi atau pakai petunjuk.', 'error');
          // allow retry by resetting quickly? keep position as moved but let them reset
        }
        practiceSelectedSquare = null;
        return;
      }

      if (piece && practiceEngine.getColor(piece) === practiceEngine.turn) {
        practiceSelectedSquare = { r, c };
        renderPracticeBoard();
        return;
      }
      practiceSelectedSquare = null;
      renderPracticeBoard();
      return;
    }

    if (piece && practiceEngine.getColor(piece) === practiceEngine.turn) {
      practiceSelectedSquare = { r, c };
      renderPracticeBoard();
    }
  }

  const btnPuzzleHint = document.getElementById('btn-puzzle-hint');
  if (btnPuzzleHint) btnPuzzleHint.addEventListener('click', () => {
    const active = getActiveTacticLevel();
    if (!active || !active.level) return;
    showToast(`Petunjuk: ${active.level.hint || 'Periksa ancaman langsung dan langkah forcing.'}`, 'info');
  });

  const btnResetPuzzle = document.getElementById('btn-reset-puzzle');
  if (btnResetPuzzle) btnResetPuzzle.addEventListener('click', () => {
    if (activeTacticLevelId) loadTacticLevel(activeTacticLevelId);
  });

  const btnNextPlayable = document.getElementById('btn-next-playable');
  if (btnNextPlayable) btnNextPlayable.addEventListener('click', () => {
    if (typeof tacticsMgr === 'undefined') return;
    const next = tacticsMgr.getNextPlayable();
    if (next && next.level) {
      loadTacticLevel(next.level.id);
      showToast(`Membuka: ${next.level.title}`, 'info');
    }
  });

  // ==================== 7. TAB 3: LEADERBOARDS ====================
  let unsubscribeLeaderboard = null;

  function initLeaderboard() {
    renderStudentLeaderboard();
    renderClassLeaderboard();

    // Subscribe ke realtime listener Firestore (koleksi "users", orderBy rating desc, limit 50)
    try {
      if (typeof schoolDb !== 'undefined' && schoolDb.listenLeaderboard) {
        if (unsubscribeLeaderboard) unsubscribeLeaderboard();
        unsubscribeLeaderboard = schoolDb.listenLeaderboard((players) => {
          renderStudentLeaderboard(players);
        });
      }
    } catch (err) {
      console.warn('Realtime leaderboard subscription error:', err);
    }

    document.getElementById('seg-students').addEventListener('click', () => {
      document.getElementById('seg-students').classList.add('active');
      document.getElementById('seg-classes').classList.remove('active');
      document.getElementById('leaderboard-students-view').classList.remove('hidden');
      document.getElementById('leaderboard-classes-view').classList.add('hidden');
    });

    document.getElementById('seg-classes').addEventListener('click', () => {
      document.getElementById('seg-classes').classList.add('active');
      document.getElementById('seg-students').classList.remove('active');
      document.getElementById('leaderboard-classes-view').classList.remove('hidden');
      document.getElementById('leaderboard-students-view').classList.add('hidden');
    });

    document.getElementById('btn-refresh-leaderboard').addEventListener('click', () => {
      if (typeof schoolDb !== 'undefined' && schoolDb.listenLeaderboard) {
        schoolDb.listenLeaderboard((players) => {
          renderStudentLeaderboard(players);
        });
      } else {
        renderStudentLeaderboard();
      }
      renderClassLeaderboard();
      showToast('Data Leaderboard telah diperbarui!', 'success');
    });
  }

  function renderStudentLeaderboard(customList) {
    const list = (customList && Array.isArray(customList) && customList.length > 0)
      ? customList
      : schoolDb.getStudentLeaderboard();
    const tbody = document.getElementById('student-leaderboard-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const currentProfile = (typeof schoolDb !== 'undefined' && schoolDb.getProfile)
      ? schoolDb.getProfile()
      : {};

    list.forEach((s, idx) => {
      const rank = s.rank !== undefined ? s.rank : (idx + 1);
      const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
      const isCurrentUser = (s.uid && s.uid === currentProfile.id) ||
                            (s.id && currentProfile.id && s.id === currentProfile.id) ||
                            (s.email && currentProfile.email && s.email.toLowerCase() === currentProfile.email.toLowerCase()) ||
                            (s.name && s.name.includes('(Kamu)'));
      const rawName = s.name || s.displayName || s.email || 'Siswa Catur';
      const displayName = isCurrentUser && !rawName.includes('(Kamu)') ? `${rawName} (Kamu)` : rawName;
      const studentClass = s.studentClass || s.class || 'X-A';
      const rating = Number.isFinite(Number(s.rating)) ? Number(s.rating) : 0;
      const wins = s.wins !== undefined ? s.wins : 0;
      const draws = s.draws !== undefined ? s.draws : 0;
      const losses = s.losses !== undefined ? s.losses : 0;
      const streak = s.streak !== undefined ? s.streak : 0;

      const tr = document.createElement('tr');
      if (isCurrentUser) {
        tr.className = 'current-user-row';
      }
      tr.innerHTML = `
        <td><span class="rank-badge ${rankClass}">${rank}</span></td>
        <td><strong>${displayName}</strong></td>
        <td><span class="brand-badge">${studentClass}</span></td>
        <td><strong style="color:var(--accent-amber);">${rating}</strong></td>
        <td>${wins} M / ${draws} S / ${losses} K</td>
        <td>${streak > 0 ? `ðŸ”¥ ${streak}` : '-'}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderClassLeaderboard() {
    const list = schoolDb.getClassLeaderboard();
    const tbody = document.getElementById('class-leaderboard-body');
    tbody.innerHTML = '';

    list.forEach((c, idx) => {
      const rank = idx + 1;
      const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : '';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><span class="rank-badge ${rankClass}">${rank}</span></td>
        <td><strong>${c.className}</strong></td>
        <td>${c.totalWins} Menang</td>
        <td><strong style="color:var(--accent-amber);">${c.points} Poin</strong></td>
        <td>â­ ${c.topPlayer}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  // ==================== 8. PROFILE & SETTINGS ====================
  function initUserProfile() {
    const profile = schoolDb.getProfile();
    updateHeaderProfile(profile);

    btnUserProfile.addEventListener('click', () => {
      inputProfileName.value = profile.name;
      selectProfileClass.value = profile.studentClass;
      profileModal.style.setProperty('display', 'flex', 'important');
      profileModal.style.setProperty('pointer-events', 'auto', 'important');
      profileModal.classList.remove('hidden');
      profileModal.classList.add('active');
    });

    btnCloseProfile.addEventListener('click', () => {
      profileModal.style.setProperty('display', 'none', 'important');
      profileModal.style.setProperty('pointer-events', 'none', 'important');
      profileModal.classList.add('hidden');
      profileModal.classList.remove('active');
    });

    avatarOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        avatarOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });

    btnSaveProfile.addEventListener('click', () => {
      const activeAvatar = document.querySelector('.avatar-option.active')?.dataset.avatar || 'â™š';
      const updated = schoolDb.saveProfile(
        inputProfileName.value.trim(),
        selectProfileClass.value,
        activeAvatar
      );
      updateHeaderProfile(updated);
      profileModal.style.setProperty('display', 'none', 'important');
      profileModal.style.setProperty('pointer-events', 'none', 'important');
      profileModal.classList.add('hidden');
      profileModal.classList.remove('active');
      renderStudentLeaderboard();
      showToast('Profil siswa berhasil diperbarui!', 'success');
    });

    // Modal Riwayat Pertandingan (Real-time Firestore)
    const btnOpenHistory = document.getElementById('btn-open-history');
    const modalHistory = document.getElementById('modal-game-history');
    const btnCloseHistory = document.getElementById('btn-close-history');
    const historyListContainer = document.getElementById('game-history-list');
    const historyEmptyEl = document.getElementById('game-history-empty');
    let unsubscribeGameHistory = null;

    if (btnOpenHistory && modalHistory) {
      btnOpenHistory.addEventListener('click', () => {
        // Tutup modal profil terlebih dahulu
        profileModal.style.setProperty('display', 'none', 'important');
        profileModal.style.setProperty('pointer-events', 'none', 'important');
        profileModal.classList.add('hidden');
        profileModal.classList.remove('active');

        // Buka modal riwayat
        modalHistory.style.setProperty('display', 'flex', 'important');
        modalHistory.style.setProperty('pointer-events', 'auto', 'important');
        modalHistory.classList.remove('hidden');
        modalHistory.classList.add('active');

        const curProfile = schoolDb.getProfile();
        if (unsubscribeGameHistory) unsubscribeGameHistory();
        unsubscribeGameHistory = schoolDb.listenGameHistory(curProfile?.id, (games) => {
          renderGameHistory(games);
        });
      });
    }

    if (btnCloseHistory && modalHistory) {
      btnCloseHistory.addEventListener('click', () => {
        modalHistory.style.setProperty('display', 'none', 'important');
        modalHistory.style.setProperty('pointer-events', 'none', 'important');
        modalHistory.classList.add('hidden');
        modalHistory.classList.remove('active');
        if (unsubscribeGameHistory) {
          unsubscribeGameHistory();
          unsubscribeGameHistory = null;
        }
      });
    }

    function renderGameHistory(games) {
      if (!historyListContainer) return;
      historyListContainer.innerHTML = '';

      if (!games || games.length === 0) {
        if (historyEmptyEl) historyEmptyEl.classList.remove('hidden');
        return;
      }

      if (historyEmptyEl) historyEmptyEl.classList.add('hidden');

      const currentProf = schoolDb.getProfile() || {};

      games.forEach(g => {
        const card = document.createElement('div');
        card.className = 'history-item-card';

        const modeBadge = g.mode === 'online' ? 'ðŸŒ PvP Online' : g.mode === 'ai' ? 'ðŸ¤– Bot AI' : 'ðŸ‘¥ PvP Lokal';

        let resultLabel = 'SELESAI';
        let resultClass = 'draw';
        if (g.isDraw || g.result === '1/2-1/2') {
          resultLabel = 'REMIS (1/2)';
          resultClass = 'draw';
        } else if (g.isWin || g.winner === currentProf.name) {
          resultLabel = 'MENANG';
          resultClass = 'win';
        } else {
          resultLabel = 'KALAH';
          resultClass = 'loss';
        }

        const dateStr = g.createdAt
          ? (typeof g.createdAt === 'number' ? new Date(g.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Hari ini')
          : 'Baru saja';

        const whiteName = g.white?.name || 'Putih';
        const blackName = g.black?.name || 'Hitam';
        const isWhiteYou = g.white?.uid === currentProf.id || whiteName.includes(currentProf.name);
        const isBlackYou = g.black?.uid === currentProf.id || blackName.includes(currentProf.name);

        card.innerHTML = `
          <div class="history-header-row">
            <span class="history-mode-tag">${modeBadge}</span>
            <span class="history-result-badge ${resultClass}">${resultLabel}</span>
          </div>
          <div class="history-players-row">
            <span class="history-player-chip ${isWhiteYou ? 'is-you' : ''}">âšª ${whiteName} ${isWhiteYou ? '(Kamu)' : ''}</span>
            <span class="history-vs-divider">VS (${g.result || '*'})</span>
            <span class="history-player-chip ${isBlackYou ? 'is-you' : ''}">âš« ${blackName} ${isBlackYou ? '(Kamu)' : ''}</span>
          </div>
          <div class="history-footer-row">
            <span>â™Ÿï¸ ${g.movesCount || 0} Langkah</span>
            <span>ðŸ•’ ${dateStr}</span>
          </div>
        `;
        historyListContainer.appendChild(card);
      });
    }
  }

  function updateHeaderProfile(profile) {
    if (!profile) return;
    document.getElementById('header-user-avatar').textContent = profile.avatar;
    document.getElementById('header-user-name').textContent = profile.name;
    document.getElementById('header-user-class').textContent = `${profile.studentClass} • ${Number.isFinite(Number(profile.rating)) ? Number(profile.rating) : 0} ELO`;
  }

  // ==================== 8B. FIREBASE AUTHENTICATION SYSTEM ====================
  function initAuthSystem() {
    const modalAuth = document.getElementById('modal-auth');
    const btnOpenAuth = document.getElementById('btn-open-auth');
    const btnCloseAuth = document.getElementById('btn-close-auth');
    const btnAuthGoogle = document.getElementById('btn-auth-google');
    const tabAuthLogin = document.getElementById('tab-auth-login');
    const tabAuthRegister = document.getElementById('tab-auth-register');
    const authRegisterFields = document.getElementById('auth-register-fields');
    const authInputEmail = document.getElementById('auth-input-email');
    const authInputPassword = document.getElementById('auth-input-password');
    const authInputName = document.getElementById('auth-input-name');
    const authSelectClass = document.getElementById('auth-select-class');
    const btnAuthSubmit = document.getElementById('btn-auth-submit');
    const btnAuthSwitch = document.getElementById('btn-auth-switch');
    const authSwitchText = document.getElementById('auth-switch-text');
    const authModalTitle = document.getElementById('auth-modal-title');
    const authErrorBanner = document.getElementById('auth-error-banner');
    const btnOpenFirebaseCfg = document.getElementById('btn-open-firebase-cfg');
    const btnLogoutAccount = document.getElementById('btn-logout-account');
    const btnAuthHeaderText = document.getElementById('btn-auth-header-text');

    let currentAuthMode = 'login'; // 'login' or 'register'

    function updateAuthHeaderBtn() {
      if (schoolDb.isLoggedIn()) {
        const p = schoolDb.getProfile();
        btnAuthHeaderText.textContent = p.email ? p.email.split('@')[0] : 'Akun';
        btnOpenAuth.title = `Akun Aktif: ${p.email || p.name}`;
      } else {
        btnAuthHeaderText.textContent = 'Masuk / Daftar';
        btnOpenAuth.title = 'Masuk dengan Google atau Email';
      }
      const ownerBtn = document.getElementById('btn-owner-tools');
      const ownerBtnProfile = document.getElementById('btn-owner-tools-profile');
      let showOwner = !!(schoolDb.isOwner && schoolDb.isOwner());
      try {
        const p = schoolDb.getProfile ? schoolDb.getProfile() : null;
        const au = schoolDb.getAuthUser ? schoolDb.getAuthUser() : null;
        const email = String((p && p.email) || (au && au.email) || '').trim().toLowerCase();
        if (email === 'peterfernandochristian123@gmail.com') showOwner = true;
      } catch (e) {}
      [ownerBtn, ownerBtnProfile].forEach(el => {
        if (!el) return;
        el.style.display = showOwner ? (el.id === 'btn-owner-tools' ? 'flex' : 'block') : 'none';
        if (el.id === 'btn-owner-tools') { el.style.alignItems = 'center'; el.style.justifyContent = 'center'; }
        el.classList.toggle('hidden', !showOwner);
        el.style.setProperty('pointer-events', showOwner ? 'auto' : 'none', 'important');
        el.style.setProperty('visibility', showOwner ? 'visible' : 'hidden', 'important');
      });
    }

    function setAuthMode(mode) {
      currentAuthMode = mode;
      authErrorBanner.classList.add('hidden');
      if (mode === 'login') {
        tabAuthLogin.classList.add('active');
        tabAuthRegister.classList.remove('active');
        authRegisterFields.classList.add('hidden');
        authModalTitle.textContent = 'Masuk ke Catur Sekolah';
        btnAuthSubmit.textContent = 'Masuk ke Akun';
        authSwitchText.textContent = 'Belum memiliki akun?';
        btnAuthSwitch.textContent = 'Daftar sekarang';
      } else {
        tabAuthRegister.classList.add('active');
        tabAuthLogin.classList.remove('active');
        authRegisterFields.classList.remove('hidden');
        authModalTitle.textContent = 'Daftar Akun Siswa Baru';
        btnAuthSubmit.textContent = 'Daftar Akun Baru';
        authSwitchText.textContent = 'Sudah memiliki akun?';
        btnAuthSwitch.textContent = 'Masuk di sini';
      }
    }

    function openAuthModal(mode = 'login') {
      setAuthMode(mode);
      modalAuth.style.setProperty('display', 'flex', 'important');
      modalAuth.style.setProperty('pointer-events', 'auto', 'important');
      modalAuth.classList.remove('hidden');
      modalAuth.classList.add('active');
    }

    function closeAuthModal(force = false) {
      if (!force && schoolDb && !schoolDb.isLoggedIn()) {
        openAuthModal('login');
        return;
      }
      modalAuth.style.setProperty('display', 'none', 'important');
      modalAuth.style.setProperty('pointer-events', 'none', 'important');
      modalAuth.classList.add('hidden');
      modalAuth.classList.remove('active');
      authInputPassword.value = '';
      authErrorBanner.classList.add('hidden');
    }

    window.openCaturAuthModal = openAuthModal;
    window.closeCaturAuthModal = closeAuthModal;

    function isEventInsideAuthModal(target) {
      return !!(modalAuth && target && modalAuth.contains(target));
    }

    function enforceGlobalLoginGate(e) {
      if (schoolDb && schoolDb.isLoggedIn()) return;
      if (isEventInsideAuthModal(e.target)) return;
      if (e.type === 'keydown') {
        const tag = (e.target && e.target.tagName || '').toLowerCase();
        if (tag === 'input' || tag === 'textarea' || tag === 'select') {
          // Allow typing only if inside auth modal (already handled above)
        }
      }
      e.preventDefault();
      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') e.stopImmediatePropagation();
      openAuthModal('login');
    }

    document.addEventListener('click', enforceGlobalLoginGate, true);
    document.addEventListener('pointerdown', enforceGlobalLoginGate, true);
    document.addEventListener('touchstart', enforceGlobalLoginGate, true);
    document.addEventListener('submit', (e) => {
      if (schoolDb && schoolDb.isLoggedIn()) return;
      if (isEventInsideAuthModal(e.target)) return;
      e.preventDefault();
      e.stopPropagation();
      openAuthModal('login');
    }, true);

    // Buka login otomatis saat web dimuat jika belum login
    if (schoolDb && !schoolDb.isLoggedIn()) {
      openAuthModal('login');
    }

    if (btnOpenAuth) {
      btnOpenAuth.addEventListener('click', () => {
        if (schoolDb.isLoggedIn()) {
          btnUserProfile.click();
        } else {
          openAuthModal('login');
        }
      });
    }

    if (btnCloseAuth) btnCloseAuth.addEventListener('click', closeAuthModal);

    modalAuth.addEventListener('click', (e) => {
      if (e.target === modalAuth) closeAuthModal();
    });

    if (tabAuthLogin) tabAuthLogin.addEventListener('click', () => setAuthMode('login'));
    if (tabAuthRegister) tabAuthRegister.addEventListener('click', () => setAuthMode('register'));
    if (btnAuthSwitch) {
      btnAuthSwitch.addEventListener('click', () => {
        setAuthMode(currentAuthMode === 'login' ? 'register' : 'login');
      });
    }

    // Google Sign-In
    if (btnAuthGoogle) {
      btnAuthGoogle.addEventListener('click', async () => {
        authErrorBanner.classList.add('hidden');
        showToast('Menghubungkan ke layanan Google...', 'info');
        const res = await schoolDb.loginWithGoogle();
        if (res.success) {
          closeAuthModal();
          updateHeaderProfile(schoolDb.getProfile());
          updateAuthHeaderBtn();
          renderStudentLeaderboard();
          showToast(`Berhasil masuk sebagai ${res.user.displayName || res.user.email}!`, 'success');
        } else {
          authErrorBanner.textContent = res.message || 'Gagal masuk dengan Google';
          authErrorBanner.classList.remove('hidden');
        }
      });
    }

    // Email Form Submit (Login / Register)
    const authForm = document.getElementById('auth-form');
    if (authForm) {
      authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = authInputEmail.value.trim();
        const password = authInputPassword.value;

        if (!email || !password) {
          authErrorBanner.textContent = 'Email dan kata sandi wajib diisi!';
          authErrorBanner.classList.remove('hidden');
          return;
        }

        authErrorBanner.classList.add('hidden');

        if (currentAuthMode === 'register') {
          const name = authInputName.value.trim() || 'Peter Fernando Christian';
          const studentClass = authSelectClass.value || 'X-A';
          const res = await schoolDb.registerWithEmail(email, password, name, studentClass);
          if (res.success) {
            closeAuthModal();
            updateHeaderProfile(schoolDb.getProfile());
            updateAuthHeaderBtn();
            renderStudentLeaderboard();
            showToast(`Registrasi akun berhasil! Selamat datang, ${name}.`, 'success');
          } else {
            authErrorBanner.textContent = res.message || 'Gagal mendaftarkan akun.';
            authErrorBanner.classList.remove('hidden');
          }
        } else {
          const res = await schoolDb.loginWithEmail(email, password);
          if (res.success) {
            closeAuthModal();
            updateHeaderProfile(schoolDb.getProfile());
            updateAuthHeaderBtn();
            renderStudentLeaderboard();
            showToast(`Selamat datang kembali, ${res.user.displayName || email}!`, 'success');
          } else {
            authErrorBanner.textContent = res.message || 'Gagal masuk ke akun.';
            authErrorBanner.classList.remove('hidden');
          }
        }
      });
    }

    // Logout
    if (btnLogoutAccount) {
      btnLogoutAccount.addEventListener('click', async () => {
        await schoolDb.logout();
        updateHeaderProfile(schoolDb.getProfile());
        updateAuthHeaderBtn();
        renderStudentLeaderboard();
        profileModal.style.setProperty('display', 'none', 'important');
        profileModal.style.setProperty('pointer-events', 'none', 'important');
        profileModal.classList.add('hidden');
        profileModal.classList.remove('active');
        showToast('Anda telah keluar dari akun. Silakan login kembali.', 'info');
        openAuthModal('login');
      });
    }

    // Open Firebase Config from modal link
    if (btnOpenFirebaseCfg) {
      btnOpenFirebaseCfg.addEventListener('click', () => {
        closeAuthModal();
        modalFirebase.style.setProperty('display', 'flex', 'important');
        modalFirebase.style.setProperty('pointer-events', 'auto', 'important');
        modalFirebase.classList.remove('hidden');
        modalFirebase.classList.add('active');
      });
    }

    updateAuthHeaderBtn();
    schoolDb.onAuthStateChanged((user) => {
      updateAuthHeaderBtn();
      if (user) updateHeaderProfile(user);
    });
  }

  // Navigation tab switcher
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const tabKey = btn.dataset.tab;
      document.getElementById(`tab-` + tabKey + `-content`).classList.add('active');

      if (tabKey === 'leaderboard') {
        renderStudentLeaderboard();
        renderClassLeaderboard();
      }
    });
  });

  // Theme Toggler
  const themes = ['theme-wood', 'theme-emerald', 'theme-cyber', 'theme-chalk'];
  // Piece Style Selector
  const pieceStyleSelect = document.getElementById('select-piece-style');
  const PIECE_STYLE_KEY = 'catur_piece_style';
  function applyPieceStyle(style) {
    const s = ['classic', 'bold', 'minimal', 'contrast'].includes(style) ? style : 'classic';
    [boardEl, practiceBoardEl].forEach(el => {
      if (!el) return;
      el.classList.remove('piece-style-bold', 'piece-style-minimal', 'piece-style-contrast');
      if (s !== 'classic') el.classList.add('piece-style-' + s);
    });
    try { localStorage.setItem(PIECE_STYLE_KEY, s); } catch (e) {}
    if (pieceStyleSelect) pieceStyleSelect.value = s;
  }
  if (pieceStyleSelect) {
    pieceStyleSelect.addEventListener('change', () => applyPieceStyle(pieceStyleSelect.value));
  }
  try { applyPieceStyle(localStorage.getItem(PIECE_STYLE_KEY) || 'classic'); } catch (e) { applyPieceStyle('classic'); }

  let currentThemeIdx = 0;
  document.getElementById('btn-theme-toggle').addEventListener('click', () => {
    document.body.classList.remove(themes[currentThemeIdx]);
    currentThemeIdx = (currentThemeIdx + 1) % themes.length;
    document.body.classList.add(themes[currentThemeIdx]);
    showToast(`Tema papan diubah ke: ${themes[currentThemeIdx].replace('theme-', '').toUpperCase()}`, 'info');
  });

  // Sound Toggler
  document.getElementById('btn-sound-toggle').addEventListener('click', function() {
    const muted = soundCtrl.toggleMute();
    this.classList.toggle('active', !muted);
    showToast(muted ? 'Suara dinonaktifkan' : 'Suara diaktifkan', 'info');
  });

  // Toast System
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Firebase Modal Handling
  const btnCloseFirebase = document.getElementById('btn-close-firebase');
  const btnSaveFirebase = document.getElementById('btn-save-firebase');
  const modalFirebase = document.getElementById('modal-firebase-settings');
  if (btnCloseFirebase && modalFirebase) {
    btnCloseFirebase.addEventListener('click', () => {
      modalFirebase.style.setProperty('display', 'none', 'important');
      modalFirebase.style.setProperty('pointer-events', 'none', 'important');
      modalFirebase.classList.add('hidden');
      modalFirebase.classList.remove('active');
    });
  }
  if (btnSaveFirebase && modalFirebase) {
    btnSaveFirebase.addEventListener('click', () => {
      modalFirebase.style.setProperty('display', 'none', 'important');
      modalFirebase.style.setProperty('pointer-events', 'none', 'important');
      modalFirebase.classList.add('hidden');
      modalFirebase.classList.remove('active');
      showToast('Konfigurasi Firebase disimpan', 'info');
    });
  }

  function checkUrlParamsForRoom() {
    try {
      const params = new URLSearchParams(window.location.search);
      const pinParam = params.get('pin');
      const netParam = params.get('net');

      if (pinParam) {
        // Switch to Online mode
        const onlineCard = document.querySelector('.mode-card[data-mode="online"]');
        if (onlineCard) onlineCard.click();

        if (netParam) {
          setNetworkType(netParam);
        }

        const input = document.getElementById('input-room-code');
        if (input) {
          input.value = pinParam;
          showToast(`Kode PIN ${pinParam} terisi dari link. Klik Gabung untuk memulai tanding!`, 'info');
        }
      }
    } catch (e) {}
  }



  function initOwnerTools() {
    const btn = document.getElementById('btn-owner-tools');
    const btnProfile = document.getElementById('btn-owner-tools-profile');
    const modal = document.getElementById('modal-owner-tools');
    const btnClose = document.getElementById('btn-close-owner-tools');
    const btnRefresh = document.getElementById('btn-owner-refresh-users');
    const search = document.getElementById('owner-user-search');
    const listEl = document.getElementById('owner-users-list');
    const statusEl = document.getElementById('owner-tools-status');
    if (!modal || !listEl) return;
    let users = [];

    function openModal() {
      modal.classList.remove('hidden');
      modal.classList.add('active');
      modal.style.setProperty('display', 'flex', 'important');
      modal.style.setProperty('pointer-events', 'auto', 'important');
      modal.style.setProperty('visibility', 'visible', 'important');
      loadUsers();
    }
    function closeModal() {
      modal.classList.add('hidden');
      modal.classList.remove('active');
      modal.style.setProperty('display', 'none', 'important');
      modal.style.setProperty('pointer-events', 'none', 'important');
      modal.style.setProperty('visibility', 'hidden', 'important');
    }
    [btn, btnProfile].forEach(b => {
      if (!b) return;
      b.addEventListener('click', () => {
        // close profile modal if open
        const profileModal = document.getElementById('modal-profile');
        if (profileModal && !profileModal.classList.contains('hidden')) {
          profileModal.classList.add('hidden');
          profileModal.style.setProperty('display','none','important');
          profileModal.style.setProperty('pointer-events','none','important');
        }
        const ownerOk = (schoolDb.isOwner && schoolDb.isOwner()) || String((schoolDb.getProfile?.()?.email||'')).toLowerCase() === 'peterfernandochristian123@gmail.com';
        if (!ownerOk) { showToast('Akses owner diperlukan.', 'error'); return; }
        openModal();
      });
    });
    if (btnClose) btnClose.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    async function loadUsers() {
      try {
        statusEl.textContent = 'Memuat data pengguna...';
        users = await schoolDb.ownerListUsers();
        renderUsers();
        statusEl.textContent = 'Total: ' + users.length + ' pengguna. (Termasuk yang tersembunyi jika ada di cache/Firestore)';
      } catch (e) {
        statusEl.textContent = 'Gagal memuat: ' + (e && e.message ? e.message : e);
      }
    }

    function renderUsers() {
      const q = String(search && search.value || '').trim().toLowerCase();
      const filtered = !q ? users : users.filter(u => {
        const hay = [u.name, u.email, u.studentClass, u.uid, u.id].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
      });
      listEl.innerHTML = '';
      if (!filtered.length) { listEl.innerHTML = '<div style="padding:0.75rem;color:var(--text-dim);">Tidak ada data.</div>'; return; }
      filtered.forEach(u => {
        const uid = u.uid || u.id || '';
        const row = document.createElement('div');
        row.style.cssText = 'display:flex; gap:0.5rem; align-items:center; justify-content:space-between; padding:0.55rem; border-bottom:1px solid var(--border-glass); flex-wrap:wrap;';
        const rating = Number.isFinite(Number(u.rating)) ? Number(u.rating) : 0;
        row.innerHTML = `
          <div style="min-width:180px; flex:1;">
            <div style="font-weight:700; color:var(--text-main);">${u.name || '(tanpa nama)'} ${u.hidden ? '<span style="color:var(--accent-amber);font-size:0.72rem;">[TERSEMBUNYI]</span>' : ''}</div>
            <div style="font-size:0.75rem; color:var(--text-dim);">${u.studentClass || '-'} • ELO ${rating} • ${u.email || '-'} • <span style="opacity:.8">${uid}</span></div>
          </div>
          <div style="display:flex; gap:0.35rem; flex-wrap:wrap;">
            <button class="btn-secondary" data-act="elo" data-delta="-10" data-uid="${uid}" style="padding:0.25rem 0.45rem;font-size:0.75rem;">-10</button>
            <button class="btn-secondary" data-act="elo" data-delta="10" data-uid="${uid}" style="padding:0.25rem 0.45rem;font-size:0.75rem;">+10</button>
            <button class="btn-secondary" data-act="setelo" data-uid="${uid}" style="padding:0.25rem 0.45rem;font-size:0.75rem;">Set ELO</button>
            <button class="btn-secondary" data-act="hide" data-uid="${uid}" style="padding:0.25rem 0.45rem;font-size:0.75rem;">${u.hidden ? 'Tampilkan' : 'Sembunyikan'}</button>
            <button class="btn-secondary" data-act="delete" data-uid="${uid}" style="padding:0.25rem 0.45rem;font-size:0.75rem; border-color: rgba(239,68,68,.4); color:#fca5a5;">Hapus</button>
          </div>`;
        listEl.appendChild(row);
      });

      listEl.querySelectorAll('button[data-act]').forEach(b => {
        b.addEventListener('click', async () => {
          const act = b.dataset.act;
          const uid = b.dataset.uid;
          if (!uid) return;
          try {
            b.disabled = true;
            if (act === 'elo') {
              const next = await schoolDb.ownerAdjustElo(uid, Number(b.dataset.delta || 0));
              showToast('ELO diperbarui: ' + next, 'success');
            } else if (act === 'setelo') {
              const v = prompt('Set ELO baru (angka >= 0):');
              if (v == null) return;
              await schoolDb.ownerUpdateUser(uid, { rating: Math.max(0, Number(v) || 0) });
              showToast('ELO diset.', 'success');
            } else if (act === 'hide') {
              const target = users.find(x => (x.uid||x.id) === uid);
              await schoolDb.ownerSetUserHidden(uid, !(target && target.hidden));
              showToast('Status leaderboard diperbarui.', 'success');
            } else if (act === 'delete') {
              if (!confirm('Hapus profil pengguna ini dari leaderboard/data users? (Tidak bisa dibatalkan)')) return;
              await schoolDb.ownerDeleteUser(uid);
              showToast('Profil dihapus dari leaderboard.', 'success');
            }
            await loadUsers();
            if (typeof renderStudentLeaderboard === 'function') renderStudentLeaderboard();
          } catch (e) {
            showToast('Gagal: ' + (e && e.message ? e.message : e), 'error');
          } finally { b.disabled = false; }
        });
      });
    }

    if (btnRefresh) btnRefresh.addEventListener('click', loadUsers);
    if (search) search.addEventListener('input', renderUsers);
  }

  // --- Initial Setup: Start the App & Render Components ---
  initUserProfile();
  initAuthSystem();
  initOwnerTools();
  initBoard();
  initLeaderboard();
  initPractice();
  loadLanInfo();
  if (schoolDb && schoolDb.isLoggedIn && schoolDb.isLoggedIn()) {
    startNewGame();
  } else {
    chessEngine.reset();
    clearSelection();
    if (moveHistoryListEl) moveHistoryListEl.innerHTML = '';
    renderBoard();
  }
  checkUrlParamsForRoom();
}

// Inisialisasi aman: berjalan langsung bila dokumen sudah siap (tidak terlewat jika DOMContentLoaded sudah terjadi)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCaturApp);
} else {
  initCaturApp();
}

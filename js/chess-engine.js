/**
 * Catur Sekolah - Core Chess Engine
 * Pure JavaScript Implementation of Standard FIDE Chess Rules
 */

class ChessEngine {
  constructor() {
    this.reset();
  }

  reset() {
    // 8x8 Board representation: Row 0 is Rank 8 (Black), Row 7 is Rank 1 (White)
    this.board = [
      ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
      ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
      ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];

    this.turn = 'w'; // 'w' (White) or 'b' (Black)
    this.castling = { K: true, Q: true, k: true, q: true };
    this.enPassant = null; // { r, c }
    this.halfMoves = 0;
    this.fullMoves = 1;

    this.history = [];
    this.capturedPieces = { w: [], b: [] }; // Pieces captured by White/Black
    this.isGameOver = false;
    this.gameResult = null; // '1-0', '0-1', '1/2-1/2'
    this.gameOverReason = null;
    this.drawOffer = null; // { by: 'w'|'b' }
    this.positionCounts = {};
    this._recordPosition();
  }

  // Clone engine state for move validation and AI calculation
  clone() {
    const copy = new ChessEngine();
    copy.board = this.board.map(row => [...row]);
    copy.turn = this.turn;
    copy.castling = { ...this.castling };
    copy.enPassant = this.enPassant ? { ...this.enPassant } : null;
    copy.halfMoves = this.halfMoves;
    copy.fullMoves = this.fullMoves;
    copy.isGameOver = this.isGameOver;
    copy.gameResult = this.gameResult;
    copy.gameOverReason = this.gameOverReason;
    copy.drawOffer = this.drawOffer ? { ...this.drawOffer } : null;
    copy.positionCounts = { ...(this.positionCounts || {}) };
    copy.history = [];
    return copy;
  }

  isWhite(piece) {
    return piece && piece === piece.toUpperCase();
  }

  isBlack(piece) {
    return piece && piece === piece.toLowerCase();
  }

  getColor(piece) {
    if (!piece) return null;
    return this.isWhite(piece) ? 'w' : 'b';
  }

  // Convert (r, c) to algebraic square notation ('e4')
  static coordsToSquare(r, c) {
    const file = String.fromCharCode('a'.charCodeAt(0) + c);
    const rank = 8 - r;
    return `${file}${rank}`;
  }

  // Convert algebraic square ('e4') to (r, c)
  static squareToCoords(sq) {
    if (!sq || sq.length < 2) return null;
    const c = sq.charCodeAt(0) - 'a'.charCodeAt(0);
    const r = 8 - parseInt(sq[1], 10);
    return { r, c };
  }

  // Check if coordinates are within the board bounds
  inBounds(r, c) {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  // Find King coordinates for a given color
  findKing(color) {
    const kingPiece = color === 'w' ? 'K' : 'k';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c] === kingPiece) {
          return { r, c };
        }
      }
    }
    return null;
  }

  // Check if square (r, c) is attacked by opponent
  isSquareAttacked(targetR, targetC, byColor) {
    const opponent = byColor;

    // Check Knight attacks
    const knightOffsets = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1]
    ];
    const knightPiece = opponent === 'w' ? 'N' : 'n';
    for (const [dr, dc] of knightOffsets) {
      const r = targetR + dr;
      const c = targetC + dc;
      if (this.inBounds(r, c) && this.board[r][c] === knightPiece) {
        return true;
      }
    }

    // Check Pawn attacks
    const pawnPiece = opponent === 'w' ? 'P' : 'p';
    const pawnPushes = opponent === 'w' ? 1 : -1; // White attacks upward from row+1 to target
    if (this.inBounds(targetR + pawnPushes, targetC - 1) && this.board[targetR + pawnPushes][targetC - 1] === pawnPiece) return true;
    if (this.inBounds(targetR + pawnPushes, targetC + 1) && this.board[targetR + pawnPushes][targetC + 1] === pawnPiece) return true;

    // Check King adjacent attacks
    const kingPiece = opponent === 'w' ? 'K' : 'k';
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = targetR + dr;
        const c = targetC + dc;
        if (this.inBounds(r, c) && this.board[r][c] === kingPiece) {
          return true;
        }
      }
    }

    // Check Straight lines (Rook / Queen)
    const straightDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    const rookPiece = opponent === 'w' ? 'R' : 'r';
    const queenPiece = opponent === 'w' ? 'Q' : 'q';
    for (const [dr, dc] of straightDirs) {
      let r = targetR + dr;
      let c = targetC + dc;
      while (this.inBounds(r, c)) {
        const piece = this.board[r][c];
        if (piece) {
          if (piece === rookPiece || piece === queenPiece) return true;
          break;
        }
        r += dr;
        c += dc;
      }
    }

    // Check Diagonals (Bishop / Queen)
    const diagonalDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    const bishopPiece = opponent === 'w' ? 'B' : 'b';
    for (const [dr, dc] of diagonalDirs) {
      let r = targetR + dr;
      let c = targetC + dc;
      while (this.inBounds(r, c)) {
        const piece = this.board[r][c];
        if (piece) {
          if (piece === bishopPiece || piece === queenPiece) return true;
          break;
        }
        r += dr;
        c += dc;
      }
    }

    return false;
  }

  isKingInCheck(color = this.turn) {
    const kingPos = this.findKing(color);
    if (!kingPos) return false;
    const opponent = color === 'w' ? 'b' : 'w';
    return this.isSquareAttacked(kingPos.r, kingPos.c, opponent);
  }

  // Generate pseudo-legal moves for a specific piece at (fromR, fromC)
  getPseudoMoves(fromR, fromC) {
    const piece = this.board[fromR][fromC];
    if (!piece) return [];
    const color = this.getColor(piece);
    const moves = [];

    const isWhite = color === 'w';
    const opponent = isWhite ? 'b' : 'w';
    const pieceType = piece.toLowerCase();

    // 1. Pawn Moves
    if (pieceType === 'p') {
      const dir = isWhite ? -1 : 1;
      const startRow = isWhite ? 6 : 1;
      const promoRow = isWhite ? 0 : 7;

      // 1 square forward
      const nextR = fromR + dir;
      if (this.inBounds(nextR, fromC) && !this.board[nextR][fromC]) {
        if (nextR === promoRow) {
          ['q', 'r', 'b', 'n'].forEach(promo => {
            moves.push({ fromR, fromC, toR: nextR, toC: fromC, promotion: isWhite ? promo.toUpperCase() : promo });
          });
        } else {
          moves.push({ fromR, fromC, toR: nextR, toC: fromC });
        }

        // 2 squares forward from start
        const doubleR = fromR + dir * 2;
        if (fromR === startRow && !this.board[doubleR][fromC]) {
          moves.push({ fromR, fromC, toR: doubleR, toC: fromC, isDoublePush: true });
        }
      }

      // Diagonal captures
      for (const dc of [-1, 1]) {
        const capC = fromC + dc;
        if (this.inBounds(nextR, capC)) {
          const target = this.board[nextR][capC];
          if (target && this.getColor(target) === opponent) {
            if (nextR === promoRow) {
              ['q', 'r', 'b', 'n'].forEach(promo => {
                moves.push({ fromR, fromC, toR: nextR, toC: capC, promotion: isWhite ? promo.toUpperCase() : promo, capture: target });
              });
            } else {
              moves.push({ fromR, fromC, toR: nextR, toC: capC, capture: target });
            }
          } else if (this.enPassant && this.enPassant.r === nextR && this.enPassant.c === capC) {
            // En Passant capture
            const epPawn = this.board[fromR][capC];
            moves.push({ fromR, fromC, toR: nextR, toC: capC, isEnPassant: true, capture: epPawn });
          }
        }
      }
    }

    // 2. Knight Moves
    if (pieceType === 'n') {
      const jumps = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1]
      ];
      for (const [dr, dc] of jumps) {
        const toR = fromR + dr;
        const toC = fromC + dc;
        if (this.inBounds(toR, toC)) {
          const target = this.board[toR][toC];
          if (!target || this.getColor(target) === opponent) {
            moves.push({ fromR, fromC, toR, toC, capture: target });
          }
        }
      }
    }

    // 3. Sliding pieces (Bishop, Rook, Queen)
    if (pieceType === 'b' || pieceType === 'r' || pieceType === 'q') {
      const dirs = [];
      if (pieceType === 'b' || pieceType === 'q') {
        dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      }
      if (pieceType === 'r' || pieceType === 'q') {
        dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      }

      for (const [dr, dc] of dirs) {
        let toR = fromR + dr;
        let toC = fromC + dc;
        while (this.inBounds(toR, toC)) {
          const target = this.board[toR][toC];
          if (!target) {
            moves.push({ fromR, fromC, toR, toC });
          } else {
            if (this.getColor(target) === opponent) {
              moves.push({ fromR, fromC, toR, toC, capture: target });
            }
            break;
          }
          toR += dr;
          toC += dc;
        }
      }
    }

    // 4. King Moves & Castling
    if (pieceType === 'k') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const toR = fromR + dr;
          const toC = fromC + dc;
          if (this.inBounds(toR, toC)) {
            const target = this.board[toR][toC];
            if (!target || this.getColor(target) === opponent) {
              moves.push({ fromR, fromC, toR, toC, capture: target });
            }
          }
        }
      }

      // Castling
      const row = isWhite ? 7 : 0;
      if (fromR === row && fromC === 4 && !this.isSquareAttacked(row, 4, opponent)) {
        // Kingside castling
        const canKingside = isWhite ? this.castling.K : this.castling.k;
        if (canKingside && !this.board[row][5] && !this.board[row][6]) {
          if (!this.isSquareAttacked(row, 5, opponent) && !this.isSquareAttacked(row, 6, opponent)) {
            moves.push({ fromR, fromC, toR: row, toC: 6, isCastling: 'K' });
          }
        }

        // Queenside castling
        const canQueenside = isWhite ? this.castling.Q : this.castling.q;
        if (canQueenside && !this.board[row][3] && !this.board[row][2] && !this.board[row][1]) {
          if (!this.isSquareAttacked(row, 3, opponent) && !this.isSquareAttacked(row, 2, opponent)) {
            moves.push({ fromR, fromC, toR: row, toC: 2, isCastling: 'Q' });
          }
        }
      }
    }

    return moves;
  }

  // Get all legal moves for current player
  getLegalMoves(fromR = null, fromC = null) {
    const legalMoves = [];

    if (fromR !== null && fromC !== null) {
      const piece = this.board[fromR][fromC];
      if (!piece || this.getColor(piece) !== this.turn) return [];
      const pseudo = this.getPseudoMoves(fromR, fromC);
      return pseudo.filter(m => this.isMoveLegal(m));
    }

    // All squares
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (piece && this.getColor(piece) === this.turn) {
          const pseudo = this.getPseudoMoves(r, c);
          for (const m of pseudo) {
            if (this.isMoveLegal(m)) {
              legalMoves.push(m);
            }
          }
        }
      }
    }

    return legalMoves;
  }

  // Test if a pseudo move doesn't leave the king in check
  isMoveLegal(move) {
    const sim = this.clone();
    sim.executeMove(move, true);
    return !sim.isKingInCheck(this.turn);
  }

  getPositionKey() {
    let placement = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (!piece) {
          empty++;
        } else {
          if (empty > 0) { placement += empty; empty = 0; }
          placement += piece;
        }
      }
      if (empty > 0) placement += empty;
      if (r < 7) placement += '/';
    }
    let castling = '';
    if (this.castling.K) castling += 'K';
    if (this.castling.Q) castling += 'Q';
    if (this.castling.k) castling += 'k';
    if (this.castling.q) castling += 'q';
    const ep = this.enPassant ? ChessEngine.coordsToSquare(this.enPassant.r, this.enPassant.c) : '-';
    return `${placement} ${this.turn} ${castling || '-'} ${ep}`;
  }

  _recordPosition() {
    const key = this.getPositionKey();
    this.positionCounts[key] = (this.positionCounts[key] || 0) + 1;
    return this.positionCounts[key];
  }

  offerDraw(byColor) {
    if (this.isGameOver) return false;
    if (byColor !== 'w' && byColor !== 'b') return false;
    this.drawOffer = { by: byColor };
    return true;
  }

  declineDraw() {
    this.drawOffer = null;
  }

  acceptDraw() {
    if (this.isGameOver) return false;
    this.isGameOver = true;
    this.gameResult = '1/2-1/2';
    this.gameOverReason = 'Kesepakatan Bersama';
    this.drawOffer = null;
    return true;
  }

  claimFiftyMoveDraw() {
    if (this.isGameOver) return false;
    if ((this.halfMoves || 0) >= 100) {
      this.isGameOver = true;
      this.gameResult = '1/2-1/2';
      this.gameOverReason = 'Aturan 50 Langkah';
      return true;
    }
    return false;
  }

  claimThreefoldRepetition() {
    if (this.isGameOver) return false;
    const count = this.positionCounts[this.getPositionKey()] || 0;
    if (count >= 3) {
      this.isGameOver = true;
      this.gameResult = '1/2-1/2';
      this.gameOverReason = 'Pengulangan Tiga Kali';
      return true;
    }
    return false;
  }

  isInsufficientMaterial() {
    const pieces = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.toLowerCase() !== 'k') pieces.push({ p, r, c });
      }
    }
    if (pieces.length === 0) return true; // K vs K
    if (pieces.length === 1) {
      const t = pieces[0].p.toLowerCase();
      return t === 'b' || t === 'n'; // K+minor vs K
    }
    if (pieces.length === 2) {
      const a = pieces[0], b = pieces[1];
      const ta = a.p.toLowerCase(), tb = b.p.toLowerCase();
      // K+B vs K+B (same color bishops)
      if (ta === 'b' && tb === 'b') {
        const colorA = (a.r + a.c) % 2;
        const colorB = (b.r + b.c) % 2;
        return colorA === colorB;
      }
    }
    return false;
  }

  // Execute a move on the board
  executeMove(move, isSimulation = false) {
    const { fromR, fromC, toR, toC, promotion, isEnPassant, isCastling, isDoublePush } = move;
    const movingPiece = this.board[fromR][fromC];
    const targetPiece = this.board[toR][toC];
    const isWhite = this.isWhite(movingPiece);
    const isCapture = !!targetPiece || !!isEnPassant;
    const isPawnMove = !!movingPiece && movingPiece.toLowerCase() === 'p';

    // Save history state for undo
    if (!isSimulation) {
      this.history.push({
        board: this.board.map(r => [...r]),
        turn: this.turn,
        castling: { ...this.castling },
        enPassant: this.enPassant ? { ...this.enPassant } : null,
        halfMoves: this.halfMoves,
        fullMoves: this.fullMoves,
        move: { ...move, piece: movingPiece, target: targetPiece },
        capturedPieces: {
          w: [...this.capturedPieces.w],
          b: [...this.capturedPieces.b]
        },
        isGameOver: this.isGameOver,
        gameResult: this.gameResult,
        gameOverReason: this.gameOverReason,
        drawOffer: this.drawOffer ? { ...this.drawOffer } : null,
        positionKey: this.getPositionKey(),
        positionCounts: { ...(this.positionCounts || {}) }
      });
      this.drawOffer = null; // any move declines/clears an outstanding offer context
    }

    // Handle captures
    if (targetPiece && !isSimulation) {
      if (isWhite) {
        this.capturedPieces.w.push(targetPiece);
      } else {
        this.capturedPieces.b.push(targetPiece);
      }
    }

    // Move piece
    this.board[toR][toC] = promotion || movingPiece;
    this.board[fromR][fromC] = null;

    // Handle En Passant capture
    if (isEnPassant) {
      const epRow = isWhite ? toR + 1 : toR - 1;
      const capturedPawn = this.board[epRow][toC];
      this.board[epRow][toC] = null;
      if (!isSimulation && capturedPawn) {
        if (isWhite) this.capturedPieces.w.push(capturedPawn);
        else this.capturedPieces.b.push(capturedPawn);
      }
    }

    // Handle Castling Rook move
    if (isCastling) {
      const row = fromR;
      if (toC === 6) { // Kingside
        this.board[row][5] = this.board[row][7];
        this.board[row][7] = null;
      } else if (toC === 2) { // Queenside
        this.board[row][3] = this.board[row][0];
        this.board[row][0] = null;
      }
    }

    // Update castling rights
    if (movingPiece === 'K') { this.castling.K = false; this.castling.Q = false; }
    if (movingPiece === 'k') { this.castling.k = false; this.castling.q = false; }
    if (movingPiece === 'R' && fromR === 7 && fromC === 0) this.castling.Q = false;
    if (movingPiece === 'R' && fromR === 7 && fromC === 7) this.castling.K = false;
    if (movingPiece === 'r' && fromR === 0 && fromC === 0) this.castling.q = false;
    if (movingPiece === 'r' && fromR === 0 && fromC === 7) this.castling.k = false;

    // Update En Passant target
    if (isDoublePush) {
      this.enPassant = { r: (fromR + toR) / 2, c: fromC };
    } else {
      this.enPassant = null;
    }

    // Aturan 50 langkah: reset jika ada gerak pion atau tangkapan, selain itu tambah 1 halfmove
    if (!isSimulation) {
      if (isPawnMove || isCapture) this.halfMoves = 0;
      else this.halfMoves = (this.halfMoves || 0) + 1;
    }

    // Switch turn
    this.turn = this.turn === 'w' ? 'b' : 'w';

    if (this.turn === 'w') {
      this.fullMoves++;
    }

    // Check game status
    if (!isSimulation) {
      this._recordPosition();
      this.updateGameStatus();
    }
  }

  // Undo the last move
  undo() {
    if (this.history.length === 0) return false;
    const prev = this.history.pop();
    this.board = prev.board;
    this.turn = prev.turn;
    this.castling = prev.castling;
    this.enPassant = prev.enPassant;
    this.halfMoves = prev.halfMoves;
    this.fullMoves = prev.fullMoves;
    this.capturedPieces = prev.capturedPieces;
    this.isGameOver = !!prev.isGameOver;
    this.gameResult = prev.gameResult || null;
    this.gameOverReason = prev.gameOverReason || null;
    this.drawOffer = prev.drawOffer ? { ...prev.drawOffer } : null;
    if (prev.positionCounts) this.positionCounts = { ...prev.positionCounts };
    else this.positionCounts = {};
    return true;
  }

  // Update checkmate / stalemate / draw conditions
  updateGameStatus() {
    if (this.isGameOver) return;

    const legalMoves = this.getLegalMoves();
    if (legalMoves.length === 0) {
      this.isGameOver = true;
      if (this.isKingInCheck(this.turn)) {
        // Checkmate
        this.gameResult = this.turn === 'w' ? '0-1' : '1-0';
        this.gameOverReason = 'Skakmat';
      } else {
        // Stalemate / Pat
        this.gameResult = '1/2-1/2';
        this.gameOverReason = 'Pat (Stalemate)';
      }
      return;
    }

    // Posisi Mati (Dead Position / insufficient material)
    if (this.isInsufficientMaterial()) {
      this.isGameOver = true;
      this.gameResult = '1/2-1/2';
      this.gameOverReason = 'Posisi Mati (Dead Position)';
      return;
    }

    // Aturan 50 Langkah (100 halfmoves)
    if ((this.halfMoves || 0) >= 100) {
      this.isGameOver = true;
      this.gameResult = '1/2-1/2';
      this.gameOverReason = 'Aturan 50 Langkah';
      return;
    }

    // Pengulangan Tiga Kali
    const repCount = (this.positionCounts && this.positionCounts[this.getPositionKey()]) || 0;
    if (repCount >= 3) {
      this.isGameOver = true;
      this.gameResult = '1/2-1/2';
      this.gameOverReason = 'Pengulangan Tiga Kali';
    }
  }

  // Convert move to algebraic notation (e.g., "e4", "Nf3", "Qxd7+", "O-O")
  moveToSan(move) {
    if (move.isCastling) {
      return move.toC === 6 ? 'O-O' : 'O-O-O';
    }
    const piece = this.board[move.fromR][move.fromC];
    const pieceType = piece ? piece.toUpperCase() : '';
    const toSq = ChessEngine.coordsToSquare(move.toR, move.toC);

    let san = '';
    if (pieceType === 'P') {
      if (move.capture || move.isEnPassant) {
        const fromFile = String.fromCharCode('a'.charCodeAt(0) + move.fromC);
        san = `${fromFile}x${toSq}`;
      } else {
        san = toSq;
      }
      if (move.promotion) {
        san += `=${move.promotion.toUpperCase()}`;
      }
    } else {
      san = pieceType;
      if (move.capture) san += 'x';
      san += toSq;
    }

    // Check check / checkmate symbol
    const sim = this.clone();
    sim.executeMove(move, true);
    if (sim.isKingInCheck(sim.turn)) {
      san += sim.getLegalMoves().length === 0 ? '#' : '+';
    }

    return san;
  }

  // Simple static evaluation of position (Centipawns)
  evaluatePosition() {
    const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
    let score = 0;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (!piece) continue;
        const val = pieceValues[piece.toLowerCase()] || 0;
        const isW = this.isWhite(piece);
        score += isW ? val : -val;
      }
    }

    return score;
  }

  // Load position from FEN string
  loadFen(fen) {
    this.reset();
    const parts = fen.trim().split(/\s+/);
    const rows = (parts[0] || '').split('/');

    for (let r = 0; r < 8; r++) {
      let c = 0;
      const row = rows[r] || '';
      for (const char of row) {
        if (char >= '1' && char <= '8') {
          const emptyCount = parseInt(char, 10);
          for (let i = 0; i < emptyCount && c < 8; i++) this.board[r][c++] = null;
        } else if (c < 8) {
          this.board[r][c++] = char;
        }
      }
      while (c < 8) this.board[r][c++] = null;
    }

    this.turn = parts[1] || 'w';
    const cast = parts[2] || '-';
    this.castling = {
      K: cast.indexOf('K') !== -1,
      Q: cast.indexOf('Q') !== -1,
      k: cast.indexOf('k') !== -1,
      q: cast.indexOf('q') !== -1
    };

    this.enPassant = parts[3] && parts[3] !== '-' ? ChessEngine.squareToCoords(parts[3]) : null;
    this.halfMoves = parseInt(parts[4], 10);
    if (isNaN(this.halfMoves)) this.halfMoves = 0;
    this.fullMoves = parseInt(parts[5], 10);
    if (isNaN(this.fullMoves) || this.fullMoves < 1) this.fullMoves = 1;

    this.positionCounts = {};
    this.drawOffer = null;
    this.gameOverReason = null;
    this.isGameOver = false;
    this.gameResult = null;
    this._recordPosition();
    this.updateGameStatus();
  }

  // Generate standard FEN string from current board state
  generateFen() {
    let fen = '';
    for (let r = 0; r < 8; r++) {
      let empty = 0;
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (!piece) {
          empty++;
        } else {
          if (empty > 0) {
            fen += empty;
            empty = 0;
          }
          fen += piece;
        }
      }
      if (empty > 0) fen += empty;
      if (r < 7) fen += '/';
    }
    fen += ` ${this.turn} `;
    let castling = '';
    if (this.castling.K) castling += 'K';
    if (this.castling.Q) castling += 'Q';
    if (this.castling.k) castling += 'k';
    if (this.castling.q) castling += 'q';
    fen += castling || '-';
    fen += ' ';
    fen += this.enPassant ? ChessEngine.coordsToSquare(this.enPassant.r, this.enPassant.c) : '-';
    fen += ` ${this.halfMoves || 0} ${this.fullMoves || 1}`;
    return fen;
  }
}

// Global instance
const chessEngine = new ChessEngine();

/**
 * Catur Sekolah - AI Bot Engine
 * Minimax with Alpha-Beta Pruning & Positional Piece-Square Tables (PST)
 */

class ChessAI {
  constructor() {
    this.difficulty = 1; // 1: Pemula, 2: Ekskul, 3: Master

    // Piece-Square Tables for Positional Evaluation (White's perspective; flipped for Black)
    this.PST = {
      p: [
        [0,  0,  0,  0,  0,  0,  0,  0],
        [50, 50, 50, 50, 50, 50, 50, 50],
        [10, 10, 20, 30, 30, 20, 10, 10],
        [5,  5, 10, 25, 25, 10,  5,  5],
        [0,  0,  0, 20, 20,  0,  0,  0],
        [5, -5,-10,  0,  0,-10, -5,  5],
        [5, 10, 10,-20,-20, 10, 10,  5],
        [0,  0,  0,  0,  0,  0,  0,  0]
      ],
      n: [
        [-50,-40,-30,-30,-30,-30,-40,-50],
        [-40,-20,  0,  0,  0,  0,-20,-40],
        [-30,  0, 10, 15, 15, 10,  0,-30],
        [-30,  5, 15, 20, 20, 15,  5,-30],
        [-30,  0, 15, 20, 20, 15,  0,-30],
        [-30,  5, 10, 15, 15, 10,  5,-30],
        [-40,-20,  0,  5,  5,  0,-20,-40],
        [-50,-40,-30,-30,-30,-30,-40,-50]
      ],
      b: [
        [-20,-10,-10,-10,-10,-10,-10,-20],
        [-10,  0,  0,  0,  0,  0,  0,-10],
        [-10,  0,  5, 10, 10,  5,  0,-10],
        [-10,  5,  5, 10, 10,  5,  5,-10],
        [-10,  0, 10, 10, 10, 10,  0,-10],
        [-10, 10, 10, 10, 10, 10, 10,-10],
        [-10,  5,  0,  0,  0,  0,  5,-10],
        [-20,-10,-10,-10,-10,-10,-10,-20]
      ],
      r: [
        [0,  0,  0,  0,  0,  0,  0,  0],
        [5, 10, 10, 10, 10, 10, 10,  5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [-5,  0,  0,  0,  0,  0,  0, -5],
        [0,  0,  0,  5,  5,  0,  0,  0]
      ],
      q: [
        [-20,-10,-10, -5, -5,-10,-10,-20],
        [-10,  0,  0,  0,  0,  0,  0,-10],
        [-10,  0,  5,  5,  5,  5,  0,-10],
        [-5,  0,  5,  5,  5,  5,  0, -5],
        [0,  0,  5,  5,  5,  5,  0, -5],
        [-10,  5,  5,  5,  5,  5,  0,-10],
        [-10,  0,  5,  0,  0,  0,  0,-10],
        [-20,-10,-10, -5, -5,-10,-10,-20]
      ],
      k: [
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-30,-40,-40,-50,-50,-40,-40,-30],
        [-20,-30,-30,-40,-40,-30,-30,-20],
        [-10,-20,-20,-20,-20,-20,-20,-10],
        [20, 20,  0,  0,  0,  0, 20, 20],
        [20, 30, 10,  0,  0, 10, 30, 20]
      ]
    };
  }

  setDifficulty(level) {
    this.difficulty = parseInt(level, 10) || 1;
  }

  // Evaluate board score from White's perspective (positive = White leads, negative = Black leads)
  evaluate(engine) {
    const pieceValues = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };
    let score = 0;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = engine.board[r][c];
        if (!piece) continue;

        const type = piece.toLowerCase();
        const isWhite = engine.isWhite(piece);
        const material = pieceValues[type] || 0;

        // Positional value from PST table
        const pstRow = isWhite ? r : 7 - r;
        const pstVal = this.PST[type] ? this.PST[type][pstRow][c] : 0;

        const totalVal = material + pstVal;
        score += isWhite ? totalVal : -totalVal;
      }
    }

    return score;
  }

  // Minimax with Alpha-Beta Pruning
  minimax(engine, depth, alpha, beta, isMaximizing) {
    if (depth === 0 || engine.isGameOver) {
      if (engine.isGameOver) {
        if (engine.gameResult === '1-0') return 100000 + depth;
        if (engine.gameResult === '0-1') return -100000 - depth;
        return 0; // Stalemate
      }
      return this.evaluate(engine);
    }

    const legalMoves = engine.getLegalMoves();
    if (legalMoves.length === 0) {
      return isMaximizing ? -100000 : 100000;
    }

    // Sort moves: captures first to improve alpha-beta cutoff
    legalMoves.sort((a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0));

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of legalMoves) {
        const sim = engine.clone();
        sim.executeMove(move, true);
        const ev = this.minimax(sim, depth - 1, alpha, beta, false);
        maxEval = Math.max(maxEval, ev);
        alpha = Math.max(alpha, ev);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of legalMoves) {
        const sim = engine.clone();
        sim.executeMove(move, true);
        const ev = this.minimax(sim, depth - 1, alpha, beta, true);
        minEval = Math.min(minEval, ev);
        beta = Math.min(beta, ev);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  // Calculate best move for the AI
  getBestMove(engine) {
    const legalMoves = engine.getLegalMoves();
    if (legalMoves.length === 0) return null;

    const isWhite = engine.turn === 'w';

    // LEVEL 1: Pemula (800 ELO)
    // 60% peluang mengambil langkah random acak, 40% mengambil langkah depth 1
    if (this.difficulty === 1) {
      if (Math.random() < 0.6) {
        return legalMoves[Math.floor(Math.random() * legalMoves.length)];
      }
      // Shallow depth 1 evaluation
      return this.findOptimalMove(engine, legalMoves, 1, isWhite);
    }

    // LEVEL 2: Ekskul (1400 ELO)
    // Depth 2 search dengan PST
    if (this.difficulty === 2) {
      return this.findOptimalMove(engine, legalMoves, 2, isWhite);
    }

    // LEVEL 3: Master (1900 ELO)
    // Depth 3 search dengan pruning dan move ordering
    return this.findOptimalMove(engine, legalMoves, 3, isWhite);
  }

  findOptimalMove(engine, moves, depth, isWhite) {
    let bestMove = moves[0];
    let bestVal = isWhite ? -Infinity : Infinity;
    let alpha = -Infinity;
    let beta = Infinity;

    // Shuffle moves slightly to avoid deterministic repeating openings
    moves.sort(() => Math.random() - 0.5);
    // Prioritize captures
    moves.sort((a, b) => (b.capture ? 1 : 0) - (a.capture ? 1 : 0));

    for (const move of moves) {
      const sim = engine.clone();
      sim.executeMove(move, true);
      const val = this.minimax(sim, depth - 1, alpha, beta, !isWhite);

      if (isWhite) {
        if (val > bestVal) {
          bestVal = val;
          bestMove = move;
        }
        alpha = Math.max(alpha, val);
      } else {
        if (val < bestVal) {
          bestVal = val;
          bestMove = move;
        }
        beta = Math.min(beta, val);
      }
    }

    return bestMove;
  }
}

// Global instance
const chessAI = new ChessAI();

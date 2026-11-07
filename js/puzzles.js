/**
 * Catur Sekolah - Taktik & Puzzle (Stage/Level Progression, Duolingo-style path)
 */

const TACTIC_STAGES = [
  {
    id: 'stage-1',
    title: 'Bab 1: Dasar Skakmat',
    subtitle: 'Mulai dari pola skakmat 1 langkah',
    color: '#10b981',
    levels: [
      {
        id: 's1-l1',
        title: 'Skakmat Cepat',
        desc: 'Putih punya serangan ke sayap raja. Temukan skakmat 1 langkah!',
        difficulty: 'Mudah',
        turn: 'w',
        fen: 'r1bqkb1r/pppp1ppp/2n5/4p3/2B1n3/5Q2/PPPP1PPP/RNB1K1NR w KQkq - 0 5',
        solutionSan: ['Qxf7#'],
        hint: 'Perhatikan petak f7 yang hanya dijaga oleh Raja Hitam.',
        explanation: "Ratu di f7 dengan dukungan Gajah c4 menghasilkan skakmat (pola Scholar's Mate)."
      },
      {
        id: 's1-l2',
        title: 'Baris Belakang',
        desc: 'Raja lawan terjebak pionnya sendiri. Tuntaskan permainan!',
        difficulty: 'Mudah',
        turn: 'w',
        fen: '3r2k1/5ppp/8/8/8/8/4RPPP/6K1 w - - 0 1',
        solutionSan: ['Re8#'],
        hint: 'Serang baris ke-8 yang lemah.',
        explanation: 'Re8# adalah skakmat baris belakang: raja tidak bisa lari karena terhalang pion.'
      }
    ]
  },
  {
    id: 'stage-2',
    title: 'Bab 2: Taktik Serangan',
    subtitle: 'Garpu, tekanan, dan langkah aktif',
    color: '#3b82f6',
    levels: [
      {
        id: 's2-l1',
        title: 'Langkah Aktif',
        desc: 'Putih bisa meningkatkan tekanan dan menjaga perwira penting.',
        difficulty: 'Sedang',
        turn: 'w',
        fen: 'r3k2r/ppp2ppp/2n5/4q3/1b2B3/8/PPPP1PPP/R1BQK2R w KQkq - 0 11',
        solutionSan: ['Qe2'],
        hint: 'Hubungkan perwira dan lindungi titik penting.',
        explanation: 'Qe2 menjaga struktur dan menyiapkan koordinasi perwira.'
      },
      {
        id: 's2-l2',
        title: 'Ancaman Ganda',
        desc: 'Cari langkah kuda yang menciptakan ancaman kuat.',
        difficulty: 'Sedang',
        turn: 'w',
        fen: 'r1b1k2r/pp3ppp/2n1p3/3p4/2PPn3/PN6/1P3PPP/R2QKB1R w KQkq - 0 12',
        solutionSan: ['Nc5'],
        hint: 'Lompatan kuda bisa menyerang lebih dari satu titik.',
        explanation: 'Nc5 meningkatkan aktivitas kuda dan memberi tekanan taktis.'
      }
    ]
  },
  {
    id: 'stage-3',
    title: 'Bab 3: Pola Mahir',
    subtitle: 'Kenali pola skakmat klasik',
    color: '#f59e0b',
    levels: [
      {
        id: 's3-l1',
        title: 'Skakmat Tercekik',
        desc: 'Raja lawan terkunci oleh bidaknya sendiri. Temukan skakmat!',
        difficulty: 'Mahir',
        turn: 'w',
        fen: '6rk/5Npp/8/8/8/8/8/4K3 w - - 0 1',
        solutionSan: ['Nh6#'],
        hint: 'Kuda bisa melompati penghalang.',
        explanation: 'Nh6# adalah skakmat tercekik: raja tidak bisa keluar karena dikelilingi bidaknya.'
      }
    ]
  }
];

class TacticsProgressManager {
  constructor() {
    this.storageKey = 'catur_tactics_progress_v1';
    this.stages = TACTIC_STAGES;
    this.state = this.load();
  }

  getUserKey() {
    try {
      if (window.schoolDb && typeof schoolDb.getAuthUser === 'function') {
        const u = schoolDb.getAuthUser();
        if (u && (u.uid || u.email)) return u.uid || u.email;
      }
      if (window.schoolDb && typeof schoolDb.getProfile === 'function') {
        const p = schoolDb.getProfile();
        if (p && p.id) return p.id;
      }
    } catch (e) {}
    return 'guest';
  }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const all = raw ? JSON.parse(raw) : {};
      const key = this.getUserKey();
      const s = all[key] || {};
      return {
        completed: Array.isArray(s.completed) ? s.completed : [],
        stars: s.stars && typeof s.stars === 'object' ? s.stars : {},
        xp: Number.isFinite(Number(s.xp)) ? Number(s.xp) : 0
      };
    } catch (e) {
      return { completed: [], stars: {}, xp: 0 };
    }
  }

  save() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const all = raw ? JSON.parse(raw) : {};
      all[this.getUserKey()] = this.state;
      localStorage.setItem(this.storageKey, JSON.stringify(all));
    } catch (e) {}
  }

  refreshUser() {
    this.state = this.load();
  }

  allLevels() {
    const out = [];
    this.stages.forEach((stage, si) => {
      stage.levels.forEach((level, li) => out.push({ stage, stageIndex: si, level, levelIndex: li }));
    });
    return out;
  }

  getLevelById(levelId) {
    return this.allLevels().find(x => x.level.id === levelId) || null;
  }

  isCompleted(levelId) {
    return this.state.completed.includes(levelId);
  }

  getStars(levelId) {
    return Number(this.state.stars[levelId] || 0);
  }

  isUnlocked(levelId) {
    const flat = this.allLevels();
    const idx = flat.findIndex(x => x.level.id === levelId);
    if (idx <= 0) return true;
    return this.isCompleted(flat[idx - 1].level.id);
  }

  markCompleted(levelId, stars = 1) {
    if (!this.isCompleted(levelId)) {
      this.state.completed.push(levelId);
      this.state.xp += 10 * Math.max(1, Number(stars) || 1);
    }
    const prev = this.getStars(levelId);
    this.state.stars[levelId] = Math.max(prev, Math.max(1, Math.min(3, Number(stars) || 1)));
    this.save();
  }

  getStageProgress(stage) {
    const total = stage.levels.length;
    const done = stage.levels.filter(l => this.isCompleted(l.id)).length;
    return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
  }

  getNextPlayable() {
    const flat = this.allLevels();
    const next = flat.find(x => !this.isCompleted(x.level.id) && this.isUnlocked(x.level.id));
    return next || flat[flat.length - 1] || null;
  }

  normalizeSan(san) {
    return String(san || '').replace(/[+#?!]/g, '').trim().toLowerCase();
  }

  validate(level, san) {
    if (!level || !Array.isArray(level.solutionSan) || !level.solutionSan[0]) return false;
    return this.normalizeSan(level.solutionSan[0]) === this.normalizeSan(san);
  }
}

const tacticsMgr = new TacticsProgressManager();

// Compatibility shim for any older code paths
const puzzleMgr = {
  puzzles: TACTIC_STAGES.flatMap(s => s.levels),
  currentIndex: 0,
  getCurrentPuzzle() { return this.puzzles[this.currentIndex] || this.puzzles[0]; },
  nextPuzzle() { this.currentIndex = (this.currentIndex + 1) % this.puzzles.length; return this.getCurrentPuzzle(); },
  prevPuzzle() { this.currentIndex = (this.currentIndex - 1 + this.puzzles.length) % this.puzzles.length; return this.getCurrentPuzzle(); },
  setPuzzle(i) { if (i >= 0 && i < this.puzzles.length) this.currentIndex = i; return this.getCurrentPuzzle(); },
  validateMove(san) { return tacticsMgr.validate(this.getCurrentPuzzle(), san); }
};

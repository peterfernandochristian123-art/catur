/**
 * Catur Sekolah - Firebase Integration & Offline-Resilient Storage Service
 * Handles Student Accounts, Firebase Authentication (Google & Email/Password),
 * Class Standings, and Dynamic Leaderboards
 */

class SchoolChessService {
  constructor() {
    this.firebaseConfig = null;
    this.isFirebaseReady = false;
    this.storageKeyProfile = 'catur_sekolah_user_profile';
    this.storageKeyLeaderboard = 'catur_sekolah_leaderboard_data';
    this.storageKeyClasses = 'catur_sekolah_class_standings';
    this.storageKeyRooms = 'catur_sekolah_active_rooms';
    this.storageKeyFirebaseConfig = 'catur_sekolah_firebase_config';
    this.storageKeyUsers = 'catur_sekolah_registered_users';
    this.storageKeyAuthUser = 'catur_sekolah_auth_session';
    this.storageKeyGames = 'catur_sekolah_games_history';
    this.eloResetVersion = 'catur_sekolah_elo_reset_v2_zero';
    this.memoryStore = {};
    this.authListeners = [];
    this.ownerEmails = ['peterfernandochristian123@gmail.com'];

    this.initDefaultData();
    this.migrateEloToZero();
    this.loadSavedFirebaseConfig();
  }

  getAuthUser() {
    try {
      if (this.isFirebaseReady && firebase.apps.length && firebase.auth) {
        const u = firebase.auth().currentUser;
        if (u) return { uid: u.uid, email: u.email || '', name: u.displayName || '' };
      }
    } catch (e) {}
    try {
      const raw = this.storageGet(this.storageKeyAuthUser);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  isOwner() {
    const u = this.getAuthUser();
    const p = (typeof this.getProfile === 'function') ? this.getProfile() : null;
    const email = String((u && u.email) || (p && p.email) || '').trim().toLowerCase();
    return !!email && this.ownerEmails.includes(email);
  }

  getRating(value) {
    return Number.isFinite(Number(value)) ? Number(value) : 0;
  }

  migrateEloToZero() {
    try {
      if (this.storageGet(this.eloResetVersion)) return;

      const profile = this.getProfile();
      if (profile) {
        profile.rating = 0;
        this.storageSet(this.storageKeyProfile, JSON.stringify(profile));
      }

      const students = this.getStudentLeaderboard();
      if (students.length) {
        this.storageSet(this.storageKeyLeaderboard, JSON.stringify(students.map(s => ({ ...s, rating: 0 }))));
      }

      this.storageSet(this.eloResetVersion, String(Date.now()));
    } catch (e) {
      console.warn('Gagal migrasi ELO:', e);
    }
  }

  // Safe wrapper around localStorage with in-memory fallback
  storageGet(key) {
    try {
      if (typeof localStorage !== 'undefined') {
        const val = localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch (e) {
      console.warn('localStorage not accessible, using in-memory store:', e);
    }
    return this.memoryStore[key] || null;
  }

  storageSet(key, value) {
    this.memoryStore[key] = value;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
    } catch (e) {
      console.warn('localStorage write failed, using in-memory store:', e);
    }
  }

  // Load saved Firebase credentials from local storage or default project
  loadSavedFirebaseConfig() {
    const saved = this.storageGet(this.storageKeyFirebaseConfig);
    if (saved) {
      try {
        const config = JSON.parse(saved);
        if (config && config.apiKey && config.apiKey !== 'AIzaSy_YOUR_API_KEY') {
          this.initFirebase(config);
          return;
        }
      } catch (e) {
        console.warn('Gagal memuat config Firebase tersimpan:', e);
      }
    }

    // Default: Proyek Firebase catur-a1dad resmi
    const defaultConfig = {
      projectId: "catur-a1dad",
      appId: "1:749062464507:web:059cdfa5fa241c8411e15e",
      storageBucket: "catur-a1dad.firebasestorage.app",
      apiKey: "AIzaSyAdBfdUvrW19O6ZrOs2hYYI9R0tqZ5JS24",
      authDomain: "catur-a1dad.firebaseapp.com",
      messagingSenderId: "749062464507",
      measurementId: "G-B447KQDG16"
    };
    this.initFirebase(defaultConfig);
  }

  // Inisialisasi Firebase SDK
  initFirebase(config) {
    if (!config || !config.apiKey) {
      return false;
    }

    this.firebaseConfig = config;
    this.storageSet(this.storageKeyFirebaseConfig, JSON.stringify(config));

    if (typeof firebase === 'undefined') {
      console.log('Firebase SDK belum termuat atau berjalan offline. Mode resilient aktif.');
      return false;
    }

    try {
      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(config);
      }
      this.isFirebaseReady = true;
      console.log('Firebase App berhasil diinisialisasi!');

      // Listen to Firebase Auth state
      if (firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
          if (user) {
            this.onFirebaseAuthSuccess(user);
          } else {
            this.onFirebaseAuthSignOut();
          }
        });
      }
      return true;
    } catch (err) {
      console.warn('Inisialisasi Firebase error:', err.message);
      return false;
    }
  }

  // Register auth state change callback
  onAuthStateChanged(callback) {
    if (typeof callback === 'function') {
      this.authListeners.push(callback);
    }
  }

  notifyAuthListeners(user) {
    this.authListeners.forEach(cb => {
      try { cb(user); } catch (e) {}
    });
  }

  onFirebaseAuthSuccess(user) {
    const profile = this.getProfile() || {};
    profile.email = user.email || profile.email || '';
    profile.name = user.displayName || profile.name || (user.email ? user.email.split('@')[0] : 'Siswa');
    profile.id = user.uid;
    if (user.photoURL) profile.photoURL = user.photoURL;

    this.storageSet(this.storageKeyProfile, JSON.stringify(profile));
    this.storageSet(this.storageKeyAuthUser, JSON.stringify({
      email: profile.email,
      name: profile.name,
      uid: user.uid,
      provider: 'firebase'
    }));

    this.syncProfileToLeaderboard(profile);
    this.syncUserToFirestore(profile);
    this.notifyAuthListeners(profile);
  }

  onFirebaseAuthSignOut() {
    this.notifyAuthListeners(null);
  }

  // ==================== AUTHENTICATION ACTIONS ====================

  /**
   * Login dengan Akun Google
   */
  async loginWithGoogle() {
    if (this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.auth) {
      try {
        const provider = new firebase.auth.GoogleAuthProvider();
        const result = await firebase.auth().signInWithPopup(provider);
        this.onFirebaseAuthSuccess(result.user);
        return { success: true, user: result.user };
      } catch (err) {
        console.error('Google sign-in error:', err);
        return { success: false, message: err.message };
      }
    } else {
      // Graceful offline simulation for school / local testing
      const simUser = {
        uid: 'usr_g_' + Math.random().toString(36).substring(2, 9),
        email: 'siswa.demo@sekolah.local',
        displayName: 'Siswa Demo',
        photoURL: null
      };

      const profile = this.getProfile() || {};
      profile.email = simUser.email;
      profile.name = simUser.displayName;
      profile.id = simUser.uid;
      this.storageSet(this.storageKeyProfile, JSON.stringify(profile));
      this.storageSet(this.storageKeyAuthUser, JSON.stringify({
        email: simUser.email,
        name: simUser.displayName,
        uid: simUser.uid,
        provider: 'google'
      }));

      this.syncProfileToLeaderboard(profile);
      this.notifyAuthListeners(profile);

      return {
        success: true,
        user: simUser,
        isSimulated: !this.isFirebaseReady,
        note: !this.isFirebaseReady ? 'Login berhasil disimulasikan (Masukkan konfigurasi Firebase di menu Pengaturan untuk sinkronisasi cloud penuh)' : ''
      };
    }
  }

  /**
   * Daftar Akun Baru dengan Email & Kata Sandi
   */
  async registerWithEmail(email, password, name = '', studentClass = 'X-A') {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanName = (name || '').trim() || cleanEmail.split('@')[0];

    if (!cleanEmail) {
      return { success: false, message: 'Alamat email wajib diisi!' };
    }
    if (!password || password.length < 6) {
      return { success: false, message: 'Kata sandi minimal 6 karakter!' };
    }

    if (this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.auth) {
      try {
        const userCred = await firebase.auth().createUserWithEmailAndPassword(cleanEmail, password);
        await userCred.user.updateProfile({ displayName: cleanName });

        const profile = this.saveProfile(cleanName, studentClass, '♚');
        profile.email = cleanEmail;
        profile.id = userCred.user.uid;
        this.storageSet(this.storageKeyProfile, JSON.stringify(profile));

        this.notifyAuthListeners(profile);
        return { success: true, user: userCred.user };
      } catch (err) {
        return { success: false, message: err.message };
      }
    } else {
      // Local Auth Resilient Store
      let users = {};
      try {
        users = JSON.parse(this.storageGet(this.storageKeyUsers) || '{}');
      } catch (e) {}

      if (users[cleanEmail]) {
        return { success: false, message: 'Alamat email ini sudah terdaftar!' };
      }

      const uid = 'usr_' + Math.random().toString(36).substring(2, 9);
      users[cleanEmail] = {
        uid,
        email: cleanEmail,
        password: password,
        name: cleanName,
        studentClass: studentClass,
        createdAt: Date.now()
      };
      this.storageSet(this.storageKeyUsers, JSON.stringify(users));

      const profile = this.saveProfile(cleanName, studentClass, '♚');
      profile.email = cleanEmail;
      profile.id = uid;
      this.storageSet(this.storageKeyProfile, JSON.stringify(profile));
      this.storageSet(this.storageKeyAuthUser, JSON.stringify({
        email: cleanEmail,
        name: cleanName,
        uid,
        provider: 'local'
      }));

      this.notifyAuthListeners(profile);
      return {
        success: true,
        user: { email: cleanEmail, displayName: cleanName },
        note: !this.isFirebaseReady ? 'Akun berhasil didaftarkan!' : ''
      };
    }
  }

  /**
   * Masuk Akun dengan Email & Kata Sandi
   */
  async loginWithEmail(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();

    if (!cleanEmail || !password) {
      return { success: false, message: 'Email dan kata sandi wajib diisi!' };
    }

    if (this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.auth) {
      try {
        const userCred = await firebase.auth().signInWithEmailAndPassword(cleanEmail, password);
        this.onFirebaseAuthSuccess(userCred.user);
        return { success: true, user: userCred.user };
      } catch (err) {
        return { success: false, message: err.message };
      }
    } else {
      let users = {};
      try {
        users = JSON.parse(this.storageGet(this.storageKeyUsers) || '{}');
      } catch (e) {}

      const user = users[cleanEmail];
      if (!user) {
        return { success: false, message: 'Akun dengan email ini belum terdaftar. Silakan klik tab Daftar Akun Baru!' };
      }

      if (user.password !== password) {
        return { success: false, message: 'Kata sandi tidak sesuai!' };
      }

      const profile = this.saveProfile(user.name, user.studentClass, '♚');
      profile.email = cleanEmail;
      profile.id = user.uid;
      this.storageSet(this.storageKeyProfile, JSON.stringify(profile));
      this.storageSet(this.storageKeyAuthUser, JSON.stringify({
        email: cleanEmail,
        name: user.name,
        uid: user.uid,
        provider: 'local'
      }));

      this.notifyAuthListeners(profile);
      return { success: true, user: { email: cleanEmail, displayName: user.name } };
    }
  }

  /**
   * Keluar dari Akun (Logout)
   */
  async logout() {
    if (this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.auth) {
      try {
        await firebase.auth().signOut();
      } catch (e) {}
    }

    this.storageSet(this.storageKeyAuthUser, '');

    const guestProfile = {
      id: 'usr_' + Math.random().toString(36).substring(2, 9),
      name: 'Siswa Catur',
      studentClass: 'X-A',
      avatar: '♚',
      rating: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      streak: 0
    };
    this.storageSet(this.storageKeyProfile, JSON.stringify(guestProfile));
    this.notifyAuthListeners(null);
    return guestProfile;
  }

  isLoggedIn() {
    const session = this.storageGet(this.storageKeyAuthUser);
    return !!session;
  }

  // ==================== DEFAULT DATA & LEADERBOARDS ====================
  initDefaultData() {
    // 1. Profil Siswa Aktif
    if (!this.storageGet(this.storageKeyProfile)) {
      const defaultProfile = {
        id: 'usr_' + Math.random().toString(36).substring(2, 9),
        name: 'Siswa Catur',
        studentClass: 'X-A',
        avatar: '♚',
        rating: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        streak: 0
      };
      this.storageSet(this.storageKeyProfile, JSON.stringify(defaultProfile));
    }

    // 2. Data Leaderboard Siswa Sekolah
    if (!this.storageGet(this.storageKeyLeaderboard)) {
      const mockStudents = [
        { id: 's1', name: 'Rian Pratama', studentClass: 'XII-MIPA-1', rating: 0, wins: 0, draws: 0, losses: 0, streak: 0 },
        { id: 's2', name: 'Nabila Azzahra', studentClass: 'XI-MIPA-1', rating: 0, wins: 0, draws: 0, losses: 0, streak: 0 },
        { id: 's3', name: 'Fikri Haikal', studentClass: 'XI-IPS-1', rating: 0, wins: 0, draws: 0, losses: 0, streak: 0 },
        { id: 's4', name: 'Ahmad Fauzi', studentClass: 'X-A', rating: 0, wins: 0, draws: 0, losses: 0, streak: 0 },
        { id: 's5', name: 'Dewi Lestari', studentClass: 'X-B', rating: 0, wins: 0, draws: 0, losses: 0, streak: 0 },
        { id: 's6', name: 'Siswa Catur (Kamu)', studentClass: 'X-A', rating: 0, wins: 0, draws: 0, losses: 0, streak: 0 }
      ];
      this.storageSet(this.storageKeyLeaderboard, JSON.stringify(mockStudents));
    }

    // 3. Data Leaderboard Antar-Kelas Sekolah
    if (!this.storageGet(this.storageKeyClasses)) {
      const mockClasses = [
        { className: 'XII-MIPA-1', totalWins: 42, points: 126, topPlayer: 'Rian Pratama' },
        { className: 'XI-MIPA-1', totalWins: 38, points: 114, topPlayer: 'Nabila Azzahra' },
        { className: 'X-A', totalWins: 27, points: 81, topPlayer: 'Ahmad Fauzi' },
        { className: 'XI-IPS-1', totalWins: 22, points: 66, topPlayer: 'Fikri Haikal' },
        { className: 'X-B', totalWins: 18, points: 54, topPlayer: 'Dewi Lestari' },
        { className: 'X-C', totalWins: 14, points: 42, topPlayer: 'Bagas W' }
      ];
      this.storageSet(this.storageKeyClasses, JSON.stringify(mockClasses));
    }
  }

  getProfile() {
    try {
      const data = this.storageGet(this.storageKeyProfile);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  saveProfile(name, studentClass, avatar) {
    const profile = this.getProfile() || {};
    profile.name = name || profile.name || 'Siswa Catur';
    profile.studentClass = studentClass || profile.studentClass || 'X-A';
    profile.avatar = avatar || profile.avatar || '♚';
    if (!Number.isFinite(Number(profile.rating))) profile.rating = 0;
    this.storageSet(this.storageKeyProfile, JSON.stringify(profile));

    this.syncProfileToLeaderboard(profile);
    this.syncUserToFirestore(profile);
    return profile;
  }

  syncProfileToLeaderboard(profile) {
    const students = this.getStudentLeaderboard();
    const idx = students.findIndex(s => s.id === profile.id || s.name.includes('(Kamu)'));
    if (idx !== -1) {
      students[idx].name = `${profile.name} (Kamu)`;
      students[idx].studentClass = profile.studentClass;
      students[idx].rating = this.getRating(profile.rating);
    } else {
      students.push({
        id: profile.id,
        name: `${profile.name} (Kamu)`,
        studentClass: profile.studentClass,
        rating: this.getRating(profile.rating),
        wins: profile.wins || 0,
        draws: profile.draws || 0,
        losses: profile.losses || 0,
        streak: profile.streak || 0
      });
    }
    this.storageSet(this.storageKeyLeaderboard, JSON.stringify(students));
  }

  getStudentLeaderboard(includeHidden = false) {
    try {
      const data = this.storageGet(this.storageKeyLeaderboard);
      let list = data ? JSON.parse(data) : [];
      if (!includeHidden) list = list.filter(p => !p.hidden);
      return list.sort((a, b) => b.rating - a.rating);
    } catch (e) {
      return [];
    }
  }

  getClassLeaderboard() {
    try {
      const data = this.storageGet(this.storageKeyClasses);
      const list = data ? JSON.parse(data) : [];
      return list.sort((a, b) => b.points - a.points);
    } catch (e) {
      return [];
    }
  }

  recordGameResult(isWin, isDraw = false) {
    const profile = this.getProfile();
    if (!profile) return;
    if (!this.isLoggedIn()) {
      console.warn('Progres pertandingan tidak disimpan: pengguna belum login.');
      return;
    }

    const currentRating = this.getRating(profile.rating);
    if (isDraw) {
      profile.draws = (profile.draws || 0) + 1;
      profile.rating = currentRating + 5;
      profile.streak = 0;
    } else if (isWin) {
      profile.wins = (profile.wins || 0) + 1;
      profile.streak = (profile.streak || 0) + 1;
      profile.rating = currentRating + 20;
      this.incrementClassPoints(profile.studentClass, 3);
    } else {
      profile.losses = (profile.losses || 0) + 1;
      profile.streak = 0;
      profile.rating = Math.max(0, currentRating - 10);
    }

    this.storageSet(this.storageKeyProfile, JSON.stringify(profile));
    this.syncProfileToLeaderboard(profile);
    this.syncUserToFirestore(profile);
  }

  incrementClassPoints(className, pts = 3) {
    const classes = this.getClassLeaderboard();
    const target = classes.find(c => c.className === className);
    if (target) {
      target.totalWins += 1;
      target.points += pts;
    } else {
      classes.push({
        className,
        totalWins: 1,
        points: pts,
        topPlayer: this.getProfile()?.name || 'Siswa'
      });
    }
    this.storageSet(this.storageKeyClasses, JSON.stringify(classes));
  }

  /**
   * Realtime Listener Firestore untuk Peringkat Leaderboard
   * Query: collection(db, "users"), orderBy("rating", "desc"), limit(50)
   * Mengembalikan fungsi unsubscribe listener
   */
  listenLeaderboard(callback) {
    if (this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.firestore) {
      try {
        const db = firebase.firestore();
        const q = db.collection("users")
          .orderBy("rating", "desc")
          .limit(50);

        return q.onSnapshot((snapshot) => {
          let players = snapshot.docs.map((doc) => ({
            uid: doc.id,
            id: doc.id,
            ...doc.data()
          })).filter(p => !p.hidden);
          players = players.map((p, index) => ({ ...p, rank: index + 1 }));

          if (players.length > 0) {
            this.storageSet(this.storageKeyLeaderboard, JSON.stringify(players));
          }
          if (typeof callback === 'function') {
            callback(players);
          }
        }, (error) => {
          console.warn("Firestore listenLeaderboard error:", error.message);
          if (typeof callback === 'function') {
            callback(this.getStudentLeaderboard());
          }
        });
      } catch (err) {
        console.warn("Gagal inisialisasi Firestore onSnapshot:", err);
      }
    }

    // Fallback data lokal jika Firebase offline / belum dikonfigurasi
    if (typeof callback === 'function') {
      callback(this.getStudentLeaderboard());
    }
    return () => {};
  }

  // Sinkronisasi data pemain ke Firestore koleksi 'users'
  async syncUserToFirestore(profile) {
    if (!profile || !profile.id) return;
    if (this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.firestore) {
      try {
        const db = firebase.firestore();
        await db.collection("users").doc(profile.id).set({
          name: profile.name,
          studentClass: profile.studentClass,
          avatar: profile.avatar || '♚',
          rating: this.getRating(profile.rating),
          wins: profile.wins || 0,
          draws: profile.draws || 0,
          losses: profile.losses || 0,
          streak: profile.streak || 0,
          email: profile.email || '',
          updatedAt: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
        }, { merge: true });
      } catch (err) {
        console.warn("Firestore syncUserToFirestore error:", err);
      }
    }
  }

  /**
   * Mendengarkan riwayat 30 pertandingan terakhir pemain dari Firestore collection 'games'
   * Query: collection(db, "games"), where("players", "array-contains", uid), orderBy("createdAt", "desc"), limit(30)
   */
  listenGameHistory(uid, callback) {
    const targetUid = uid || this.getProfile()?.id;

    if (this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.firestore) {
      try {
        const db = firebase.firestore();
        let q = db.collection("games");
        if (targetUid) {
          q = q.where("players", "array-contains", targetUid);
        }
        q = q.orderBy("createdAt", "desc").limit(30);

        return q.onSnapshot((snapshot) => {
          const games = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          if (typeof callback === 'function') {
            callback(games);
          }
        }, (error) => {
          console.warn("Firestore listenGameHistory error:", error.message);
          if (typeof callback === 'function') {
            callback(this.getLocalGameHistory(targetUid));
          }
        });
      } catch (err) {
        console.warn("Gagal inisialisasi Firestore listenGameHistory:", err);
      }
    }

    // Fallback data riwayat lokal jika offline
    if (typeof callback === 'function') {
      callback(this.getLocalGameHistory(targetUid));
    }
    return () => {};
  }

  // Riwayat game lokal
  getLocalGameHistory(uid) {
    try {
      const data = this.storageGet(this.storageKeyGames);
      const list = data ? JSON.parse(data) : [];
      if (!uid) return list.slice(0, 30);
      return list.filter(g => (g.players && g.players.includes(uid)) || !g.players).slice(0, 30);
    } catch (e) {
      return [];
    }
  }

  saveLocalGameRecord(gameData) {
    try {
      const data = this.storageGet(this.storageKeyGames);
      const list = data ? JSON.parse(data) : [];
      list.unshift(gameData);
      if (list.length > 50) list.pop();
      this.storageSet(this.storageKeyGames, JSON.stringify(list));
    } catch (e) {}
  }

  async saveGameRecord(gameData) {
    if (!this.isLoggedIn()) return;
    const record = {
      ...gameData,
      createdAt: Date.now()
    };
    this.saveLocalGameRecord(record);

    if (this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.firestore) {
      try {
        const db = firebase.firestore();
        await db.collection("games").add({
          ...gameData,
          createdAt: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
        });
      } catch (err) {
        console.warn("Firestore saveGameRecord error:", err);
      }
    }
  }

  // ==================== CLOUD MULTIPLAYER (FIRESTORE) ====================
  /**
   * Membuat ruangan multiplayer online
   */
  async createOnlineRoom(hostProfile, timeLimit = 600) {
    if (this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.firestore) {
      try {
        const pin = Math.floor(1000 + Math.random() * 9000).toString();
        const db = firebase.firestore();
        const roomData = {
          pin,
          status: 'waiting',
          host: {
            uid: hostProfile.id || hostProfile.uid || 'usr_host',
            name: hostProfile.name || 'Pemain 1',
            studentClass: hostProfile.studentClass || 'Umum',
            avatar: hostProfile.avatar || '♚',
            rating: this.getRating(hostProfile.rating)
          },
          guest: null,
          turn: 'w',
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          lastMove: null,
          fullMoves: 1,
          timeLimit: timeLimit,
          whiteTime: timeLimit,
          blackTime: timeLimit,
          winner: null,
          result: null,
          resultReason: null,
          moves: [],
          isCloud: true,
          createdAt: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : Date.now(),
          updatedAt: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
        };

        await db.collection('rooms').doc(pin).set(roomData);
        return { success: true, pin, room: roomData, isCloud: true };
      } catch (err) {
        console.warn('Gagal membuat room Firestore, fallback ke server lokal:', err);
      }
    }

    // Fallback: Local Node.js server REST API
    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostName: hostProfile.name,
          hostClass: hostProfile.studentClass,
          hostAvatar: hostProfile.avatar,
          timeLimit: timeLimit
        })
      });
      const data = await res.json();
      return { ...data, isCloud: false };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Bergabung ke ruangan multiplayer online
   */
  async joinOnlineRoom(pin, guestProfile) {
    if (this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.firestore) {
      try {
        const db = firebase.firestore();
        const roomRef = db.collection('rooms').doc(pin);
        const docSnap = await roomRef.get();

        if (!docSnap.exists) {
          return { success: false, message: `Ruangan dengan PIN ${pin} tidak ditemukan di Cloud Firestore!` };
        }

        const room = docSnap.data();
        if (room.status !== 'waiting' && room.guest) {
          return { success: false, message: `Ruangan PIN ${pin} sudah penuh!` };
        }

        const guestData = {
          uid: guestProfile.id || guestProfile.uid || 'usr_guest',
          name: guestProfile.name || 'Pemain 2',
          studentClass: guestProfile.studentClass || 'Umum',
          avatar: guestProfile.avatar || '♚',
          rating: this.getRating(guestProfile.rating)
        };

        await roomRef.update({
          guest: guestData,
          status: 'playing',
          updatedAt: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
        });

        return {
          success: true,
          pin,
          room: { ...room, guest: guestData, status: 'playing' },
          isCloud: true
        };
      } catch (err) {
        console.warn('Gagal gabung room Firestore, fallback ke server lokal:', err);
      }
    }

    // Fallback: Local Node.js server REST API
    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin: pin,
          guestName: guestProfile.name,
          guestClass: guestProfile.studentClass,
          guestAvatar: guestProfile.avatar
        })
      });
      const data = await res.json();
      return { ...data, isCloud: false };
    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  /**
   * Mendengarkan sinkronisasi ruangan secara real-time via Firestore
   */
  listenOnlineRoom(pin, callback) {
    if (this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.firestore) {
      try {
        const db = firebase.firestore();
        return db.collection('rooms').doc(pin).onSnapshot((docSnap) => {
          if (docSnap.exists) {
            callback({ exists: true, room: { id: docSnap.id, ...docSnap.data() }, isCloud: true });
          } else {
            callback({ exists: false, room: null, isCloud: true });
          }
        }, (err) => {
          console.warn('Firestore listenOnlineRoom error:', err);
        });
      } catch (e) {
        console.warn('Gagal inisialisasi listener room Firestore:', e);
      }
    }
    return null;
  }

  /**
   * Mengirimkan langkah catur online
   */
  async sendOnlineMove(pin, moveData, isCloud = false) {
    if (isCloud && this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.firestore) {
      try {
        const db = firebase.firestore();
        const payload = {
          fen: moveData.fen,
          turn: moveData.turn,
          lastMove: moveData.lastMove,
          fullMoves: moveData.fullMoves,
          whiteTime: moveData.whiteTime,
          blackTime: moveData.blackTime,
          updatedAt: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
        };

        if (moveData.isGameOver) {
          payload.status = 'finished';
          payload.winner = moveData.winner;
          payload.result = moveData.result;
          payload.resultReason = moveData.resultReason || 'Permainan Selesai';
        }

        await db.collection('rooms').doc(pin).update(payload);
        return { success: true };
      } catch (err) {
        console.warn('Gagal kirim langkah ke Firestore:', err);
      }
    }

    // Fallback: Local Node.js server
    return fetch(`/api/rooms/${pin}/move`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(moveData)
    }).then(r => r.json()).catch(() => ({ success: false }));
  }

  /**
   * Menyerah dalam permainan online
   */
  async resignOnlineRoom(pin, color, isCloud = false) {
    if (isCloud && this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.firestore) {
      try {
        const db = firebase.firestore();
        await db.collection('rooms').doc(pin).update({
          status: 'finished',
          winner: color === 'w' ? 'b' : 'w',
          result: color === 'w' ? '0-1' : '1-0',
          resultReason: `Pemain ${color === 'w' ? 'Putih' : 'Hitam'} menyerah`,
          updatedAt: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
        });
        return { success: true };
      } catch (e) {}
    }

    return fetch(`/api/rooms/${pin}/resign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color })
    }).then(r => r.json()).catch(() => ({ success: false }));
  }

  /**
   * Mengajukan / Memulai tanding ulang
   */
  async rematchOnlineRoom(pin, timeLimit = 600, isCloud = false) {
    if (isCloud && this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.firestore) {
      try {
        const db = firebase.firestore();
        await db.collection('rooms').doc(pin).update({
          status: 'playing',
          turn: 'w',
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          lastMove: null,
          fullMoves: 1,
          whiteTime: timeLimit,
          blackTime: timeLimit,
          winner: null,
          result: null,
          resultReason: null,
          moves: [],
          updatedAt: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
        });
        return { success: true };
      } catch (e) {}
    }

    return fetch(`/api/rooms/${pin}/rematch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: 'w' })
    }).then(r => r.json()).catch(() => ({ success: false }));
  }

  /**
   * Keluar dari ruang online
   */
  async leaveOnlineRoom(pin, color, isCloud = false) {
    if (isCloud && this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.firestore) {
      try {
        const db = firebase.firestore();
        await db.collection('rooms').doc(pin).update({
          status: 'closed',
          updatedAt: firebase.firestore.FieldValue ? firebase.firestore.FieldValue.serverTimestamp() : Date.now()
        });
      } catch (e) {}
    }

    return fetch(`/api/rooms/${pin}/leave`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color })
    }).catch(() => {});
  }

  // ==================== OWNER / ADMIN TOOLS ====================
  _requireOwner() {
    if (!this.isOwner()) throw new Error('Akses ditolak: khusus owner.');
    // Owner tools that modify/read all users via Firestore need a real Firebase Auth session
    // with the owner email. Local/session-only login makes request.auth null in Firestore rules.
    if (this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.auth) {
      const fbUser = firebase.auth().currentUser;
      const fbEmail = String((fbUser && fbUser.email) || '').trim().toLowerCase();
      if (!fbUser || !this.ownerEmails.includes(fbEmail)) {
        throw new Error('Owner tools memerlukan login Firebase aktif sebagai akun owner (peterfernandochristian123@gmail.com). Silakan Keluar lalu masuk lagi dengan akun Google/email owner tersebut, dan pastikan firestore.rules sudah di-deploy ke project Firebase.');
      }
    }
  }

  async ownerListUsers() {
    this._requireOwner();
    if (this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.firestore) {
      try {
        const snap = await firebase.firestore().collection('users').orderBy('rating', 'desc').limit(100).get();
        return snap.docs.map(d => ({ uid: d.id, id: d.id, ...d.data() }));
      } catch (e) {
        console.warn('ownerListUsers firestore error:', e);
      }
    }
    return this.getStudentLeaderboard(true);
  }

  async ownerUpdateUser(userId, patch) {
    this._requireOwner();
    if (!userId) throw new Error('userId diperlukan.');
    const safe = {};
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'name')) safe.name = String(patch.name || '');
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'studentClass')) safe.studentClass = String(patch.studentClass || '');
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'rating')) safe.rating = Math.max(0, Number(patch.rating) || 0);
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'wins')) safe.wins = Math.max(0, Number(patch.wins) || 0);
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'draws')) safe.draws = Math.max(0, Number(patch.draws) || 0);
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'losses')) safe.losses = Math.max(0, Number(patch.losses) || 0);
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'streak')) safe.streak = Math.max(0, Number(patch.streak) || 0);
    if (patch && Object.prototype.hasOwnProperty.call(patch, 'hidden')) safe.hidden = !!patch.hidden;
    safe.updatedAt = (typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue) ? firebase.firestore.FieldValue.serverTimestamp() : Date.now();

    if (this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.firestore) {
      await firebase.firestore().collection('users').doc(userId).set(safe, { merge: true });
    }
    // update local cache if present
    try {
      const raw = this.storageGet(this.storageKeyLeaderboard);
      if (raw) {
        let list = JSON.parse(raw);
        list = list.map(u => (u.id === userId || u.uid === userId) ? { ...u, ...safe } : u);
        this.storageSet(this.storageKeyLeaderboard, JSON.stringify(list));
      }
    } catch (e) {}
    return safe;
  }

  async ownerAdjustElo(userId, delta) {
    this._requireOwner();
    let current = 0;
    if (this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.firestore) {
      try {
        const doc = await firebase.firestore().collection('users').doc(userId).get();
        if (doc.exists) current = this.getRating(doc.data().rating);
      } catch (e) {}
    }
    if (!current) {
      const all = this.getStudentLeaderboard(true);
      const u = all.find(x => x.id === userId || x.uid === userId);
      if (u) current = this.getRating(u.rating);
    }
    const next = Math.max(0, current + (Number(delta) || 0));
    await this.ownerUpdateUser(userId, { rating: next });
    return next;
  }

  async ownerSetUserHidden(userId, hidden) {
    return this.ownerUpdateUser(userId, { hidden: !!hidden });
  }

  async ownerDeleteUser(userId) {
    this._requireOwner();
    if (!userId) throw new Error('userId diperlukan.');
    if (this.isFirebaseReady && typeof firebase !== 'undefined' && firebase.firestore) {
      await firebase.firestore().collection('users').doc(userId).delete();
    }
    try {
      const raw = this.storageGet(this.storageKeyLeaderboard);
      if (raw) {
        let list = JSON.parse(raw).filter(u => !(u.id === userId || u.uid === userId));
        this.storageSet(this.storageKeyLeaderboard, JSON.stringify(list));
      }
    } catch (e) {}
    return true;
  }

}

// Global instance
const schoolDb = new SchoolChessService();

// Standalone functions as requested for direct modular/procedural usage
function listenLeaderboard(callback) {
  return schoolDb.listenLeaderboard(callback);
}

function listenGameHistory(uid, callback) {
  return schoolDb.listenGameHistory(uid, callback);
}

if (typeof window !== 'undefined') {
  window.listenLeaderboard = listenLeaderboard;
  window.listenGameHistory = listenGameHistory;
  window.schoolDb = schoolDb;
}


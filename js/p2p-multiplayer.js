/**
 * Catur Sekolah - P2P WebRTC Remote Multiplayer (PeerJS)
 * Memungkinkan siswa bermain catur jarak jauh dari mana saja lewat internet
 * (Beda WiFi, beda kota, atau pakai kuota HP tanpa perlu server khusus).
 */

class P2PMultiplayerService {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.currentPin = null;
    this.isHost = false;
    this.myColor = 'w';
    this.callbacks = {};
    this.isConnected = false;
    this.peerPrefix = 'catur-sekolah-room-';
  }

  // Register listener events ('start', 'move', 'gameOver', 'rematch', 'opponentLeft', 'error')
  on(event, callback) {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(callback);
  }

  trigger(event, data) {
    if (this.callbacks[event]) {
      this.callbacks[event].forEach(cb => {
        try { cb(data); } catch (e) { console.error('P2P callback error:', e); }
      });
    }
  }

  cleanup() {
    if (this.conn) {
      try { this.conn.close(); } catch (e) {}
      this.conn = null;
    }
    if (this.peer) {
      try { this.peer.destroy(); } catch (e) {}
      this.peer = null;
    }
    this.isConnected = false;
    this.currentPin = null;
    this.isHost = false;
  }

  /**
   * Membuat Ruangan Online Jarak Jauh (Host)
   */
  async createRoom(hostProfile, timeLimit = 600) {
    this.cleanup();
    this.isHost = true;
    this.myColor = 'w';

    return new Promise((resolve, reject) => {
      let pin = Math.floor(1000 + Math.random() * 9000).toString();
      const peerId = `${this.peerPrefix}${pin}`;

      // Config STUN server publik Google gratis
      const peerConfig = {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      };

      try {
        if (typeof Peer === 'undefined') {
          return reject(new Error('Modul WebRTC P2P (PeerJS) belum termuat. Periksa koneksi internet Anda.'));
        }

        this.peer = new Peer(peerId, peerConfig);

        this.peer.on('open', (id) => {
          this.currentPin = pin;
          resolve({
            success: true,
            pin: pin,
            color: 'w',
            timeLimit: timeLimit,
            room: {
              pin: pin,
              host: hostProfile,
              guest: null,
              status: 'waiting',
              timeLimit: timeLimit,
              turn: 'w'
            }
          });
        });

        this.peer.on('connection', (connection) => {
          this.conn = connection;
          this.setupConnectionHandlers(hostProfile, timeLimit);
        });

        this.peer.on('error', (err) => {
          if (err.type === 'unavailable-id') {
            // PIN bentrok, coba PIN baru
            pin = Math.floor(1000 + Math.random() * 9000).toString();
            this.peer.destroy();
            this.createRoom(hostProfile, timeLimit).then(resolve).catch(reject);
          } else {
            reject(new Error(err.type || 'Gagal membuat ruang online P2P'));
          }
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Bergabung ke Ruangan Online Jarak Jauh (Guest)
   */
  async joinRoom(pin, guestProfile) {
    this.cleanup();
    this.isHost = false;
    this.myColor = 'b';
    this.currentPin = pin;

    return new Promise((resolve, reject) => {
      if (typeof Peer === 'undefined') {
        return reject(new Error('Modul WebRTC P2P (PeerJS) belum termuat. Periksa koneksi internet Anda.'));
      }

      const peerConfig = {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      };

      try {
        this.peer = new Peer(peerConfig);

        this.peer.on('open', () => {
          const targetPeerId = `${this.peerPrefix}${pin}`;
          this.conn = this.peer.connect(targetPeerId, { reliable: true });

          const connectTimeout = setTimeout(() => {
            if (!this.isConnected) {
              this.cleanup();
              reject(new Error(`Ruangan PIN ${pin} tidak ditemukan atau Host sedang offline.`));
            }
          }, 12000);

          this.conn.on('open', () => {
            clearTimeout(connectTimeout);
            this.isConnected = true;
            // Kirim perkenalan ke Host
            this.conn.send({
              type: 'guest_join',
              guest: guestProfile
            });
          });

          this.conn.on('data', (data) => {
            if (data.type === 'room_ready') {
              resolve({
                success: true,
                pin: pin,
                color: 'b',
                timeLimit: data.timeLimit || 600,
                room: data.room
              });
              this.trigger('start', { room: data.room });
            } else {
              this.handleIncomingData(data);
            }
          });

          this.conn.on('close', () => {
            this.trigger('opponentLeft', {});
          });

          this.conn.on('error', (err) => {
            clearTimeout(connectTimeout);
            reject(new Error('Koneksi ke lawan terputus: ' + err.message));
          });
        });

        this.peer.on('error', (err) => {
          reject(new Error('Gagal menghubungkan ke jaringan P2P: ' + err.message));
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  setupConnectionHandlers(hostProfile, timeLimit) {
    this.conn.on('open', () => {
      this.isConnected = true;
    });

    this.conn.on('data', (data) => {
      if (data.type === 'guest_join') {
        const roomData = {
          pin: this.currentPin,
          host: hostProfile,
          guest: data.guest,
          status: 'playing',
          timeLimit: timeLimit,
          turn: 'w'
        };

        // Kirim konfirmasi balik ke Guest
        this.conn.send({
          type: 'room_ready',
          timeLimit: timeLimit,
          room: roomData
        });

        // Trigger start di Host
        this.trigger('start', { room: roomData });
      } else {
        this.handleIncomingData(data);
      }
    });

    this.conn.on('close', () => {
      this.trigger('opponentLeft', {});
    });

    this.conn.on('error', () => {
      this.trigger('opponentLeft', {});
    });
  }

  handleIncomingData(data) {
    switch (data.type) {
      case 'move':
        this.trigger('move', { moveEntry: data.moveEntry, room: data.room });
        break;
      case 'resign':
        this.trigger('gameOver', {
          winner: data.color === 'w' ? 'b' : 'w',
          resultReason: `Pemain ${data.color === 'w' ? 'Putih' : 'Hitam'} menyerah.`
        });
        break;
      case 'game_over':
        this.trigger('gameOver', data);
        break;
      case 'rematch':
        this.trigger('rematch', { room: data.room });
        break;
      case 'player_left':
        this.trigger('opponentLeft', {});
        break;
    }
  }

  sendMove(moveEntry, roomState) {
    if (this.conn && this.conn.open) {
      this.conn.send({
        type: 'move',
        moveEntry,
        room: roomState
      });
      return true;
    }
    return false;
  }

  sendResign(color) {
    if (this.conn && this.conn.open) {
      this.conn.send({
        type: 'resign',
        color
      });
    }
  }

  sendRematch(timeLimit) {
    if (this.conn && this.conn.open) {
      this.conn.send({
        type: 'rematch',
        timeLimit
      });
    }
  }

  leaveRoom() {
    if (this.conn && this.conn.open) {
      this.conn.send({ type: 'player_left' });
    }
    this.cleanup();
  }
}

// Global instance
window.p2pChess = new P2PMultiplayerService();

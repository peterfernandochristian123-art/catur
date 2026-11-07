import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase-config";

/**
 * Catur Sekolah - Firebase Firestore Cloud Multiplayer (Global Internet Online)
 * Memungkinkan siswa bermain catur bersama dari perangkat apa pun lewat internet publik.
 */

/**
 * Membuat ruangan catur online di Cloud Firestore
 * @param {Object} hostProfile - Data profil pembuat ruang (id, name, studentClass, rating, avatar)
 * @param {number} timeLimit - Batas waktu catur dalam detik (misal: 600)
 */
export async function createCloudRoom(hostProfile, timeLimit = 600) {
  const pin = Math.floor(1000 + Math.random() * 9000).toString();
  const roomRef = doc(db, "rooms", pin);

  const roomData = {
    pin,
    status: "waiting", // "waiting", "playing", "finished", "closed"
    host: {
      uid: hostProfile.id || hostProfile.uid,
      name: hostProfile.name || "Pemain 1",
      studentClass: hostProfile.studentClass || "Umum",
      avatar: hostProfile.avatar || "♚",
      rating: hostProfile.rating || 1200
    },
    guest: null,
    turn: "w",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    lastMove: null,
    fullMoves: 1,
    timeLimit: timeLimit,
    whiteTime: timeLimit,
    blackTime: timeLimit,
    winner: null,
    result: null,
    resultReason: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(roomRef, roomData);
  return { success: true, pin, room: roomData };
}

/**
 * Bergabung ke ruangan catur online dengan 4 digit PIN
 * @param {string} pin - 4 Digit PIN ruang
 * @param {Object} guestProfile - Data profil pemain yang bergabung
 */
export async function joinCloudRoom(pin, guestProfile) {
  const roomRef = doc(db, "rooms", pin);
  const snap = await getDoc(roomRef);

  if (!snap.exists()) {
    return { success: false, message: `Ruangan dengan PIN ${pin} tidak ditemukan!` };
  }

  const room = snap.data();
  if (room.status !== "waiting" && room.guest) {
    return { success: false, message: `Ruangan PIN ${pin} sudah penuh!` };
  }

  const guestData = {
    uid: guestProfile.id || guestProfile.uid,
    name: guestProfile.name || "Pemain 2",
    studentClass: guestProfile.studentClass || "Umum",
    avatar: guestProfile.avatar || "♚",
    rating: guestProfile.rating || 1200
  };

  await updateDoc(roomRef, {
    guest: guestData,
    status: "playing",
    updatedAt: serverTimestamp()
  });

  return {
    success: true,
    pin,
    room: { ...room, guest: guestData, status: "playing" }
  };
}

/**
 * Mendengarkan sinkronisasi ruangan secara real-time
 * @param {string} pin - 4 digit PIN ruangan
 * @param {Function} callback - Callback menerima data ruangan terkini
 * @returns {Function} Unsubscribe listener
 */
export function listenCloudRoom(pin, callback) {
  const roomRef = doc(db, "rooms", pin);
  return onSnapshot(roomRef, (snapshot) => {
    if (snapshot.exists()) {
      callback({ exists: true, room: { id: snapshot.id, ...snapshot.data() } });
    } else {
      callback({ exists: false, room: null });
    }
  }, (err) => {
    console.warn("Firestore listenCloudRoom error:", err);
  });
}

/**
 * Mengirimkan langkah catur ke Cloud Firestore
 * @param {string} pin - PIN ruangan
 * @param {Object} moveData - Data langkah (fen, turn, lastMove, fullMoves, whiteTime, blackTime, isGameOver, winner, result)
 */
export async function sendCloudMove(pin, moveData) {
  const roomRef = doc(db, "rooms", pin);
  const updatePayload = {
    fen: moveData.fen,
    turn: moveData.turn,
    lastMove: moveData.lastMove,
    fullMoves: moveData.fullMoves,
    whiteTime: moveData.whiteTime,
    blackTime: moveData.blackTime,
    updatedAt: serverTimestamp()
  };

  if (moveData.isGameOver) {
    updatePayload.status = "finished";
    updatePayload.winner = moveData.winner;
    updatePayload.result = moveData.result;
    updatePayload.resultReason = moveData.resultReason || "Permainan Selesai";
  }

  await updateDoc(roomRef, updatePayload);
}

/**
 * Menyerah dalam permainan online
 * @param {string} pin - PIN ruangan
 * @param {string} color - 'w' (Putih) atau 'b' (Hitam)
 */
export async function resignCloudGame(pin, color) {
  const roomRef = doc(db, "rooms", pin);
  await updateDoc(roomRef, {
    status: "finished",
    winner: color === "w" ? "b" : "w",
    result: color === "w" ? "0-1" : "1-0",
    resultReason: `Pemain ${color === "w" ? "Putih" : "Hitam"} menyerah`,
    updatedAt: serverTimestamp()
  });
}

/**
 * Mengajukan atau memulai tanding ulang (rematch)
 * @param {string} pin - PIN ruangan
 * @param {number} timeLimit - Batas waktu
 */
export async function rematchCloudGame(pin, timeLimit = 600) {
  const roomRef = doc(db, "rooms", pin);
  await updateDoc(roomRef, {
    status: "playing",
    turn: "w",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    lastMove: null,
    fullMoves: 1,
    whiteTime: timeLimit,
    blackTime: timeLimit,
    winner: null,
    result: null,
    resultReason: null,
    updatedAt: serverTimestamp()
  });
}

/**
 * Meninggalkan ruangan catur
 * @param {string} pin - PIN ruangan
 */
export async function leaveCloudRoom(pin) {
  const roomRef = doc(db, "rooms", pin);
  try {
    await updateDoc(roomRef, {
      status: "closed",
      updatedAt: serverTimestamp()
    });
  } catch (e) {}
}

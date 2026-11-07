import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot
} from "firebase/firestore";

import { db } from "../firebase-config";

/**
 * Mendengarkan riwayat 30 pertandingan terakhir pemain secara real-time dari Firestore
 * Koleksi: 'games', filter: 'players' berisi uid, diurutkan berdasarkan 'createdAt' terbaru.
 *
 * @param {string} uid - ID unik pemain yang dicari
 * @param {Function} callback - Menerima array objek game yang diperbarui
 * @returns {Function} Unsubscribe function untuk menghentikan listener
 */
export function listenGameHistory(uid, callback) {
  const q = query(
    collection(db, "games"),
    where("players", "array-contains", uid),
    orderBy("createdAt", "desc"),
    limit(30)
  );

  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
    );
  });
}

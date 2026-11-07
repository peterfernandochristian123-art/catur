import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot
} from "firebase/firestore";

import { db } from "../firebase-config";

/**
 * Mendengarkan perubahan data peringkat 50 pemain teratas secara real-time dari Firestore
 * Koleksi: 'users', diurutkan berdasarkan 'rating' secara menurun (descending).
 *
 * @param {Function} callback - Menerima array objek pemain terurut dengan rank 1 s/d 50
 * @returns {Function} Unsubscribe function untuk menghentikan listener
 */
export function listenLeaderboard(callback) {
  const q = query(
    collection(db, "users"),
    orderBy("rating", "desc"),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const players = snapshot.docs.map((doc, index) => ({
      uid: doc.id,
      rank: index + 1,
      ...doc.data()
    }));

    callback(players);
  });
}

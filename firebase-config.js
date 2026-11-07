/**
 * Firebase Modular SDK Setup (v9+)
 * Proyek Firebase: catur-a1dad
 */
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Konfigurasi resmi Firebase Catur Sekolah (Project: catur-a1dad)
export const firebaseConfig = {
  projectId: "catur-a1dad",
  appId: "1:749062464507:web:059cdfa5fa241c8411e15e",
  storageBucket: "catur-a1dad.firebasestorage.app",
  apiKey: "AIzaSyAdBfdUvrW19O6ZrOs2hYYI9R0tqZ5JS24",
  authDomain: "catur-a1dad.firebaseapp.com",
  messagingSenderId: "749062464507",
  measurementId: "G-B447KQDG16"
};

// Inisialisasi Firebase App secara singleton
export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Inisialisasi Cloud Firestore Database
export const db = getFirestore(app);

// Inisialisasi Firebase Authentication
export const auth = getAuth(app);

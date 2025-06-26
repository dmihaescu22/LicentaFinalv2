// config/firebase.js
import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyDLvBisrOT3N129y5ynqv9_oSF927y7fIQ',
  authDomain: 'hikelinkapp.firebaseapp.com',
  projectId: 'hikelinkapp',
  storageBucket: 'hikelinkapp.appspot.com',
  messagingSenderId: '1092280000000',
  appId: '1:1092280000000:web:0000000000000000000000',
  measurementId: 'G-0000000000'
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage)
});

// Initialize Firestore
const db = getFirestore(app);

// Initialize Storage
const storage = getStorage(app);

export { app, auth, db, storage };

// Adăugare pentru rezolvarea warning-ului legat de New Architecture în Expo
// Se va seta manual newArchEnabled în app.json conform documentației Expo.

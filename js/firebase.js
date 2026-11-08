import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, setPersistence, browserLocalPersistence } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-storage.js';

const firebaseConfig = {
  apiKey: 'AIzaSyACJnX63Y8aOCzIKFCA6FkWi2a167Kwp8o',
  authDomain: 'nexus-ai-5996c.firebaseapp.com',
  projectId: 'nexus-ai-5996c',
  storageBucket: 'nexus-ai-5996c.firebasestorage.app',
  messagingSenderId: '116158813081',
  appId: '1:116158813081:web:678d202f164226697c7908',
  measurementId: 'G-M958NSV0SG'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const authReady = setPersistence(auth, browserLocalPersistence);
export const db = getFirestore(app);
export const storage = getStorage(app);
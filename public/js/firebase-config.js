import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBySLV4poaJoEotkUmNyU4j8MB8NouxbR4",
  authDomain: "speakora-fce68.firebaseapp.com",
  projectId: "speakora-fce68",
  storageBucket: "speakora-fce68.firebasestorage.app",
  messagingSenderId: "852414873503",
  appId: "1:852414873503:web:116f9929f31c087e3247aa",
  measurementId: "G-B7R87R49Q4"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

import {
  signInWithPopup,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

import {
  auth,
  db,
  googleProvider
} from "./firebase-config.js";

export async function loginWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function getUserProfile(user) {
  if (!user) return null;

  const ref = doc(db, "users", user.uid);
  const snapshot = await getDoc(ref);

  return snapshot.exists() ? snapshot.data() : null;
}

export async function saveDisplayName(user, displayName) {
  const name = displayName.trim();

  if (!name) {
    throw new Error("يرجى إدخال اسم العرض للمتابعة.");
  }

  if (name.length < 2) {
    throw new Error("يرجى إدخال اسم عرض صحيح.");
  }

  if (name.length > 50) {
    throw new Error("اسم العرض يجب ألا يتجاوز 50 حرفًا.");
  }

  const ref = doc(db, "users", user.uid);

  await setDoc(ref, {
    uid: user.uid,
    displayName: name,
    email: user.email || "",
    photoURL: user.photoURL || "",
    updatedAt: serverTimestamp()
  }, { merge: true });

  return name;
}

export { auth, onAuthStateChanged, signOut };

window.speakOraLogout = async function () {
  try {
    await signOut(auth);
    window.location.reload();
  } catch (error) {
    console.error("Logout failed:", error);
    alert("تعذر تسجيل الخروج، حاول مرة أخرى.");
  }
};

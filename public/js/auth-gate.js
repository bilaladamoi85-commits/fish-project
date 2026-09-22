import {
  auth,
  getUserProfile,
  onAuthStateChanged
} from "./auth.js";

function waitForAuth() {
  return new Promise((resolve) => {
    if (auth.currentUser) {
      resolve(auth.currentUser);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

export async function requireSpeakOraAuth() {
  const user = await waitForAuth();

  if (!user) {
    window.location.href =
      "/login.html?return=" +
      encodeURIComponent(
        window.location.pathname + window.location.search
      );

    return false;
  }

  try {
    const profile = await getUserProfile(user);

    if (!profile || !profile.displayName) {
      window.location.href =
        "/display-name.html?return=" +
        encodeURIComponent(
          window.location.pathname + window.location.search
        );

      return false;
    }

    return true;
  } catch (error) {
    console.error("SpeakOra auth check failed:", error);
    alert("تعذر التحقق من الحساب. يرجى المحاولة مرة أخرى.");
    return false;
  }
}

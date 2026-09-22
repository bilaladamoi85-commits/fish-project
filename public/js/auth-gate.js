import {
  auth,
  getUserProfile,
  loginWithGoogle,
  saveDisplayName,
  onAuthStateChanged
} from "./auth.js";

let authReady = false;
let currentUser = null;

let modal = null;
let modalBody = null;

let authPromiseResolve = null;
let authPromiseReject = null;

const STYLE_ID = "speakora-auth-gate-styles";

function waitForAuth() {
  if (authReady) {
    return Promise.resolve(currentUser);
  }

  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      currentUser = user;
      authReady = true;
      unsubscribe();
      resolve(user);
    });
  });
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;

  const style = document.createElement("style");
  style.id = STYLE_ID;

  style.textContent = `
    .speakora-auth-overlay {
      position: fixed;
      inset: 0;
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(7, 10, 18, 0.72);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }

    .speakora-auth-card {
      width: min(430px, 100%);
      max-height: calc(100vh - 40px);
      overflow: auto;
      border-radius: 24px;
      background: #ffffff;
      box-shadow:
        0 30px 80px rgba(0, 0, 0, 0.28),
        0 8px 30px rgba(0, 0, 0, 0.12);
      padding: 34px 28px 28px;
      color: #111827;
      font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      animation: speakoraAuthIn 0.2s ease-out;
    }

    @keyframes speakoraAuthIn {
      from {
        opacity: 0;
        transform: translateY(12px) scale(0.98);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    .speakora-auth-logo {
      width: 54px;
      height: 54px;
      margin: 0 auto 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 16px;
      background: #111827;
      color: #ffffff;
      font-size: 25px;
      font-weight: 800;
      letter-spacing: -1px;
    }

    .speakora-auth-title {
      margin: 0;
      text-align: center;
      font-size: 25px;
      line-height: 1.2;
      font-weight: 750;
      letter-spacing: -0.5px;
    }

    .speakora-auth-subtitle {
      margin: 11px auto 0;
      max-width: 350px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      line-height: 1.65;
    }

    .speakora-auth-content {
      margin-top: 26px;
    }

    .speakora-google-btn,
    .speakora-continue-btn {
      width: 100%;
      min-height: 52px;
      border: 0;
      border-radius: 13px;
      cursor: pointer;
      font-size: 15px;
      font-weight: 650;
      transition:
        transform 0.15s ease,
        box-shadow 0.15s ease,
        opacity 0.15s ease;
    }

    .speakora-google-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 11px;
      background: #ffffff;
      color: #111827;
      border: 1px solid #d1d5db;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
    }

    .speakora-google-btn:hover {
      box-shadow: 0 5px 16px rgba(0, 0, 0, 0.09);
      transform: translateY(-1px);
    }

    .speakora-google-btn:disabled,
    .speakora-continue-btn:disabled {
      cursor: not-allowed;
      opacity: 0.6;
      transform: none;
    }

    .speakora-google-icon {
      width: 20px;
      height: 20px;
      flex: 0 0 auto;
    }

    .speakora-name-label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 650;
      color: #374151;
    }

    .speakora-name-input {
      width: 100%;
      box-sizing: border-box;
      min-height: 52px;
      padding: 0 15px;
      border: 1px solid #d1d5db;
      border-radius: 13px;
      outline: none;
      font-size: 16px;
      color: #111827;
      background: #ffffff;
      transition:
        border-color 0.15s ease,
        box-shadow 0.15s ease;
    }

    .speakora-name-input:focus {
      border-color: #111827;
      box-shadow: 0 0 0 3px rgba(17, 24, 39, 0.08);
    }

    .speakora-continue-btn {
      margin-top: 15px;
      background: #111827;
      color: #ffffff;
    }

    .speakora-continue-btn:hover:not(:disabled) {
      background: #1f2937;
      transform: translateY(-1px);
      box-shadow: 0 7px 18px rgba(17, 24, 39, 0.2);
    }

    .speakora-auth-error {
      display: none;
      margin-top: 14px;
      padding: 11px 13px;
      border-radius: 11px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      color: #b91c1c;
      font-size: 13px;
      line-height: 1.55;
      text-align: right;
    }

    .speakora-auth-error.show {
      display: block;
    }

    .speakora-auth-loading {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }

    .speakora-auth-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: speakoraSpin 0.7s linear infinite;
    }

    .speakora-google-spinner {
      border-color: rgba(17, 24, 39, 0.2);
      border-top-color: #111827;
    }

    @keyframes speakoraSpin {
      to {
        transform: rotate(360deg);
      }
    }

    .speakora-auth-note {
      margin-top: 15px;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
      line-height: 1.5;
    }

    @media (max-width: 480px) {
      .speakora-auth-overlay {
        padding: 12px;
      }

      .speakora-auth-card {
        padding: 28px 20px 22px;
        border-radius: 21px;
      }

      .speakora-auth-title {
        font-size: 23px;
      }
    }
  `;

  document.head.appendChild(style);
}

function createModal() {
  injectStyles();

  if (modal) return;

  modal = document.createElement("div");
  modal.className = "speakora-auth-overlay";

  modal.innerHTML = `
    <div class="speakora-auth-card" role="dialog" aria-modal="true">
      <div class="speakora-auth-logo">S</div>

      <h2 class="speakora-auth-title">سجّل دخولك إلى SpeakOra</h2>

      <div class="speakora-auth-subtitle">
        سجّل دخولك بحساب Google للمتابعة وإنشاء الأصوات.
      </div>

      <div class="speakora-auth-content" id="speakoraAuthContent"></div>
    </div>
  `;

  document.body.appendChild(modal);

  modalBody = modal.querySelector("#speakoraAuthContent");
}

function showError(message) {
  const error = modal?.querySelector("#speakoraAuthError");

  if (!error) return;

  error.textContent = message;
  error.classList.add("show");
}

function clearError() {
  const error = modal?.querySelector("#speakoraAuthError");

  if (!error) return;

  error.textContent = "";
  error.classList.remove("show");
}

function friendlyFirebaseError(error) {
  const code = error?.code || "";

  console.error("Speakora Firebase error:", error);

  if (code === "permission-denied" || code === "firestore/permission-denied") {
    return "ليس لديك صلاحية لحفظ اسم العرض. تحقق من إعدادات Firestore.";
  }

  if (code === "auth/popup-blocked") {
    return "المتصفح منع نافذة Google. اسمح بالنوافذ المنبثقة ثم حاول مرة أخرى.";
  }

  if (code === "auth/popup-closed-by-user") {
    return "تم إغلاق نافذة Google قبل اكتمال تسجيل الدخول.";
  }

  if (code === "auth/unauthorized-domain") {
    return "هذا الموقع غير مضاف إلى Authorized domains في Firebase.";
  }

  if (code === "auth/network-request-failed") {
    return "تعذر الاتصال بخدمة Google. تحقق من اتصال الإنترنت وحاول مرة أخرى.";
  }

  if (code === "auth/api-key-not-valid") {
    return "مفتاح Firebase API غير صالح. تحقق من إعدادات Firebase.";
  }

  if (code === "failed-precondition") {
    return "Firestore غير مهيأ بشكل صحيح. تحقق من إعدادات قاعدة البيانات.";
  }

  if (code === "unavailable") {
    return "خدمة Firestore غير متاحة مؤقتًا. حاول مرة أخرى.";
  }

  if (error?.message) {
    return `تعذر إكمال العملية: ${error.message}`;
  }

  return "تعذر إكمال العملية. حاول مرة أخرى.";
}

function showLoginView() {
  modalBody.innerHTML = `
    <button class="speakora-google-btn" id="speakoraGoogleBtn" type="button">
      <svg class="speakora-google-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M21.35 12.27c0-.71-.06-1.39-.18-2.04H12v3.86h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.21z"
        />
        <path
          fill="#34A853"
          d="M12 21.75c2.63 0 4.84-.87 6.45-2.35l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.29v2.53A9.75 9.75 0 0 0 12 21.75z"
        />
        <path
          fill="#FBBC05"
          d="M6.53 13.84A5.86 5.86 0 0 1 6.22 12c0-.64.11-1.27.31-1.84V7.63H3.29A9.74 9.74 0 0 0 2.25 12c0 1.57.38 3.05 1.04 4.37l3.24-2.53z"
        />
        <path
          fill="#EA4335"
          d="M12 6.13c1.43 0 2.72.49 3.73 1.45l2.79-2.79C16.84 3.13 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.71 5.38l3.24 2.53C7.3 7.85 9.46 6.13 12 6.13z"
        />
      </svg>

      <span>المتابعة باستخدام Google</span>
    </button>

    <div class="speakora-auth-error" id="speakoraAuthError"></div>

    <div class="speakora-auth-note">
      تسجيل الدخول آمن بواسطة Google وFirebase.
    </div>
  `;

  const button = modalBody.querySelector("#speakoraGoogleBtn");

  button.addEventListener("click", async () => {
    clearError();

    button.disabled = true;

    button.innerHTML = `
      <span class="speakora-auth-loading">
        <span class="speakora-auth-spinner speakora-google-spinner"></span>
        جاري تسجيل الدخول...
      </span>
    `;

    try {
      const user = await loginWithGoogle();

      currentUser = user;

      const profile = await getUserProfile(user);

      if (profile?.displayName) {
        closeModal(true);
        return;
      }

      showDisplayNameView(user);
    } catch (error) {
      showError(friendlyFirebaseError(error));

      button.disabled = false;

      button.innerHTML = `
        <svg class="speakora-google-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M21.35 12.27c0-.71-.06-1.39-.18-2.04H12v3.86h5.24a4.48 4.48 0 0 1-1.94 2.94v2.45h3.14c1.84-1.7 2.91-4.2 2.91-7.21z"/>
          <path fill="#34A853" d="M12 21.75c2.63 0 4.84-.87 6.45-2.35l-3.14-2.45c-.87.58-1.98.92-3.31.92-2.54 0-4.7-1.72-5.47-4.03H3.29v2.53A9.75 9.75 0 0 0 12 21.75z"/>
          <path fill="#FBBC05" d="M6.53 13.84A5.86 5.86 0 0 1 6.22 12c0-.64.11-1.27.31-1.84V7.63H3.29A9.74 9.74 0 0 0 2.25 12c0 1.57.38 3.05 1.04 4.37l3.24-2.53z"/>
          <path fill="#EA4335" d="M12 6.13c1.43 0 2.72.49 3.73 1.45l2.79-2.79C16.84 3.13 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.71 5.38l3.24 2.53C7.3 7.85 9.46 6.13 12 6.13z"/>
        </svg>
        <span>المتابعة باستخدام Google</span>
      `;
    }
  });
}

function showDisplayNameView(user) {
  modalBody.innerHTML = `
    <div>
      <label class="speakora-name-label" for="speakoraDisplayName">
        اسم العرض
      </label>

      <input
        class="speakora-name-input"
        id="speakoraDisplayName"
        type="text"
        maxlength="50"
        autocomplete="name"
        placeholder="مثال: Adam"
      />

      <button class="speakora-continue-btn" id="speakoraSaveNameBtn" type="button">
        متابعة
      </button>

      <div class="speakora-auth-error" id="speakoraAuthError"></div>

      <div class="speakora-auth-note">
        اسم العرض مطلوب لإكمال استخدام SpeakOra.
      </div>
    </div>
  `;

  const input = modalBody.querySelector("#speakoraDisplayName");
  const button = modalBody.querySelector("#speakoraSaveNameBtn");

  input.focus();

  const submitName = async () => {
    clearError();

    const name = input.value.trim();

    if (!name) {
      showError("يرجى إدخال اسم العرض للمتابعة.");
      input.focus();
      return;
    }

    if (name.length < 2) {
      showError("يرجى إدخال اسم عرض صحيح.");
      input.focus();
      return;
    }

    if (name.length > 50) {
      showError("اسم العرض يجب ألا يتجاوز 50 حرفًا.");
      input.focus();
      return;
    }

    button.disabled = true;

    button.innerHTML = `
      <span class="speakora-auth-loading">
        <span class="speakora-auth-spinner"></span>
        جاري الحفظ...
      </span>
    `;

    try {
      if (!user) {
        throw new Error("لم يتم العثور على حساب Google.");
      }

      await saveDisplayName(user, name);

      closeModal(true);
    } catch (error) {
      console.error("Speakora display name save error:", error);

      showError(friendlyFirebaseError(error));

      button.disabled = false;
      button.textContent = "متابعة";
    }
  };

  button.addEventListener("click", submitName);

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      submitName();
    }
  });
}

function closeModal(success = false) {
  if (modal) {
    modal.remove();
    modal = null;
    modalBody = null;
  }

  if (success) {
    if (authPromiseResolve) {
      authPromiseResolve(true);
      authPromiseResolve = null;
      authPromiseReject = null;
    }
  } else {
    if (authPromiseResolve) {
      authPromiseResolve(false);
      authPromiseResolve = null;
      authPromiseReject = null;
    }
  }
}

async function openModal(user = null) {
  createModal();

  if (user) {
    currentUser = user;
    showDisplayNameView(user);
  } else {
    showLoginView();
  }
}

export async function requireSpeakOraAuth() {
  await waitForAuth();

  if (currentUser) {
    try {
      const profile = await getUserProfile(currentUser);

      if (profile?.displayName) {
        return true;
      }

      return new Promise(async (resolve, reject) => {
        authPromiseResolve = resolve;
        authPromiseReject = reject;

        await openModal(currentUser);
      });
    } catch (error) {
      console.error("Speakora profile check error:", error);

      return new Promise(async (resolve, reject) => {
        authPromiseResolve = resolve;
        authPromiseReject = reject;

        await openModal(currentUser);
      });
    }
  }

  return new Promise(async (resolve, reject) => {
    authPromiseResolve = resolve;
    authPromiseReject = reject;

    await openModal();
  });
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  authReady = true;
});

window.requireSpeakOraAuth = requireSpeakOraAuth;

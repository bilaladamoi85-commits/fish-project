const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'public', 'app.js');

if (!fs.existsSync(appJsPath)) {
  console.error("❌ ملف public/app.js غير موجود");
  process.exit(1);
}

let code = fs.readFileSync(appJsPath, 'utf8');

// 1. مسح أي استدعاء للحفظ داخل الأحداث العامة للبطاقة (Card Click)
code = code.replace(/saveRecentVoice\([^)]*\)/g, '/* disabled auto save */ null');
code = code.replace(/addToRecent\([^)]*\)/g, '/* disabled auto save */ null');

// 2. إصلاح دالة الضغط على زر الحفظ المستقل ومنع انتشار الحدث للبطاقة (stopPropagation)
const manualSaveLogic = `

/* --- STRICT SEPARATED SAVE BUTTON --- */
window.saveVoiceManualOnly = function(event, voiceId, voiceName, lang, audio) {
  if (event) {
    event.stopPropagation(); // منع الانتقال لصفحة الشخصية أو اختيارها
    event.preventDefault();
  }

  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem('user_saved_voices') || '[]');
  } catch(e) {
    saved = [];
  }

  const index = saved.findIndex(item => (item.id && item.id === voiceId) || item.name === voiceName);

  if (index > -1) {
    saved.splice(index, 1);
    alert('تمت إزالة "' + voiceName + '" من قائمة المحفوظات');
  } else {
    saved.unshift({
      id: voiceId || voiceName,
      name: voiceName,
      lang: lang || 'ar',
      audio: audio || '',
      savedAt: new Date().toISOString()
    });
    alert('تم حفظ "' + voiceName + '" في المحفوظات!');
  }

  localStorage.setItem('user_saved_voices', JSON.stringify(saved));
  localStorage.setItem('recentVoices', JSON.stringify(saved));

  if (typeof window.loadRecentVoices === 'function') {
    window.loadRecentVoices();
  } else if (typeof window.renderRecentVoices === 'function') {
    window.renderRecentVoices();
  }
};
`;

fs.writeFileSync(appJsPath, code + manualSaveLogic);
console.log("✅ تم فصل ضغطة الشخصية عن زر الحفظ بنجاح تام!");

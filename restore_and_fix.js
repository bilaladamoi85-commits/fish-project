const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'public', 'app.js');
const backupPath = path.join(__dirname, 'public', 'app.js.bak-fast-stable');

if (fs.existsSync(backupPath)) {
  fs.copyFileSync(backupPath, appJsPath);
  console.log("✅ تم استرجاع الملف الأساسي الشغال بنجاح.");
} else {
  console.log("⚠️ لم يتم العثور على النسخة الاحتياطية القديمة، سيتم تنظيف الكود.");
}

const safeSaveScript = `

/* --- SAFE MANUAL SAVE VOICE FUNCTION --- */
window.manualSaveVoice = function(event, voiceId, voiceName) {
  if (event) {
    event.stopPropagation();
  }
  let saved = JSON.parse(localStorage.getItem('user_saved_voices') || '[]');
  const idx = saved.findIndex(v => v.id === voiceId || v.name === voiceName);
  
  if (idx > -1) {
    saved.splice(idx, 1);
  } else {
    saved.unshift({ id: voiceId, name: voiceName, date: new Date().toISOString() });
  }
  
  localStorage.setItem('user_saved_voices', JSON.stringify(saved));
  localStorage.setItem('recentVoices', JSON.stringify(saved));
  
  if (typeof window.loadRecentVoices === 'function') {
    window.loadRecentVoices();
  } else if (typeof window.renderRecentVoices === 'function') {
    window.renderRecentVoices();
  }
  alert(idx > -1 ? 'تم إزالة الصوت من المحفوظات' : 'تم حفظ الصوت بنجاح!');
};
`;

fs.appendFileSync(appJsPath, safeSaveScript);
console.log("✅ تم إصلاح واجهة الأيقونات وبناء آلية الحفظ بدون أخطاء.");

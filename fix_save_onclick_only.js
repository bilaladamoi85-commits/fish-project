const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'public', 'app.js');
const backupPath = path.join(__dirname, 'public', 'app.js.bak-fast-stable');

// 1. استرجاع النسخة الأصلية المستقرة
if (fs.existsSync(backupPath)) {
  fs.copyFileSync(backupPath, appJsPath);
  console.log("✅ تم استرجاع النسخة الأصلية المستقرة.");
}

let content = fs.readFileSync(appJsPath, 'utf8');

// 2. إيقاف الاستدعاء التلقائي للحفظ داخل دوال الاستماع والتشغيل
content = content.replace(/saveRecentVoice\(([^)]+)\);?/g, '// auto save disabled');
content = content.replace(/addToRecent\(([^)]+)\);?/g, '// auto save disabled');
content = content.replace(/saveRecent\(([^)]+)\);?/g, '// auto save disabled');

// 3. إضافة دالة الحفظ اليدوي المستقلة عند الضغط على زر الحفظ
const manualSaveCode = `

/* --- MANUAL SAVE VOICE ONLY --- */
window.saveVoiceManual = function(event, voiceId, voiceName, langCode, audioUrl) {
  if (event) {
    event.stopPropagation();
    event.preventDefault();
  }
  
  let saved = JSON.parse(localStorage.getItem('user_saved_voices') || '[]');
  const index = saved.findIndex(v => v.id === voiceId || v.name === voiceName);
  
  if (index > -1) {
    saved.splice(index, 1);
    alert('تمت إزالة الصوت من المحفوظات');
  } else {
    saved.unshift({
      id: voiceId || voiceName,
      name: voiceName,
      lang: langCode || 'ar',
      audio: audioUrl || '',
      date: new Date().toISOString()
    });
    alert('تم حفظ الصوت في قائمة المحفوظات بنجاح!');
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

fs.writeFileSync(appJsPath, content + manualSaveCode);
console.log("✅ تم إلغاء الحفظ التلقائي بنجاح! الآن الحفظ يتم بضغط زر الحفظ فقط.");

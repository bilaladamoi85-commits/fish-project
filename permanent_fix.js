const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'public', 'app.js');
const backupPath = path.join(__dirname, 'public', 'app.js.bak-fast-stable');

// 1. استرجاع النسخة الأساسية
if (fs.existsSync(backupPath)) {
  fs.copyFileSync(backupPath, appJsPath);
}

let code = fs.readFileSync(appJsPath, 'utf8');

// 2. إزالة وتعطيل جميع دوال الحفظ التلقائي من الكود تماماً
code = code.replace(/function saveRecentVoices?[^}]*}/g, 'function saveRecentVoice() { return; }');
code = code.replace(/function addToRecent[^}]*}/g, 'function addToRecent() { return; }');
code = code.replace(/saveRecentVoice\s*\([^)]*\);?/g, '');
code = code.replace(/addToRecent\s*\([^)]*\);?/g, '');
code = code.replace(/saveRecent\s*\([^)]*\);?/g, '');

// 3. منع التخزين المحلي التلقائي لأي صوت عند التشغيل
code = code.replace(/localStorage\.setItem\s*\(\s*['"]recentVoices['"][^;]*;/g, '// Auto save to localStorage removed');

// 4. كتابة دالة حفظ يدوية تعمل فقط عند الضغط المباشر على زر الحفظ
const manualOnlyScript = `

/* --- STRICT MANUAL SAVE ONLY --- */
window.saveVoiceManual = function(e, id, name, lang, audio) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }

  let saved = [];
  try {
    saved = JSON.parse(localStorage.getItem('user_saved_voices') || '[]');
  } catch(err) {
    saved = [];
  }

  const index = saved.findIndex(item => item.id === id || item.name === name);

  if (index > -1) {
    saved.splice(index, 1);
    alert('تمت إزالة "' + name + '" من قائمة المحفوظات');
  } else {
    saved.unshift({
      id: id || name,
      name: name,
      lang: lang || 'ar',
      audio: audio || '',
      date: new Date().toISOString()
    });
    alert('تم حفظ "' + name + '" في قائمة المحفوظات بنجاح!');
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

fs.writeFileSync(appJsPath, code + manualOnlyScript);
console.log("✅ تم حل المشكلة نهائياً! الحفظ التلقائي ملغى تماماً ولا يتم التخزين إلا بالضغط على زر الحفظ اليدوي.");

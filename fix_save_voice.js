const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'public', 'app.js');
const cssPath = path.join(__dirname, 'public', 'styles.css');

if (!fs.existsSync(appJsPath)) {
  console.error("❌ لم يتم العثور على ملف public/app.js");
  process.exit(1);
}

let appJsContent = fs.readFileSync(appJsPath, 'utf8');

// 1. إيقاف وتعطيل الحفظ التلقائي عند الضغط على الصوت للاستماع
appJsContent = appJsContent.replace(/saveRecentVoice\(([^)]+)\);?/g, '// auto save disabled');
appJsContent = appJsContent.replace(/addToRecent\(([^)]+)\);?/g, '// auto save disabled');
appJsContent = appJsContent.replace(/saveRecent\(([^)]+)\);?/g, '// auto save disabled');

// 2. إضافة منطق الحفظ اليدوي عبر زر الحفظ
const manualSaveLogic = `

/* --- MANUAL SAVE VOICE LOGIC --- */
(function() {
  window.getSavedVoicesList = function() {
    try {
      return JSON.parse(localStorage.getItem('user_saved_voices') || '[]');
    } catch(e) {
      return [];
    }
  };

  window.toggleManualSaveVoice = function(event, voiceId, voiceName, langCode, audioUrl) {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    
    let saved = window.getSavedVoicesList();
    const existingIndex = saved.findIndex(v => (v.id && v.id === voiceId) || v.name === voiceName);
    
    if (existingIndex > -1) {
      saved.splice(existingIndex, 1); // إلغاء الحفظ
    } else {
      saved.unshift({
        id: voiceId || voiceName,
        name: voiceName,
        lang: langCode || 'ar',
        audio: audioUrl || '',
        savedAt: new Date().toISOString()
      });
    }
    
    localStorage.setItem('user_saved_voices', JSON.stringify(saved));
    localStorage.setItem('recentVoices', JSON.stringify(saved)); // تحديث السجل الأصلي أيضاً
    
    // إعادة تحديث القسم الخاص بالأصوات المحفوظة
    if (typeof window.renderRecentVoices === 'function') {
      window.renderRecentVoices();
    }
    if (typeof window.loadRecentVoices === 'function') {
      window.loadRecentVoices();
    }

    // تحديث أزرار الحفظ على الشاشة
    document.querySelectorAll('.btn-save-voice[data-id="' + voiceId + '"]').forEach(btn => {
      const isSaved = saved.some(v => (v.id && v.id === voiceId) || v.name === voiceName);
      btn.classList.toggle('saved', isSaved);
      btn.innerHTML = isSaved ? '🔖 تم الحفظ' : '🔖 حفظ';
    });
  };

  // مراقبة العناصر على الشاشة وإضافة زر "🔖 حفظ" لكل شخصية
  function attachSaveButtons() {
    const cards = document.querySelectorAll('.character-card, .voice-card, .card, [data-voice-id]');
    const saved = window.getSavedVoicesList();
    
    cards.forEach((card, idx) => {
      if (card.querySelector('.btn-save-voice')) return; // تم إضافة الزر مسبقاً

      const nameEl = card.querySelector('h3, .name, .character-name, .title') || card;
      const voiceName = nameEl.innerText ? nameEl.innerText.trim() : ('صوت ' + (idx + 1));
      const voiceId = card.getAttribute('data-id') || card.getAttribute('data-voice-id') || voiceName;
      const lang = card.getAttribute('data-lang') || 'ar';
      const audio = card.getAttribute('data-audio') || '';

      const isSaved = saved.some(v => (v.id && v.id === voiceId) || v.name === voiceName);

      const saveBtn = document.createElement('button');
      saveBtn.className = 'btn-save-voice' + (isSaved ? ' saved' : '');
      saveBtn.setAttribute('data-id', voiceId);
      saveBtn.type = 'button';
      saveBtn.innerHTML = isSaved ? '🔖 تم الحفظ' : '🔖 حفظ';
      saveBtn.onclick = (e) => window.toggleManualSaveVoice(e, voiceId, voiceName, lang, audio);

      const actionArea = card.querySelector('.actions, .card-actions, .buttons, .info') || card;
      actionArea.appendChild(saveBtn);
    });
  }

  const observer = new MutationObserver(attachSaveButtons);
  document.addEventListener('DOMContentLoaded', () => {
    attachSaveButtons();
    observer.observe(document.body, { childList: true, subtree: true });
  });
})();
`;

// 3. إضافة تنسيقات زر الحفظ في CSS
const saveCss = `

/* --- Manual Save Button Styles --- */
.btn-save-voice {
  background: rgba(2, 132, 199, 0.1);
  color: #0284c7;
  border: 1px solid rgba(2, 132, 199, 0.4);
  padding: 6px 14px;
  border-radius: 18px;
  font-size: 0.83rem;
  font-weight: bold;
  cursor: pointer;
  margin-left: 8px;
  margin-top: 6px;
  transition: all 0.2s ease-in-out;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.btn-save-voice:hover {
  background: rgba(2, 132, 199, 0.25);
  transform: translateY(-2px);
}

.btn-save-voice.saved {
  background: #0284c7;
  color: #ffffff;
  border-color: #0284c7;
  box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4);
}
`;

fs.writeFileSync(appJsPath, appJsContent + manualSaveLogic);
fs.appendFileSync(cssPath, saveCss);

console.log("✅ تم التعديل بنجاح! الآن الحفظ يعمل فقط عند الضغط على زر (🔖 حفظ).");

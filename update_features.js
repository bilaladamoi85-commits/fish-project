const fs = require('fs');
const path = require('path');

const appJsPath = path.join(__dirname, 'public', 'app.js');
const cssPath = path.join(__dirname, 'public', 'styles.css');

// 1. إضافة تنسيقات CSS لشارة اللغة وزر المعاينة الصوتية
const extraCss = `

/* --- Language Badge & Voice Preview Styles --- */
.lang-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: rgba(2, 132, 199, 0.15);
  color: #0284c7;
  border: 1px solid rgba(2, 132, 199, 0.3);
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.82rem;
  font-weight: 600;
  margin: 6px 0;
}

.btn-preview-voice {
  background: linear-gradient(135deg, #0284c7, #0369a1);
  color: #ffffff;
  border: none;
  padding: 8px 14px;
  border-radius: 20px;
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: bold;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease-in-out;
  margin-top: 8px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.btn-preview-voice:hover {
  transform: translateY(-2px);
  background: linear-gradient(135deg, #0369a1, #075985);
  box-shadow: 0 4px 12px rgba(2, 132, 199, 0.4);
}

.btn-preview-voice:active {
  transform: translateY(0);
}
`;

// 2. إضافة وظائف جلب اللغة والنطق باللغة الأم
const extraJs = `

// --- VOICE LANGUAGE MAPPING & NATIVE SAMPLE PHRASES ---
const VOICE_LANG_MAP = {
  'ar': { name: 'العربية', flag: '🇸🇦', sample: 'مرحباً بك! أنا جاهز للتحدث معك بصوتي الخاص.' },
  'ar-ma': { name: 'الدارجة المغربية', flag: '🇲🇦', sample: 'مرحبا بيك! أنا واجد باش نهضر معاك بصوتي.' },
  'en': { name: 'English', flag: '🇺🇸', sample: 'Hello! I am ready to speak with you in my natural voice.' },
  'ja': { name: '日本語', flag: '🇯🇵', sample: 'こんにちは！私の声でお話しする準備ができています。' },
  'fr': { name: 'Français', flag: '🇫🇷', sample: 'Bonjour! Je suis prêt à vous parler avec ma propre voix.' },
  'es': { name: 'Español', flag: '🇪🇸', sample: '¡Hola! Estoy listo para hablar contigo con mi propia voz.' },
  'de': { name: 'Deutsch', flag: '🇩🇪', sample: 'Hallo! Ich bin bereit, mit meiner eigenen Stimme zu sprechen.' },
  'zh': { name: '中文', flag: '🇨🇳', sample: '你好！我已经准备好用我的声音和你说话了。' },
  'ko': { name: '한국어', flag: '🇰🇷', sample: '안녕하세요! 제 목소리로 이야기할 준비가 되었습니다.' }
};

window.getVoiceLangInfo = function(langCode) {
  if (!langCode) return { name: 'العربية', flag: '🌐', sample: 'مرحباً بك!' };
  const key = langCode.toLowerCase().trim();
  const shortKey = key.split('-')[0];
  return VOICE_LANG_MAP[key] || VOICE_LANG_MAP[shortKey] || { name: langCode, flag: '🌐', sample: 'Hello! Welcome.' };
};

let currentVoiceAudio = null;
window.playCharacterVoicePreview = function(audioUrl, langCode, customText) {
  if (currentVoiceAudio) {
    currentVoiceAudio.pause();
    currentVoiceAudio = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  const langInfo = window.getVoiceLangInfo(langCode);
  
  if (audioUrl && audioUrl.trim() !== '') {
    currentVoiceAudio = new Audio(audioUrl);
    currentVoiceAudio.play().catch(err => {
      console.warn('Audio URL playback failed, falling back to TTS:', err);
      speakWithTTS(customText || langInfo.sample, langCode);
    });
  } else {
    speakWithTTS(customText || langInfo.sample, langCode);
  }
};

function speakWithTTS(text, langCode) {
  if (!('speechSynthesis' in window)) {
    alert('متصفحك لا يدعم خاصية نطق الصوت التلقائي');
    return;
  }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = langCode || 'ar';
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}
`;

fs.appendFileSync(cssPath, extraCss);
fs.appendFileSync(appJsPath, extraJs);

console.log("✅ تم إضافة مميزات معاينة الصوت واللغة بنجاح إلى ملفات المشروع!");

const VOICE_SEARCH_KEY = "fish.voiceSearch";
const API = location.origin;
let voices = [];
let page = 1;
const pageSize = 50;
let hasMore = true;
let selectedEmotion = "neutral";
let cinematicMode = localStorage.getItem("fish.cinematicMode") === "1";
let generatedAudioUrl = "";
let searchTimer = null;
let generationPoller = null;
let generationCountdownTimer = null;
let generationRemaining = 120;

const $ = id => document.getElementById(id);

document.addEventListener("DOMContentLoaded", () => {
  updateCounter();
  setupEvents();
  
function cleanVoiceTags(tags) {
  return (Array.isArray(tags) ? tags : [])
    .filter(tag => !/^(male|female|man|woman|boy|girl)$/i.test(String(tag).trim()));
}

function installCinematicMode() {
  try {
    window.cinematicMode = !!localStorage.getItem("fish.cinematicMode");
  } catch (_) {
    window.cinematicMode = false;
  }
}

installCinematicMode();
  checkHealth();
  loadVoices(true);

  const savedVoiceSearch = localStorage.getItem(VOICE_SEARCH_KEY);
  if (savedVoiceSearch) {
    const searchInput =
      document.querySelector("#voiceSearch") ||
      document.querySelector("#searchVoice") ||
      document.querySelector('input[type="search"]');

    if (searchInput) {
      searchInput.value = savedVoiceSearch;
      searchInput.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }
  loadClonedVoices();

  const savedEmotion =
    localStorage.getItem("fish.emotion");

  if (savedEmotion) {
    selectedEmotion = savedEmotion;
    document.querySelectorAll(".emotion").forEach(btn => {
      btn.classList.toggle(
        "active",
        btn.dataset.emotion === selectedEmotion
      );
    });
  }

  resumeActiveJob();
});

function setupEvents() {
  $("textInput").addEventListener("input", updateCounter);

  document.querySelectorAll(".emotion").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".emotion").forEach(x => x.classList.remove("active"));
      btn.classList.add("active");
      selectedEmotion = btn.dataset.emotion;
    localStorage.setItem('fish_selected_emotion', selectedEmotion);
    });
  });

  $("voiceSearch").addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => loadVoices(true), 300);
  });

  $("languageSelect").addEventListener("change", () => loadVoices(true));
  $("loadMoreBtn")?.addEventListener("click", () => loadVoices(false));
  $("refreshBtn")?.addEventListener("click", () => loadVoices(true));

  setupVoiceFilters();
}

async function checkHealth() {
  try {
    const r = await fetch(`${API}/api/health`);
    const d = await r.json();

    $("healthStatus").textContent = d.fishConfigured
      ? "Voice Studio connected"
      : "🔴 Voice Studio API key missing";

    $("healthStatus").className = d.fishConfigured
      ? "status ok"
      : "status error";
  } catch {
    $("healthStatus").textContent = "🔴 Server unavailable";
    $("healthStatus").className = "status error";
  }
}


async function loadVoices(reset = false) {
  const search = $("voiceSearch").value.trim();
  const language = $("languageSelect")?.value || "";

  if (reset) {
    page = 1;
    hasMore = true;

    // ⚡ Keep saved voices visible while API loads.
    const savedRecent = getRecentVoices();
    voices = savedRecent.filter(v => v && v.id);

    $("voiceSelect").innerHTML = `<option value="">Loading voices...</option>`;
    renderRecentVoices();
  }

  if (!hasMore && !reset) return;

  const loadMoreBtn = $("loadMoreBtn");
  if (loadMoreBtn) {
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = "⏳ Loading...";
  }

  try {
    const params = new URLSearchParams({
      page: page,
      pageSize: pageSize
    });

    if (search) params.set("search", search);
    if (language) params.set("language", language);

    const r = await fetch(`${API}/api/voices?${params}`);
    if (!r.ok) throw new Error("Voice request failed");

    const data = await r.json();
    const items = data.voices || data.models || data.items || [];

    if (reset) voices = [];

    const existing = new Set(voices.map(v => v.id));
    for (const v of items) {
      if (v.id && !existing.has(v.id)) voices.push(v);
    }

    // Restore saved recent voices from localStorage after voices are loaded.
    const savedRecent = getRecentVoices();
    for (const rv of savedRecent) {
      if (!rv || !rv.id) continue;
      if (!voices.some(v => String(v.id) === String(rv.id))) {
        voices.push(rv);
      }
    }

    hasMore = Boolean(data.hasMore) || items.length >= pageSize;
    page++;

    renderVoices();
    renderVoiceFilters(voices);
    renderVoiceSearchResults();

    $("voiceStatus").textContent =
      `✅  (${voices.length})`;
  } catch (e) {
    $("voiceStatus").textContent = "❌ Failed to load voices: " + e.message;
  } finally {
    if (loadMoreBtn) loadMoreBtn.disabled = !hasMore;
      if (loadMoreBtn) loadMoreBtn.textContent = hasMore ? "⬇️ " : "✅ All loaded";
  }
}

function renderVoices() {
  const select = $("voiceSelect");
  const previous = select.value;

  select.innerHTML = `<option value="">Select a voice...</option>`;

  if (!voices.length) {
    $("voiceInfo").textContent = "";
    return;
  }

  voices.forEach((v, i) => {
    const option = document.createElement("option");
    option.value = v.id || "";
    option.textContent =
      v.title ||
      v.name ||
      `Voice ${i + 1}`;
    select.appendChild(option);
  });

  // Preserve the current voice, or restore the last selected voice.
  const savedVoiceId = localStorage.getItem("fish.voiceId") || "";
  const wantedVoiceId = previous || savedVoiceId;

  if (
    wantedVoiceId &&
    voices.some(v => String(v.id) === String(wantedVoiceId))
  ) {
    select.value = wantedVoiceId;
    localStorage.setItem("fish.voiceId", wantedVoiceId);
  } else if (!previous) {
    select.value = "";
  }

  showVoiceInfo();
  renderRecentVoices();
  renderVoiceSearchResults();

  select.onchange = () => {
    showVoiceInfo();

    if (select.value) {
      localStorage.setItem("fish.voiceId", select.value);
    }

    renderRecentVoices();
  };
}

/* ===== Voice Search Results with Save Buttons ===== */
function voiceText(v) {
  return [
    v.title,
    v.name,
    v.nickname,
    v.gender,
    v.sex,
    v.language,
    v.languages,
    v.country,
    v.countryCode,
    v.country_code,
    v.tags,
    v.labels,
    v.category,
    v.style
  ].flat().filter(Boolean).join(" ").toLowerCase();
}

function voiceGender(v) {
  const x = voiceText(v);
  if (/\b(female|woman|girl|fem|womanly|lady)\b/.test(x)) return "female";
  if (/\b(male|man|boy|masc|gentleman)\b/.test(x)) return "male";
  return "";
}

function voiceCountry(v) {
  return String(
    v.country ||
    v.countryName ||
    v.country_code ||
    v.countryCode ||
    ""
  ).trim();
}

function voiceStyles(v) {
  const raw = [
    v.style,
    v.styles,
    v.category,
    v.categories,
    v.tags,
    v.labels
  ].flat().filter(Boolean);

  return raw
    .flatMap(x => String(x).split(/[,\|;]+/))
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 6);
}

function voiceLanguage(v) {
  return String(
    v.language ||
    v.lang ||
    v.locale ||
    (Array.isArray(v.languages) ? v.languages[0] : v.languages) ||
    ""
  ).trim();
}

function renderVoiceFilters(items) {
  const languageSelect = $("voiceLanguageFilter");
  const genderSelect = $("voiceGenderSelect");
  const categorySelect = $("voiceCategoryFilter");

  if (!languageSelect || !genderSelect || !categorySelect) return;

  const oldLanguage = languageSelect.value;
  const oldGender = genderSelect.value;
  const oldCategory = categorySelect.value;

  const languages = [...new Set(
    items.map(v => {
      const raw =
        v?.language ||
        (Array.isArray(v?.languages) ? v.languages[0] : v?.languages) ||
        v?.locale ||
        "";
      return String(raw).trim().toLowerCase().split("-")[0];
    }).filter(Boolean)
  )].sort();

  const languageNames = {
    ar:"Arabic",
    en:"English",
    fr:"Français",
    es:"Español",
    de:"Deutsch",
    it:"Italiano",
    pt:"Português",
    nl:"Nederlands",
    tr:"Türkçe",
    ru:"Русский",
    uk:"Українська",
    pl:"Polski",
    ja:"日本語",
    ko:"한국어",
    zh:"中文",
    hi:"हिन्दी",
    id:"Bahasa Indonesia",
    vi:"Tiếng Việt",
    th:"ไทย",
    he:"עברית"
  };

  languageSelect.innerHTML =
    '<option value="">Any Language</option>';

  languages.forEach(lang => {
    const o=document.createElement("option");
    o.value=lang;
    o.textContent=(languageNames[lang] || lang.toUpperCase());
    languageSelect.appendChild(o);
  });

  genderSelect.innerHTML = `
    <option value="">Any Gender</option>
    <option value="male">Male</option>
    <option value="female">Female</option>
  `;

  const categories = new Set();

  items.forEach(v => {
    const values = [
      v?.category,
      v?.category_name,
      v?.categoryName,
      v?.style,
      v?.voice_style,
      v?.voiceStyle,
      ...(Array.isArray(v?.tags) ? v.tags : []),
      ...(Array.isArray(v?.labels) ? v.labels : [])
    ];

    values
      .flat()
      .filter(Boolean)
      .map(x => String(x).trim())
      .filter(x =>
        x &&
        !/^(male|female|man|woman|boy|girl)$/i.test(x)
      )
      .forEach(x => categories.add(x));
  });

  categorySelect.innerHTML =
    '<option value="">Any Category</option>';

  [...categories]
    .sort((a,b)=>a.localeCompare(b))
    .slice(0,80)
    .forEach(cat => {
      const o=document.createElement("option");
      o.value=cat;
      o.textContent=cat;
      categorySelect.appendChild(o);
    });

  if (languages.includes(oldLanguage))
    languageSelect.value=oldLanguage;

  if (["male","female"].includes(oldGender))
    genderSelect.value=oldGender;

  if ([...categories].includes(oldCategory))
    categorySelect.value=oldCategory;
}

function setupVoiceFilters() {
  [
    "voiceLanguageFilter",
    "voiceGenderSelect",
    "voiceCategoryFilter"
  ].forEach(id => {
    const el=$(id);
    if(el){
      el.addEventListener("change",()=>{
        renderVoiceSearchResults();
      });
    }
  });
}

function esc(x) {
  return String(x ?? "").replace(/[&<>"']/g, ch => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[ch]));
}

function getVoiceAvatar(v) {
  let avatar =
    v?.cover_image ||
    v?.coverImage ||
    v?.avatar ||
    v?.author?.avatar ||
    "";

  if (avatar && typeof avatar === "object") {
    avatar =
      avatar.url ||
      avatar.image_url ||
      avatar.imageUrl ||
      avatar.src ||
      avatar.avatar_url ||
      avatar.cover_image ||
      "";
  }

  avatar = String(avatar || "").trim();

  if (!avatar) return "";

  if (avatar.startsWith("//")) {
    return "https:" + avatar;
  }

  if (
    avatar.startsWith("http://") ||
    avatar.startsWith("https://")
  ) {
    return avatar;
  }

  return "https://public-platform.r2.fish.audio/" +
    avatar.replace(/^\/+/, "");
}

function voiceAvatarHTML(v, title) {
  const url = getVoiceAvatar(v);

  if (!url) {
    return '<span class="voice-avatar-fallback">🎙️</span>';
  }

  const safeUrl = String(url)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `
    <img
      src="${safeUrl}"
      alt="${esc(title)}"
      class="voice-avatar-img"
      loading="eager"
      decoding="async"
      onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
    >
    <span class="voice-avatar-fallback" style="display:none">🎙️</span>
  `;
}

/* ===== Voice Cards / Preview / Select ===== */

function ensureSelectedVoiceBar() {
  const input = document.getElementById("voiceSearch");
  if (!input) return null;

  let bar = document.getElementById("selectedVoiceBar");

  if (!bar) {
    bar = document.createElement("div");
    bar.id = "selectedVoiceBar";

    bar.style.cssText = [
      "display:none",
      "align-items:center",
      "gap:8px",
      "height:46px",
      "padding:5px 9px",
      "margin:0 0 8px 0",
      "border:1px solid rgba(255,255,255,.10)",
      "border-radius:10px",
      "background:rgba(255,255,255,.045)",
      "box-sizing:border-box",
      "overflow:hidden"
    ].join(";");

    // يكون فوق خانة البحث مباشرة
    const searchWrap = input.closest(".voice-search-wrap");

    if (searchWrap && searchWrap.parentNode) {
      searchWrap.parentNode.insertBefore(bar, searchWrap);
    } else if (input.parentNode) {
      input.parentNode.insertBefore(bar, input);
    }
  }

  return bar;
}

function renderSelectedVoice() {
  const bar = ensureSelectedVoiceBar();
  if (!bar) return;

  const select = document.getElementById("voiceSelect");
  const id = select ? String(select.value || "") : "";

  const v = voices.find(x => String(x.id) === id);

  if (!v || !id) {
    bar.style.display = "none";
    bar.innerHTML = "";
    return;
  }

  const title =
    v.title ||
    v.name ||
    v.nickname ||
    "Selected Voice";

  const lang = voiceLanguage(v);
  const country = voiceCountry(v);
  const gender = voiceGender(v);

  const meta = [lang, country, gender]
    .filter(Boolean)
    .map(esc)
    .join(" · ");

  bar.innerHTML = `
    <div style="
      width:34px;
      height:34px;
      min-width:34px;
      border-radius:9px;
      overflow:hidden;
      display:flex;
      align-items:center;
      justify-content:center;
      background:rgba(255,255,255,.08);
    ">
      ${voiceAvatarHTML(v, title)}
    </div>

    <div style="min-width:0;flex:1">
      <div style="
        font-weight:700;
        white-space:nowrap;
        overflow:hidden;
        text-overflow:ellipsis;
      ">
        ${esc(title)}
      </div>

      ${
        meta
          ? `<div style="
              opacity:.65;
              font-size:12px;
              margin-top:2px;
              white-space:nowrap;
              overflow:hidden;
              text-overflow:ellipsis;
            ">${meta}</div>`
          : ""
      }
    </div>

    <span style="
      font-size:11px;
      opacity:.75;
      padding:4px 7px;
      border-radius:7px;
      background:rgba(255,255,255,.08);
    ">SELECTED</span>
  `;

  bar.style.display = "flex";
}

async function previewVoice(id, button) {
  if (!id) return;

  const originalText = button ? button.innerHTML : "";

  if (button) {
    button.disabled = true;
    button.innerHTML = "⏳";
  }

  fetch("/api/voice-preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      voiceId: id
    })
  })
    .then(async response => {
      const data = await response.json().catch(() => ({}));

      if (!response.ok || !data.success || !data.audioUrl) {
        throw new Error(
          data.error ||
          data.details ||
          "Preview failed"
        );
      }

      return data.audioUrl;
    })
    .then(async audioUrl => {
      // Fetch the MP3 ourselves, then create a browser Blob URL.
      // This avoids browser/player issues with the API audio URL.
      const audioResponse = await fetch(audioUrl, {
        cache: "no-store"
      });

      if (!audioResponse.ok) {
        throw new Error(
          `Audio HTTP ${audioResponse.status}`
        );
      }

      const blob = await audioResponse.blob();

      if (!blob.size) {
        throw new Error("Empty audio file");
      }

      const blobUrl = URL.createObjectURL(
        new Blob([blob], { type: "audio/mpeg" })
      );

      const audio = new Audio();

      audio.preload = "auto";
      audio.src = blobUrl;

      window.__fishPreviewAudio =
        window.__fishPreviewAudio || null;

      if (window.__fishPreviewAudio) {
        try {
          window.__fishPreviewAudio.pause();
          window.__fishPreviewAudio.removeAttribute("src");
        } catch (_) {}
      }

      window.__fishPreviewAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(blobUrl);

        if (button && button.isConnected) {
          button.disabled = false;
          button.innerHTML = originalText || "▶";
        }
      };

      audio.onerror = () => {
        URL.revokeObjectURL(blobUrl);

        if (button && button.isConnected) {
          button.disabled = false;
          button.innerHTML = originalText || "▶";
        }

        alert("Preview failed: audio file cannot be played.");
      };

      await audio.play();
    })
    .catch(error => {
      console.error("❌ Preview playback:", error);

      if (button && button.isConnected) {
        button.disabled = false;
        button.innerHTML = originalText || "▶";
      }

      alert(
        "Preview failed: " +
        (error.message || "Failed to load")
      );
    });
}


function getVoiceProfessionalScore(v) {
  const text = [
    v?.title,
    v?.name,
    v?.nickname,
    v?.description,
    v?.tags,
    v?.labels,
    v?.category,
    v?.categories,
    v?.style,
    v?.styles
  ]
    .flat()
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const weights = {
    professional: 14,
    cinematic: 13,
    dramatic: 11,
    authoritative: 10,
    expressive: 10,
    narration: 9,
    storytelling: 9,
    narrator: 9,
    voiceover: 9,
    broadcast: 9,
    commercial: 9,
    clear: 8,
    natural: 8,
    fluent: 8,
    smooth: 7,
    deep: 6,
    energetic: 6,
    serious: 5,
    calm: 4,
    friendly: 4
  };

  let score = 35;
  const matched = new Set();

  for (const [keyword, weight] of Object.entries(weights)) {
    const re = new RegExp(
      `(^|[^a-z])${keyword}(?=$|[^a-z])`,
      "i"
    );

    if (re.test(text) && !matched.has(keyword)) {
      matched.add(keyword);
      score += weight;
    }
  }

  if (String(v?.description || "").trim().length >= 80) {
    score += 4;
  }

  if (
    Array.isArray(v?.samples) &&
    v.samples.length > 0
  ) {
    score += 4;
  }

  if (
    v?.author &&
    (v.author.nickname || v.author._id)
  ) {
    score += 3;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function getVoiceProfessionalBadge(score) {
  if (score >= 80) {
    return {
      icon: "⭐",
      label: "Premium",
      className: "premium"
    };
  }

  if (score >= 60) {
    return {
      icon: "🎙️",
      label: "Professional",
      className: "professional"
    };
  }

  return {
    icon: "",
    label: "",
    className: "standard"
  };
}

function renderVoiceSearchResults() {

  if (!document.getElementById("professionalVoiceTagsStyle")) {
    const style = document.createElement("style");
    style.id = "professionalVoiceTagsStyle";
    style.textContent = `

      .voice-professional-score {
        display:inline-flex;
        align-items:center;
        gap:5px;
        margin-top:6px;
        padding:4px 8px;
        border-radius:999px;
        font-size:10px;
        line-height:1;
        font-weight:800;
        white-space:nowrap;
        width:max-content;
        border:1px solid rgba(255,255,255,.10);
        background:rgba(255,255,255,.045);
      }

      .voice-professional-score.premium {
        background:rgba(255,196,0,.10);
        border-color:rgba(255,196,0,.28);
      }

      .voice-professional-score.professional {
        background:rgba(80,170,255,.10);
        border-color:rgba(80,170,255,.25);
      }

      .voice-professional-score.standard {
        opacity:.72;
      }

      .voice-card-tags {
        display:flex;
        flex-wrap:wrap;
        gap:6px;
        margin-top:7px;
      }

      .voice-card-tag {
        display:inline-flex;
        align-items:center;
        gap:5px;
        padding:5px 8px;
        border:1px solid rgba(255,255,255,.10);
        border-radius:999px;
        background:rgba(255,255,255,.045);
        color:inherit;
        font-size:11px;
        line-height:1;
        white-space:nowrap;
      }

      .voice-card-tag svg {
        width:13px;
        height:13px;
        fill:none;
        stroke:currentColor;
        stroke-width:1.7;
        stroke-linecap:round;
        stroke-linejoin:round;
        opacity:.8;
        flex:none;
      }
    `;
    document.head.appendChild(style);
  }


  const input = document.getElementById("voiceSearch");
  const box = document.getElementById("voiceSearchResultsBox");
  const count = document.getElementById("voiceResultCount");

  if (!box) return;

  renderSelectedVoice();

  const query = input
    ? input.value.trim().toLowerCase()
    : "";

  if (count) count.textContent = "";

  const hasFilters =
    !!document.getElementById("voiceLanguageFilter")?.value ||
    !!document.getElementById("voiceGenderSelect")?.value ||
    !!document.getElementById("voiceCategoryFilter")?.value;

  if (!query && !hasFilters) {
    box.innerHTML = "";
    box.style.display = "none";
    renderRecentVoices();
    renderSelectedVoice();
    return;
  }

  const languageFilter =
    document.getElementById("voiceLanguageFilter")?.value || "";

  const genderFilter =
    document.getElementById("voiceGenderSelect")?.value || "";

  const categoryFilter =
    document.getElementById("voiceCategoryFilter")?.value || "";

  const matches = voices.filter(v => {
    const textMatch =
      !query ||
      voiceText(v).includes(query);

    const language = String(
      v?.language ||
      (Array.isArray(v?.languages) ? v.languages[0] : v?.languages) ||
      v?.locale ||
      ""
    ).trim().toLowerCase().split("-")[0];

    const gender = voiceGender(v);

    const categories = [
      v?.category,
      v?.category_name,
      v?.categoryName,
      v?.style,
      v?.voice_style,
      v?.voiceStyle,
      ...(Array.isArray(v?.tags) ? v.tags : []),
      ...(Array.isArray(v?.labels) ? v.labels : [])
    ]
      .flat()
      .filter(Boolean)
      .map(x => String(x).trim().toLowerCase());

    const languageMatch =
      !languageFilter ||
      language === languageFilter;

    const genderMatch =
      !genderFilter ||
      gender === genderFilter;

    const categoryMatch =
      !categoryFilter ||
      categories.includes(String(categoryFilter).toLowerCase());

    return (
      textMatch &&
      languageMatch &&
      genderMatch &&
      categoryMatch
    );
  });

  const select = document.getElementById("voiceSelect");
  const selectedId = String(
    localStorage.getItem("fish.voiceId") ||
    (select && select.value) ||
    ""
  );

  if (count) {
    count.textContent = `${matches.length} voices`;
  }

  if (!matches.length) {
    box.innerHTML =
      '<div class="voice-no-results">No voices found</div>';

    box.style.display = "";
    return;
  }

  box.innerHTML = matches.map(v => {
    const id = String(v.id || "");

    const title =
      v.title ||
      v.name ||
      v.nickname ||
      "Voice";

    const lang = voiceLanguage(v);
    const country = voiceCountry(v);
    const gender = voiceGender(v);
    const styles = voiceStyles(v);

    const professionalScore =
      getVoiceProfessionalScore(v);

    const professionalBadge =
      getVoiceProfessionalBadge(professionalScore);

    const professionalScoreHtml =
      professionalBadge.label
        ? `
          <div class="voice-professional-score ${professionalBadge.className}">
            <span>${professionalBadge.icon}</span>
            <span>${professionalBadge.label}</span>
            <span>·</span>
            <span>${professionalScore}/100</span>
          </div>
        `
        : `
          <div class="voice-professional-score standard">
            <span>${professionalScore}/100</span>
          </div>
        `;

    const languageNames = {
      en: "English",
      es: "Spanish",
      fr: "French",
      de: "German",
      it: "Italian",
      pt: "Portuguese",
      ar: "Arabic",
      ja: "Japanese",
      ko: "Korean",
      zh: "Chinese",
      tr: "Turkish",
      ru: "Russian",
      hi: "Hindi",
      nl: "Dutch",
      pl: "Polish",
      sv: "Swedish",
      no: "Norwegian",
      da: "Danish",
      fi: "Finnish",
      uk: "Ukrainian",
      cs: "Czech"
    };

    const langCode = String(lang || "")
      .split("-")[0]
      .trim()
      .toLowerCase();

    const languageLabel =
      languageNames[langCode] ||
      (lang ? String(lang).toUpperCase() : "");

    const genderLabel =
      String(gender || "").toLowerCase() === "male"
        ? "Male"
        : String(gender || "").toLowerCase() === "female"
          ? "Female"
          : String(gender || "");

    const prettyStyle = value => {
      const key = String(value || "").trim().toLowerCase();

      const names = {
        old: "Old",
        elderly: "Elderly",
        young: "Young",
        adult: "Adult",
        child: "Child",
        teenager: "Teen",
        male: "Male",
        female: "Female",
        deep: "Deep",
        soft: "Soft",
        warm: "Warm",
        calm: "Calm",
        energetic: "Energetic",
        dramatic: "Dramatic",
        friendly: "Friendly",
        professional: "Professional"
      };

      return names[key] || String(value || "").trim();
    };

    const svgIcon = type => {
      const icons = {
        language:
          '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"></circle><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"></path></svg>',

        country:
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM4 9h16M10 5v14"></path></svg>',

        gender:
          '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="9" r="3"></circle><path d="M4 20c1-3 2.5-5 5-5s4 2 5 5M15 5h5v5M20 5l-5 5"></path></svg>',

        style:
          '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z"></path></svg>'
      };

      return icons[type] || "";
    };

    const tagsHtml = [
      languageLabel
        ? `<span class="voice-card-tag">${svgIcon("language")}<span>${esc(languageLabel)}</span></span>`
        : "",

      country
        ? `<span class="voice-card-tag">${svgIcon("country")}<span>${esc(country)}</span></span>`
        : "",

      genderLabel
        ? `<span class="voice-card-tag">${svgIcon("gender")}<span>${esc(genderLabel)}</span></span>`
        : "",

      ...styles
      .filter(x => !/^(male|female|man|woman|boy|girl)$/i.test(String(x).trim()))
      .slice(0, 2)
      .map(x =>
        `<span class="voice-card-tag">${svgIcon("style")}<span>${esc(prettyStyle(x))}</span></span>`
      )
    ].filter(Boolean).join("");

    const selected =
      id === selectedId;

    return `
      <div
        class="voice-card ${selected ? "selected" : ""}"
        data-voice-id="${esc(id)}"
        style="
          position:relative;
          display:flex;
          align-items:stretch;
          gap:7px;
        "
      >

        <div
          class="voice-card-main"
          style="
            flex:1;
            min-width:0;
          "
        >
          <div class="voice-card-icon">
            ${voiceAvatarHTML(v, title)}
          </div>

          <div class="voice-card-body">
            <div class="voice-card-name">
              ${esc(title)}
              ${
                selected
                  ? '<span class="voice-card-check">✓</span>'
                  : ""
              }
            </div>

            ${professionalScoreHtml}

            <div class="voice-card-tags">
              ${tagsHtml}
            </div>
          </div>
        </div>

        <div style="
          display:flex;
          flex-direction:column;
          gap:5px;
          padding:5px 5px 5px 0;
        ">

          <button
            type="button"
            data-voice-preview="${esc(id)}"
            title="Preview voice"
            aria-label="Preview voice"
            style="
              width:38px;
              height:34px;
              border:0;
              border-radius:9px;
              cursor:pointer;
              font-size:16px;
            "
          >▶</button>
          <button
            type="button"
            data-voice-select="${esc(id)}"
            title="Select voice"
            aria-label="Select voice"
            style="
              
              position:absolute;
              top:5px;
              left:50%;
              transform:translateX(-50%);
              z-index:5;
              width:70px;
              height:28px;
              border:0;
              border-radius:8px;
              cursor:pointer;
              font-size:11px;
              font-weight:700;
              
            "
          >Select</button>

          <button
            type="button"
            class="voice-card-save"
            data-voice-save="${esc(id)}"
            title="Save voice"
            aria-label="Save voice"
            style="
              width:38px;
              height:30px;
              border:0;
              border-radius:8px;
              cursor:pointer;
            "
          ><span class="voice-save-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="M5 4h12l2 2v15H5z"/>
              <path d="M8 4v6h8V4"/>
              <path d="M8 21v-6h8v6"/>
            </svg>
          </span></button>

        </div>
      </div>
    `;
  }).join("");

  box.style.display = "";

  // =========================
  // PREVIEW
  // =========================
  box.querySelectorAll("[data-voice-preview]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();

      const id =
        btn.getAttribute("data-voice-preview");

      previewVoice(id, btn);
    });
  });

  // =========================
  // SAVE
  // =========================
  box.querySelectorAll("[data-voice-save]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();

      const id =
        btn.getAttribute("data-voice-save");

      if (!id) return;

      rememberRecentVoice(id);
      renderRecentVoices();

      btn.textContent = "✓";

      setTimeout(() => {
        if (btn.isConnected) {
          btn.textContent = "💾";
        }
      }, 900);
    });
  });

  // =========================
  // SELECT
  // =========================

  const finalizeVoiceSelection = id => {
    if (!id) return false;

    const select = document.getElementById("voiceSelect");
    if (!select) return false;

    const v = voices.find(x => String(x.id) === String(id));
    if (!v) return false;

    let option = [...select.options].find(
      o => String(o.value) === String(id)
    );

    if (!option) {
      option = new Option(
        v.title || v.name || v.nickname || "Voice",
        id
      );
      select.add(option);
    }

    select.value = id;

    localStorage.setItem("fish.voiceId", id);

    renderSelectedVoice();
    renderVoiceSearchResults();

    const input = document.getElementById("voiceSearch");
    if (input) {
      input.value = "";
      localStorage.removeItem(VOICE_SEARCH_KEY);
    }

    const searchInput = document.getElementById("voiceSearch");
    if (searchInput) {
      searchInput.dispatchEvent(
        new Event("input", { bubbles: true })
      );
    }

    return true;
  };

  let pendingPremiumVoiceId = "";

  const closePremiumVoiceModal = () => {
    const modal = document.getElementById("premiumVoiceModal");

    if (modal) {
      modal.style.display = "none";
    }

    pendingPremiumVoiceId = "";
  };

  const openPremiumVoiceModal = id => {
    const modal = document.getElementById("premiumVoiceModal");
    if (!modal) return false;

    const v = voices.find(x => String(x.id) === String(id));
    if (!v) return false;

    pendingPremiumVoiceId = String(id);

    const title =
      v.title ||
      v.name ||
      v.nickname ||
      "Premium Voice";

    const titleEl = document.getElementById("premiumVoiceTitle");
    const messageEl = document.getElementById("premiumVoiceMessage");

    if (titleEl) {
      titleEl.textContent = `⭐ ${title}`;
    }

    if (messageEl) {
      messageEl.textContent =
        "هذه الشخصية Premium. يمكنك مشاهدة إعلان قصير لدعم بقاء Speakoro مجانيًا، ثم المتابعة لاستخدام الصوت.";
    }

    modal.style.display = "flex";

    return true;
  };

  window.closePremiumVoiceModal = closePremiumVoiceModal;

  box.querySelectorAll("[data-voice-select]").forEach(btn => {
    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();

      const id = btn.getAttribute("data-voice-select");
      if (!id) return;

      const v = voices.find(x => String(x.id) === String(id));
      if (!v) return;

      const score = getVoiceProfessionalScore(v);
      const badge = getVoiceProfessionalBadge(score);

      // Premium voices require the Premium confirmation modal.
      if (badge.className === "premium") {
        openPremiumVoiceModal(id);
        return;
      }

      finalizeVoiceSelection(id);
    });
  });

  // Premium modal controls.
  const premiumClose =
    document.getElementById("premiumVoiceClose");

  const premiumContinue =
    document.getElementById("premiumVoiceContinueBtn");

  const premiumAd =
    document.getElementById("premiumVoiceAdBtn");

  if (premiumClose) {
    premiumClose.onclick = () => {
      closePremiumVoiceModal();
    };
  }

  if (premiumContinue) {
    premiumContinue.onclick = () => {
      const id = pendingPremiumVoiceId;

      closePremiumVoiceModal();

      // User can continue without an ad.
      if (id) {
        finalizeVoiceSelection(id);
      }
    };
  }

  if (premiumAd) {
    premiumAd.onclick = () => {
      const id = pendingPremiumVoiceId;

      if (!id) {
        closePremiumVoiceModal();
        return;
      }

      sessionStorage.setItem(
        "speakoro_pending_premium_voice",
        id
      );

      sessionStorage.setItem(
        "speakoro_premium_return",
        "1"
      );

      window.location.href = SPEAKORO_SMARTLINK;
    };
  }

  const premiumModal =
    document.getElementById("premiumVoiceModal");

  if (premiumModal) {
    premiumModal.onclick = e => {
      if (e.target === premiumModal) {
        closePremiumVoiceModal();
      }
    };
  }

  // Restore Premium selection after returning from the ad.
  window.addEventListener("pageshow", () => {
    const pendingId = sessionStorage.getItem(
      "speakoro_pending_premium_voice"
    );

    const returned =
      sessionStorage.getItem("speakoro_premium_return");

    if (pendingId && returned === "1") {
      sessionStorage.removeItem(
        "speakoro_pending_premium_voice"
      );

      sessionStorage.removeItem(
        "speakoro_premium_return"
      );

      setTimeout(() => {
        finalizeVoiceSelection(pendingId);
      }, 300);
    }
  });
}

/* ===== Recent Voices ===== */
const RECENT_VOICES_KEY = "fish.recentVoices";
const RECENT_VOICES_MAX = 10;

function getRecentVoices() {
  try {
    const data = JSON.parse(localStorage.getItem(RECENT_VOICES_KEY) || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function rememberRecentVoice(id) {
  if (!id) return;

  const voice = voices.find(v => v.id === id);
  if (!voice) return;

  const item = {
    ...voice,
    id: voice.id,
    title: voice.title || voice.name || voice.nickname || "Voice"
  };

  let recent = getRecentVoices();

  recent = recent.filter(v => v.id !== item.id);
  recent.unshift(item);
  recent = recent.slice(0, RECENT_VOICES_MAX);

  localStorage.setItem(RECENT_VOICES_KEY, JSON.stringify(recent));
}



function renderRecentVoices() {
  const recent = getRecentVoices();
  let box = document.getElementById("recentVoicesBox");

  if (!box) {
    box = document.createElement("div");
    box.id = "recentVoicesBox";
    box.className = "recent-voices-box";

    const searchBox = document.getElementById("voiceSearchResultsBox");
    if (searchBox && searchBox.parentNode) {
      searchBox.parentNode.insertBefore(box, searchBox);
    }
  }

  if (!recent.length) {
    box.innerHTML = "";
    box.style.display = "none";
    return;
  }

  const currentId =
    document.getElementById("voiceSelect")?.value || "";

  box.innerHTML = `
    <div class="recent-voices-title">🕘 Recent Voices</div>
    <div class="recent-voices-list">
      ${recent.map(v => {
        const liveVoice =
          voices.find(x => String(x.id) === String(v.id)) || v;

        const title =
          liveVoice.title ||
          liveVoice.name ||
          liveVoice.nickname ||
          "Voice";

        return `
          <div class="recent-voice-item ${String(currentId) === String(v.id) ? "recent-voice-selected" : ""}"
               data-recent-id="${esc(v.id)}">

            <button type="button"
                    class="recent-voice-main"
                    data-recent-select="${esc(v.id)}">

              <span class="recent-voice-avatar-wrap">
                ${voiceAvatarHTML(liveVoice, title)}
              </span>

              <span class="recent-voice-name">${esc(title)}</span>
            </button>

            <button type="button"
                    class="recent-voice-delete"
                    data-recent-delete="${esc(v.id)}">×</button>
          </div>
        `;
      }).join("")}
    </div>
  `;

  box.style.display = "";

  box.querySelectorAll("[data-recent-delete]").forEach(btn => {
    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();

      const id = btn.getAttribute("data-recent-delete");
      const updated = getRecentVoices()
        .filter(v => String(v.id) !== String(id));

      localStorage.setItem(
        RECENT_VOICES_KEY,
        JSON.stringify(updated)
      );

      renderRecentVoices();
    };
  });

  box.querySelectorAll("[data-recent-select]").forEach(btn => {
    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();

      const id = btn.getAttribute("data-recent-select");
      if (!id) return;

      const saved = getRecentVoices()
        .find(v => String(v.id) === String(id));

      if (!saved) return;

      const select = document.getElementById("voiceSelect");
      if (!select) return;

      let option = [...select.options]
        .find(o => String(o.value) === String(id));

      if (!option) {
        option = new Option(
          saved.title || saved.name || saved.nickname || "Voice",
          saved.id
        );
        select.add(option);
      }

      // Change the actual selected voice.
      select.value = saved.id;
      localStorage.setItem("fish.voiceId", saved.id);

    if (typeof showVoiceInfo === "function") {
      showVoiceInfo();
    }

    if (typeof renderSelectedVoice === "function") {
      renderSelectedVoice();
    }

      // Update only the saved-voices visual state.
      box.querySelectorAll(".recent-voice-item")
        .forEach(item => item.classList.remove("recent-voice-selected"));

      const item = btn.closest(".recent-voice-item");
      if (item) item.classList.add("recent-voice-selected");

      // Keep the normal app selection logic working.
      select.dispatchEvent(
        new Event("change", { bubbles: true })
      );
    };
  });
}

function showVoiceInfo() {
  const box = document.getElementById("voiceInfo");
  if (box) box.innerHTML = "";
}

function updateCounter() {
  const n = $("textInput").value.length;
  $("charCount").textContent =
    `${n.toLocaleString()} / 50,000 characters`;

  if (n > 8000) {
    const chunks = Math.ceil(n / 900);
    $("chunkInfo").textContent =
      `⚡ ~${chunks} chunks × ~900 chars • 10 parallel`;
  } else {
    $("chunkInfo").textContent =
      "⚡ Single request";
  }
}

function prepareCinematicText(text) {
  return String(text || '').trim();
}


async function generateSpeech() {
    const generateButton = $("generateBtn");
    if (generateButton) {
      generateButton.disabled = false;
      generateButton.textContent = "🎙️ Generate Speech";
    }
  const text = $("textInput").value.trim();
  const voiceId = $("voiceSelect").value;
  const ttsText = cinematicMode ? prepareCinematicText(text) : text;

  if (!text) {
    showStatus("⚠️ Please enter some text first", "error");
    return;
  }

  if (!voiceId) {
    showStatus("⚠️ Please select a voice first", "error");
    return;
  }

  if (text.length > 50000) {
    showStatus("⚠️ Maximum is 50,000 characters", "error");
    return;
  }

  localStorage.setItem("fish.voiceId", voiceId);

  // Keep the selected voice visible after Generate.
  const selectedSelect = document.getElementById("voiceSelect");
  if (selectedSelect) {
    selectedSelect.value = voiceId;
  }

  renderSelectedVoice();
  renderVoiceSearchResults();

  localStorage.setItem("fish.emotion", selectedEmotion);
  localStorage.setItem("fish.text", text);

  const active = localStorage.getItem("fish.activeJobId");

  if (active) {
    try {
      const r = await fetch(`${API}/api/tts-progress/${active}`, {
        cache: "no-store"
      });
      if (r.ok) {
        const old = await r.json();
        if (!old.finished && !old.failed) {
          startJobWatcher(active);
          return;
        }
      }
    } catch (_) {}
  }

  const jobId =
    (crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

  localStorage.setItem("fish.activeJobId", jobId);

  

  try {
    const response = await fetch(`${API}/api/tts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-TTS-Job-Id": jobId
      },
      body: JSON.stringify({
        text: ttsText,
        voiceId,
        emotion: selectedEmotion
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "TTS request failed");
    }

    const actualJobId = data.jobId || jobId;
    localStorage.setItem("fish.activeJobId", actualJobId);
    startJobWatcher(actualJobId);

  } catch (error) {
    stopJobWatcher();
    localStorage.removeItem("fish.activeJobId");
    showStatus("❌ " + error.message, "error");
    $("generateBtn").disabled = false;
    $("generateBtn").textContent = "🎙️ Generate Speech";
  }
}

function stopJobWatcher() {
  clearInterval(generationCountdownTimer);
  clearInterval(generationPoller);
  generationCountdownTimer = null;
  generationPoller = null;
}

function startJobWatcher(jobId) {
  stopJobWatcher();

  $("progressBox").classList.remove("hidden");
  $("audioSection").classList.add("hidden");

  const btn = $("generateBtn");
  btn.disabled = true;
  btn.textContent = "⏳ Generating...";

  let estimatedTotalSeconds = 120;
  let finished = false;

  const update = async () => {
    if (finished) return;

    try {
      const r = await fetch(
        `${API}/api/tts-progress/${encodeURIComponent(jobId)}`,
        { cache: "no-store" }
      );

      if (!r.ok) return;

      const p = await r.json();

      const started =
        Number(p.startedAt) || Date.now();

      const elapsed =
        Math.floor((Date.now() - started) / 1000);

      $("elapsedTime").textContent =
        `${elapsed}s`;

      if (
        p.eta !== null &&
        Number.isFinite(Number(p.eta))
      ) {
        estimatedTotalSeconds =
          Math.max(
            estimatedTotalSeconds,
            elapsed + Number(p.eta)
          );
      }

      const remaining =
        p.finished
          ? 0
          : Math.max(
              1,
              Math.ceil(
                estimatedTotalSeconds - elapsed
              )
            );

      $("remainingTime").textContent =
        `${remaining}s`;

      if (p.failed) {
        finished = true;
        stopJobWatcher();
        localStorage.removeItem("fish.activeJobId");
        showStatus(
          "❌ " + (p.error || "Failed to generate speech"),
          "error"
        );
        btn.disabled = false;
        btn.textContent = "🎙️ Generate Speech";
        return;
      }

      if (p.merging) {
        setProgress(
          98,
          `🔄 Merging audio... • ${p.completed}/${p.total}`
        );
      } else if (p.total > 1) {
        const percent =
          Math.min(
            94,
            8 + Math.round(
              (Number(p.completed) / Number(p.total)) * 90
            )
          );

        setProgress(
          percent,
          `🎙️ Generating... • ${p.completed}/${p.total}`
        );
      } else {
        setProgress(
          15,
          "🎙️ Generating speech..."
        );
      }

      if (p.finished && p.audioUrl) {
        finished = true;
        stopJobWatcher();

        $("elapsedTime").textContent =
          `${Math.floor(
            Number(p.processingSeconds || elapsed)
          )}s`;

        $("remainingTime").textContent = "0s";

        setProgress(
          100,
          "✅ Audio ready"
        );

        generatedAudioUrl =
          p.audioUrl.startsWith("http")
            ? p.audioUrl
            : `${API}${p.audioUrl}`;

        localStorage.setItem(
          "fish.generatedAudioUrl",
          generatedAudioUrl
        );

        $("audioPlayer").src = generatedAudioUrl;
        $("audioPlayer").load();

        $("audioSection").classList.remove("hidden");

        btn.disabled = false;
        btn.textContent = "🎙️ Generate Speech";

        localStorage.removeItem("fish.activeJobId");

        showStatus(
          `✅ Speech created in ${Number(
            p.processingSeconds || elapsed
          ).toFixed(1)}s`,
          "success"
        );
      }
    } catch (_) {}
  };

  update();
  generationPoller = setInterval(update, 700);
  generationCountdownTimer = setInterval(update, 1000);
}

async function resumeActiveJob() {
  const jobId =
    localStorage.getItem("fish.activeJobId");

  if (!jobId) return;

  $("progressBox").classList.remove("hidden");

  startJobWatcher(jobId);

  try {
    const r = await fetch(
      `${API}/api/tts-progress/${encodeURIComponent(jobId)}`,
      { cache: "no-store" }
    );

    if (!r.ok) {
      localStorage.removeItem("fish.activeJobId");
      stopJobWatcher();
      $("progressBox").classList.add("hidden");
      $("generateBtn").disabled = false;
      $("generateBtn").textContent = "🎙️ Generate Speech";
    }
  } catch (_) {}
}

function setProgress(percent, text) {
  $("progressFill").style.width = percent + "%";
  $("progressText").textContent = text;
}

function showStatus(message, type) {
  const box = $("statusBox");
  box.textContent = message;
  box.className = "status-box " + type;
}

function downloadAudio() {
  if (!generatedAudioUrl) {
    generatedAudioUrl =
      localStorage.getItem("fish.generatedAudioUrl") || "";
  }

  if (!generatedAudioUrl) {
    showStatus("⚠️ No audio is ready to download", "error");
    return;
  }

  const a = document.createElement("a");
  a.href = generatedAudioUrl;
  a.download = "fish-audio.mp3";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

async function copyAudioUrl() {
  if (!generatedAudioUrl) {
    showStatus("⚠️ No audio is ready", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(generatedAudioUrl);
    showStatus("📋 Audio URL copied", "success");
  } catch {
    showStatus("⚠️ The browser blocked copying the URL", "error");
  }
}

async function loadClonedVoices() { return; }

function showCloneForm() {
  $("cloneModal").classList.remove("hidden");
}

function hideCloneForm() {
  $("cloneModal").classList.add("hidden");
}

function addAudioUrlInput() {
  const input = document.createElement("input");
  input.className = "input audio-url-input";
  input.placeholder = "https://example.com/audio.wav";
  $("audioUrlsContainer").appendChild(input);
}

async function submitVoiceClone() {
  const title = $("voiceTitle").value.trim();
  const audioUrls = [...document.querySelectorAll(".audio-url-input")]
    .map(x => x.value.trim())
    .filter(Boolean);

  if (!title || !audioUrls.length) {
    alert("Enter a voice name and at least one audio URL.");
    return;
  }

  try {
    const r = await fetch(`${API}/api/clone-voice`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({title, audioUrls})
    });

    const d = await r.json();

    if (!r.ok) throw new Error(d.error || "Clone failed");

    hideCloneForm();
    await loadClonedVoices();

  const savedEmotion =
    localStorage.getItem("fish.emotion");

  if (savedEmotion) {
    selectedEmotion = savedEmotion;
    document.querySelectorAll(".emotion").forEach(btn => {
      btn.classList.toggle(
        "active",
        btn.dataset.emotion === selectedEmotion
      );
    });
  }

  resumeActiveJob();
    showStatus("✅ Voice clone created", "success");
  } catch (e) {
    showStatus("❌ " + e.message, "error");
  }
}


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
    alert('Removed "' + name + '" from saved voices');
  } else {
    saved.unshift({
      id: id || name,
      name: name,
      lang: lang || 'ar',
      audio: audio || '',
      date: new Date().toISOString()
    });
    alert('Saved "' + name + '" to saved voices successfully!');
  }

  localStorage.setItem('user_saved_voices', JSON.stringify(saved));
  localStorage.setItem('recentVoices', JSON.stringify(saved));

  if (typeof window.loadRecentVoices === 'function') {
    window.loadRecentVoices();
  } else if (typeof window.renderRecentVoices === 'function') {
    window.renderRecentVoices();
  }
};


/* --- STRICT SEPARATED SAVE BUTTON --- */
window.saveVoiceManualOnly = function(event, voiceId, voiceName, lang, audio) {
  if (event) {
    event.stopPropagation(); // Prevent navigation to the profile page or selection
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
    alert('Removed "' + voiceName + '" from saved voices');
  } else {
    saved.unshift({
      id: voiceId || voiceName,
      name: voiceName,
      lang: lang || 'ar',
      audio: audio || '',
      savedAt: new Date().toISOString()
    });
    alert('Saved "' + voiceName + '" to saved voices!');
  }

  localStorage.setItem('user_saved_voices', JSON.stringify(saved));
  localStorage.setItem('recentVoices', JSON.stringify(saved));

  if (typeof window.loadRecentVoices === 'function') {
    window.loadRecentVoices();
  } else if (typeof window.renderRecentVoices === 'function') {
    window.renderRecentVoices();
  }
};

/* ================================
   Speakoro Support Modal
   ================================ */

const SPEAKORO_SMARTLINK =
  "https://cowardrainbowactual.com/tht44es8sp?key=d7859f1b667778d53c4dfd041aaf0220";

const speakoroTranslations = {
  ar: {
    message:
      "❤️ ساعدنا في إبقاء هذه الخدمة مجانية وعالية الجودة. يمكنك دعمنا بزيارة رابط إعلاني سريع، أو تجاوز هذه الخطوة واستخدام الخدمة مباشرة. شكرًا لدعمك!",
    support: "❤️ دعمنا ومشاهدة الإعلان",
    skip: "تجاوز المساعدة"
  },
  en: {
    message:
      "❤️ Help us keep this service free and high quality. You can support us by visiting a quick ad link, or skip this step and use the service directly. Thank you for your support!",
    support: "❤️ Support Us & View Ad",
    skip: "Skip for now"
  }
};

function getSpeakoroLanguage() {
  const lang = (navigator.language || navigator.userLanguage || "ar").toLowerCase();
  return lang.startsWith("ar") ? "ar" : "en";
}

function updateSpeakoroModal() {
  const modal = document.getElementById("adModal");
  const message = document.getElementById("modalMessage");
  const support = document.getElementById("supportBtn");
  const skip = document.getElementById("skipBtn");

  if (!modal || !message || !support || !skip) return;

  const lang = getSpeakoroLanguage();
  const t = speakoroTranslations[lang];

  modal.dir = lang === "ar" ? "rtl" : "ltr";
  message.textContent = t.message;
  support.textContent = t.support;
  skip.textContent = t.skip;
}

function showAdModal() {
  const modal = document.getElementById("adModal");

  if (!modal) {
    generateSpeech();
    return;
  }

  updateSpeakoroModal();
  modal.style.display = "flex";
}

function closeSpeakoroModal() {
  const modal = document.getElementById("adModal");
  if (modal) modal.style.display = "none";
}

document.addEventListener("DOMContentLoaded", () => {
  const supportBtn = document.getElementById("supportBtn");
  const skipBtn = document.getElementById("skipBtn");
  const modal = document.getElementById("adModal");

  if (supportBtn) {
    supportBtn.addEventListener("click", () => {
      sessionStorage.setItem("speakoro_pending_generation", "1");

      window.location.href = SPEAKORO_SMARTLINK;
    });
  }

  window.addEventListener("pageshow", () => {
    const pending = sessionStorage.getItem("speakoro_pending_generation");

    if (pending === "1") {
      sessionStorage.removeItem("speakoro_pending_generation");

      closeSpeakoroModal();

      setTimeout(() => {
        generateSpeech();
      }, 250);
    }
  });

  if (skipBtn) {
    skipBtn.addEventListener("click", () => {
      closeSpeakoroModal();
      generateSpeech();
    });
  }

  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeSpeakoroModal();
      }
    });
  }
});

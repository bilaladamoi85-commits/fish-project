require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');
const ffmpegPath = require('ffmpeg-static');
const app = express();

const ttsJobs = new Map();
const RUNTIME_DIR = process.env.VERCEL
  ? path.join(os.tmpdir(), 'fish-project')
  : path.join(__dirname, 'runtime');

const AUDIO_DIR = path.join(RUNTIME_DIR, 'audio');
fs.mkdirSync(AUDIO_DIR, { recursive: true });


const PORT = process.env.PORT || 3001;
const FISH_API_KEY = process.env.FISH_AUDIO_API_KEY;
const FISH_BASE = 'https://api.fish.audio';
const FISH_MODEL = 's2.1-pro-free';

const CHUNK_SIZE = 900;
const PARALLEL = 30;

// ============================================================
// SpeakOra Security Layer - internal protection, no external service
// ============================================================

app.disable('x-powered-by');

const SPEAKORA_ALLOWED_ORIGINS = new Set([
  'https://speakoraa.vercel.app',
  'https://shynsuai.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001'
]);

const SPEAKORA_RATE_WINDOW = 60 * 1000;
const SPEAKORA_RATE_LIMITS = {
  default: 120,
  voices: 60,
  generation: 8,
  preview: 20,
  credits: 30,
  avatar: 60
};

const speakoraRateStore = new Map();

function speakoraClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '')
    .split(',')[0]
    .trim();

  return forwarded ||
    String(req.socket?.remoteAddress || 'unknown');
}

function speakoraRateLimit(bucket, limit) {
  return (req, res, next) => {
    const now = Date.now();
    const ip = speakoraClientIp(req);
    const key = `${bucket}:${ip}`;

    let entry = speakoraRateStore.get(key);

    if (!entry || now - entry.startedAt >= SPEAKORA_RATE_WINDOW) {
      entry = {
        startedAt: now,
        count: 0
      };
    }

    entry.count += 1;
    speakoraRateStore.set(key, entry);

    if (entry.count > limit) {
      const retryAfter =
        Math.max(
          1,
          Math.ceil(
            (SPEAKORA_RATE_WINDOW - (now - entry.startedAt)) / 1000
          )
        );

      res.setHeader('Retry-After', String(retryAfter));

      return res.status(429).json({
        error: 'Too many requests',
        message: 'Please try again later.'
      });
    }

    next();
  };
}

// Remove expired in-memory rate-limit records.
setInterval(() => {
  const now = Date.now();

  for (const [key, entry] of speakoraRateStore.entries()) {
    if (now - entry.startedAt >= SPEAKORA_RATE_WINDOW) {
      speakoraRateStore.delete(key);
    }
  }
}, SPEAKORA_RATE_WINDOW).unref();

// Security headers.
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()'
  );
  res.setHeader(
    'Cross-Origin-Resource-Policy',
    'same-origin'
  );

  next();
});

// Controlled CORS.
// Requests without an Origin (for example server-to-server calls) remain
// possible, while browser cross-origin requests are restricted.
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || SPEAKORA_ALLOWED_ORIGINS.has(origin)) {
      return callback(null, true);
    }

    return callback(
      new Error('CORS origin not allowed')
    );
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  maxAge: 86400
}));

// Reject obviously invalid API requests before they reach expensive handlers.
app.use('/api', (req, res, next) => {
  const contentLength = Number(req.headers['content-length'] || 0);

  if (
    Number.isFinite(contentLength) &&
    contentLength > 10 * 1024 * 1024
  ) {
    return res.status(413).json({
      error: 'Request too large'
    });
  }

  const userAgent = String(req.headers['user-agent'] || '').trim();

  if (
    userAgent.length > 500 ||
    /sqlmap|nikto|masscan|nmap|zgrab|gobuster|dirbuster/i.test(userAgent)
  ) {
    return res.status(403).json({
      error: 'Request blocked'
    });
  }

  next();
});

// General API rate limit.
app.use(
  '/api',
  speakoraRateLimit(
    'default',
    SPEAKORA_RATE_LIMITS.default
  )
);

// Expensive endpoints receive stricter limits.
app.use(
  '/api/tts',
  speakoraRateLimit(
    'generation',
    SPEAKORA_RATE_LIMITS.generation
  )
);

app.use(
  '/api/voice-preview',
  speakoraRateLimit(
    'preview',
    SPEAKORA_RATE_LIMITS.preview
  )
);

app.use(
  '/api/voices',
  speakoraRateLimit(
    'voices',
    SPEAKORA_RATE_LIMITS.voices
  )
);

app.use(
  '/api/credits',
  speakoraRateLimit(
    'credits',
    SPEAKORA_RATE_LIMITS.credits
  )
);

app.use(
  '/api/voice-avatar',
  speakoraRateLimit(
    'avatar',
    SPEAKORA_RATE_LIMITS.avatar
  )
);

// JSON body protection.
app.use(express.json({
  limit: '2mb',
  strict: true
}));

// Static files.
app.use(express.static(path.join(__dirname, 'public'), {
  dotfiles: 'deny',
  index: 'index.html'
}));

function normalizeArabicTTS(text) {
  let s = String(text || "");

  // Normalize Unicode Arabic forms.
  s = s.normalize("NFC");

  // Remove tatweel and invisible formatting characters.
  s = s
    .replace(/ـ+/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");

  // Collapse whitespace so accidental spaces don't become pauses.
  s = s.replace(/\s+/g, " ").trim();

  // Reduce repeated punctuation that can create unnatural pauses.
  s = s
    .replace(/([،,:;.!؟?]){2,}/g, "$1")
    .replace(/\.{2,}/g, "،")
    .replace(/،{2,}/g, "،")
    .replace(/!{2,}/g, "!")
    .replace(/؟{2,}/g, "؟");

  // Remove spaces before punctuation and keep a single space after it.
  s = s
    .replace(/\s+([،,:;.!؟?])/g, "$1")
    .replace(/([،؛:])\s*/g, "$1 ")
    .replace(/([.!؟])\s*/g, "$1 ");

  // Keep sentence punctuation readable without creating huge gaps.
  s = s.replace(/\s{2,}/g, " ").trim();

  return s;
}

function splitText(text, maxChars = CHUNK_SIZE) {
  const clean = String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  if (!clean) return [];

  // Short text: no unnecessary splitting.
  if (clean.length <= 1200) {
    return [clean];
  }

  const chunks = [];
  let remaining = clean;

  // Prefer natural sentence/paragraph boundaries.
  const boundaryChars = [
    '\n\n',
    '\n',
    '。',
    '！',
    '？',
    '!',
    '?',
    '.',
    '؛',
    ';',
    ':',
    '،',
    ','
  ];

  while (remaining.length > maxChars) {
    let cut = -1;

    // Search backwards for the best natural boundary.
    for (const boundary of boundaryChars) {
      const candidate = remaining.lastIndexOf(boundary, maxChars);

      if (candidate > Math.floor(maxChars * 0.55)) {
        const candidateEnd = candidate + boundary.length;

        if (cut === -1 || candidateEnd > cut) {
          cut = candidateEnd;
        }
      }
    }

    // If no good punctuation boundary exists, cut at a space.
    if (cut === -1) {
      const space = remaining.lastIndexOf(' ', maxChars);

      if (space > Math.floor(maxChars * 0.55)) {
        cut = space;
      }
    }

    // Last-resort hard cut.
    if (cut === -1 || cut < 1) {
      cut = maxChars;
    }

    const piece = remaining.slice(0, cut).trim();

    if (piece) {
      chunks.push(piece);
    }

    remaining = remaining.slice(cut).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  return chunks;
}

function applyEmotion(text, emotion) {
  const tags = {
    excited: '[excited]',
    sad: '[sad]',
    angry: '[angry]',
    calm: '[calm]',
    whispering: '[whisper]',
    laughing: '[chuckle]',
    emphasis: '[emphasis]'
  };

  if (
    !emotion ||
    emotion === 'neutral' ||
    !tags[emotion]
  ) {
    return text;
  }

  return `${tags[emotion]} ${text}`;
}


async function withRetry(fn, retries = 3) {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.log(`Retry ${attempt}/${retries}...`);

      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, 1500 * attempt));
      }
    }
  }

  throw lastError;
}


async function getMp3Duration(buffer) {
  return 0;
}

function getMaxAllowedDuration(text) {
  const chars = String(text || '').trim().length;

  // Generous safety limit:
  // roughly 1 second per 3 characters, with sensible minimum/maximum.
  return Math.min(
    300,
    Math.max(20, Math.ceil(chars / 3))
  );
}


function getVoicePreviewText(voice) {
  const languages = Array.isArray(voice?.languages)
    ? voice.languages
    : [];

  const lang = String(
    voice?.language ||
    languages[0] ||
    ''
  ).toLowerCase().split('-')[0];

  // Short preview sentences (~5–7 seconds).
  // Keep these natural and language-specific.
  const previews = {
    ar: 'مرحباً، سعيد بلقائك اليوم. أتمنى أن يكون يومك رائعاً.',
    en: 'Hello, it is a pleasure to meet you. Have a wonderful day.',
    fr: 'Bonjour, ravi de vous rencontrer. Je vous souhaite une excellente journée.',
    es: 'Hola, es un placer conocerte. Que tengas un excelente día.',
    de: 'Hallo, schön dich kennenzulernen. Ich wünsche dir einen schönen Tag.',
    it: 'Ciao, è un piacere conoscerti. Ti auguro una splendida giornata.',
    pt: 'Olá, é um prazer conhecer você. Tenha um ótimo dia.',
    nl: 'Hallo, leuk je te ontmoeten. Ik wens je een fijne dag.',
    tr: 'Merhaba, seninle tanıştığıma memnun oldum. Harika bir gün geçir.',
    ru: 'Здравствуйте, рад с вами познакомиться. Желаю вам прекрасного дня.',
    uk: 'Вітаю, радий з вами познайомитися. Бажаю вам чудового дня.',
    pl: 'Cześć, miło cię poznać. Życzę ci wspaniałego dnia.',
    cs: 'Ahoj, rád tě poznávám. Přeji ti krásný den.',
    sv: 'Hej, trevligt att träffas. Jag önskar dig en fantastisk dag.',
    da: 'Hej, dejligt at møde dig. Jeg ønsker dig en rigtig god dag.',
    no: 'Hei, hyggelig å møte deg. Jeg ønsker deg en flott dag.',
    fi: 'Hei, mukava tavata sinut. Toivotan sinulle mahtavaa päivää.',
    ja: 'こんにちは、お会いできてうれしいです。素敵な一日をお過ごしください。',
    ko: '안녕하세요, 만나서 반갑습니다. 좋은 하루 보내세요.',
    zh: '你好，很高兴见到你。祝你今天过得愉快。',
    hi: 'नमस्ते, आपसे मिलकर खुशी हुई। आपका दिन शुभ हो।',
    id: 'Halo, senang bertemu denganmu. Semoga harimu menyenangkan.',
    vi: 'Xin chào, rất vui được gặp bạn. Chúc bạn một ngày tuyệt vời.',
    th: 'สวัสดี ยินดีที่ได้พบคุณ ขอให้วันนี้เป็นวันที่ดี',
    he: 'שלום, נעים מאוד להכיר אותך. שיהיה לך יום נפלא.',
    el: 'Γεια σας, χαίρομαι που σας γνωρίζω. Να έχετε μια υπέροχη μέρα.'
  };

  return previews[lang] || previews.en;
}
async function fishTTS(text, voiceId, partNumber = 0, signal = null) {
  if (!FISH_API_KEY) {
    throw new Error(
      'FISH_AUDIO_API_KEY غير موجود في .env'
    );
  }

  if (signal?.aborted) {
    const err = new Error('TTS cancelled');
    err.code = 'TTS_CANCELLED';
    throw err;
  }

  const started = Date.now();

  console.log(
    `🎙️ Fish request Part ${partNumber || "?"} (${text.length} chars)`
  );

  const request = axios({
    method: 'POST',
    url: `${FISH_BASE}/v1/tts`,
    headers: {
      Authorization: `Bearer ${FISH_API_KEY}`,
      'Content-Type': 'application/json',
      model: FISH_MODEL
    },
    data: {
      text,
      reference_id: voiceId,
      format: 'mp3'
    },
    responseType: 'arraybuffer',
    timeout: 300000,
    signal,
    maxContentLength: Infinity,
    maxBodyLength: Infinity
  });

  let response;

  try {
    response = await request;
  } catch (error) {
    if (
      signal?.aborted ||
      error?.code === 'ERR_CANCELED'
    ) {
      const err = new Error('TTS cancelled');
      err.code = 'TTS_CANCELLED';
      throw err;
    }

    throw error;
  }

  const seconds =
    ((Date.now() - started) / 1000).toFixed(1);

  const audioBuffer =
    Buffer.from(response.data);

  const audioDuration =
    await getMp3Duration(audioBuffer);

  const maxAllowed =
    getMaxAllowedDuration(text);

  console.log(
    `🎧 Part ${partNumber || "?"}: ${audioDuration.toFixed(2)}s audio / max ${maxAllowed}s`
  );

  if (audioDuration > maxAllowed) {
    throw new Error(
      `Fish Audio رجّع مدة غير طبيعية: ${audioDuration.toFixed(1)}s ` +
      `لـ ${String(text).length} حرف (الحد ${maxAllowed}s)`
    );
  }

  console.log(
    `✅ Part ${partNumber || "?"} finished in ${seconds}s`
  );

  return audioBuffer;
}

async function runParallel(items, worker, concurrency = PARALLEL) {
  const results = new Array(items.length);
  let nextIndex = 0;

  async function runner() {
    while (true) {
      const index = nextIndex++;

      if (index >= items.length) {
        return;
      }

      results[index] = await worker(
        items[index],
        index
      );
    }
  }

  const workers = Math.min(
    concurrency,
    items.length
  );

  await Promise.all(
    Array.from(
      { length: workers },
      () => runner()
    )
  );

  return results;
}

async function mergeMp3(buffers) {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), 'fish-audio-')
  );

  const files = [];

  try {
    for (let i = 0; i < buffers.length; i++) {
      const file = path.join(
        tempDir,
        `part-${String(i).padStart(5, '0')}.mp3`
      );

      fs.writeFileSync(file, buffers[i]);
      files.push(file);
    }

    const listFile = path.join(tempDir, 'inputs.txt');
    const outputFile = path.join(tempDir, 'merged.mp3');

    const list = files
      .map(file => `file '${file.replace(/'/g, "'\\''")}'`)
      .join('\n');

    fs.writeFileSync(listFile, list + '\n', 'utf8');

    await new Promise((resolve, reject) => {
      execFile(
        ffmpegPath,
        [
          '-hide_banner',
          '-loglevel', 'error',
          '-f', 'concat',
          '-safe', '0',
          '-i', listFile,
          '-vn',
          '-c:a', 'libmp3lame',
          '-b:a', '192k',
          '-ar', '44100',
          '-ac', '2',
          '-y',
          outputFile
        ],
        {
          maxBuffer: 2 * 1024 * 1024
        },
        (error, stdout, stderr) => {
          if (error) {
            reject(
              new Error(
                `FFmpeg merge failed: ${stderr || error.message}`
              )
            );
            return;
          }

          resolve();
        }
      );
    });

    const finalBuffer = fs.readFileSync(outputFile);

    console.log(
      `🔗 FFmpeg merge complete: ${files.length} parts -> ${(
        finalBuffer.length / 1024 / 1024
      ).toFixed(2)} MB`
    );

    return finalBuffer;

  } finally {
    try {
      fs.rmSync(tempDir, {
        recursive: true,
        force: true
      });
    } catch (_) {}
  }
}
async function processTTSJob(job, prepared, voiceId, originalText) {
  const startedAt = job.startedAt;

  try {
    const audioParts = await runParallel(
      prepared,
      async (chunk, index) => {
        const part = job.chunks[index];

        part.status = 'generating';
        part.startedAt = Date.now();
        job.running++;

        console.log(
          `▶️ Job ${job.id} Part ${index + 1}/${prepared.length}`
        );

        try {
          const audio = await fishTTS(
            chunk,
            voiceId,
            index + 1
          );

          part.status = 'done';
          part.finishedAt = Date.now();

          const duration =
            (part.finishedAt - part.startedAt) / 1000;

          job.partTimes.push(duration);
          job.completed++;
          job.running--;

          return audio;
        } catch (error) {
          part.status = 'failed';
          part.finishedAt = Date.now();
          job.running--;

          throw error;
        }
      },
      PARALLEL
    );

    job.merging = true;

    console.log(`🔄 Job ${job.id}: merging ${audioParts.length} parts...`);

    const finalAudio = await mergeMp3(audioParts);

    const outputFile =
      path.join(AUDIO_DIR, `${job.id}.mp3`);

    fs.writeFileSync(outputFile, finalAudio);

    job.audioUrl =
      `/api/audio/${encodeURIComponent(job.id)}`;

    job.merging = false;
    job.completed = prepared.length;
    job.finished = true;
    job.finishedAt = Date.now();

    job.processingSeconds =
      Number(((job.finishedAt - startedAt) / 1000).toFixed(1));

    console.log(
      `🎉 Job ${job.id} finished in ${job.processingSeconds}s`
    );

  } catch (error) {
    job.merging = false;
    job.failed = true;
    job.finished = false;
    job.error =
      error.response?.data ||
      error.message ||
      'TTS failed';
    job.finishedAt = Date.now();

    console.error(
      `❌ Job ${job.id} failed:`,
      error.response?.data || error.message
    );
  }
}

app.get('/api/audio/:jobId', (req, res) => {
  try {
    const rawId = String(req.params.jobId || '').trim();

    if (!rawId) {
      return res.status(400).json({
        success: false,
        error: 'Missing audio id'
      });
    }

    // Keep only safe filename characters.
    const safeId = rawId
      .replace(/\.mp3$/i, '')
      .replace(/[^a-zA-Z0-9_-]/g, '');

    if (!safeId) {
      return res.status(400).json({
        success: false,
        error: 'Invalid audio id'
      });
    }

    // Preview files are saved as:
    // runtime/audio/preview-VOICE_ID.mp3
    const fileName = `${safeId}.mp3`;
    const filePath = path.join(AUDIO_DIR, fileName);

    console.log(`🔊 Audio request: ${fileName}`);

    if (!fs.existsSync(filePath)) {
      console.log(`❌ Audio not found: ${filePath}`);

      return res.status(404).json({
        success: false,
        error: 'Audio file not found',
        file: fileName
      });
    }

    const stat = fs.statSync(filePath);

    if (!stat.size) {
      return res.status(404).json({
        success: false,
        error: 'Audio file is empty'
      });
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

    return res.sendFile(filePath);
  } catch (error) {
    console.error('❌ Audio serve error:', error);

    return res.status(500).json({
      success: false,
      error: 'Failed to serve audio'
    });
  }
});
app.get('/api/tts-progress/:jobId', (req, res) => {
  const job = ttsJobs.get(req.params.jobId);

  if (!job) {
    return res.status(404).json({
      error: 'Job not found'
    });
  }

  const now = Date.now();
  const elapsed = Math.max(
    0,
    (now - job.startedAt) / 1000
  );

  let eta = null;

  if (!job.finished && !job.failed && job.completed > 0) {
    const average =
      job.partTimes.reduce((a, b) => a + b, 0) /
      job.partTimes.length;

    const remainingParts =
      Math.max(0, job.total - job.completed);

    const batches =
      Math.ceil(remainingParts / PARALLEL);

    eta = Math.max(
      0,
      batches * average
    );

    if (job.running > 0) {
      eta = Math.max(
        0,
        ((remainingParts / PARALLEL) + 0.2) * average
      );
    }
  }

  if (job.merging && eta === null) {
    eta = 3;
  }

  res.json({
    success: true,
    jobId: job.id,
    total: job.total,
    completed: job.completed,
    running: job.running,
    merging: Boolean(job.merging),
    finished: Boolean(job.finished),
    failed: Boolean(job.failed),
    error: job.error || null,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt || null,
    elapsed,
    eta,
    audioUrl: job.audioUrl || null,
    processingSeconds: job.processingSeconds,
    voiceId: job.voiceId,
    emotion: job.emotion,
    parts: job.chunks
  });
});

app.get('/api/credits', (req, res) => {
  res.json({
    balance: null,
    message:
      'Credits are managed by Fish Audio'
  });
});

app.post('/api/clone-voice', (req, res) => {
  res.status(501).json({
    error:
      'Voice cloning UI needs migration to the current Fish Audio API.'
  });
});

app.get("/privacy", (req,res) => res.sendFile(path.join(__dirname,"public","legal.html")));
app.get("/terms", (req,res) => res.sendFile(path.join(__dirname,"public","legal.html")));
app.get("/about", (req,res) => res.sendFile(path.join(__dirname,"public","legal.html")));

app.get('*', (req, res) => {
  res.sendFile(
    path.join(
      __dirname,
      'public',
      'index.html'
    )
  );
});


app.get('/api/voice-avatar', async (req, res) => {
  try {
    const avatar = String(req.query.path || '').trim();

    if (!avatar || avatar.includes('..') || avatar.startsWith('http://') || avatar.startsWith('https://')) {
      return res.status(400).send('Invalid avatar path');
    }

    const upstream = await axios.get(`${FISH_BASE}/${avatar.replace(/^\/+/, '')}`, {
      responseType: 'arraybuffer',
      validateStatus: () => true,
      timeout: 15000
    });

    const contentType = upstream.headers['content-type'] || '';

    if (upstream.status >= 200 && upstream.status < 300 && contentType.startsWith('image/')) {
      res.set('Content-Type', contentType);
      res.set('Cache-Control', 'public, max-age=86400');
      return res.send(Buffer.from(upstream.data));
    }

    return res.status(404).send('Avatar not found');
  } catch (err) {
    console.error('Avatar proxy error:', err.message);
    return res.status(500).send('Avatar proxy error');
  }
});

app.listen(PORT, () => {
  console.log('');
  console.log(
    '🚀 Fish Audio Voice App'
  );
  console.log(
    `🌐 http://localhost:${PORT}`
  );
  console.log(
    `⚡ Parallel TTS: ${PARALLEL}`
  );
  console.log(
    `✂️ Chunk size: ${CHUNK_SIZE}`
  );
  console.log('');
});

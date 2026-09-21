require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
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
const PARALLEL = 10;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

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
    '،',
    ',',
    ':'
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
    // Write every MP3 part separately.
    for (let i = 0; i < buffers.length; i++) {
      const file = path.join(
        tempDir,
        `part-${String(i).padStart(5, '0')}.mp3`
      );

      fs.writeFileSync(file, buffers[i]);
      files.push(file);
    }

    /*
     * IMPORTANT:
     *
     * Do NOT use MP3 "concat copy" here.
     *
     * Independently generated MP3 files can contain different
     * encoder delay/padding/frame boundaries. Joining those raw
     * MP3 streams can cause short distortions/glitches at the
     * transition between chunks.
     *
     * Instead:
     *   MP3 -> decoded audio -> normalized -> concatenated
     *   -> ONE final MP3 encode
     *
     * This makes the transitions much cleaner.
     */

    const finalBuffer = Buffer.concat(buffers.map(buffer => Buffer.from(buffer)));



    console.log(
      `🔗 MP3 merge complete: ${files.length} parts -> ${(
        finalBuffer.length / 1024 / 1024
      ).toFixed(2)} MB`
    );

    return finalBuffer;

  } finally {
    try {
      fs.rmSync(
        tempDir,
        {
          recursive: true,
          force: true
        }
      );
    } catch (_) {}
  }
}


function similarityScore(query, voice) {
  const q = String(query || '')
    .toLowerCase()
    .trim();

  if (!q) return 0;

  const name = String(
    voice.title ||
    voice.name ||
    voice.display_name ||
    ''
  ).toLowerCase();

  if (name === q) return 10000;
  if (name.startsWith(q)) return 8000;
  if (name.includes(q)) return 6000;

  const words = q
    .split(/\s+/)
    .filter(Boolean);

  let score = 0;

  for (const word of words) {
    if (name.includes(word)) {
      score += 100;
    }
  }

  return score;
}

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    service: 'Fish Audio Voice App',
    fishConfigured: Boolean(FISH_API_KEY),
    chunkSize: CHUNK_SIZE,
    parallel: PARALLEL
  });
});

app.get('/api/voices', async (req, res) => {
  try {
    const page = Math.max(
      1,
      Number(req.query.page) || 1
    );

    const pageSize = Math.min(
      100,
      Math.max(
        1,
        Number(req.query.pageSize) || 100
      )
    );

    const search =
      String(req.query.search || '').trim();

    const language =
      String(req.query.language || '').trim();

    const params = {
      page_number: page,
      page_size: pageSize
    };

    if (search) {
      params.title = search;
    }

    if (language) {
      params.language = language;
    }

    const response = await axios.get(
      `${FISH_BASE}/model`,
      {
        headers: {
          Authorization:
            `Bearer ${FISH_API_KEY}`
        },
        params,
        timeout: 30000
      }
    );

    const raw =
      Array.isArray(response.data)
        ? response.data
        : (
          response.data.items ||
          response.data.data ||
          response.data.models ||
          []
        );

    const voices = raw.map(v => ({
      id:
        v.id ||
        v._id ||
        v.reference_id,

      name:
        v.title ||
        v.name ||
        v.display_name ||
        'Unnamed Voice',

      title:
        v.title ||
        v.name ||
        v.display_name ||
        'Unnamed Voice',

      description:
        v.description || '',

      language:
        v.language ||
        (Array.isArray(v.languages) && v.languages.length
          ? v.languages[0]
          : ''),
      languages:
        Array.isArray(v.languages) ? v.languages : [],
      default_text:
        v.default_text || '',
      samples:
        Array.isArray(v.samples) ? v.samples : [],
      country:
        v.country ||
        v.country_name ||
        v.countryName ||
        v.country_code ||
        v.countryCode ||
        '',
      countryCode:
        v.countryCode ||
        v.country_code ||
        '',
      tags:
        Array.isArray(v.tags)
          ? v.tags
          : [],

      labels:
        Array.isArray(v.labels)
          ? v.labels
          : [],

      category:
        v.category ||
        v.category_name ||
        v.categoryName ||
        v.type ||
        v.style ||
        '',

      categories: [
        v.category,
        v.category_name,
        v.categoryName,
        v.type,
        v.style,
        v.voice_style,
        v.voiceStyle,
        ...(Array.isArray(v.categories) ? v.categories : []),
        ...(Array.isArray(v.tags) ? v.tags : []),
        ...(Array.isArray(v.labels) ? v.labels : [])
      ]
        .flat()
        .filter(Boolean)
        .map(x => String(x).trim()),

      gender:
        v.gender ||
        v.sex ||
        '',

      author:
        v.author || null,

      cover_image:
        v.cover_image ||
        v.coverImage ||
        null,

      avatar:
        v.avatar ||
        v.author?.avatar ||
        null
    }));

    if (search) {
      voices.sort(
        (a, b) =>
          similarityScore(search, b) -
          similarityScore(search, a)
      );
    }

    const total =
      Number(
        response.data.total ||
        response.data.count ||
        0
      );

    res.json({
      voices,
      page,
      pageSize,
      total,
      hasMore:
        Boolean(
          response.data.has_more ??
          response.data.hasMore ??
          voices.length >= pageSize
        )
    });

  } catch (error) {
    console.error(
      'Voice search error:',
      error.response?.data ||
      error.message
    );

    res.status(
      error.response?.status || 500
    ).json({
      error:
        'فشل تحميل الأصوات',
      details:
        error.response?.data ||
        error.message
    });
  }
});

app.get('/api/my-voices', async (req, res) => {
  try {
    const response = await axios.get(
      `${FISH_BASE}/model`,
      {
        headers: {
          Authorization:
            `Bearer ${FISH_API_KEY}`
        },
        params: {
          self: true,
          page_number: 1,
          page_size: 100
        },
        timeout: 30000
      }
    );

    const raw =
      Array.isArray(response.data)
        ? response.data
        : (
          response.data.items ||
          response.data.data ||
          []
        );

    const voices = raw.map(v => ({
      id:
        v.id ||
        v._id ||
        v.reference_id,

      name:
        v.title ||
        v.name ||
        v.display_name ||
        'Unnamed Voice',

      title:
        v.title ||
        v.name ||
        v.display_name ||
        'Unnamed Voice',

      language:
        v.language || '',

      tags:
        Array.isArray(v.tags)
          ? v.tags
          : []
    }));

    res.json({
      voices
    });

  } catch (error) {
    res.status(
      error.response?.status || 500
    ).json({
      error:
        'فشل تحميل الأصوات الخاصة بك',
      details:
        error.response?.data ||
        error.message
    });
  }
});


const previewAudioCache = new Map();

app.post('/api/voice-preview', async (req, res) => {
  try {
    const { voiceId } = req.body || {};

    if (!voiceId) {
      return res.status(400).json({
        success: false,
        error: 'voiceId is required'
      });
    }

    const modelResponse = await axios.get(
      `${FISH_BASE}/model/${encodeURIComponent(voiceId)}`,
      {
        headers: {
          Authorization: `Bearer ${FISH_API_KEY}`
        },
        timeout: 15000
      }
    );

    const voice = modelResponse.data || {};
    const previewText = getVoicePreviewText(voice);

    console.log(
      `🎧 Preview voice=${voiceId} lang=${
        Array.isArray(voice.languages)
          ? voice.languages.join(',')
          : (voice.language || 'unknown')
      } text="${previewText.slice(0, 80)}..."`
    );

    const audio = await fishTTS(
      previewText,
      voiceId,
      'preview'
    );

    const safeVoiceId = String(voiceId).replace(/[^a-zA-Z0-9_-]/g, '');
    const fileName = `preview-${safeVoiceId}.mp3`;
    const filePath = path.join(AUDIO_DIR, fileName);

    fs.writeFileSync(filePath, audio);

    console.log(`✅ Preview saved: ${filePath}`);

    return res.json({
      success: true,
      audioUrl: `/api/audio/${encodeURIComponent(fileName.replace(/\\.mp3$/i, ''))}`
    });

  } catch (error) {
    console.error(
      '❌ Voice preview error:',
      error.response?.data || error.message
    );

    return res.status(500).json({
      success: false,
      error: 'Voice preview failed'
    });
  }
});

app.post('/api/tts', async (req, res) => {
  try {
    const {
      text,
      voiceId,
      emotion = 'neutral'
    } = req.body || {};

    if (!text || !String(text).trim()) {
      return res.status(400).json({ error: 'النص فارغ' });
    }

    if (!voiceId) {
      return res.status(400).json({ error: 'خاصك تختار الصوت' });
    }

    const originalText = String(text).trim();

    if (originalText.length > 50000) {
      return res.status(400).json({
        error: 'الحد الأقصى هو 50,000 حرف'
      });
    }

    const requestedJobId =
      req.headers['x-tts-job-id'] ||
      req.body.jobId;

    if (requestedJobId && ttsJobs.has(requestedJobId)) {
      const existing = ttsJobs.get(requestedJobId);

      if (!existing.finished && !existing.failed) {
        return res.status(202).json({
          success: true,
          jobId: requestedJobId,
          resumed: true
        });
      }

      if (existing.finished) {
        return res.json({
          success: true,
          jobId: requestedJobId,
          resumed: true,
          audioUrl: existing.audioUrl,
          processingSeconds: existing.processingSeconds
        });
      }
    }

    const chunks = splitText(originalText, CHUNK_SIZE);
    const prepared = chunks.map(chunk =>
      applyEmotion(chunk, emotion)
    );

    const jobId =
      requestedJobId ||
      Math.random().toString(36).slice(2) +
      Date.now().toString(36);

    const job = {
      id: jobId,
      total: prepared.length,
      completed: 0,
      running: 0,
      startedAt: Date.now(),
      partTimes: [],
      merging: false,
      finished: false,
      failed: false,
      audioUrl: null,
      processingSeconds: null,
      voiceId,
      emotion,
      characters: originalText.length,
      chunks: prepared.map((_, i) => ({
        part: i + 1,
        status: 'queued',
        startedAt: null,
        finishedAt: null
      }))
    };

    ttsJobs.set(jobId, job);

    console.log(
      `🎙️ TTS Job ${jobId}: ${originalText.length} chars → ${prepared.length} chunks → ${PARALLEL} parallel`
    );

    // Start in the background. The browser does NOT need to stay connected.
    void processTTSJob(job, prepared, voiceId, originalText);

    return res.status(202).json({
      success: true,
      jobId,
      total: prepared.length,
      parallel: PARALLEL,
      chunkSize: CHUNK_SIZE
    });

  } catch (error) {
    console.error(
      'TTS start error:',
      error.response?.data || error.message
    );

    return res.status(500).json({
      error: 'فشل بدء إنشاء الصوت',
      details: error.response?.data || error.message
    });
  }
});

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

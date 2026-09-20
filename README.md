# 🎤 Fish Audio Emotional Voice Generator

A powerful web application that transforms text into emotional speech using the Fish Audio API. Includes support for voice cloning!

![Fish Audio](https://img.shields.io/badge/Fish%20Audio-API-blue)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

## ✨ Features

- 🎤 **Text-to-Speech**: Convert text to natural-sounding speech
- 😊 **Emotional Voices**: Choose from various emotions (excited, sad, calm, angry, etc.)
- 🎯 **Voice Cloning**: Clone and use your own voice
- 🎨 **Beautiful UI**: Modern, responsive web interface
- 💾 **Download & Share**: Export audio files or share URLs
- ⚡ **Real-time Processing**: Fast audio generation
- 📱 **Mobile Friendly**: Works on desktop and mobile browsers

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ ([Download](https://nodejs.org/))
- **Fish Audio API Key** ([Get one here](https://fish.audio/))

### Installation (Windows)

1. **Extract the application folder**

2. **Get your API Key**:
   - Go to [https://fish.audio/](https://fish.audio/)
   - Sign up or log in
   - Get your API key from the dashboard

3. **Configure API Key**:
   - Open `.env` file in the app folder
   - Replace `YOUR_API_KEY_HERE` with your actual Fish Audio API key:
     ```
     FISH_AUDIO_API_KEY=sk-fish-YOUR_KEY_HERE
     ```

4. **Start the App**:
   - Double-click `start.bat`
   - The app will automatically install dependencies on first run
   - A browser window will open at `http://localhost:3000`

### Manual Start (Without Batch File)

```bash
# Install dependencies
npm install

# Start the server
npm start
```

Then open `http://localhost:3000` in your browser.

## 📖 How to Use

### Generate Speech

1. **Select a Voice**: Choose from recommended voices or your cloned voices
2. **Enter Text**: Type or paste the text you want to convert
3. **Choose Emotion**: Select an emotion (Neutral, Excited, Sad, Calm, etc.)
4. **Generate**: Click "Generate Speech"
5. **Listen & Download**: Play the audio or download the MP3

### Clone Your Voice

1. Click **"Clone Your Voice"** button
2. Enter a name for your cloned voice
3. Provide audio sample URLs (1-5 URLs, 10-60 seconds total recommended)
   - Tips for best results:
     - Use clear, clean audio
     - Minimize background noise
     - Use one speaker per clone
     - 10-60 seconds works best (up to 270s max)
4. Confirm you own/have permission for this voice
5. Click "Clone Voice"
6. Your cloned voice will appear in the "Your Cloned Voices" dropdown

### Example Audio URLs

If you need sample audio files to test cloning, use publicly hosted audio:
- Online voice recordings
- Audio from websites
- Podcast clips
- Audiobook samples

## 🎙️ Emotion Tags

The app supports various emotional delivery styles:

- 😐 **Neutral** - Normal, balanced tone
- 🤩 **Excited** - Enthusiastic and energetic
- 😢 **Sad** - Sorrowful, melancholic tone
- 😠 **Angry** - Aggressive, frustrated tone
- 🧘 **Calm** - Peaceful, relaxed delivery
- 🤫 **Whispering** - Soft, quiet speech
- 😂 **Laughing** - Cheerful with laughter
- ✨ **Emphasis** - Stressed, important delivery

## 💰 Credits System

- Text-to-Speech costs **1 credit per UTF-8 byte** of text
- Voice cloning is **FREE**
- Check your remaining credits in the top-right corner
- Upgrade your plan at [https://fish.audio/go-premium/](https://fish.audio/go-premium/)

## 📁 Project Structure

```
fish-audio-voice-app/
├── server.js           # Express backend server
├── package.json        # Node.js dependencies
├── .env               # Configuration (API key)
├── .env.example       # Example configuration
├── start.bat          # Windows startup script
├── public/
│   ├── index.html     # Main HTML interface
│   ├── styles.css     # UI styling
│   └── app.js         # Frontend logic
└── README.md          # This file
```

## 🔧 Configuration

### Environment Variables (.env)

```bash
# Your Fish Audio API Key (required)
FISH_AUDIO_API_KEY=sk-fish-YOUR_KEY_HERE

# Server port (optional, default: 3000)
PORT=3000
```

## 🛠️ API Endpoints

The app provides these backend endpoints:

```
GET  /api/health              # Health check
GET  /api/voices              # Get available voices
GET  /api/voices/:voiceId     # Get voice details
GET  /api/my-voices           # Get your cloned voices
GET  /api/credits             # Get credit balance
POST /api/tts                 # Generate speech
POST /api/clone-voice         # Clone a voice
```

## 🐛 Troubleshooting

### App won't start
- Ensure Node.js is installed: `node --version`
- Check .env file exists and has valid API key
- Delete `node_modules` folder and run `npm install` again

### "Failed to load voices"
- Verify your API key is correct
- Check your internet connection
- Make sure you're logged into Fish Audio account

### "Failed to generate speech"
- Check you have enough credits
- Verify the text isn't empty
- Ensure a voice is selected

### Voice clone fails
- Use 10-60 seconds of clean audio
- Ensure URLs are publicly accessible
- Try re-uploading with better quality audio

### "Port 3000 already in use"
- Change the PORT in .env file
- Or close the app using port 3000
- Or kill the process: `netstat -ano | findstr :3000`

## 📚 Learn More

- [Fish Audio Documentation](https://docs.fish.audio/)
- [Fish Audio API Reference](https://docs.fish.audio/api-reference/introduction)
- [Node.js Documentation](https://nodejs.org/docs/)

## ⚖️ License

MIT License - Feel free to use and modify for your projects

## 🤝 Support

Having issues? Check out:
- [Fish Audio Support](https://fish.audio/)
- Project troubleshooting section above
- Node.js documentation

---

**Made with ❤️ using Fish Audio API**

Happy voice generating! 🎙️✨

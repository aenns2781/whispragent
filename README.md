# OpenWhispr

A powerful open-source desktop voice assistant that combines speech-to-text, AI processing, and image generation. Features dual transcription engines (Local Whisper or ElevenLabs cloud), multi-provider AI support, and Gemini-powered image generation.

## Key Features

### Voice Transcription
- **Dual Transcription Engines**:
  - **ElevenLabs** (Recommended): Fastest & most accurate cloud transcription with real-time display
  - **Local Whisper**: 100% private - audio never leaves your device, works offline
- **58 Languages Supported**: Including auto-detect mode
- **Real-time Transcript**: See your words appear as you speak (ElevenLabs mode)
- **Global Hotkey**: Customizable hotkey to start/stop dictation from anywhere

### AI Agent Mode
- **Custom Agent Name**: Name your AI assistant (e.g., "Jarvis", "Alex", "Luna")
- **Three Trigger Methods**:
  1. Voice: Say "Hey [AgentName], write a professional email"
  2. Highlight text: Select text before pressing hotkey
  3. Screenshot: Press Cmd/Ctrl + hotkey to capture and analyze screen
- **OpenAI Models**:
  - GPT-5.1 (Most Capable)
  - GPT-5 Mini (Balanced)
  - GPT-5 Nano (Fastest)

### Image Generation
- **Gemini-Powered**: Generate AI images with voice commands
- **Hotkey**: Press Shift + your dictation hotkey
- **Models**:
  - Nano Banana (Fast)
  - Nano Banana Pro (Higher Quality)
- **Features**: Multiple aspect ratios, reference image support
- **History**: All generated images saved and accessible

### Smart Text Processing
- **Style Guide**: Custom writing instructions for AI responses
- **Dictionary**: Custom vocabulary recognition + auto-corrections
- **Snippets**: Text expansion triggers (e.g., "myemail" → full email address)
- **AI Suggestions**: Automatic phrase and correction recommendations

### Additional Features
- **Screenshot Analysis**: Cmd/Ctrl + hotkey captures screen for AI analysis
- **Automatic Pasting**: Transcribed text pastes directly at cursor
- **Transcription History**: SQLite database with search, export (CSV/JSON/TXT)
- **Launch on Startup**: Optional auto-start when computer boots
- **Cross-Platform**: macOS, Windows, and Linux support

## Quick Start

### For Beginners (Never Coded Before?)

**Step 1: Install Required Software**

1. **Install Node.js**: Download from https://nodejs.org/ (click the green "LTS" button)
2. **Install Git**: Download from https://git-scm.com/downloads

**Step 2: Download & Run**

```bash
# Open Terminal (Mac: Cmd+Space, type "Terminal") or Command Prompt (Windows)
cd ~/Documents
git clone https://github.com/aenns2781/whispragent.git
cd whispragent
npm install  # Wait 2-3 minutes
npm run dev  # App opens!
```

**Step 3: Follow the Setup Wizard**
- Choose transcription method (ElevenLabs recommended, or Local for privacy)
- Grant microphone permissions
- Set your hotkey (default: backtick `)
- Name your AI agent

### Building a Standalone App

```bash
npm run pack  # Creates unsigned app for personal use

# Find your app:
# macOS: dist/mac-arm64/OpenWhispr.app
# Windows: dist/win-unpacked/OpenWhispr.exe
```

**First launch on macOS**: Right-click → Open (or run `sudo xattr -rd com.apple.quarantine /Applications/OpenWhispr.app`)

## Usage

### Basic Dictation
1. Press your hotkey (default: `) to start recording
2. Speak naturally
3. Press hotkey again to stop and transcribe
4. Text automatically pastes at your cursor

### AI Agent Commands
- **Voice trigger**: "Hey [AgentName], summarize this email"
- **Highlight + hotkey**: Select text, press hotkey, speak command
- **Screenshot**: Cmd/Ctrl + hotkey, then speak about what you see

### Image Generation
1. Press Shift + your hotkey
2. Describe the image you want
3. AI generates and displays the result

### Control Panel Sections
- **Home**: Quick start and status
- **History**: View/search/export transcriptions and images
- **Dictionary**: Custom vocabulary and auto-corrections
- **Snippets**: Text expansion triggers
- **Style**: Writing style guide for AI
- **Dictation**: Hotkey and screenshot settings
- **AI Models**: Configure transcription engine and AI providers
- **System**: App settings and diagnostics
- **Help**: Documentation and support

## Configuration

### API Keys

**Method 1 - In-App** (Recommended):
Open Control Panel → AI Models → Enter your API keys

**Method 2 - Environment File**:
```bash
cp env.example .env
# Edit .env with your keys:
# OPENAI_API_KEY=your_key
# ANTHROPIC_API_KEY=your_key
# GEMINI_API_KEY=your_key
# ELEVENLABS_API_KEY=your_key
```

### Transcription Options

| Engine | Speed | Accuracy | Privacy | Requires |
|--------|-------|----------|---------|----------|
| ElevenLabs | Fastest | Best | Cloud | API Key |
| Local Whisper | Moderate | Good | 100% Local | None |

### Local Whisper Models

| Model | Size | Speed | Quality |
|-------|------|-------|---------|
| tiny | 39MB | Fastest | Basic |
| base | 74MB | Fast | Good (Recommended) |
| small | 244MB | Moderate | Better |
| medium | 769MB | Slower | High |
| large | 1.5GB | Slowest | Best |
| turbo | 809MB | Fast | Good |

## Platform Support

### macOS
- macOS 10.15+ (Intel & Apple Silicon)
- Permissions required: Microphone, Accessibility, Screen Recording (optional)
- Globe key support available (requires Xcode Command Line Tools)

### Windows
- Windows 10+
- No special permissions needed
- NSIS installer included

### Linux
Multiple package formats available:
```bash
npm run build:linux

# Outputs: AppImage, .deb, .rpm, .tar.gz
```

**Auto-paste requirements**:
- X11: `sudo apt install xdotool`
- Wayland: `sudo apt install wtype`

## Development

### Scripts
```bash
npm run dev          # Development with hot reload
npm start            # Production mode
npm run pack         # Build without signing
npm run build:mac    # macOS with signing
npm run build:win    # Windows with signing
npm run build:linux  # Linux packages
npm run lint         # Run ESLint
```

### Architecture
- **Main Window**: Minimal overlay for dictation (draggable, always-on-top)
- **Control Panel**: Full settings interface
- **Electron 36** with context isolation
- **React 19** + TypeScript + Tailwind CSS v4
- **better-sqlite3** for local database

### Project Structure
```
open-whispr/
├── main.js              # Electron main process
├── preload.js           # IPC bridge
├── whisper_bridge.py    # Local Whisper processing
├── src/
│   ├── App.jsx          # Main dictation UI
│   ├── components/
│   │   ├── ControlPanelV2.tsx
│   │   ├── OnboardingFlow.tsx
│   │   ├── ImageGenerationModal.tsx
│   │   └── panels/      # Control panel sections
│   ├── services/
│   │   ├── ReasoningService.ts      # Multi-provider AI
│   │   └── LocalReasoningService.ts # Local AI models
│   └── hooks/           # React hooks
└── assets/              # Icons and resources
```

## Troubleshooting

### Common Issues

**Microphone not working**
- Grant microphone permission in System Settings

**Text not pasting (macOS)**
- System Settings → Privacy & Security → Accessibility → Enable OpenWhispr
- Toggle OFF then ON if already enabled

**Screenshot not working (macOS)**
- System Settings → Privacy & Security → Screen Recording → Enable OpenWhispr

**ElevenLabs not transcribing**
- Check API key in Control Panel → AI Models
- Verify key at elevenlabs.io

**Local Whisper issues**
- Python 3.7+ required (app can install automatically)
- Check disk space for models

**Hotkey conflicts**
- Change hotkey in Control Panel → Dictation

### Getting Help
- Check [Issues](https://github.com/aenns2781/whispragent/issues)
- Review console logs (View → Toggle Developer Tools)

## Security & Privacy

- **Local Processing**: Voice data never leaves your device
- **No Analytics**: No usage data or telemetry collected
- **Open Source**: All code available for review
- **Secure Storage**: API keys stored in system keychain
- **Minimal Permissions**: Only requests necessary access

## License

MIT License - Free for personal and commercial use. See [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

**OpenWhispr** - Speak. Create. Command.

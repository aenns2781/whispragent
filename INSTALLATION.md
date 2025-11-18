# WhisprAgent Installation Guide

## macOS Installation

### Step 1: Download
- **Apple Silicon Macs (M1/M2/M3):** Download `OpenWhispr-1.0.12-arm64.dmg`
- **Intel Macs:** Download `OpenWhispr-1.0.12.dmg`

### Step 2: Install
1. Double-click the DMG file
2. Drag **OpenWhispr** to your **Applications** folder
3. **Don't open it yet!**

### Step 3: Bypass macOS Security (REQUIRED - App is unsigned)

**⚠️ IMPORTANT:** This app is **not signed or notarized** with an Apple Developer certificate ($99/year). macOS Gatekeeper will block it with a message saying **"macOS cannot verify that this app is free from malware"**.

**For macOS 15+ (2025):** The right-click > Open trick **NO LONGER WORKS**. You MUST use the Terminal command below.

**For macOS 14 and earlier:** You can try right-clicking first, but if blocked, use the Terminal command.

#### **Terminal Command (REQUIRED for macOS 15+)**
1. Open **Terminal** (Applications > Utilities > Terminal)
2. Copy and paste this command, then press Enter:
   ```bash
   sudo xattr -rd com.apple.quarantine /Applications/OpenWhispr.app
   ```
3. Enter your Mac password when prompted (you won't see it typing - that's normal)
4. Press Enter
5. You can now open OpenWhispr normally!

**What this does:** Removes the "quarantine" flag that macOS adds to downloaded apps. This is safe and only affects this one app.

#### **Alternative for older macOS (14 and below only)**
1. Go to Applications folder
2. **Right-click** (or Control+click) on **OpenWhispr**
3. Select **"Open"** from the menu
4. Click **"Open"** in the dialog
5. If still blocked: **System Settings** > **Privacy & Security** > Click **"Open Anyway"**

**Note:** If you see "app is damaged" error, the right-click method won't work. Use the Terminal command above.

### Step 4: First Run Setup
1. Open **OpenWhispr**
2. The app will start in the background (look for the icon in your menu bar)
3. Click the **Settings** icon
4. Add your API keys:
   - **OpenAI API Key** (required) - Get from https://platform.openai.com/api-keys
   - **Anthropic API Key** (optional) - Get from https://console.anthropic.com
   - **Gemini API Key** (optional) - Get from https://aistudio.google.com/app/apikey
5. Set your hotkey (default: `)
6. Set your agent name (e.g., "Calvin", "Jarvis", etc.)

### Step 5: Permissions
WhisprAgent needs these permissions to work:
- **Microphone** - For voice dictation
- **Accessibility** - To paste text into other apps
- **Screen Recording** - For screenshot capture feature

macOS will prompt you for these when needed.

## Usage

### Voice Dictation
1. Click in any text field
2. Press your hotkey (default: `)
3. Speak your text
4. Press hotkey again to stop
5. Text appears at your cursor!

### Agent Mode (AI Processing)

**Trigger agent mode in 3 ways:**

1. **Say your agent's name:**
   - Press hotkey, say "Hey Calvin, write me a professional email about..."
   - Agent processes and pastes the result

2. **Highlight text first:**
   - Select any text in any app
   - Press hotkey and give a command: "Summarize this"
   - Agent has context from the highlighted text

3. **Take a screenshot:**
   - Press Cmd+hotkey (Cmd+` by default)
   - Drag to select screen region
   - Press hotkey and describe what you want: "What's the error in this code?"
   - Agent analyzes the screenshot

### Features
- Runs quietly in the background
- Auto-starts on login (optional)
- Complete transcription history
- Export history as CSV/JSON/TXT
- Cancel anytime by pressing hotkey during processing
- Supports 58 languages

## Troubleshooting

**"App is damaged" or "cannot verify malware" error:**
- Run: `sudo xattr -rd com.apple.quarantine /Applications/OpenWhispr.app` in Terminal
- This removes macOS quarantine flag and allows the app to run

**No audio detected:**
- Check microphone permissions in System Settings
- Select correct microphone in WhisprAgent settings

**Text not pasting:**
- Grant Accessibility permission in System Settings > Privacy & Security

**Screenshot not working:**
- Grant Screen Recording permission in System Settings > Privacy & Security

## Support
For issues or questions, visit: https://github.com/aenns2781/whispragent

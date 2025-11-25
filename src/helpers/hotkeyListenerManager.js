const { spawn } = require("child_process");
const path = require("path");
const EventEmitter = require("events");
const fs = require("fs");

// Map of key names to macOS keyCodes
const KEY_CODES = {
  "`": 50,
  "1": 18,
  "2": 19,
  "3": 20,
  "4": 21,
  "5": 23,
  "6": 22,
  "7": 26,
  "8": 28,
  "9": 25,
  "0": 29,
  "-": 27,
  "=": 24,
  "q": 12,
  "w": 13,
  "e": 14,
  "r": 15,
  "t": 17,
  "y": 16,
  "u": 32,
  "i": 34,
  "o": 31,
  "p": 35,
  "[": 33,
  "]": 30,
  "\\": 42,
  "a": 0,
  "s": 1,
  "d": 2,
  "f": 3,
  "g": 5,
  "h": 4,
  "j": 38,
  "k": 40,
  "l": 37,
  ";": 41,
  "'": 39,
  "z": 6,
  "x": 7,
  "c": 8,
  "v": 9,
  "b": 11,
  "n": 45,
  "m": 46,
  ",": 43,
  ".": 47,
  "/": 44,
  "space": 49,
  "F1": 122,
  "F2": 120,
  "F3": 99,
  "F4": 118,
  "F5": 96,
  "F6": 97,
  "F7": 98,
  "F8": 100,
  "F9": 101,
  "F10": 109,
  "F11": 103,
  "F12": 111,
};

class HotkeyListenerManager extends EventEmitter {
  constructor() {
    super();
    this.process = null;
    this.isSupported = process.platform === "darwin";
    this.hasReportedError = false;
    this.currentKeyCode = null;
  }

  start(hotkey = "`") {
    if (!this.isSupported) {
      console.log("[HotkeyListener] Not supported on this platform");
      return false;
    }

    // Stop existing process if running
    this.stop();

    const keyCode = KEY_CODES[hotkey.toLowerCase()] || KEY_CODES[hotkey];
    if (!keyCode && keyCode !== 0) {
      console.error(`[HotkeyListener] Unknown hotkey: ${hotkey}`);
      return false;
    }

    this.currentKeyCode = keyCode;

    const listenerPath = this.resolveListenerBinary();
    if (!listenerPath) {
      console.error("[HotkeyListener] Binary not found. Run `npm run compile:hotkey`");
      return false;
    }

    try {
      fs.accessSync(listenerPath, fs.constants.X_OK);
    } catch (accessError) {
      console.error(`[HotkeyListener] Binary not executable: ${listenerPath}`);
      return false;
    }

    this.hasReportedError = false;
    console.log(`[HotkeyListener] Starting native listener for keyCode ${keyCode} (${hotkey})`);

    this.process = spawn(listenerPath, [String(keyCode)]);

    this.process.stdout.setEncoding("utf8");
    this.process.stdout.on("data", (chunk) => {
      chunk
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => {
          if (line === "KEY_DOWN") {
            console.log(`[HotkeyListener] KEY_DOWN received`);
            this.emit("key-down");
          } else if (line === "KEY_UP") {
            console.log(`[HotkeyListener] KEY_UP received`);
            this.emit("key-up");
          }
        });
    });

    this.process.stderr.setEncoding("utf8");
    this.process.stderr.on("data", (data) => {
      const message = data.toString().trim();
      if (message.length > 0) {
        console.error("[HotkeyListener] stderr:", message);
        this.reportError(new Error(message));
      }
    });

    this.process.on("error", (error) => {
      this.reportError(error);
      this.process = null;
    });

    this.process.on("exit", (code, signal) => {
      this.process = null;
      if (code !== 0) {
        const error = new Error(
          `Hotkey listener exited with code ${code ?? "null"} signal ${signal ?? "null"}`
        );
        this.reportError(error);
      }
    });

    return true;
  }

  stop() {
    if (this.process) {
      console.log("[HotkeyListener] Stopping native listener");
      this.process.kill();
      this.process = null;
    }
  }

  reportError(error) {
    if (this.hasReportedError) {
      return;
    }
    this.hasReportedError = true;
    if (this.process) {
      try {
        this.process.kill();
      } catch {
        // ignore
      } finally {
        this.process = null;
      }
    }
    console.error("[HotkeyListener] error:", error);
    this.emit("error", error);
  }

  resolveListenerBinary() {
    const candidates = new Set([
      path.join(__dirname, "..", "..", "resources", "bin", "macos-hotkey-listener"),
      path.join(__dirname, "..", "..", "resources", "macos-hotkey-listener"),
    ]);

    if (process.resourcesPath) {
      [
        path.join(process.resourcesPath, "macos-hotkey-listener"),
        path.join(process.resourcesPath, "bin", "macos-hotkey-listener"),
        path.join(process.resourcesPath, "resources", "macos-hotkey-listener"),
        path.join(process.resourcesPath, "resources", "bin", "macos-hotkey-listener"),
        path.join(
          process.resourcesPath,
          "app.asar.unpacked",
          "resources",
          "macos-hotkey-listener"
        ),
        path.join(
          process.resourcesPath,
          "app.asar.unpacked",
          "resources",
          "bin",
          "macos-hotkey-listener"
        ),
      ].forEach((candidate) => candidates.add(candidate));
    }

    for (const candidate of candidates) {
      try {
        const stats = fs.statSync(candidate);
        if (stats.isFile()) {
          return candidate;
        }
      } catch {
        continue;
      }
    }

    return null;
  }
}

module.exports = HotkeyListenerManager;

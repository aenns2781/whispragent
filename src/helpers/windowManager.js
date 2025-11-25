const { app, screen, BrowserWindow } = require("electron");
const HotkeyManager = require("./hotkeyManager");
const HotkeyListenerManager = require("./hotkeyListenerManager");
const DragManager = require("./dragManager");
const MenuManager = require("./menuManager");
const DevServerManager = require("./devServerManager");
const {
  MAIN_WINDOW_CONFIG,
  CONTROL_PANEL_CONFIG,
  IMAGE_GENERATION_WINDOW_CONFIG,
  WindowPositionUtil,
} = require("./windowConfig");

class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.controlPanelWindow = null;
    this.imageGenerationWindow = null;
    this.tray = null;
    this.hotkeyManager = new HotkeyManager();
    this.hotkeyListenerManager = new HotkeyListenerManager(); // Native macOS listener
    this.dragManager = new DragManager();
    this.isQuitting = false;
    this.isMainWindowInteractive = false;
    this.useNativeListener = process.platform === "darwin"; // Use native listener on macOS
    this.currentHotkey = "`";

    app.on("before-quit", () => {
      this.isQuitting = true;
      this.hotkeyListenerManager.stop();
    });
  }

  async createMainWindow() {
    const display = screen.getPrimaryDisplay();
    const position = WindowPositionUtil.getMainWindowPosition(display);

    this.mainWindow = new BrowserWindow({
      ...MAIN_WINDOW_CONFIG,
      ...position,
    });

    if (process.platform === "darwin") {
      this.mainWindow.setSkipTaskbar(false);
    } else if (process.platform === "win32") {
      this.mainWindow.setSkipTaskbar(true);
    }

    this.setMainWindowInteractivity(false);
    this.registerMainWindowEvents();

    await this.loadMainWindow();
    await this.initializeHotkey();
    this.dragManager.setTargetWindow(this.mainWindow);
    MenuManager.setupMainMenu();

    this.mainWindow.webContents.on(
      "did-fail-load",
      async (_event, errorCode, errorDescription, validatedURL) => {
        console.error(
          "Failed to load main window:",
          errorCode,
          errorDescription,
          validatedURL
        );
        if (
          process.env.NODE_ENV === "development" &&
          validatedURL.includes("localhost:5174")
        ) {
          // Retry connection to dev server
          setTimeout(async () => {
            const isReady = await DevServerManager.waitForDevServer();
            if (isReady) {
              console.log("Dev server ready, reloading...");
              this.mainWindow.reload();
            }
          }, 2000);
        }
      }
    );

    this.mainWindow.webContents.on(
      "did-finish-load",
      () => {
        this.enforceMainWindowOnTop();
      }
    );
  }

  setMainWindowInteractivity(shouldCapture) {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return;
    }

    if (shouldCapture) {
      this.mainWindow.setIgnoreMouseEvents(false);
    } else {
      this.mainWindow.setIgnoreMouseEvents(true, { forward: true });
    }

    this.isMainWindowInteractive = shouldCapture;
  }

  async loadMainWindow() {
    const appUrl = DevServerManager.getAppUrl(false);
    if (process.env.NODE_ENV === "development") {
      const isReady = await DevServerManager.waitForDevServer();
      if (!isReady) {
        // Dev server not ready, continue anyway
      }
    }
    this.mainWindow.loadURL(appUrl);
  }

  async initializeHotkey() {
    const callback = () => {
      console.log(`🔥 [HOTKEY] Callback fired at ${Date.now()}`);
      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show();
      }
      console.log(`🔥 [HOTKEY] Sending toggle-dictation IPC at ${Date.now()}`);
      this.mainWindow.webContents.send("toggle-dictation");
    };

    const screenshotCallback = () => {
      console.log("Screenshot hotkey triggered!");
      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show();
      }
      this.mainWindow.webContents.send("toggle-screenshot");
      console.log("Sent toggle-screenshot event to renderer");
    };

    const imageGenCallback = () => {
      console.log("Image generation hotkey triggered!");

      // Show/create image generation window
      if (!this.imageGenerationWindow || this.imageGenerationWindow.isDestroyed()) {
        this.createImageGenerationWindow();
      } else {
        if (this.imageGenerationWindow.isMinimized()) {
          this.imageGenerationWindow.restore();
        }
        if (!this.imageGenerationWindow.isVisible()) {
          this.imageGenerationWindow.show();
        }
        this.imageGenerationWindow.focus();
      }
    };

    // On macOS, try to use native listener for main dictation hotkey (more reliable)
    if (this.useNativeListener && this.currentHotkey !== "GLOBE") {
      console.log(`🔧 [HOTKEY] Using native macOS listener for "${this.currentHotkey}"`);

      // Set up native listener for dictation
      this.hotkeyListenerManager.removeAllListeners();
      this.hotkeyListenerManager.on("key-down", callback);

      const started = this.hotkeyListenerManager.start(this.currentHotkey);
      if (started) {
        console.log(`✅ [HOTKEY] Native listener started for "${this.currentHotkey}"`);
        // Still use Electron's globalShortcut for screenshot and image gen (with modifiers)
        await this.hotkeyManager.initializeHotkey(this.mainWindow, () => {}, screenshotCallback, imageGenCallback);
        return;
      } else {
        console.log(`⚠️ [HOTKEY] Native listener failed, falling back to Electron globalShortcut`);
      }
    }

    // Fallback to Electron's globalShortcut
    await this.hotkeyManager.initializeHotkey(this.mainWindow, callback, screenshotCallback, imageGenCallback);
  }

  async updateHotkey(hotkey) {
    this.currentHotkey = hotkey;

    const callback = () => {
      console.log(`🔥 [HOTKEY] Callback fired at ${Date.now()}`);
      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show();
      }
      this.mainWindow.webContents.send("toggle-dictation");
    };

    const screenshotCallback = () => {
      console.log("Screenshot hotkey triggered!");
      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show();
      }
      this.mainWindow.webContents.send("toggle-screenshot");
      console.log("Sent toggle-screenshot event to renderer");
    };

    const imageGenCallback = () => {
      console.log("Image generation hotkey triggered!");

      // Show/create image generation window
      if (!this.imageGenerationWindow || this.imageGenerationWindow.isDestroyed()) {
        this.createImageGenerationWindow();
      } else {
        if (this.imageGenerationWindow.isMinimized()) {
          this.imageGenerationWindow.restore();
        }
        if (!this.imageGenerationWindow.isVisible()) {
          this.imageGenerationWindow.show();
        }
        this.imageGenerationWindow.focus();
      }
    };

    // On macOS, use native listener for main dictation hotkey (more reliable)
    if (this.useNativeListener && hotkey !== "GLOBE") {
      console.log(`🔧 [HOTKEY] Updating native macOS listener for "${hotkey}"`);

      this.hotkeyListenerManager.removeAllListeners();
      this.hotkeyListenerManager.on("key-down", callback);

      const started = this.hotkeyListenerManager.start(hotkey);
      if (started) {
        console.log(`✅ [HOTKEY] Native listener updated for "${hotkey}"`);
        // Still use Electron for screenshot and image gen hotkeys
        return await this.hotkeyManager.updateHotkey(hotkey, () => {}, screenshotCallback, imageGenCallback);
      } else {
        console.log(`⚠️ [HOTKEY] Native listener failed, falling back to Electron globalShortcut`);
      }
    }

    return await this.hotkeyManager.updateHotkey(hotkey, callback, screenshotCallback, imageGenCallback);
  }

  async startWindowDrag() {
    return await this.dragManager.startWindowDrag();
  }

  async stopWindowDrag() {
    return await this.dragManager.stopWindowDrag();
  }

  async updateScreenshotModifier(modifier) {
    const callback = () => {
      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show();
      }
      this.mainWindow.webContents.send("toggle-dictation");
    };

    const screenshotCallback = () => {
      console.log("Screenshot hotkey triggered!");
      if (!this.mainWindow.isVisible()) {
        this.mainWindow.show();
      }
      this.mainWindow.webContents.send("toggle-screenshot");
      console.log("Sent toggle-screenshot event to renderer");
    };

    const imageGenCallback = () => {
      console.log("Image generation hotkey triggered!");

      // Show/create image generation window
      if (!this.imageGenerationWindow || this.imageGenerationWindow.isDestroyed()) {
        this.createImageGenerationWindow();
      } else {
        if (this.imageGenerationWindow.isMinimized()) {
          this.imageGenerationWindow.restore();
        }
        if (!this.imageGenerationWindow.isVisible()) {
          this.imageGenerationWindow.show();
        }
        this.imageGenerationWindow.focus();
      }
    };

    return this.hotkeyManager.updateScreenshotModifier(modifier, callback, screenshotCallback, imageGenCallback);
  }

  async createControlPanelWindow() {
    if (this.controlPanelWindow && !this.controlPanelWindow.isDestroyed()) {
      if (this.controlPanelWindow.isMinimized()) {
        this.controlPanelWindow.restore();
      }
      if (!this.controlPanelWindow.isVisible()) {
        this.controlPanelWindow.show();
      }
      this.controlPanelWindow.focus();
      return;
    }

    this.controlPanelWindow = new BrowserWindow(CONTROL_PANEL_CONFIG);

    this.controlPanelWindow.once("ready-to-show", () => {
      if (process.platform === "win32") {
        this.controlPanelWindow.setSkipTaskbar(false);
      }
      this.controlPanelWindow.show();
      this.controlPanelWindow.focus();
    });

    this.controlPanelWindow.on("show", () => {
      if (process.platform === "win32") {
        this.controlPanelWindow.setSkipTaskbar(false);
      }
    });

    this.controlPanelWindow.on("close", (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        if (process.platform === "darwin") {
          this.controlPanelWindow.minimize();
        } else {
          this.hideControlPanelToTray();
        }
      }
    });

    this.controlPanelWindow.on("closed", () => {
      this.controlPanelWindow = null;
    });

    // Set up menu for control panel to ensure text input works
    MenuManager.setupControlPanelMenu(this.controlPanelWindow);

    console.log("📱 Loading control panel content...");
    await this.loadControlPanel();
  }

  async loadControlPanel() {
    const appUrl = DevServerManager.getAppUrl(true);
    if (process.env.NODE_ENV === "development") {
      const isReady = await DevServerManager.waitForDevServer();
      if (!isReady) {
        console.error(
          "Dev server not ready for control panel, loading anyway..."
        );
      }
    }
    this.controlPanelWindow.loadURL(appUrl);
  }

  async createImageGenerationWindow() {
    if (this.imageGenerationWindow && !this.imageGenerationWindow.isDestroyed()) {
      if (this.imageGenerationWindow.isMinimized()) {
        this.imageGenerationWindow.restore();
      }
      if (!this.imageGenerationWindow.isVisible()) {
        this.imageGenerationWindow.show();
      }
      this.imageGenerationWindow.focus();
      return;
    }

    // Position window at bottom center of screen
    const { screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

    const windowWidth = IMAGE_GENERATION_WINDOW_CONFIG.width;
    const windowHeight = IMAGE_GENERATION_WINDOW_CONFIG.height;
    const x = Math.floor((screenWidth - windowWidth) / 2);
    const y = screenHeight - windowHeight - 40; // Much closer to bottom - only 40px gap

    this.imageGenerationWindow = new BrowserWindow({
      ...IMAGE_GENERATION_WINDOW_CONFIG,
      x,
      y,
    });

    this.imageGenerationWindow.once("ready-to-show", () => {
      this.imageGenerationWindow.show();
      this.imageGenerationWindow.focus();
      WindowPositionUtil.setupAlwaysOnTop(this.imageGenerationWindow);
    });

    this.imageGenerationWindow.on("close", (event) => {
      if (!this.isQuitting) {
        event.preventDefault();
        this.imageGenerationWindow.hide();
      }
    });

    this.imageGenerationWindow.on("closed", () => {
      this.imageGenerationWindow = null;
    });

    console.log("📸 Loading image generation window...");
    await this.loadImageGenerationWindow();
  }

  async loadImageGenerationWindow() {
    // Load with a special URL parameter to indicate it's the image generation window
    const baseUrl = DevServerManager.getAppUrl(false);
    const appUrl = `${baseUrl}?mode=image-generation`;

    if (process.env.NODE_ENV === "development") {
      const isReady = await DevServerManager.waitForDevServer();
      if (!isReady) {
        console.error(
          "Dev server not ready for image generation window, loading anyway..."
        );
      }
    }
    this.imageGenerationWindow.loadURL(appUrl);
  }

  showDictationPanel(options = {}) {
    const { focus = false } = options;
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (!this.mainWindow.isVisible()) {
        if (typeof this.mainWindow.showInactive === "function") {
          this.mainWindow.showInactive();
        } else {
          this.mainWindow.show();
        }
      }
      if (focus) {
        this.mainWindow.focus();
      }
    }
  }

  hideControlPanelToTray() {
    if (!this.controlPanelWindow || this.controlPanelWindow.isDestroyed()) {
      return;
    }

    if (process.platform === "win32") {
      this.controlPanelWindow.setSkipTaskbar(true);
    }

    this.controlPanelWindow.hide();
  }

  hideDictationPanel() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      if (process.platform === "darwin") {
        this.mainWindow.hide();
      } else {
        this.mainWindow.minimize();
      }
    }
  }

  isDictationPanelVisible() {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return false;
    }

    if (this.mainWindow.isMinimized && this.mainWindow.isMinimized()) {
      return false;
    }

    return this.mainWindow.isVisible();
  }

  registerMainWindowEvents() {
    if (!this.mainWindow) {
      return;
    }

    this.mainWindow.once("ready-to-show", () => {
      this.enforceMainWindowOnTop();
      // Window starts hidden - only shows when hotkey is pressed or tray menu is clicked
      // This keeps the app subtle and in the background
    });

    this.mainWindow.on("show", () => {
      this.enforceMainWindowOnTop();
    });

    this.mainWindow.on("focus", () => {
      this.enforceMainWindowOnTop();
    });

    this.mainWindow.on("blur", () => {
      setTimeout(() => {
        this.enforceMainWindowOnTop();
      }, 100);
    });

    this.mainWindow.on("closed", () => {
      this.dragManager.cleanup();
      this.mainWindow = null;
      this.isMainWindowInteractive = false;
    });
  }

  enforceMainWindowOnTop() {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      WindowPositionUtil.setupAlwaysOnTop(this.mainWindow);
    }
  }
}

module.exports = WindowManager;

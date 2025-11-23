const { app, screen, BrowserWindow } = require("electron");
const HotkeyManager = require("./hotkeyManager");
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
    this.dragManager = new DragManager();
    this.isQuitting = false;
    this.isMainWindowInteractive = false;

    app.on("before-quit", () => {
      this.isQuitting = true;
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

    await this.hotkeyManager.initializeHotkey(this.mainWindow, callback, screenshotCallback, imageGenCallback);
  }

  async updateHotkey(hotkey) {
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

    this.imageGenerationWindow = new BrowserWindow({
      ...IMAGE_GENERATION_WINDOW_CONFIG,
      center: true,
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

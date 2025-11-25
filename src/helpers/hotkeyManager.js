const { globalShortcut } = require("electron");

class HotkeyManager {
  constructor() {
    // Default to backtick for all platforms (works best with agent mode)
    this.currentHotkey = "`";
    this.isInitialized = false;
    this.screenshotModifier = "CmdOrCtrl"; // Default modifier for screenshots
    this.heartbeatInterval = null;
    this.callback = null;
    this.wrappedCallback = null; // Stored wrapped callback for re-registration
    this.screenshotCallback = null;
    this.imageGenCallback = null;
  }

  // Start a heartbeat that periodically checks if hotkey is still registered
  startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (this.currentHotkey && this.currentHotkey !== "GLOBE") {
        const isRegistered = globalShortcut.isRegistered(this.currentHotkey);
        if (!isRegistered && this.callback) {
          console.error(`⚠️ [HotkeyManager] HOTKEY UNREGISTERED! Re-registering "${this.currentHotkey}"...`);
          globalShortcut.register(this.currentHotkey, this.callback);
        }
      }
    }, 500); // Check every 500ms for more reliable hotkey detection
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  setupShortcuts(hotkey = "`", callback, screenshotCallback, imageGenCallback) {
    if (!callback) {
      throw new Error("Callback function is required for hotkey setup");
    }

    // Unregister previous hotkeys
    if (this.currentHotkey) {
      if (this.currentHotkey === "GLOBE") {
        // Unregister the Globe screenshot fallback
        globalShortcut.unregister("CmdOrCtrl+Shift+G");
        // Unregister image generation hotkey
        globalShortcut.unregister("Shift+G");
      } else {
        globalShortcut.unregister(this.currentHotkey);
        // Unregister with screenshot modifier
        globalShortcut.unregister(`${this.screenshotModifier}+${this.currentHotkey}`);
        // Unregister image generation hotkey
        globalShortcut.unregister(`Shift+${this.currentHotkey}`);
      }
    }

    try {
      if (hotkey === "GLOBE") {
        if (process.platform !== "darwin") {
          return {
            success: false,
            error: "The Globe key is only available on macOS.",
          };
        }
        this.currentHotkey = hotkey;

        // For Globe key, we still need to register the screenshot modifier with a fallback key
        // Since Globe+Cmd doesn't work, we'll use Cmd+Shift+G for screenshot mode when Globe is the hotkey
        if (screenshotCallback) {
          const screenshotHotkey = "CmdOrCtrl+Shift+G";
          const screenshotSuccess = globalShortcut.register(screenshotHotkey, screenshotCallback);
          console.log(`Registered screenshot hotkey "${screenshotHotkey}" (for Globe mode):`, screenshotSuccess);
        }

        // Register image generation hotkey (Shift+G for Globe mode)
        if (imageGenCallback) {
          const imageGenHotkey = "Shift+G";
          const imageGenSuccess = globalShortcut.register(imageGenHotkey, imageGenCallback);
          console.log(`Registered image generation hotkey "${imageGenHotkey}" (for Globe mode):`, imageGenSuccess);
        }

        return { success: true, hotkey };
      }

      // Register the normal hotkey
      const success = globalShortcut.register(hotkey, callback);
      console.log(`Registered hotkey "${hotkey}":`, success);

      // Register modifier+hotkey for screenshot mode if callback provided
      let screenshotSuccess = true;
      if (screenshotCallback) {
        // Use configured modifier for screenshots (Cmd/Ctrl + key)
        const screenshotHotkey = `${this.screenshotModifier}+${hotkey}`;
        screenshotSuccess = globalShortcut.register(screenshotHotkey, screenshotCallback);
        console.log(`Registered screenshot hotkey "${screenshotHotkey}":`, screenshotSuccess);
      }

      // Register Shift+hotkey for image generation if callback provided
      let imageGenSuccess = true;
      if (imageGenCallback) {
        const imageGenHotkey = `Shift+${hotkey}`;
        imageGenSuccess = globalShortcut.register(imageGenHotkey, imageGenCallback);
        console.log(`Registered image generation hotkey "${imageGenHotkey}":`, imageGenSuccess);
      }

      if (success && screenshotSuccess && imageGenSuccess) {
        this.currentHotkey = hotkey;
        // Store callbacks for potential re-registration
        this.callback = callback;
        this.screenshotCallback = screenshotCallback;
        this.imageGenCallback = imageGenCallback;
        // Start heartbeat to monitor hotkey registration
        this.startHeartbeat();
        return { success: true, hotkey };
      } else {
        console.error(`Failed to register hotkey: ${hotkey}`);
        return {
          success: false,
          error: `Failed to register hotkey: ${hotkey}`,
        };
      }
    } catch (error) {
      console.error("Error setting up shortcuts:", error);
      return { success: false, error: error.message };
    }
  }

  async initializeHotkey(mainWindow, callback, screenshotCallback, imageGenCallback) {
    if (!mainWindow || !callback) {
      throw new Error("mainWindow and callback are required");
    }

    // Load screenshot modifier from localStorage
    try {
      const savedModifier = await mainWindow.webContents.executeJavaScript(`
        localStorage.getItem("screenshotModifier") || "CmdOrCtrl"
      `);
      this.screenshotModifier = savedModifier;
      console.log("Loaded screenshot modifier:", this.screenshotModifier);
    } catch (err) {
      console.log("Using default screenshot modifier: CmdOrCtrl");
    }

    // Set up default hotkey first (backtick for all platforms)
    const defaultHotkey = "`";
    this.setupShortcuts(defaultHotkey, callback, screenshotCallback, imageGenCallback);

    // Listen for window to be ready, then get saved hotkey
    mainWindow.webContents.once("did-finish-load", () => {
      setTimeout(() => {
        this.loadSavedHotkey(mainWindow, callback, screenshotCallback, imageGenCallback);
      }, 1000);
    });

    this.isInitialized = true;
  }

  async loadSavedHotkey(mainWindow, callback, screenshotCallback, imageGenCallback) {
    try {
      const defaultHotkey = "`";
      const savedHotkey = await mainWindow.webContents.executeJavaScript(`
        localStorage.getItem("dictationKey") || "${defaultHotkey}"
      `);

      if (savedHotkey && savedHotkey !== defaultHotkey) {
        const result = this.setupShortcuts(savedHotkey, callback, screenshotCallback, imageGenCallback);
        if (result.success) {
          // Hotkey initialized from localStorage
        }
      }
    } catch (err) {
      console.error("Failed to get saved hotkey:", err);
    }
  }

  async updateHotkey(hotkey, callback, screenshotCallback, imageGenCallback) {
    if (!callback) {
      throw new Error("Callback function is required for hotkey update");
    }

    try {
      const result = this.setupShortcuts(hotkey, callback, screenshotCallback, imageGenCallback);
      if (result.success) {
        return { success: true, message: `Hotkey updated to: ${hotkey}` };
      } else {
        return { success: false, message: result.error };
      }
    } catch (error) {
      console.error("Failed to update hotkey:", error);
      return {
        success: false,
        message: `Failed to update hotkey: ${error.message}`,
      };
    }
  }

  getCurrentHotkey() {
    return this.currentHotkey;
  }

  // Soft refresh - only re-registers if hotkey is not currently registered
  // Does NOT unregister first, avoiding the gap where keypresses are missed
  softRefresh() {
    if (!this.currentHotkey || this.currentHotkey === "GLOBE") {
      return { success: true };
    }

    let needsRefresh = false;

    // Check main hotkey
    if (!globalShortcut.isRegistered(this.currentHotkey)) {
      console.log(`🔄 [HotkeyManager] Main hotkey not registered, re-registering...`);
      if (this.callback) {
        globalShortcut.register(this.currentHotkey, this.callback);
      }
      needsRefresh = true;
    }

    // Check screenshot hotkey
    const screenshotHotkey = `${this.screenshotModifier}+${this.currentHotkey}`;
    if (!globalShortcut.isRegistered(screenshotHotkey)) {
      console.log(`🔄 [HotkeyManager] Screenshot hotkey not registered, re-registering...`);
      if (this.screenshotCallback) {
        globalShortcut.register(screenshotHotkey, this.screenshotCallback);
      }
      needsRefresh = true;
    }

    // Check image gen hotkey
    const imageGenHotkey = `Shift+${this.currentHotkey}`;
    if (!globalShortcut.isRegistered(imageGenHotkey)) {
      console.log(`🔄 [HotkeyManager] Image gen hotkey not registered, re-registering...`);
      if (this.imageGenCallback) {
        globalShortcut.register(imageGenHotkey, this.imageGenCallback);
      }
      needsRefresh = true;
    }

    if (!needsRefresh) {
      console.log(`✅ [HotkeyManager] All hotkeys still registered, no refresh needed`);
    }

    return { success: true };
  }

  unregisterAll() {
    this.stopHeartbeat();
    globalShortcut.unregisterAll();
  }

  isHotkeyRegistered(hotkey) {
    return globalShortcut.isRegistered(hotkey);
  }

  updateScreenshotModifier(newModifier, callback, screenshotCallback, imageGenCallback) {
    // Store the new modifier
    this.screenshotModifier = newModifier;
    console.log("Updating screenshot modifier to:", newModifier);

    // Re-register shortcuts with the new modifier
    if (this.currentHotkey && callback && screenshotCallback) {
      return this.setupShortcuts(this.currentHotkey, callback, screenshotCallback, imageGenCallback);
    }

    return { success: true, message: "Screenshot modifier updated" };
  }
}

module.exports = HotkeyManager;

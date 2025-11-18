const { globalShortcut } = require("electron");

class HotkeyManager {
  constructor() {
    this.currentHotkey = "`";
    this.isInitialized = false;
    this.screenshotModifier = "CmdOrCtrl"; // Default modifier
  }

  setupShortcuts(hotkey = "`", callback, screenshotCallback) {
    if (!callback) {
      throw new Error("Callback function is required for hotkey setup");
    }

    // Unregister previous hotkeys
    if (this.currentHotkey && this.currentHotkey !== "GLOBE") {
      globalShortcut.unregister(this.currentHotkey);
      // Unregister with current modifier
      globalShortcut.unregister(`${this.screenshotModifier}+${this.currentHotkey}`);
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
        return { success: true, hotkey };
      }

      // Register the normal hotkey
      const success = globalShortcut.register(hotkey, callback);
      console.log(`Registered hotkey "${hotkey}":`, success);

      // Register modifier+hotkey for screenshot mode if callback provided
      let screenshotSuccess = true;
      if (screenshotCallback) {
        // Use configured modifier
        const screenshotHotkey = `${this.screenshotModifier}+${hotkey}`;
        screenshotSuccess = globalShortcut.register(screenshotHotkey, screenshotCallback);
        console.log(`Registered screenshot hotkey "${screenshotHotkey}":`, screenshotSuccess);
      }

      if (success && screenshotSuccess) {
        this.currentHotkey = hotkey;
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

  async initializeHotkey(mainWindow, callback, screenshotCallback) {
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

    // Set up default hotkey first
    this.setupShortcuts("`", callback, screenshotCallback);

    // Listen for window to be ready, then get saved hotkey
    mainWindow.webContents.once("did-finish-load", () => {
      setTimeout(() => {
        this.loadSavedHotkey(mainWindow, callback, screenshotCallback);
      }, 1000);
    });

    this.isInitialized = true;
  }

  async loadSavedHotkey(mainWindow, callback, screenshotCallback) {
    try {
      const savedHotkey = await mainWindow.webContents.executeJavaScript(`
        localStorage.getItem("dictationKey") || "\`"
      `);

      if (savedHotkey && savedHotkey !== "`") {
        const result = this.setupShortcuts(savedHotkey, callback, screenshotCallback);
        if (result.success) {
          // Hotkey initialized from localStorage
        }
      }
    } catch (err) {
      console.error("Failed to get saved hotkey:", err);
    }
  }

  async updateHotkey(hotkey, callback, screenshotCallback) {
    if (!callback) {
      throw new Error("Callback function is required for hotkey update");
    }

    try {
      const result = this.setupShortcuts(hotkey, callback, screenshotCallback);
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

  unregisterAll() {
    globalShortcut.unregisterAll();
  }

  isHotkeyRegistered(hotkey) {
    return globalShortcut.isRegistered(hotkey);
  }

  updateScreenshotModifier(newModifier, callback, screenshotCallback) {
    // Store the new modifier
    this.screenshotModifier = newModifier;
    console.log("Updating screenshot modifier to:", newModifier);

    // Re-register shortcuts with the new modifier
    if (this.currentHotkey && callback && screenshotCallback) {
      return this.setupShortcuts(this.currentHotkey, callback, screenshotCallback);
    }

    return { success: true, message: "Screenshot modifier updated" };
  }
}

module.exports = HotkeyManager;

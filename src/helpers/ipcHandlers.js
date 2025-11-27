const { ipcMain, app, shell, BrowserWindow, desktopCapturer, dialog } = require("electron");
const fs = require("fs");
const path = require("path");
const AppUtils = require("../utils");
const debugLogger = require("./debugLogger");
const PhraseAnalyzer = require("./phraseAnalyzer");

class IPCHandlers {
  constructor(managers) {
    this.environmentManager = managers.environmentManager;
    this.databaseManager = managers.databaseManager;
    this.clipboardManager = managers.clipboardManager;
    this.whisperManager = managers.whisperManager;
    this.windowManager = managers.windowManager;
    this.modelManager = managers.modelManager;
    this.elevenlabsManager = managers.elevenlabsManager;
    this.elevenlabsRealtimeManager = managers.elevenlabsRealtimeManager;
    this.phraseAnalyzer = new PhraseAnalyzer(this.databaseManager);
    this.setupHandlers();
  }

  setupHandlers() {
    // Window control handlers
    ipcMain.handle("window-minimize", () => {
      if (this.windowManager.controlPanelWindow) {
        this.windowManager.controlPanelWindow.minimize();
      }
    });

    ipcMain.handle("window-maximize", () => {
      if (this.windowManager.controlPanelWindow) {
        if (this.windowManager.controlPanelWindow.isMaximized()) {
          this.windowManager.controlPanelWindow.unmaximize();
        } else {
          this.windowManager.controlPanelWindow.maximize();
        }
      }
    });

    ipcMain.handle("window-close", () => {
      if (this.windowManager.controlPanelWindow) {
        this.windowManager.controlPanelWindow.close();
      }
    });

    ipcMain.handle("window-is-maximized", () => {
      if (this.windowManager.controlPanelWindow) {
        return this.windowManager.controlPanelWindow.isMaximized();
      }
      return false;
    });

    ipcMain.handle("hide-window", (event) => {
      // Determine which window is calling this
      const senderWindow = BrowserWindow.fromWebContents(event.sender);

      if (senderWindow === this.windowManager.imageGenerationWindow) {
        // Hide image generation window
        if (this.windowManager.imageGenerationWindow && !this.windowManager.imageGenerationWindow.isDestroyed()) {
          this.windowManager.imageGenerationWindow.hide();
        }
      } else {
        // Hide dictation panel (default behavior)
        if (process.platform === "darwin") {
          this.windowManager.hideDictationPanel();
          if (app.dock) app.dock.show();
        } else {
          this.windowManager.hideDictationPanel();
        }
      }
    });

    // Image generation window resize handler
    ipcMain.handle("resize-image-window", (event, isCompact) => {
      const window = this.windowManager.imageGenerationWindow;
      if (window && !window.isDestroyed()) {
        const { screen } = require('electron');
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

        if (isCompact) {
          // Compact mode - small window at bottom
          window.setSize(620, 80);
          const x = Math.floor((screenWidth - 620) / 2);
          const y = screenHeight - 80 - 40; // Much closer to bottom - only 40px gap
          window.setPosition(x, y);
        } else {
          // Expanded mode - larger centered window
          window.setSize(900, 700);
          window.center();
        }
      }
    });

    ipcMain.handle("show-dictation-panel", () => {
      this.windowManager.showDictationPanel();
    });

    ipcMain.handle("start-dictation", () => {
      // Show dictation panel and trigger dictation
      this.windowManager.showDictationPanel({ focus: false });
      // Small delay to ensure window is shown before sending event
      setTimeout(() => {
        if (this.windowManager.mainWindow && !this.windowManager.mainWindow.isDestroyed()) {
          this.windowManager.mainWindow.webContents.send("toggle-dictation");
        }
      }, 100);
    });

    ipcMain.handle("set-main-window-interactivity", (event, shouldCapture) => {
      this.windowManager.setMainWindowInteractivity(Boolean(shouldCapture));
      return { success: true };
    });

    // Environment handlers
    ipcMain.handle("get-openai-key", async (event) => {
      return this.environmentManager.getOpenAIKey();
    });

    ipcMain.handle("save-openai-key", async (event, key) => {
      return this.environmentManager.saveOpenAIKey(key);
    });

    ipcMain.handle("create-production-env-file", async (event, apiKey) => {
      return this.environmentManager.createProductionEnvFile(apiKey);
    });

    ipcMain.handle("save-settings", async (event, settings) => {
      try {
        // Save settings to environment and localStorage
        if (settings.apiKey) {
          await this.environmentManager.saveOpenAIKey(settings.apiKey);
        }
        return { success: true };
      } catch (error) {
        console.error("Failed to save settings:", error);
        return { success: false, error: error.message };
      }
    });

    // Database handlers
    ipcMain.handle("db-save-transcription", async (event, text, settings = {}) => {
      const result = this.databaseManager.saveTranscription(text);
      if (result?.success && result?.transcription) {
        this.broadcastToWindows("transcription-added", result.transcription);

        // Analyze transcription for phrase frequency and patterns
        try {
          const analysisResult = this.phraseAnalyzer.analyzeTranscription(text, settings);
          // If AI analysis ran, tell renderer to update localStorage
          if (analysisResult?.shouldUpdateLastRun) {
            result.aiAnalysisRan = true;
            result.newDate = analysisResult.newDate;
          }
        } catch (error) {
          console.error("Error analyzing transcription:", error);
        }
      }
      return result;
    });

    ipcMain.handle("db-get-transcriptions", async (event, limit = 50) => {
      return this.databaseManager.getTranscriptions(limit);
    });

    ipcMain.handle("db-clear-transcriptions", async (event) => {
      const result = this.databaseManager.clearTranscriptions();
      if (result?.success) {
        this.broadcastToWindows("transcriptions-cleared", {
          cleared: result.cleared,
        });
      }
      return result;
    });

    ipcMain.handle("db-delete-transcription", async (event, id) => {
      const result = this.databaseManager.deleteTranscription(id);
      if (result?.success) {
        this.broadcastToWindows("transcription-deleted", { id });
      }
      return result;
    });

    // Phrase suggestion handlers
    ipcMain.handle("get-phrase-suggestions", async (event) => {
      try {
        return this.phraseAnalyzer.getSuggestions(3);
      } catch (error) {
        console.error("Error getting phrase suggestions:", error);
        return [];
      }
    });

    ipcMain.handle("dismiss-phrase-suggestion", async (event, phrase) => {
      try {
        console.log("[IPC] Dismissing phrase suggestion:", phrase);
        const result = this.phraseAnalyzer.dismissSuggestion(phrase);
        console.log("[IPC] Dismiss result:", result);
        return result;
      } catch (error) {
        console.error("Error dismissing phrase suggestion:", error);
        return false;
      }
    });

    ipcMain.handle("clear-all-phrase-suggestions", async (event) => {
      try {
        console.log("[IPC] Clearing all phrase suggestions");
        return this.databaseManager.clearAllPhraseSuggestions();
      } catch (error) {
        console.error("Error clearing phrase suggestions:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("trigger-ai-analysis", async (event, settings = {}, mode = 'dictionary') => {
      try {
        console.log(`[IPC] Manually triggering AI phrase analysis (mode: ${mode})`);
        const result = await this.phraseAnalyzer.runAIAnalysis(settings, mode);
        return result || { success: true, suggestions: [], message: 'Analysis complete' };
      } catch (error) {
        console.error("Error triggering AI analysis:", error);
        return { success: false, suggestions: [], error: error.message };
      }
    });

    ipcMain.handle("mark-phrase-suggested", async (event, phrase) => {
      try {
        return this.phraseAnalyzer.markAsSuggested(phrase);
      } catch (error) {
        console.error("Error marking phrase as suggested:", error);
        return false;
      }
    });

    ipcMain.handle("db-clear-all-transcriptions", async (event) => {
      const result = this.databaseManager.clearAllTranscriptions();
      if (result?.success) {
        this.broadcastToWindows("transcriptions-cleared", {});
      }
      return result;
    });

    ipcMain.handle("db-get-transcription-count", async (event) => {
      return this.databaseManager.getTranscriptionCount();
    });

    ipcMain.handle("db-get-all-transcriptions", async (event) => {
      return this.databaseManager.getAllTranscriptions();
    });

    // Generated images database handlers
    ipcMain.handle("db-save-generated-image", async (event, params) => {
      const { prompt, imagePath, model, aspectRatio, resolution } = params;
      const result = this.databaseManager.saveGeneratedImage(prompt, imagePath, model, aspectRatio, resolution);
      if (result?.success && result?.generatedImage) {
        this.broadcastToWindows("generated-image-added", result.generatedImage);
      }
      return result;
    });

    ipcMain.handle("db-get-generated-images", async (event, limit = 50) => {
      return this.databaseManager.getGeneratedImages(limit);
    });

    ipcMain.handle("db-get-all-generated-images", async (event) => {
      return this.databaseManager.getAllGeneratedImages();
    });

    ipcMain.handle("db-delete-generated-image", async (event, id) => {
      const result = this.databaseManager.deleteGeneratedImage(id);
      if (result?.success) {
        this.broadcastToWindows("generated-image-deleted", { id });
      }
      return result;
    });

    // Clipboard handlers
    ipcMain.handle("paste-text", async (event, text) => {
      return this.clipboardManager.pasteText(text);
    });

    ipcMain.handle("read-clipboard", async (event) => {
      return this.clipboardManager.readClipboard();
    });

    ipcMain.handle("write-clipboard", async (event, text) => {
      return this.clipboardManager.writeClipboard(text);
    });

    ipcMain.handle("copy-image-file-to-clipboard", async (event, filePath) => {
      const fs = require('fs');
      const path = require('path');
      const { nativeImage, clipboard } = require('electron');

      try {
        // Read the image file
        const imageBuffer = fs.readFileSync(filePath);

        // Create NativeImage from buffer
        const image = nativeImage.createFromBuffer(imageBuffer);

        if (image.isEmpty()) {
          throw new Error('Failed to create image from file');
        }

        // Write image to clipboard
        clipboard.writeImage(image);

        return { success: true };
      } catch (error) {
        console.error('Failed to copy image to clipboard:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("simulate-copy", async (event) => {
      return this.clipboardManager.simulateCopy();
    });

    // Whisper handlers
    ipcMain.handle(
      "transcribe-local-whisper",
      async (event, audioBlob, options = {}) => {
        debugLogger.log('transcribe-local-whisper called', {
          audioBlobType: typeof audioBlob,
          audioBlobSize: audioBlob?.byteLength || audioBlob?.length || 0,
          options
        });
        
        try {
          const result = await this.whisperManager.transcribeLocalWhisper(
            audioBlob,
            options
          );

          debugLogger.log('Whisper result', {
            success: result.success,
            hasText: !!result.text,
            message: result.message,
            error: result.error
          });
          
          // Check if no audio was detected and send appropriate event
          if (!result.success && result.message === "No audio detected") {
            debugLogger.log('Sending no-audio-detected event to renderer');
            event.sender.send("no-audio-detected");
          }

          return result;
        } catch (error) {
          debugLogger.error('Local Whisper transcription error', error);
          throw error;
        }
      }
    );

    ipcMain.handle("check-whisper-installation", async (event) => {
      return this.whisperManager.checkWhisperInstallation();
    });

    ipcMain.handle("check-python-installation", async (event) => {
      return this.whisperManager.checkPythonInstallation();
    });

    ipcMain.handle("install-python", async (event) => {
      try {
        const result = await this.whisperManager.installPython((progress) => {
          event.sender.send("python-install-progress", {
            type: "progress",
            stage: progress.stage,
            percentage: progress.percentage,
          });
        });
        return result;
      } catch (error) {
        throw error;
      }
    });

    ipcMain.handle("install-whisper", async (event) => {
      try {
        // Set up progress forwarding for installation
        const originalConsoleLog = console.log;
        console.log = (...args) => {
          const message = args.join(" ");
          if (
            message.includes("Installing") ||
            message.includes("Downloading") ||
            message.includes("Collecting")
          ) {
            event.sender.send("whisper-install-progress", {
              type: "progress",
              message: message,
            });
          }
          originalConsoleLog(...args);
        };

        const result = await this.whisperManager.installWhisper();

        // Restore original console.log
        console.log = originalConsoleLog;

        return result;
      } catch (error) {
        throw error;
      }
    });

    ipcMain.handle("download-whisper-model", async (event, modelName) => {
      console.log('\n═══════════════════════════════════════════════════════════');
      console.log(`📥 DOWNLOADING WHISPER MODEL: ${modelName.toUpperCase()}`);
      console.log('═══════════════════════════════════════════════════════════');

      try {
        const result = await this.whisperManager.downloadWhisperModel(
          modelName,
          (progressData) => {
            // Forward progress updates to the renderer
            event.sender.send("whisper-download-progress", progressData);
          }
        );

        console.log(`✅ Model ${modelName.toUpperCase()} downloaded successfully`);
        console.log('═══════════════════════════════════════════════════════════\n');

        // Send completion event
        event.sender.send("whisper-download-progress", {
          type: "complete",
          model: modelName,
          result: result,
        });

        return result;
      } catch (error) {
        console.log(`❌ Failed to download ${modelName}: ${error.message}`);
        console.log('═══════════════════════════════════════════════════════════\n');

        // Send error event
        event.sender.send("whisper-download-progress", {
          type: "error",
          model: modelName,
          error: error.message,
        });

        throw error;
      }
    });

    ipcMain.handle("check-model-status", async (event, modelName) => {
      return this.whisperManager.checkModelStatus(modelName);
    });

    ipcMain.handle("list-whisper-models", async (event) => {
      return this.whisperManager.listWhisperModels();
    });

    ipcMain.handle("delete-whisper-model", async (event, modelName) => {
      console.log(`🗑️  Deleting Whisper model: ${modelName.toUpperCase()}`);
      const result = await this.whisperManager.deleteWhisperModel(modelName);
      if (result.success) {
        console.log(`✅ Model ${modelName.toUpperCase()} deleted (freed ${result.freed_mb || 0}MB)`);
      }
      return result;
    });

    ipcMain.handle("cancel-whisper-download", async (event) => {
      return this.whisperManager.cancelDownload();
    });

    ipcMain.handle("check-ffmpeg-availability", async (event) => {
      return this.whisperManager.checkFFmpegAvailability();
    });

    // Utility handlers
    ipcMain.handle("cleanup-app", async (event) => {
      try {
        AppUtils.cleanup(this.windowManager.mainWindow);
        return { success: true, message: "Cleanup completed successfully" };
      } catch (error) {
        throw error;
      }
    });

    ipcMain.handle("update-hotkey", async (event, hotkey) => {
      return await this.windowManager.updateHotkey(hotkey);
    });

    // Re-register the current hotkey (useful after clipboard operations that may interfere)
    // Uses soft refresh to avoid unregister/register gap where keypresses are missed
    ipcMain.handle("refresh-hotkey", async (event) => {
      console.log(`🔄 [HOTKEY] Soft refreshing hotkey registration...`);
      return this.windowManager.hotkeyManager.softRefresh();
    });

    ipcMain.handle("update-screenshot-modifier", async (event, modifier) => {
      return await this.windowManager.updateScreenshotModifier(modifier);
    });

    ipcMain.handle("start-window-drag", async (event) => {
      return await this.windowManager.startWindowDrag();
    });

    ipcMain.handle("stop-window-drag", async (event) => {
      return await this.windowManager.stopWindowDrag();
    });

    // External link handler
    ipcMain.handle("open-external", async (event, url) => {
      try {
        await shell.openExternal(url);
        return { success: true };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Model management handlers
    ipcMain.handle("model-get-all", async () => {
      try {
        console.log('[IPC] model-get-all called');
        const modelManager = require("./modelManagerBridge").default;
        const models = await modelManager.getModelsWithStatus();
        console.log('[IPC] Returning models:', models.length);
        return models;
      } catch (error) {
        console.error('[IPC] Error in model-get-all:', error);
        throw error;
      }
    });

    ipcMain.handle("model-check", async (_, modelId) => {
      const modelManager = require("./modelManagerBridge").default;
      return modelManager.isModelDownloaded(modelId);
    });

    ipcMain.handle("model-download", async (event, modelId) => {
      try {
        const modelManager = require("./modelManagerBridge").default;
        const result = await modelManager.downloadModel(
          modelId,
          (progress, downloadedSize, totalSize) => {
            event.sender.send("model-download-progress", {
              modelId,
              progress,
              downloadedSize,
              totalSize,
            });
          }
        );
        return { success: true, path: result };
      } catch (error) {
        return { 
          success: false, 
          error: error.message,
          code: error.code,
          details: error.details 
        };
      }
    });

    ipcMain.handle("model-delete", async (event, modelId) => {
      try {
        const modelManager = require("./modelManagerBridge").default;
        await modelManager.deleteModel(modelId);
        return { success: true };
      } catch (error) {
        return { 
          success: false, 
          error: error.message,
          code: error.code,
          details: error.details 
        };
      }
    });

    ipcMain.handle("model-delete-all", async () => {
      try {
        const modelManager = require("./modelManagerBridge").default;
        await modelManager.deleteAllModels();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error.message,
          code: error.code,
          details: error.details,
        };
      }
    });

    ipcMain.handle("model-check-runtime", async (event) => {
      try {
        const modelManager = require("./modelManagerBridge").default;
        await modelManager.ensureLlamaCpp();
        return { available: true };
      } catch (error) {
        return { 
          available: false, 
          error: error.message,
          code: error.code,
          details: error.details 
        };
      }
    });

    ipcMain.handle("get-anthropic-key", async (event) => {
      return this.environmentManager.getAnthropicKey();
    });

    ipcMain.handle("get-gemini-key", async (event) => {
      return this.environmentManager.getGeminiKey();
    });

    ipcMain.handle("save-gemini-key", async (event, key) => {
      return this.environmentManager.saveGeminiKey(key);
    });

    ipcMain.handle("save-anthropic-key", async (event, key) => {
      return this.environmentManager.saveAnthropicKey(key);
    });

    // ElevenLabs API
    ipcMain.handle("get-elevenlabs-key", async (event) => {
      return this.environmentManager.getElevenlabsKey();
    });

    ipcMain.handle("save-elevenlabs-key", async (event, key) => {
      return this.environmentManager.saveElevenlabsKey(key);
    });

    // ElevenLabs transcription handler
    ipcMain.handle("transcribe-elevenlabs", async (event, audioBlob, options = {}) => {
      debugLogger.log('transcribe-elevenlabs called', {
        audioBlobType: typeof audioBlob,
        audioBlobSize: audioBlob?.byteLength || audioBlob?.length || 0,
        options
      });

      try {
        const result = await this.elevenlabsManager.transcribe(audioBlob, options);

        debugLogger.log('ElevenLabs result', {
          success: result.success,
          hasText: !!result.text,
          message: result.message,
          error: result.error
        });

        // Check if no audio was detected and send appropriate event
        if (!result.success && result.message === "No audio detected") {
          debugLogger.log('Sending no-audio-detected event to renderer');
          event.sender.send("no-audio-detected");
        }

        return result;
      } catch (error) {
        debugLogger.error('ElevenLabs transcription error', error);
        throw error;
      }
    });

    // ElevenLabs availability check
    ipcMain.handle("check-elevenlabs-availability", async (event) => {
      return this.elevenlabsManager.checkAvailability();
    });

    // ElevenLabs real-time token generation
    ipcMain.handle("generate-elevenlabs-realtime-token", async (event) => {
      if (!this.elevenlabsRealtimeManager) {
        return { success: false, error: "Real-time manager not initialized" };
      }
      return this.elevenlabsRealtimeManager.generateSingleUseToken();
    });

    // ElevenLabs real-time availability check
    ipcMain.handle("check-elevenlabs-realtime-availability", async (event) => {
      if (!this.elevenlabsRealtimeManager) {
        return { available: false, error: "Real-time manager not initialized" };
      }
      return this.elevenlabsRealtimeManager.checkRealtimeAvailability();
    });

    // Settings persistence helper
    const settingsPath = path.join(app.getPath("userData"), "transcription-settings.json");

    const loadTranscriptionSettings = () => {
      try {
        if (fs.existsSync(settingsPath)) {
          const data = fs.readFileSync(settingsPath, "utf8");
          return JSON.parse(data);
        }
      } catch (err) {
        console.error("Failed to load transcription settings:", err);
      }
      return { engine: "local", realtime: false };
    };

    const saveTranscriptionSettings = (settings) => {
      try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), "utf8");
      } catch (err) {
        console.error("Failed to save transcription settings:", err);
      }
    };

    // Load settings on startup
    const savedSettings = loadTranscriptionSettings();
    this.transcriptionEngine = savedSettings.engine || "local";
    this.realtimeTranscriptionEnabled = savedSettings.realtime || false;
    console.log(`🔧 [Settings] Loaded: engine=${this.transcriptionEngine}, realtime=${this.realtimeTranscriptionEnabled}`);

    // Real-time transcription setting (shared between windows, persisted)
    ipcMain.handle("get-realtime-transcription-enabled", async () => {
      console.log(`🔧 [Settings] GET Real-time transcription: ${this.realtimeTranscriptionEnabled || false}`);
      return this.realtimeTranscriptionEnabled || false;
    });

    ipcMain.handle("set-realtime-transcription-enabled", async (event, enabled) => {
      this.realtimeTranscriptionEnabled = enabled;
      saveTranscriptionSettings({ engine: this.transcriptionEngine, realtime: enabled });
      console.log(`🔧 [Settings] Real-time transcription: ${enabled}`);
      return true;
    });

    // Transcription engine setting (shared between windows, persisted)
    ipcMain.handle("get-transcription-engine", async () => {
      const engine = this.transcriptionEngine || "local";
      console.log(`🔧 [Settings] GET Transcription engine: ${engine}`);
      return engine;
    });

    ipcMain.handle("set-transcription-engine", async (event, engine) => {
      this.transcriptionEngine = engine;
      saveTranscriptionSettings({ engine: engine, realtime: this.realtimeTranscriptionEnabled });
      console.log(`🔧 [Settings] SET Transcription engine: ${engine}`);
      return true;
    });

    // Local reasoning handler
    ipcMain.handle("process-local-reasoning", async (event, text, modelId, agentName, config) => {
      try {
        const LocalReasoningService = require("../services/localReasoningBridge").default;
        const result = await LocalReasoningService.processText(text, modelId, agentName, config);
        return { success: true, text: result };
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Anthropic reasoning handler
    ipcMain.handle("process-anthropic-reasoning", async (event, text, modelId, agentName, config) => {
      try {
        const apiKey = this.environmentManager.getAnthropicKey();
        
        if (!apiKey) {
          throw new Error("Anthropic API key not configured");
        }

        const systemPrompt = "You are a dictation assistant. Clean up text by fixing grammar and punctuation. Output ONLY the cleaned text without any explanations, options, or commentary.";
        const userPrompt = agentName && text.toLowerCase().includes(agentName.toLowerCase())
          ? `You are ${agentName}, a helpful AI assistant. Clean up the following dictated text by fixing grammar, punctuation, and formatting. Remove any reference to your name. Output ONLY the cleaned text without explanations or options:\n\n${text}`
          : `Clean up the following dictated text by fixing grammar, punctuation, and formatting. Output ONLY the cleaned text without any explanations, options, or commentary:\n\n${text}`;

        // Always log system prompt to terminal (not dependent on debug mode)
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log('🤖 ANTHROPIC AGENT MODE SYSTEM PROMPT');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('⚠️  NOTE: Anthropic handler does not currently include Dictionary/Snippets/Style context');
        console.log('───────────────────────────────────────────────────────────');
        console.log('📤 SYSTEM PROMPT:', systemPrompt);
        console.log('═══════════════════════════════════════════════════════════\n');

        const requestBody = {
          model: modelId || "claude-3-5-sonnet-20241022",
          messages: [{ role: "user", content: userPrompt }],
          system: systemPrompt,
          max_tokens: config?.maxTokens || Math.max(100, Math.min(text.length * 2, 4096)),
          temperature: config?.temperature || 0.3,
        };

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorData = { error: response.statusText };
          try {
            errorData = JSON.parse(errorText);
          } catch {
            errorData = { error: errorText || response.statusText };
          }
          throw new Error(errorData.error?.message || errorData.error || `Anthropic API error: ${response.status}`);
        }

        const data = await response.json();
        return { success: true, text: data.content[0].text.trim() };
      } catch (error) {
        debugLogger.error("Anthropic reasoning error:", error);
        return { success: false, error: error.message };
      }
    });


    // Check if local reasoning is available
    ipcMain.handle("check-local-reasoning-available", async () => {
      try {
        const LocalReasoningService = require("../services/localReasoningBridge").default;
        return await LocalReasoningService.isAvailable();
      } catch (error) {
        return false;
      }
    });

    // llama.cpp installation handlers
    ipcMain.handle("llama-cpp-check", async () => {
      try {
        const llamaCppInstaller = require("./llamaCppInstaller").default;
        const isInstalled = await llamaCppInstaller.isInstalled();
        const version = isInstalled ? await llamaCppInstaller.getVersion() : null;
        return { isInstalled, version };
      } catch (error) {
        return { isInstalled: false, error: error.message };
      }
    });

    ipcMain.handle("llama-cpp-install", async () => {
      try {
        const llamaCppInstaller = require("./llamaCppInstaller").default;
        const result = await llamaCppInstaller.install();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("llama-cpp-uninstall", async () => {
      try {
        const result = await llamaCppInstaller.uninstall();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    });

    // Debug logging handler for reasoning pipeline
    ipcMain.handle("log-reasoning", async (event, stage, details) => {
      // Always log to terminal (not dependent on debug mode)
      if (stage === "SYSTEM_PROMPT") {
        console.log('\n═══════════════════════════════════════════════════════════');
        console.log(`🤖 ${details.provider.toUpperCase()} AGENT MODE SYSTEM PROMPT`);
        console.log('═══════════════════════════════════════════════════════════');
        console.log('📝 Dictionary Context:', details.dictionaryContext || '(disabled or empty)');
        console.log('✂️  Snippets Context:', details.snippetsContext || '(disabled or empty)');
        console.log('🎨 Style Guidance:', details.styleGuidance || '(disabled or no active profile)');
        console.log('───────────────────────────────────────────────────────────');
        console.log('📤 COMPLETE SYSTEM PROMPT:');
        console.log(details.fullPrompt);
        console.log('═══════════════════════════════════════════════════════════\n');
      }

      // Also log to debug logger if in debug mode
      debugLogger.logReasoning(stage, details);
      return { success: true };
    });

    // Screenshot capture handler - uses native OS screenshot selection tool
    ipcMain.handle("capture-screenshot", async () => {
      try {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        const { clipboard, nativeImage } = require('electron');

        if (process.platform === 'darwin') {
          // macOS: Use native screencapture with interactive selection
          // -i = interactive mode (drag to select region)
          // -c = copy to clipboard
          console.log("Triggering macOS screenshot selection tool...");

          try {
            await execAsync('screencapture -i -c');

            // Wait a bit for the clipboard to be populated
            await new Promise(resolve => setTimeout(resolve, 200));

            // Read the screenshot from clipboard
            const image = clipboard.readImage();

            if (image.isEmpty()) {
              console.log("No screenshot captured (user may have cancelled)");
              return { success: false, error: "Screenshot cancelled or no selection made" };
            }

            const screenshot = image.toDataURL();
            console.log("Screenshot captured successfully from clipboard");
            return { success: true, screenshot };
          } catch (error) {
            // Check if it's a permission error
            if (error.message?.includes('permission') ||
                error.message?.includes('denied') ||
                error.message?.includes('not authorized')) {
              return {
                success: false,
                error: "Screen recording permission denied. Please grant permission in System Settings > Privacy & Security > Screen Recording."
              };
            }
            throw error;
          }
        } else if (process.platform === 'win32') {
          // Windows: Trigger the native Snipping Tool
          console.log("Triggering Windows screenshot selection tool...");

          try {
            // Clear clipboard first
            clipboard.clear();

            // Trigger Windows Snipping Tool (Win + Shift + S)
            const { GlobalKeyboardListener } = require('node-global-key-listener');

            // Use PowerShell to simulate Win+Shift+S
            await execAsync('powershell -command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'^+{PRTSC}\')"');

            // Wait for user to make selection and for it to be copied to clipboard
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Read from clipboard
            const image = clipboard.readImage();

            if (image.isEmpty()) {
              console.log("No screenshot captured (user may have cancelled)");
              return { success: false, error: "Screenshot cancelled or no selection made" };
            }

            const screenshot = image.toDataURL();
            console.log("Screenshot captured successfully from clipboard");
            return { success: true, screenshot };
          } catch (error) {
            console.error("Windows screenshot error:", error);
            throw error;
          }
        } else {
          // Linux: Use native tools if available
          console.log("Triggering Linux screenshot selection tool...");

          try {
            // Try gnome-screenshot first, then scrot
            await execAsync('gnome-screenshot -a -c || scrot -s -');

            await new Promise(resolve => setTimeout(resolve, 200));

            const image = clipboard.readImage();

            if (image.isEmpty()) {
              return { success: false, error: "Screenshot cancelled or no selection made" };
            }

            const screenshot = image.toDataURL();
            return { success: true, screenshot };
          } catch (error) {
            return {
              success: false,
              error: "Screenshot tool not available. Please install gnome-screenshot or scrot."
            };
          }
        }
      } catch (error) {
        console.error("Screenshot capture error:", error);
        return { success: false, error: error.message };
      }
    });

    // Launch on startup handlers
    ipcMain.handle("set-launch-on-startup", async (event, enabled) => {
      try {
        app.setLoginItemSettings({
          openAtLogin: enabled,
          openAsHidden: false,
        });
        return { success: true };
      } catch (error) {
        console.error("Failed to set launch on startup:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("get-launch-on-startup", async () => {
      try {
        const settings = app.getLoginItemSettings();
        return { enabled: settings.openAtLogin };
      } catch (error) {
        console.error("Failed to get launch on startup:", error);
        return { enabled: false, error: error.message };
      }
    });

    // Directory dialog handler
    ipcMain.handle("open-directory-dialog", async () => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory', 'createDirectory']
        });
        return result;
      } catch (error) {
        console.error('Directory dialog error:', error);
        return { canceled: true, error: error.message };
      }
    });

    // Export handlers
    ipcMain.handle("save-file", async (event, params) => {
      try {
        const { defaultPath, filters, content } = params;
        const result = await dialog.showSaveDialog({
          defaultPath,
          filters
        });

        if (result.canceled || !result.filePath) {
          return { success: false, canceled: true };
        }

        await fs.promises.writeFile(result.filePath, content, 'utf-8');
        console.log(`[Export] Saved file to: ${result.filePath}`);
        return { success: true, filePath: result.filePath };
      } catch (error) {
        console.error('Save file error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("export-images", async (event, params) => {
      try {
        const { imagePaths, defaultPath } = params;
        const archiver = require('archiver');

        const result = await dialog.showSaveDialog({
          defaultPath,
          filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
        });

        if (result.canceled || !result.filePath) {
          return { success: false, canceled: true };
        }

        // Create ZIP file
        const output = fs.createWriteStream(result.filePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        return new Promise((resolve, reject) => {
          output.on('close', () => {
            console.log(`[Export] Images exported to: ${result.filePath} (${archive.pointer()} bytes)`);
            resolve({ success: true, filePath: result.filePath });
          });

          archive.on('error', (err) => {
            reject({ success: false, error: err.message });
          });

          archive.pipe(output);

          // Add each image to the archive
          imagePaths.forEach((imagePath, index) => {
            if (fs.existsSync(imagePath)) {
              const filename = path.basename(imagePath);
              archive.file(imagePath, { name: filename });
            }
          });

          archive.finalize();
        });
      } catch (error) {
        console.error('Export images error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("export-all", async (event, params) => {
      try {
        const { transcriptionsJson, imagesJson, imagePaths, defaultPath } = params;
        const archiver = require('archiver');

        const result = await dialog.showSaveDialog({
          defaultPath,
          filters: [{ name: 'ZIP Archive', extensions: ['zip'] }]
        });

        if (result.canceled || !result.filePath) {
          return { success: false, canceled: true };
        }

        // Create ZIP file
        const output = fs.createWriteStream(result.filePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        return new Promise((resolve, reject) => {
          output.on('close', () => {
            console.log(`[Export] Full export saved to: ${result.filePath} (${archive.pointer()} bytes)`);
            resolve({ success: true, filePath: result.filePath });
          });

          archive.on('error', (err) => {
            reject({ success: false, error: err.message });
          });

          archive.pipe(output);

          // Add transcriptions JSON
          if (transcriptionsJson) {
            archive.append(transcriptionsJson, { name: 'transcriptions.json' });
          }

          // Add images metadata JSON
          if (imagesJson) {
            archive.append(imagesJson, { name: 'images-metadata.json' });
          }

          // Add images to images/ folder
          imagePaths.forEach((imagePath) => {
            if (fs.existsSync(imagePath)) {
              const filename = path.basename(imagePath);
              archive.file(imagePath, { name: `images/${filename}` });
            }
          });

          archive.finalize();
        });
      } catch (error) {
        console.error('Export all error:', error);
        return { success: false, error: error.message };
      }
    });

    // Show in Dock handlers (macOS only)
    ipcMain.handle("set-show-in-dock", async (event, enabled) => {
      try {
        if (process.platform === 'darwin' && app.dock) {
          if (enabled) {
            app.dock.show();
            app.setActivationPolicy('regular');
          } else {
            app.dock.hide();
            app.setActivationPolicy('accessory');
          }
          return { success: true };
        } else {
          // Not macOS, return success but do nothing
          return { success: true, message: 'Not applicable on this platform' };
        }
      } catch (error) {
        console.error("Failed to set dock visibility:", error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("get-show-in-dock", async () => {
      try {
        if (process.platform === 'darwin' && app.dock) {
          // Check if dock is visible by checking activation policy
          const policy = app.getActivationPolicy?.();
          const isVisible = policy === 'regular';
          return { visible: isVisible };
        } else {
          // Not macOS, return true as default
          return { visible: true };
        }
      } catch (error) {
        console.error("Failed to get dock visibility:", error);
        return { visible: true, error: error.message };
      }
    });

    // Gemini image generation handlers
    ipcMain.handle("generate-image", async (event, params) => {
      try {
        // Use dynamic import for ES module
        const { GoogleGenAI } = await import('@google/genai');
        const { prompt, modelId, aspectRatio, resolution, referenceImages, apiKey, useGoogleSearch } = params;

        if (!apiKey) {
          throw new Error('Gemini API key not configured');
        }

        const ai = new GoogleGenAI({ apiKey });

        // Build the contents array
        let contents = [];

        // Add reference images first (if editing)
        if (referenceImages && referenceImages.length > 0) {
          for (const imageData of referenceImages) {
            // Remove data URL prefix to get base64 data
            const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
            contents.push({
              inlineData: {
                mimeType: 'image/png',
                data: base64Data
              }
            });
          }
        }

        // Add text prompt
        contents.push({ text: prompt });

        // Prepare config
        const config = {
          responseModalities: ['TEXT', 'IMAGE']
        };

        // Add Google Search grounding if enabled
        if (useGoogleSearch) {
          config.tools = [{ google_search: {} }];
        }

        // Add image config if aspect ratio or resolution specified
        if (aspectRatio || (modelId.includes('pro') && resolution)) {
          config.imageConfig = {};

          if (aspectRatio) {
            config.imageConfig.aspectRatio = aspectRatio;
          }

          // Add resolution for Pro models (must be uppercase: 1K, 2K, 4K)
          if (modelId.includes('pro') && resolution) {
            config.imageConfig.imageSize = resolution.toUpperCase();
          }
        }

        // Log the config being used
        console.log('\n🔍 Image Generation Config:');
        console.log('Model:', modelId);
        console.log('Google Search Enabled:', useGoogleSearch);
        console.log('Config:', JSON.stringify(config, null, 2));

        // Generate image using generateContent
        const response = await ai.models.generateContent({
          model: modelId,
          contents: contents,
          config: config
        });

        // Extract ALL images from response
        if (!response.candidates || response.candidates.length === 0) {
          throw new Error('No candidates in response');
        }

        const parts = response.candidates[0].content.parts;
        const images = [];

        for (const part of parts) {
          if (part.inlineData) {
            const imageDataUrl = `data:image/png;base64,${part.inlineData.data}`;
            images.push(imageDataUrl);
          }
        }

        if (images.length === 0) {
          throw new Error('No image generated in response');
        }

        // Log grounding metadata if present
        const groundingMetadata = response.candidates[0]?.groundingMetadata || response.groundingMetadata || null;

        if (groundingMetadata) {
          console.log('\n✅ GOOGLE SEARCH GROUNDING METADATA:');
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

          if (groundingMetadata.webSearchQueries) {
            console.log('\n📝 Search Queries Used:');
            groundingMetadata.webSearchQueries.forEach((query, idx) => {
              console.log(`   ${idx + 1}. "${query}"`);
            });
          }

          if (groundingMetadata.groundingChunks) {
            console.log('\n🔗 Sources Used (Top 3):');
            groundingMetadata.groundingChunks.slice(0, 3).forEach((chunk, idx) => {
              if (chunk.web) {
                console.log(`   ${idx + 1}. ${chunk.web.title || 'Untitled'}`);
                console.log(`      ${chunk.web.uri}`);
              }
            });
          }

          if (groundingMetadata.searchEntryPoint) {
            console.log('\n🔍 Search Entry Point: Present (HTML/CSS for search suggestions)');
          }

          console.log('\n📊 Full Grounding Metadata:');
          console.log(JSON.stringify(groundingMetadata, null, 2));
          console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        } else {
          console.log('\n⚠️  NO GROUNDING METADATA - Google Search may not have been used');
          console.log('   This could mean:');
          console.log('   - The model answered from its own knowledge');
          console.log('   - The model didn\'t think a search was necessary');
          console.log('   - Google Search is not enabled for this model\n');
        }

        // Return all images (backward compatible with single image)
        return {
          success: true,
          image: images[0], // First image for backward compatibility
          images: images,   // All images
          groundingMetadata: groundingMetadata
        };
      } catch (error) {
        console.error('Image generation error:', error);
        return { success: false, error: error.message };
      }
    });

    ipcMain.handle("save-generated-image", async (event, params) => {
      try {
        const { image, savePath, filename } = params;
        const fs = require('fs');
        const path = require('path');
        const os = require('os');

        // Expand path with environment variables and home directory
        let expandedPath = savePath;
        if (expandedPath) {
          // Replace ~ with home directory (Mac/Linux)
          if (expandedPath.startsWith('~')) {
            expandedPath = expandedPath.replace('~', os.homedir());
          }
          // Replace Windows environment variables
          expandedPath = expandedPath.replace(/%([^%]+)%/g, (_, key) => {
            return process.env[key] || _;
          });
        }

        // Use Downloads folder by default if no savePath provided
        const targetPath = expandedPath || app.getPath('downloads');

        // Ensure save directory exists
        if (!fs.existsSync(targetPath)) {
          fs.mkdirSync(targetPath, { recursive: true });
        }

        // Remove data URL prefix to get base64 data
        const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Save to file
        const filePath = path.join(targetPath, filename);
        fs.writeFileSync(filePath, buffer);

        console.log(`Image saved to: ${filePath}`);
        return { success: true, filePath };
      } catch (error) {
        console.error('Save image error:', error);
        return { success: false, error: error.message };
      }
    });
  }

  broadcastToWindows(channel, payload) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, payload);
      }
    });
  }
}

module.exports = IPCHandlers;

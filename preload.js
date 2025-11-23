const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  pasteText: (text) => ipcRenderer.invoke("paste-text", text),
  hideWindow: () => ipcRenderer.invoke("hide-window"),
  resizeImageWindow: (isCompact) => ipcRenderer.invoke("resize-image-window", isCompact),
  showDictationPanel: () => ipcRenderer.invoke("show-dictation-panel"),
  startDictation: () => ipcRenderer.invoke("start-dictation"),
  onToggleDictation: (callback) => ipcRenderer.on("toggle-dictation", callback),
  onStopDictation: (callback) => ipcRenderer.on("stop-dictation", callback),
  onGlobeKeyDown: (callback) => ipcRenderer.on("globe-key-down", callback),
  onGlobeKeyUp: (callback) => ipcRenderer.on("globe-key-up", callback),
  onPushToTalkToggle: (callback) => ipcRenderer.on("push-to-talk-toggle", callback),
  onToggleScreenshot: (callback) => ipcRenderer.on("toggle-screenshot", callback),
  onToggleImageGeneration: (callback) => ipcRenderer.on("toggle-image-generation", callback),
  captureScreenshot: () => ipcRenderer.invoke("capture-screenshot"),

  // Database functions
  saveTranscription: (text) =>
    ipcRenderer.invoke("db-save-transcription", text),
  getTranscriptions: (limit) =>
    ipcRenderer.invoke("db-get-transcriptions", limit),
  clearTranscriptions: () => ipcRenderer.invoke("db-clear-transcriptions"),
  clearTranscriptionHistory: () => ipcRenderer.invoke("db-clear-all-transcriptions"),
  deleteTranscription: (id) =>
    ipcRenderer.invoke("db-delete-transcription", id),
  getTranscriptionCount: () =>
    ipcRenderer.invoke("db-get-transcription-count"),
  getAllTranscriptions: () =>
    ipcRenderer.invoke("db-get-all-transcriptions"),

  // Generated images database functions
  saveGeneratedImageToDb: (params) =>
    ipcRenderer.invoke("db-save-generated-image", params),
  getGeneratedImages: (limit) =>
    ipcRenderer.invoke("db-get-generated-images", limit),
  getAllGeneratedImages: () =>
    ipcRenderer.invoke("db-get-all-generated-images"),
  deleteGeneratedImage: (id) =>
    ipcRenderer.invoke("db-delete-generated-image", id),
  onGeneratedImageAdded: (callback) => {
    const listener = (_event, generatedImage) => callback?.(generatedImage);
    ipcRenderer.on("generated-image-added", listener);
    return () => ipcRenderer.removeListener("generated-image-added", listener);
  },
  onTranscriptionAdded: (callback) => {
    const listener = (_event, transcription) => callback?.(transcription);
    ipcRenderer.on("transcription-added", listener);
    return () => ipcRenderer.removeListener("transcription-added", listener);
  },
  onTranscriptionDeleted: (callback) => {
    const listener = (_event, data) => callback?.(data);
    ipcRenderer.on("transcription-deleted", listener);
    return () => ipcRenderer.removeListener("transcription-deleted", listener);
  },
  onTranscriptionsCleared: (callback) => {
    const listener = (_event, data) => callback?.(data);
    ipcRenderer.on("transcriptions-cleared", listener);
    return () =>
      ipcRenderer.removeListener("transcriptions-cleared", listener);
  },

  // Environment variables
  getOpenAIKey: () => ipcRenderer.invoke("get-openai-key"),
  saveOpenAIKey: (key) => ipcRenderer.invoke("save-openai-key", key),
  createProductionEnvFile: (key) =>
    ipcRenderer.invoke("create-production-env-file", key),

  // Settings management
  saveSettings: (settings) => ipcRenderer.invoke("save-settings", settings),

  // Clipboard functions
  readClipboard: () => ipcRenderer.invoke("read-clipboard"),
  writeClipboard: (text) => ipcRenderer.invoke("write-clipboard", text),
  simulateCopy: () => ipcRenderer.invoke("simulate-copy"),

  // Python installation functions
  checkPythonInstallation: () =>
    ipcRenderer.invoke("check-python-installation"),
  installPython: () => ipcRenderer.invoke("install-python"),
  onPythonInstallProgress: (callback) =>
    ipcRenderer.on("python-install-progress", callback),

  // Local Whisper functions
  transcribeLocalWhisper: (audioBlob, options) =>
    ipcRenderer.invoke("transcribe-local-whisper", audioBlob, options),
  checkWhisperInstallation: () =>
    ipcRenderer.invoke("check-whisper-installation"),
  installWhisper: () => ipcRenderer.invoke("install-whisper"),
  onWhisperInstallProgress: (callback) =>
    ipcRenderer.on("whisper-install-progress", callback),
  downloadWhisperModel: (modelName) =>
    ipcRenderer.invoke("download-whisper-model", modelName),
  onWhisperDownloadProgress: (callback) =>
    ipcRenderer.on("whisper-download-progress", callback),
  checkModelStatus: (modelName) =>
    ipcRenderer.invoke("check-model-status", modelName),
  listWhisperModels: () => ipcRenderer.invoke("list-whisper-models"),
  deleteWhisperModel: (modelName) =>
    ipcRenderer.invoke("delete-whisper-model", modelName),
  cancelWhisperDownload: () => ipcRenderer.invoke("cancel-whisper-download"),
  checkFFmpegAvailability: () =>
    ipcRenderer.invoke("check-ffmpeg-availability"),

  // Window control functions
  windowMinimize: () => ipcRenderer.invoke("window-minimize"),
  windowMaximize: () => ipcRenderer.invoke("window-maximize"),
  windowClose: () => ipcRenderer.invoke("window-close"),
  windowIsMaximized: () => ipcRenderer.invoke("window-is-maximized"),
  getPlatform: () => process.platform,

  // Cleanup function
  cleanupApp: () => ipcRenderer.invoke("cleanup-app"),
  updateHotkey: (hotkey) => ipcRenderer.invoke("update-hotkey", hotkey),
  updateScreenshotModifier: (modifier) => ipcRenderer.invoke("update-screenshot-modifier", modifier),
  startWindowDrag: () => ipcRenderer.invoke("start-window-drag"),
  stopWindowDrag: () => ipcRenderer.invoke("stop-window-drag"),
  setMainWindowInteractivity: (interactive) =>
    ipcRenderer.invoke("set-main-window-interactivity", interactive),

  // Update functions
  checkForUpdates: () => ipcRenderer.invoke("check-for-updates"),
  downloadUpdate: () => ipcRenderer.invoke("download-update"),
  installUpdate: () => ipcRenderer.invoke("install-update"),
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  getUpdateStatus: () => ipcRenderer.invoke("get-update-status"),
  getUpdateInfo: () => ipcRenderer.invoke("get-update-info"),

  // Update event listeners
  onUpdateAvailable: (callback) => ipcRenderer.on("update-available", callback),
  onUpdateNotAvailable: (callback) =>
    ipcRenderer.on("update-not-available", callback),
  onUpdateDownloaded: (callback) =>
    ipcRenderer.on("update-downloaded", callback),
  onUpdateDownloadProgress: (callback) =>
    ipcRenderer.on("update-download-progress", callback),
  onUpdateError: (callback) => ipcRenderer.on("update-error", callback),

  // Audio event listeners
  onNoAudioDetected: (callback) =>
    ipcRenderer.on("no-audio-detected", callback),

  // External link opener
  openExternal: (url) => ipcRenderer.invoke("open-external", url),

  // Model management functions
  modelGetAll: () => ipcRenderer.invoke("model-get-all"),
  modelCheck: (modelId) => ipcRenderer.invoke("model-check", modelId),
  modelDownload: (modelId) => ipcRenderer.invoke("model-download", modelId),
  modelDelete: (modelId) => ipcRenderer.invoke("model-delete", modelId),
  modelDeleteAll: () => ipcRenderer.invoke("model-delete-all"),
  modelCheckRuntime: () => ipcRenderer.invoke("model-check-runtime"),
  onModelDownloadProgress: (callback) => ipcRenderer.on("model-download-progress", callback),

  // Anthropic API
  getAnthropicKey: () => ipcRenderer.invoke("get-anthropic-key"),
  saveAnthropicKey: (key) => ipcRenderer.invoke("save-anthropic-key", key),

  // Gemini API
  getGeminiKey: () => ipcRenderer.invoke("get-gemini-key"),
  saveGeminiKey: (key) => ipcRenderer.invoke("save-gemini-key", key),

  // Local reasoning
  processLocalReasoning: (text, modelId, agentName, config) =>
    ipcRenderer.invoke("process-local-reasoning", text, modelId, agentName, config),
  checkLocalReasoningAvailable: () =>
    ipcRenderer.invoke("check-local-reasoning-available"),

  // Anthropic reasoning
  processAnthropicReasoning: (text, modelId, agentName, config) =>
    ipcRenderer.invoke("process-anthropic-reasoning", text, modelId, agentName, config),

  // llama.cpp
  llamaCppCheck: () => ipcRenderer.invoke("llama-cpp-check"),
  llamaCppInstall: () => ipcRenderer.invoke("llama-cpp-install"),
  llamaCppUninstall: () => ipcRenderer.invoke("llama-cpp-uninstall"),

  // Debug logging for reasoning pipeline
  logReasoning: (stage, details) =>
    ipcRenderer.invoke("log-reasoning", stage, details),

  // Launch on startup
  setLaunchOnStartup: (enabled) =>
    ipcRenderer.invoke("set-launch-on-startup", enabled),
  getLaunchOnStartup: () =>
    ipcRenderer.invoke("get-launch-on-startup"),

  // Remove all listeners for a channel
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },

  // Gemini image generation
  generateImage: (params) => ipcRenderer.invoke("generate-image", params),
  saveGeneratedImage: (params) => ipcRenderer.invoke("save-generated-image", params),

  // Directory dialog
  openDirectoryDialog: () => ipcRenderer.invoke("open-directory-dialog"),
});

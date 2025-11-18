import ReasoningService from "../services/ReasoningService";
import { API_ENDPOINTS, buildApiUrl, normalizeBaseUrl } from "../config/constants";

// Debug logger for renderer process
const debugLogger = {
  logReasoning: async (stage, details) => {
    if (window.electronAPI?.logReasoning) {
      try {
        await window.electronAPI.logReasoning(stage, details);
      } catch (error) {
        console.error('Failed to log reasoning:', error);
      }
    } else {
      // Fallback to console if IPC not available
      console.log(`🤖 [REASONING ${stage}]`, details);
    }
  }
};


class AudioManager {
  constructor() {
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.isRecording = false;
    this.isProcessing = false;
    this.onStateChange = null;
    this.onError = null;
    this.onTranscriptionComplete = null;
    this.cachedApiKey = null; // Cache API key
    this.capturedContext = null; // Store captured text context
    this.originalClipboard = null; // Store original clipboard to restore
    this.abortController = null; // For cancelling API requests
  }

  // Set callback functions
  setCallbacks({ onStateChange, onError, onTranscriptionComplete }) {
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.onTranscriptionComplete = onTranscriptionComplete;
  }

  async captureHighlightedText() {
    try {
      console.log("📋 Attempting to capture highlighted text...");
      debugLogger.logReasoning("CAPTURE_START", { timestamp: new Date().toISOString() });

      // Save the current clipboard content first
      this.originalClipboard = await window.electronAPI.readClipboard();
      console.log("📋 Original clipboard:", this.originalClipboard?.substring(0, 50) + "...");
      debugLogger.logReasoning("ORIGINAL_CLIPBOARD", {
        hasContent: !!this.originalClipboard,
        length: this.originalClipboard?.length || 0,
        preview: this.originalClipboard?.substring(0, 100)
      });

      // Try to copy any highlighted text (this will replace clipboard if text is selected)
      // We need to simulate Cmd+C to copy highlighted text
      console.log("📋 Simulating copy command...");
      const copyResult = await window.electronAPI.simulateCopy();
      console.log("📋 Copy command result:", copyResult);
      debugLogger.logReasoning("SIMULATE_COPY", {
        result: copyResult,
        success: copyResult === true || copyResult?.success === true
      });

      // Increased delay to ensure copy completes (was 200ms, now 500ms)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Read the potentially new clipboard content
      const newClipboard = await window.electronAPI.readClipboard();
      console.log("📋 New clipboard:", newClipboard?.substring(0, 50) + "...");
      debugLogger.logReasoning("NEW_CLIPBOARD", {
        hasContent: !!newClipboard,
        length: newClipboard?.length || 0,
        preview: newClipboard?.substring(0, 100),
        changed: newClipboard !== this.originalClipboard
      });

      // If clipboard changed, we captured highlighted text
      if (newClipboard !== this.originalClipboard && newClipboard) {
        this.capturedContext = newClipboard;
        console.log("✅ CAPTURED HIGHLIGHTED TEXT:", this.capturedContext.substring(0, 100));
        console.log("✅ Full captured text length:", this.capturedContext.length);
        debugLogger.logReasoning("CAPTURED_HIGHLIGHTED_TEXT", {
          captured: true,
          length: this.capturedContext.length,
          preview: this.capturedContext.substring(0, 200),
          fullText: this.capturedContext // Log full text for debugging
        });
      } else {
        // No highlighted text
        this.capturedContext = null;
        console.log("❌ No highlighted text captured - clipboard unchanged");
        console.log("   Original:", this.originalClipboard?.substring(0, 50));
        console.log("   New:     ", newClipboard?.substring(0, 50));
        debugLogger.logReasoning("NO_HIGHLIGHTED_TEXT", {
          captured: false,
          originalClipboard: this.originalClipboard?.substring(0, 100),
          newClipboard: newClipboard?.substring(0, 100),
          areEqual: newClipboard === this.originalClipboard
        });
      }
    } catch (error) {
      console.error("❌ Capture error:", error);
      debugLogger.logReasoning("CAPTURE_ERROR", {
        error: error.message,
        stack: error.stack
      });
      this.capturedContext = null;
    }
  }

  async startRecording() {
    try {
      if (this.isRecording) {
        return false;
      }

      // Capture any highlighted text when recording starts
      await this.captureHighlightedText();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });


      this.mediaRecorder = new MediaRecorder(stream);
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = (event) => {
        this.audioChunks.push(event.data);
      };

      this.mediaRecorder.onstop = async () => {
        this.isRecording = false;
        this.isProcessing = true;
        this.onStateChange?.({ isRecording: false, isProcessing: true });

        const audioBlob = new Blob(this.audioChunks, { type: "audio/wav" });
        
        if (audioBlob.size === 0) {
        }
        
        await this.processAudio(audioBlob);

        // Clean up stream
        stream.getTracks().forEach((track) => track.stop());
      };

      this.mediaRecorder.start();
      this.isRecording = true;
      this.onStateChange?.({ isRecording: true, isProcessing: false });

      return true;
    } catch (error) {
      
      // Provide more specific error messages
      let errorTitle = "Recording Error";
      let errorDescription = `Failed to access microphone: ${error.message}`;
      
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        errorTitle = "Microphone Access Denied";
        errorDescription = "Please grant microphone permission in your system settings and try again.";
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        errorTitle = "No Microphone Found";
        errorDescription = "No microphone was detected. Please connect a microphone and try again.";
      } else if (error.name === "NotReadableError" || error.name === "TrackStartError") {
        errorTitle = "Microphone In Use";
        errorDescription = "The microphone is being used by another application. Please close other apps and try again.";
      }
      
      this.onError?.({
        title: errorTitle,
        description: errorDescription,
      });
      return false;
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      this.mediaRecorder.stop();
      // State change will be handled in onstop callback
      return true;
    }
    return false;
  }

  async processAudio(audioBlob) {
    try {
      // Get user preferences
      const useLocalWhisper =
        localStorage.getItem("useLocalWhisper") === "true";
      const whisperModel = localStorage.getItem("whisperModel") || "base";
      

      let result;
      if (useLocalWhisper) {
        result = await this.processWithLocalWhisper(audioBlob, whisperModel);
      } else {
        result = await this.processWithOpenAIAPI(audioBlob);
      }
      this.onTranscriptionComplete?.(result);
    } catch (error) {
      // Don't show error here if it's "No audio detected" - already shown elsewhere
      if (error.message !== "No audio detected") {
        this.onError?.({
          title: "Transcription Error",
          description: `Transcription failed: ${error.message}`,
        });
      }
    } finally {
      this.isProcessing = false;
      this.onStateChange?.({ isRecording: false, isProcessing: false });
    }
  }

  async processWithLocalWhisper(audioBlob, model = "base") {
    
    // Analyze audio levels first
    const audioAnalysis = await this.analyzeAudioLevels(audioBlob);
    if (audioAnalysis && audioAnalysis.isSilent) {
      // Show error to user immediately
      this.onError?.({
        title: "No Audio Detected",
        description: "The recording appears to be silent. Please check that your microphone is working and not muted.",
      });
      // Still continue to try transcription in case analysis was wrong
    }
    
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Get language preference for local Whisper
      const language = localStorage.getItem("preferredLanguage");
      const options = { model };
      if (language && language !== "auto") {
        options.language = language;
      }

      const result = await window.electronAPI.transcribeLocalWhisper(
        arrayBuffer,
        options
      );
      

      if (result.success && result.text) {
        const text = await this.processTranscription(result.text, "local");
        // Allow empty strings as valid responses (reasoning service might return cleaned empty text)
        if (text !== null && text !== undefined) {
          return { success: true, text: text || result.text, source: "local" };
        } else {
          throw new Error("No text transcribed");
        }
      } else if (
        result.success === false &&
        result.message === "No audio detected"
      ) {
        // Show specific error to user with more details
        this.onError?.({
          title: "No Audio Detected",
          description: "The recording contained no detectable audio. Please check your microphone settings.",
        });
        throw new Error("No audio detected");
      } else {
        throw new Error(result.error || "Local Whisper transcription failed");
      }
    } catch (error) {
      if (error.message === "No audio detected") {
        throw error;
      }

      const allowOpenAIFallback = localStorage.getItem("allowOpenAIFallback") === "true";
      const isLocalMode = localStorage.getItem("useLocalWhisper") === "true";

      if (allowOpenAIFallback && isLocalMode) {
        try {
          const fallbackResult = await this.processWithOpenAIAPI(audioBlob);
          return { ...fallbackResult, source: "openai-fallback" };
        } catch (fallbackError) {
          throw new Error(`Local Whisper failed: ${error.message}. OpenAI fallback also failed: ${fallbackError.message}`);
        }
      } else {
        throw new Error(`Local Whisper failed: ${error.message}`);
      }
    }
  }

  async getAPIKey() {
    if (this.cachedApiKey) {
      return this.cachedApiKey;
    }

    let apiKey = await window.electronAPI.getOpenAIKey();
    if (
      !apiKey ||
      apiKey.trim() === "" ||
      apiKey === "your_openai_api_key_here"
    ) {
      apiKey = localStorage.getItem("openaiApiKey");
    }

    if (
      !apiKey ||
      apiKey.trim() === "" ||
      apiKey === "your_openai_api_key_here"
    ) {
      throw new Error(
        "OpenAI API key not found. Please set your API key in the .env file or Control Panel."
      );
    }

    this.cachedApiKey = apiKey;
    return apiKey;
  }

  async analyzeAudioLevels(audioBlob) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      let sum = 0;
      let max = 0;
      
      for (let i = 0; i < channelData.length; i++) {
        const sample = Math.abs(channelData[i]);
        sum += sample;
        max = Math.max(max, sample);
      }
      
      const average = sum / channelData.length;
      const duration = audioBuffer.duration;
      
      
      return {
        duration,
        averageLevel: average,
        maxLevel: max,
        isSilent: max < 0.01
      };
    } catch (error) {
      return null;
    }
  }

  // Convert audio to optimal format for API (reduces upload time)
  async optimizeAudio(audioBlob) {
    return new Promise((resolve) => {
      const audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const arrayBuffer = reader.result;
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          // Convert to 16kHz mono for smaller size and faster upload
          const sampleRate = 16000;
          const channels = 1;
          const length = Math.floor(audioBuffer.duration * sampleRate);
          const offlineContext = new OfflineAudioContext(
            channels,
            length,
            sampleRate
          );

          const source = offlineContext.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(offlineContext.destination);
          source.start();

          const renderedBuffer = await offlineContext.startRendering();

          // Convert to WAV blob
          const wavBlob = this.audioBufferToWav(renderedBuffer);
          resolve(wavBlob);
        } catch (error) {
          // If optimization fails, use original
          resolve(audioBlob);
        }
      };

      reader.onerror = () => resolve(audioBlob);
      reader.readAsArrayBuffer(audioBlob);
    });
  }

  // Convert AudioBuffer to WAV format
  audioBufferToWav(buffer) {
    const length = buffer.length;
    const arrayBuffer = new ArrayBuffer(44 + length * 2);
    const view = new DataView(arrayBuffer);
    const sampleRate = buffer.sampleRate;
    const channelData = buffer.getChannelData(0);

    // WAV header
    const writeString = (offset, string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + length * 2, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeString(36, "data");
    view.setUint32(40, length * 2, true);

    // Convert samples to 16-bit PCM
    let offset = 44;
    for (let i = 0; i < length; i++) {
      const sample = Math.max(-1, Math.min(1, channelData[i]));
      view.setInt16(
        offset,
        sample < 0 ? sample * 0x8000 : sample * 0x7fff,
        true
      );
      offset += 2;
    }

    return new Blob([arrayBuffer], { type: "audio/wav" });
  }

  async processWithReasoningModel(text, clipboardContext = null, abortSignal = null) {
    console.error("🎯 CALVIN PROCESSING STARTED!");

    const model = (typeof window !== 'undefined' && window.localStorage)
      ? (localStorage.getItem("reasoningModel") || "gpt-5.1")
      : "gpt-5.1";
    const agentName = (typeof window !== 'undefined' && window.localStorage)
      ? (localStorage.getItem("agentName") || null)
      : null;
    const reasoningEffort = (typeof window !== 'undefined' && window.localStorage)
      ? (localStorage.getItem("reasoningEffort") || "low")
      : "low";
    const verbosity = (typeof window !== 'undefined' && window.localStorage)
      ? (localStorage.getItem("verbosity") || "medium")
      : "medium";

    console.error("🤖 USING MODEL:", model);
    console.error("   - Agent name:", agentName);
    console.error("   - Has clipboard context:", !!clipboardContext);

    debugLogger.logReasoning("CALLING_REASONING_SERVICE", {
      model,
      agentName,
      textLength: text.length,
      hasContext: !!clipboardContext,
      contextLength: clipboardContext ? clipboardContext.length : 0
    });

    const startTime = Date.now();

    try {
      // Pass the clipboard context, screenshot, and abort signal as part of the config
      const config = {
        reasoningEffort,
        verbosity,
        clipboardContext,
        screenshot: window.capturedScreenshot || null,
        abortSignal
      };

      const result = await ReasoningService.processText(text, model, agentName, config);

      const processingTime = Date.now() - startTime;

      debugLogger.logReasoning("REASONING_SERVICE_COMPLETE", {
        model,
        processingTimeMs: processingTime,
        resultLength: result.length,
        success: true
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;

      debugLogger.logReasoning("REASONING_SERVICE_ERROR", {
        model,
        processingTimeMs: processingTime,
        error: error.message,
        stack: error.stack
      });

      throw error;
    }
  }

  async isReasoningAvailable() {
    // Check if we're in renderer process (has localStorage)
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedValue = localStorage.getItem("useReasoningModel");

      console.log("🔍 Checking if reasoning is enabled:");
      console.log("   - useReasoningModel value:", storedValue);
      console.log("   - Type:", typeof storedValue);

      // Debug log the actual stored value
      debugLogger.logReasoning("REASONING_STORAGE_CHECK", {
        storedValue,
        typeOfStoredValue: typeof storedValue,
        isTrue: storedValue === "true",
        isTruthy: !!storedValue && storedValue !== "false"
      });

      // Check for both "true" string and truthy values (but not "false")
      const useReasoning = storedValue === "true" || (!!storedValue && storedValue !== "false");

      console.log("   - Reasoning enabled?", useReasoning);

      if (!useReasoning) return false;
      
      try {
        const isAvailable = await ReasoningService.isAvailable();
        
        debugLogger.logReasoning("REASONING_AVAILABILITY", {
          isAvailable,
          reasoningEnabled: useReasoning,
          finalDecision: useReasoning && isAvailable
        });
        
        return isAvailable;
      } catch (error) {
        debugLogger.logReasoning("REASONING_AVAILABILITY_ERROR", {
          error: error.message,
          stack: error.stack
        });
        return false;
      }
    }
    // If not in renderer, reasoning is not available
    return false;
  }

  async processTranscription(text, source) {
    const normalizedText = typeof text === "string" ? text.trim() : "";

    // Log incoming transcription
    debugLogger.logReasoning("TRANSCRIPTION_RECEIVED", {
      source,
      textLength: normalizedText.length,
      textPreview: normalizedText.substring(0, 100) + (normalizedText.length > 100 ? "..." : ""),
      timestamp: new Date().toISOString()
    });

    // Safe localStorage access
    const agentName = (typeof window !== 'undefined' && window.localStorage)
      ? (localStorage.getItem("agentName") || null)
      : null;

    // Check if agent is addressed by name
    const isAgentAddressed = agentName && normalizedText.toLowerCase().includes(agentName.toLowerCase());

    // Check if we have highlighted text captured (from App.jsx or from our own capture)
    const hasHighlightedText = !!(window.capturedHighlightedContext || this.capturedContext);

    // Check if we have a screenshot captured
    const hasScreenshot = !!window.capturedScreenshot;

    // Use the captured context from App.jsx if available
    if (window.capturedHighlightedContext && !this.capturedContext) {
      this.capturedContext = window.capturedHighlightedContext;
      this.originalClipboard = window.originalClipboardContent;
      console.log("📋 Using captured context from App.jsx:", this.capturedContext?.substring(0, 100));
    }

    // Use reasoning ONLY if:
    // 1. User addresses the agent by name OR
    // 2. User has highlighted text (automatic agent activation) OR
    // 3. User has captured a screenshot (automatic agent activation)
    // NO "regular mode" - it's either pure transcription or agent mode
    const reasoningEnabled = await this.isReasoningAvailable();
    const useReasoning = reasoningEnabled && (isAgentAddressed || hasHighlightedText || hasScreenshot);

    const reasoningModel = (typeof window !== 'undefined' && window.localStorage)
      ? (localStorage.getItem("reasoningModel") || "gpt-5.1")
      : "gpt-5.1";
    const reasoningProvider = (typeof window !== 'undefined' && window.localStorage)
      ? (localStorage.getItem("reasoningProvider") || "auto")
      : "auto";

    console.error("🤖 CALVIN ACTIVATION CHECK:");
    console.error("   - Agent addressed:", isAgentAddressed);
    console.error("   - Has highlighted text:", hasHighlightedText);
    console.error("   - Will use Calvin:", useReasoning);
    console.error("   - Selected model:", reasoningModel);
    console.error("   - Provider:", reasoningProvider);

    // Use captured context when available - ALWAYS if we have highlighted text
    let clipboardContext = null;
    const hasContextReference = /\b(this|that|these|those|it)\b/i.test(normalizedText);

    console.log("🔍 Context check:");
    console.log("   - Has context reference words:", hasContextReference);
    console.log("   - Has captured context:", !!this.capturedContext);
    console.log("   - Captured context length:", this.capturedContext?.length || 0);

    debugLogger.logReasoning("CONTEXT_CHECK", {
      hasContextReference,
      hasCapturedContext: !!this.capturedContext,
      capturedContextLength: this.capturedContext?.length || 0,
      normalizedTextPreview: normalizedText.substring(0, 100)
    });

    // Use captured context if:
    // 1. We have highlighted text (always use it)
    // 2. OR user references "this/that" etc AND addresses agent
    if (this.capturedContext && (hasHighlightedText || (hasContextReference && isAgentAddressed))) {
      clipboardContext = this.capturedContext;
      console.log("✅ Using captured context:", clipboardContext.substring(0, 100));
      debugLogger.logReasoning("USING_CAPTURED_CONTEXT", {
        hasContext: true,
        contextLength: clipboardContext.length,
        contextPreview: clipboardContext.substring(0, 200),
        fullContext: clipboardContext, // Log full context for debugging
        reason: hasHighlightedText ? "Highlighted text captured" : "Context reference with agent"
      });
    } else if (hasContextReference && !this.capturedContext) {
      console.log("⚠️ User referenced context but none was captured");
      debugLogger.logReasoning("NO_CAPTURED_CONTEXT", {
        hasContextReference: true,
        capturedContext: null,
        warning: "User referenced context but none was captured"
      });
    } else {
      console.log("ℹ️ No context to use");
      debugLogger.logReasoning("CONTEXT_NOT_USED", {
        reason: "No highlighted text or context references",
        hasContextReference,
        hasCapturedContext: false
      });
    }

    // Restore original clipboard after processing
    const restoreClipboard = async () => {
      if (this.originalClipboard !== null && this.capturedContext) {
        try {
          await window.electronAPI.writeClipboard(this.originalClipboard);
          debugLogger.logReasoning("CLIPBOARD_RESTORED", {
            restored: true
          });
        } catch (error) {
          debugLogger.logReasoning("CLIPBOARD_RESTORE_ERROR", { error: error.message });
        }
      }
      // Clear captured context and screenshot
      this.capturedContext = null;
      this.originalClipboard = null;
      // Also clear the window variables set by App.jsx
      window.capturedHighlightedContext = null;
      window.originalClipboardContent = null;
      window.capturedScreenshot = null;
    };

    debugLogger.logReasoning("REASONING_CHECK", {
      useReasoning,
      reasoningModel,
      reasoningProvider,
      agentName,
      hasClipboardContext: !!clipboardContext
    });

    console.error("📊 REASONING DECISION:", useReasoning ? "YES - will use Calvin" : "NO - plain transcription");

    if (useReasoning) {
      console.error("🚀 STARTING CALVIN PROCESSING...");

      // Create a new AbortController for this request
      this.abortController = new AbortController();
      this.cancelled = false;

      try {
        // Prepare text with context if available
        let preparedText = normalizedText;

        // If there's clipboard context and the user is addressing the agent, include it
        if (clipboardContext && agentName && normalizedText.toLowerCase().includes(agentName.toLowerCase())) {
          // Pass both the command and the context separately
          preparedText = normalizedText;
        }

        debugLogger.logReasoning("SENDING_TO_REASONING", {
          preparedTextLength: preparedText.length,
          model: reasoningModel,
          provider: reasoningProvider,
          hasContext: !!clipboardContext
        });

        const result = await this.processWithReasoningModel(preparedText, clipboardContext, this.abortController.signal);

        debugLogger.logReasoning("REASONING_SUCCESS", {
          resultLength: result.length,
          resultPreview: result.substring(0, 100) + (result.length > 100 ? "..." : ""),
          processingTime: new Date().toISOString(),
          wasCancelled: this.cancelled
        });

        // Restore clipboard after successful processing
        await restoreClipboard();

        // If cancelled, return null to prevent pasting
        if (this.cancelled) {
          console.error("⚠️ Processing was cancelled - not returning result");
          return null;
        }

        return result;
      } catch (error) {
        debugLogger.logReasoning("REASONING_FAILED", {
          error: error.message,
          stack: error.stack,
          fallbackToCleanup: true,
          wasCancelled: this.cancelled,
          isAbortError: error.name === 'AbortError'
        });

        // If it's an abort error, just clean up and return null
        if (error.name === 'AbortError' || this.cancelled) {
          console.error("🛑 Processing was cancelled by user");
          await restoreClipboard();
          return null;
        }

        console.error(`❌ Calvin/Reasoning failed - falling back to plain transcription`);
        console.error(`   - Model: ${reasoningModel}`);
        console.error(`   - Error: ${error.message}`);
        console.error(`   - Full error:`, error);
        // Restore clipboard even on error
        await restoreClipboard();
        // Fall back to standard cleanup (just return the transcription)
      } finally {
        // Clean up the abort controller
        this.abortController = null;
      }
    }
    
    debugLogger.logReasoning("USING_STANDARD_CLEANUP", {
      reason: useReasoning ? "Reasoning failed" : "Reasoning not enabled"
    });

    // Check if cancelled before returning regular transcription
    if (this.cancelled) {
      console.log("⚠️ Transcription was cancelled - not returning result");
      return null;
    }

    // Standard cleanup when reasoning is unavailable or fails
    return normalizedText;
  }

  async processWithOpenAIAPI(audioBlob) {
    try {
      // Parallel: get API key (cached) and optimize audio
      const [apiKey, optimizedAudio] = await Promise.all([
        this.getAPIKey(),
        this.optimizeAudio(audioBlob),
      ]);

      const formData = new FormData();
      formData.append("file", optimizedAudio, "audio.wav");
      formData.append("model", "whisper-1");

      // Add language hint if set (improves processing speed)
      const language = localStorage.getItem("preferredLanguage");
      if (language && language !== "auto") {
        formData.append("language", language);
      }

      const response = await fetch(
        this.getTranscriptionEndpoint(),
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      
      if (result.text) {
        const text = await this.processTranscription(result.text, "openai");
        const source = await this.isReasoningAvailable() ? "openai-reasoned" : "openai";
        return { success: true, text, source };
      } else {
        throw new Error("No text transcribed");
      }
    } catch (error) {

      // Try fallback to Local Whisper ONLY if enabled AND we're in OpenAI mode
      const allowLocalFallback =
        localStorage.getItem("allowLocalFallback") === "true";
      const isOpenAIMode = localStorage.getItem("useLocalWhisper") !== "true";

      if (allowLocalFallback && isOpenAIMode) {
        const fallbackModel =
          localStorage.getItem("fallbackWhisperModel") || "base";
        try {
          const arrayBuffer = await audioBlob.arrayBuffer();

          // Get language preference for fallback as well
          const language = localStorage.getItem("preferredLanguage");
          const options = { model: fallbackModel };
          if (language && language !== "auto") {
            options.language = language;
          }

          const result = await window.electronAPI.transcribeLocalWhisper(
            arrayBuffer,
            options
          );

          if (result.success && result.text) {
            const text = await this.processTranscription(result.text, "local-fallback");
            if (text) {
              return { success: true, text, source: "local-fallback" };
            }
          }
          // If local fallback fails, throw the original OpenAI error
          throw error;
        } catch (fallbackError) {
          throw new Error(
            `OpenAI API failed: ${error.message}. Local fallback also failed: ${fallbackError.message}`
          );
        }
      }

      throw error;
    }
  }

  getTranscriptionEndpoint() {
    try {
      const stored = typeof localStorage !== "undefined"
        ? localStorage.getItem("cloudTranscriptionBaseUrl") || ""
        : "";
      const trimmed = stored.trim();
      const base = trimmed ? trimmed : API_ENDPOINTS.TRANSCRIPTION_BASE;
      const normalizedBase = normalizeBaseUrl(base);

      if (!normalizedBase) {
        return API_ENDPOINTS.TRANSCRIPTION;
      }

      // Security: Only allow HTTPS endpoints (except localhost for development)
      const isLocalhost = normalizedBase.includes('://localhost') || normalizedBase.includes('://127.0.0.1');
      if (!normalizedBase.startsWith('https://') && !isLocalhost) {
        console.warn('Non-HTTPS endpoint rejected for security. Using default.');
        return API_ENDPOINTS.TRANSCRIPTION;
      }

      if (/\/audio\/(transcriptions|translations)$/i.test(normalizedBase)) {
        return normalizedBase;
      }

      return buildApiUrl(normalizedBase, '/audio/transcriptions');
    } catch (error) {
      console.warn('Failed to resolve transcription endpoint:', error);
      return API_ENDPOINTS.TRANSCRIPTION;
    }
  }

  async safePaste(text) {
    try {
      await window.electronAPI.pasteText(text);
      return true;
    } catch (error) {
      this.onError?.({
        title: "Paste Error",
        description: `Failed to paste text. Please check accessibility permissions. ${error.message}`,
      });
      return false;
    }
  }

  async saveTranscription(text) {
    try {
      await window.electronAPI.saveTranscription(text);
      return true;
    } catch (error) {
      return false;
    }
  }

  cancelProcessing() {
    console.log("🛑 Cancelling agent processing...");
    this.cancelled = true; // Set flag to prevent pasting
    if (this.abortController) {
      console.log("   - Aborting API request...");
      this.abortController.abort();
      this.abortController = null;
    }
    this.isProcessing = false;
    this.onStateChange?.({ isRecording: false, isProcessing: false });
  }

  getState() {
    return {
      isRecording: this.isRecording,
      isProcessing: this.isProcessing,
    };
  }

  cleanup() {
    if (this.mediaRecorder && this.isRecording) {
      this.stopRecording();
    }
    if (this.abortController) {
      this.abortController.abort();
    }
    this.onStateChange = null;
    this.onError = null;
    this.onTranscriptionComplete = null;
  }
}

export default AudioManager;

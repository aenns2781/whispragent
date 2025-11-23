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
      // ALWAYS use local Whisper - this is the only transcription method
      const whisperModel = localStorage.getItem("whisperModel") || "base";

      const result = await this.processWithLocalWhisper(audioBlob, whisperModel);
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
    // Skip audio analysis - Whisper will handle silence detection
    // This saves processing time and Whisper's detection is more reliable

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

      // No fallback to OpenAI - local Whisper is the only transcription method
      throw new Error(`Local Whisper failed: ${error.message}`);
    }
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
    // ALWAYS return true - agent mode should always be available
    // We don't need a toggle for this fundamental feature
    console.log("🔍 Agent mode is ALWAYS enabled");
    debugLogger.logReasoning("REASONING_ALWAYS_ENABLED", {
      enabled: true,
      reason: "Agent mode is a core feature and always available"
    });

    try {
      const isAvailable = await ReasoningService.isAvailable();
      debugLogger.logReasoning("REASONING_SERVICE_AVAILABILITY", {
        isAvailable
      });
      return isAvailable;
    } catch (error) {
      debugLogger.logReasoning("REASONING_AVAILABILITY_ERROR", {
        error: error.message,
        stack: error.stack
      });
      return true; // Still return true even if service check fails - agent mode should be available
    }
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

    // Enhanced debug logging
    console.error("🔍 AGENT MODE DECISION FACTORS:");
    console.error("   - Reasoning enabled:", reasoningEnabled);
    console.error("   - Agent addressed:", isAgentAddressed);
    console.error("   - Has highlighted text:", hasHighlightedText);
    console.error("   - Has screenshot:", hasScreenshot);
    console.error("   - Captured context exists:", !!this.capturedContext);
    console.error("   - Window captured context exists:", !!window.capturedHighlightedContext);
    console.error("   - FINAL DECISION - Use agent mode:", useReasoning);

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

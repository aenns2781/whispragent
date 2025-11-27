import ReasoningService from "../services/ReasoningService";
import { API_ENDPOINTS, buildApiUrl, normalizeBaseUrl } from "../config/constants";
import ElevenLabsRealtimeClient from "../services/ElevenLabsRealtimeClient";

// VERSION MARKER - if you don't see this in console, the old file is cached
console.log("🔴🔴🔴 AudioManager v5 loaded with REALTIME support 🔴🔴🔴");

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

    // Real-time transcription
    this.realtimeClient = null;
    this.isRealtimeMode = false;
    this.realtimeTranscript = '';
    this.realtimeIsAgentMode = false;
    this.onPartialTranscript = null; // Callback for live transcript updates
  }

  // Set callback functions
  setCallbacks({ onStateChange, onError, onTranscriptionComplete, onAgentModeChange, onPartialTranscript }) {
    this.onStateChange = onStateChange;
    this.onError = onError;
    this.onTranscriptionComplete = onTranscriptionComplete;
    this.onAgentModeChange = onAgentModeChange;
    this.onPartialTranscript = onPartialTranscript;
  }

  buildInitialPrompt() {
    const prompts = [];

    // Check if Dictionary is enabled and add dictionary words as Whisper hints
    // This helps Whisper recognize custom words, names, and terms correctly
    if (JSON.parse(localStorage.getItem('dictionaryEnabled') || 'true')) {
      const dictionary = JSON.parse(localStorage.getItem('dictionary') || '[]');
      if (dictionary.length > 0) {
        // Extract just the words for Whisper to recognize
        const words = dictionary.map(entry => entry.word).filter(Boolean);
        if (words.length > 0) {
          prompts.push(`Vocabulary: ${words.join(', ')}`);
        }
      }
    }

    // Add captured context if available
    if (this.capturedContext) {
      prompts.push(`Context: ${this.capturedContext.substring(0, 150)}`);
    }

    // Join all prompts
    const finalPrompt = prompts.join('. ').substring(0, 500); // Limit to 500 chars
    return finalPrompt || null;
  }

  applyDictionaryCorrections(text) {
    // Check if Dictionary is enabled
    if (!JSON.parse(localStorage.getItem('dictionaryEnabled') || 'true')) {
      return text;
    }

    const dictionary = JSON.parse(localStorage.getItem('dictionary') || '[]');
    if (dictionary.length === 0) {
      return text;
    }

    let result = text;

    // Apply corrections from dictionary entries that have a correction defined
    dictionary.forEach(entry => {
      if (entry.word && entry.correction) {
        // Create case-insensitive regex with word boundaries to avoid partial matches
        const escapedWord = entry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
        result = result.replace(regex, entry.correction);
      }
    });

    return result;
  }

  applySnippets(text) {
    // Check if Snippets are enabled
    if (!JSON.parse(localStorage.getItem('snippetsEnabled') || 'true')) {
      return text;
    }

    const snippets = JSON.parse(localStorage.getItem('snippets') || '[]');
    if (snippets.length === 0) {
      return text;
    }

    let result = text;

    // Apply each snippet as case-insensitive find-and-replace
    snippets.forEach(snippet => {
      if (snippet.trigger && snippet.content) {
        // Create case-insensitive regex
        const regex = new RegExp(snippet.trigger.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        result = result.replace(regex, snippet.content);
      }
    });

    return result;
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
    // Log through IPC to main process terminal
    window.electronAPI?.logReasoning?.("AUDIO_MANAGER_START", { version: "v3", timestamp: Date.now() });

    try {
      if (this.isRecording) {
        return false;
      }

      // Capture any highlighted text when recording starts
      await this.captureHighlightedText();

      // Check if real-time mode is enabled for ElevenLabs
      // Read from main process (shared across windows) instead of localStorage
      let transcriptionEngine = "local";
      let useRealtimeTranscription = false;

      // Log to terminal via IPC
      await window.electronAPI?.logReasoning?.("START_RECORDING", {
        hasGetTranscriptionEngine: !!window.electronAPI?.getTranscriptionEngine,
        hasGetRealtimeEnabled: !!window.electronAPI?.getRealtimeTranscriptionEnabled
      });

      try {
        transcriptionEngine = await window.electronAPI?.getTranscriptionEngine?.() || "local";
        useRealtimeTranscription = await window.electronAPI?.getRealtimeTranscriptionEnabled?.() || false;
      } catch (err) {
        await window.electronAPI?.logReasoning?.("SETTINGS_ERROR", { error: err.message });
      }

      this.isRealtimeMode = transcriptionEngine === "elevenlabs" && useRealtimeTranscription;

      // Log decision to terminal via IPC
      await window.electronAPI?.logReasoning?.("REALTIME_DECISION", {
        transcriptionEngine,
        useRealtimeTranscription,
        isRealtimeMode: this.isRealtimeMode
      });

      window.electronAPI?.logReasoning?.("REALTIME_CHECK", {
        transcriptionEngine,
        useRealtimeTranscription,
        isRealtimeMode: this.isRealtimeMode
      });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // If real-time mode, set up the WebSocket client and PCM capture
      if (this.isRealtimeMode) {
        console.log("🎙️ [AudioManager] Starting real-time transcription mode");
        const agentName = localStorage.getItem("agentName") || null;
        const language = localStorage.getItem("preferredLanguage") || "auto";

        this.realtimeTranscript = '';
        this.realtimeIsAgentMode = false;

        this.realtimeClient = new ElevenLabsRealtimeClient({
          language,
          agentName,
          onPartialTranscript: (text) => {
            this.realtimeTranscript = text;
            this.onPartialTranscript?.(text);
          },
          onCommittedTranscript: (text) => {
            this.realtimeTranscript = text;
          },
          onAgentDetected: (isAgentMode) => {
            this.realtimeIsAgentMode = isAgentMode;
            this.onAgentModeChange?.(isAgentMode);
            console.log(`🎯 [AudioManager] Agent mode detected: ${isAgentMode}`);
          },
          onError: (error) => {
            console.error("❌ [AudioManager] Real-time error:", error);
            // Fall back to batch mode on error
            this.isRealtimeMode = false;
          },
          onConnected: () => {
            console.log("✅ [AudioManager] Real-time connected");
          },
          onDisconnected: () => {
            console.log("🔌 [AudioManager] Real-time disconnected");
          }
        });

        const connected = await this.realtimeClient.connect();
        if (!connected) {
          console.warn("⚠️ [AudioManager] Failed to connect to real-time, falling back to batch mode");
          this.isRealtimeMode = false;
          this.realtimeClient = null;
        } else {
          // Set up AudioContext for PCM capture (ElevenLabs needs PCM 16kHz 16-bit)
          this.audioContext = new AudioContext({ sampleRate: 16000 });
          const source = this.audioContext.createMediaStreamSource(stream);

          // Use ScriptProcessor to get raw PCM samples
          const bufferSize = 4096;
          this.scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

          this.scriptProcessor.onaudioprocess = (e) => {
            if (this.isRealtimeMode && this.realtimeClient) {
              const inputData = e.inputBuffer.getChannelData(0);
              // Convert Float32 to Int16 PCM
              const pcm16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
              }
              this.realtimeClient.sendAudio(pcm16.buffer);
            }
          };

          source.connect(this.scriptProcessor);
          this.scriptProcessor.connect(this.audioContext.destination);
          console.log("🎤 [AudioManager] PCM audio capture started (16kHz)");
        }
      }

      // Still use MediaRecorder for batch mode or as backup
      this.mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      this.audioChunks = [];

      this.mediaRecorder.ondataavailable = async (event) => {
        this.audioChunks.push(event.data);
        // Note: For real-time mode, audio is sent via ScriptProcessor above, not here
      };

      this.mediaRecorder.onstop = async () => {
        this.isRecording = false;
        this.isProcessing = true;
        this.onStateChange?.({ isRecording: false, isProcessing: true });

        // If real-time mode, commit and disconnect
        if (this.isRealtimeMode && this.realtimeClient) {
          this.realtimeClient.commit();
          // Wait for final transcript
          await new Promise(resolve => setTimeout(resolve, 1000));
          this.realtimeClient.disconnect();
        }

        // Clean up AudioContext and ScriptProcessor
        if (this.scriptProcessor) {
          this.scriptProcessor.disconnect();
          this.scriptProcessor = null;
        }
        if (this.audioContext) {
          await this.audioContext.close();
          this.audioContext = null;
        }

        const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" });

        await this.processAudio(audioBlob);

        // Clean up stream
        stream.getTracks().forEach((track) => track.stop());

        // Clean up real-time client
        if (this.realtimeClient) {
          this.realtimeClient = null;
        }
        this.isRealtimeMode = false;
      };

      // Start recording (PCM audio is sent via ScriptProcessor for realtime mode)
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
      // Check which transcription engine to use (from IPC for cross-window consistency)
      const transcriptionEngine = await window.electronAPI?.getTranscriptionEngine() || "local";

      let result;

      // If we have a real-time transcript, use it instead of batch processing
      if (this.realtimeTranscript && this.realtimeTranscript.trim()) {
        console.log(`📝 Using real-time transcript: "${this.realtimeTranscript.substring(0, 50)}..."`);

        // Process the real-time transcript through the standard pipeline
        const text = await this.processTranscription(this.realtimeTranscript, "elevenlabs-realtime");

        if (text !== null && text !== undefined) {
          result = { success: true, text: text || this.realtimeTranscript, source: "elevenlabs-realtime" };
        } else {
          throw new Error("No text transcribed");
        }

        // Clear the real-time transcript
        this.realtimeTranscript = '';
      } else if (transcriptionEngine === "elevenlabs") {
        // Use ElevenLabs batch transcription (fallback or non-realtime mode)
        console.log(`📝 Using ElevenLabs batch transcription`);
        result = await this.processWithElevenLabs(audioBlob);
      } else {
        // Use local Whisper (default)
        const whisperModel = localStorage.getItem("whisperModel") || "base";
        console.log(`📝 Using local Whisper model: ${whisperModel}`);
        result = await this.processWithLocalWhisper(audioBlob, whisperModel);
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
      this.onAgentModeChange?.(false); // Reset agent mode indicator
      // Clear real-time state
      this.realtimeTranscript = '';
      this.realtimeIsAgentMode = false;
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

      // Build initial prompt based on enabled features
      const initialPrompt = this.buildInitialPrompt();
      if (initialPrompt) {
        options.initialPrompt = initialPrompt;
        console.log("📝 Using initial prompt:", initialPrompt);
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

  async processWithElevenLabs(audioBlob) {
    try {
      const arrayBuffer = await audioBlob.arrayBuffer();

      // Get language preference
      const language = localStorage.getItem("preferredLanguage");
      const options = {};
      if (language && language !== "auto") {
        options.language = language;
      }

      console.log("📤 Sending audio to ElevenLabs...");
      const result = await window.electronAPI.transcribeElevenlabs(
        arrayBuffer,
        options
      );

      if (result.success && result.text) {
        const text = await this.processTranscription(result.text, "elevenlabs");
        // Allow empty strings as valid responses
        if (text !== null && text !== undefined) {
          return { success: true, text: text || result.text, source: "elevenlabs" };
        } else {
          throw new Error("No text transcribed");
        }
      } else if (result.success === false && result.message === "No audio detected") {
        this.onError?.({
          title: "No Audio Detected",
          description: "The recording contained no detectable audio. Please check your microphone settings.",
        });
        throw new Error("No audio detected");
      } else {
        throw new Error(result.error || "ElevenLabs transcription failed");
      }
    } catch (error) {
      if (error.message === "No audio detected") {
        throw error;
      }
      throw new Error(`ElevenLabs failed: ${error.message}`);
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

    // Notify UI that agent mode is active (for visual indicator)
    if (useReasoning) {
      this.onAgentModeChange?.(true);
    }

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

    // Apply dictionary corrections first (e.g., "btw" -> "by the way")
    let processedText = this.applyDictionaryCorrections(normalizedText);
    if (processedText !== normalizedText) {
      console.log("📖 Applied dictionary corrections to transcription");
    }

    // Then apply snippets (trigger phrases -> full expansions)
    const finalText = this.applySnippets(processedText);
    if (finalText !== processedText) {
      console.log("✂️ Applied snippets to transcription");
    }

    // Standard cleanup when reasoning is unavailable or fails
    return finalText;
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
      // Gather settings for phrase analysis
      const settings = {
        aiSuggestionsEnabled: localStorage.getItem('aiSuggestionsEnabled') === 'true',
        openaiApiKey: localStorage.getItem('openaiApiKey') || '',
        aiAnalysisLastRun: localStorage.getItem('aiAnalysisLastRun') || ''
      };

      const result = await window.electronAPI.saveTranscription(text, settings);

      // If AI analysis ran, update the last run date in localStorage
      if (result?.aiAnalysisRan) {
        localStorage.setItem('aiAnalysisLastRun', result.newDate);
      }

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

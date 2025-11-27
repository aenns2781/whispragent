const fs = require("fs");
const path = require("path");
const { app } = require("electron");

/**
 * ElevenLabs Speech-to-Text Service
 * Uses the REST API for batch transcription (not real-time WebSocket)
 * This ensures compatibility with agent mode - full transcription returned after recording stops
 */
class ElevenLabsManager {
  constructor(environmentManager) {
    this.environmentManager = environmentManager;
    this.apiBaseUrl = "https://api.elevenlabs.io/v1";
  }

  /**
   * Transcribe audio using ElevenLabs Speech-to-Text API
   * @param {ArrayBuffer|Buffer} audioData - Audio data to transcribe
   * @param {Object} options - Transcription options
   * @param {string} options.language - Language code (e.g., 'en', 'es', 'fr')
   * @param {string} options.model - Model to use (default: 'scribe_v1')
   * @returns {Promise<{success: boolean, text?: string, error?: string}>}
   */
  async transcribe(audioData, options = {}) {
    const apiKey = this.environmentManager.getElevenlabsKey();

    if (!apiKey) {
      return {
        success: false,
        error: "ElevenLabs API key not configured"
      };
    }

    try {
      // Convert audio data to buffer
      const buffer = Buffer.isBuffer(audioData) ? audioData : Buffer.from(audioData);
      console.log(`📤 [ElevenLabs] Sending audio for transcription (${buffer.length} bytes)`);

      // Use the correct model ID for ElevenLabs Scribe
      const modelId = options.model || "scribe_v1";
      console.log(`📤 [ElevenLabs] Using model: ${modelId}`);

      // Use Node.js native FormData and Blob (available since Node 18)
      const formData = new FormData();

      // Create a Blob from the buffer and append to form
      const audioBlob = new Blob([buffer], { type: 'audio/webm' });
      formData.set('file', audioBlob, 'audio.webm');
      formData.set('model_id', modelId);

      // Add language if specified (not 'auto')
      if (options.language && options.language !== "auto") {
        formData.set("language_code", options.language);
        console.log(`📤 [ElevenLabs] Language: ${options.language}`);
      }

      // Make the API request
      // Important: Don't set Content-Type header - fetch sets it automatically with boundary
      const url = `${this.apiBaseUrl}/speech-to-text`;
      console.log(`📤 [ElevenLabs] POST ${url}`);

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [ElevenLabs] Response status: ${response.status}`);
        console.error(`❌ [ElevenLabs] Response body: ${errorText}`);

        let errorMessage = `ElevenLabs API error: ${response.status}`;
        let errorCode = null;

        try {
          const errorData = JSON.parse(errorText);
          console.error(`❌ [ElevenLabs] Parsed error:`, errorData);
          errorMessage = errorData.detail?.message || errorData.detail || errorData.error || errorMessage;
          errorCode = errorData.detail?.status || errorData.status;
        } catch {
          if (errorText) {
            errorMessage = errorText.slice(0, 200);
          }
        }

        // Provide user-friendly error messages for common errors
        if (response.status === 401) {
          errorMessage = "Invalid ElevenLabs API key. Please check your key in Settings.";
        } else if (response.status === 429) {
          errorMessage = "Rate limit exceeded. Please wait a moment and try again.";
        } else if (response.status === 402 || errorMessage.toLowerCase().includes("quota") || errorMessage.toLowerCase().includes("limit")) {
          errorMessage = "ElevenLabs quota exceeded. Please check your subscription or upgrade your plan.";
        } else if (response.status === 403) {
          errorMessage = "Access denied. Your ElevenLabs plan may not include speech-to-text.";
        } else if (response.status === 503 || response.status === 502) {
          errorMessage = "ElevenLabs service temporarily unavailable. Please try again later.";
        }

        console.error(`❌ [ElevenLabs] Transcription failed: ${errorMessage}`);
        return {
          success: false,
          error: errorMessage,
          code: errorCode || response.status
        };
      }

      const result = await response.json();
      console.log(`✅ [ElevenLabs] Response:`, JSON.stringify(result).slice(0, 200));

      // ElevenLabs returns { text: "transcribed text", ... }
      const transcribedText = result.text || "";

      if (!transcribedText.trim()) {
        console.log("⚠️ [ElevenLabs] No speech detected in audio");
        return {
          success: false,
          message: "No audio detected"
        };
      }

      console.log(`✅ [ElevenLabs] Transcription successful: "${transcribedText.slice(0, 50)}..."`);

      return {
        success: true,
        text: transcribedText,
        language: result.language_code || options.language
      };
    } catch (error) {
      console.error("❌ [ElevenLabs] Transcription error:", error);
      return {
        success: false,
        error: error.message || "Unknown transcription error"
      };
    }
  }

  /**
   * Check if ElevenLabs is properly configured
   * @returns {Promise<{available: boolean, error?: string}>}
   */
  async checkAvailability() {
    const apiKey = this.environmentManager.getElevenlabsKey();

    if (!apiKey) {
      return {
        available: false,
        error: "ElevenLabs API key not configured"
      };
    }

    try {
      // Make a simple API call to verify the key works
      const response = await fetch(`${this.apiBaseUrl}/user`, {
        method: "GET",
        headers: {
          "xi-api-key": apiKey
        }
      });

      if (!response.ok) {
        return {
          available: false,
          error: `Invalid API key (${response.status})`
        };
      }

      const userData = await response.json();
      console.log(`✅ [ElevenLabs] API key valid for user: ${userData.subscription?.tier || 'unknown tier'}`);

      return {
        available: true,
        tier: userData.subscription?.tier
      };
    } catch (error) {
      return {
        available: false,
        error: error.message
      };
    }
  }
}

module.exports = ElevenLabsManager;

/**
 * ElevenLabs Real-time Speech-to-Text Service
 * Uses WebSocket API with scribe_v2_realtime model
 *
 * Features:
 * - Real-time transcription via WebSocket
 * - 3-word buffer for agent name detection
 * - Automatic reconnection handling
 */

class ElevenLabsRealtimeManager {
  constructor(environmentManager) {
    this.environmentManager = environmentManager;
    this.apiBaseUrl = "https://api.elevenlabs.io/v1";
  }

  /**
   * Generate a single-use token for client-side WebSocket authentication
   * This token is used instead of the API key for security
   * @returns {Promise<{success: boolean, token?: string, error?: string}>}
   */
  async generateSingleUseToken() {
    const apiKey = this.environmentManager.getElevenlabsKey();

    if (!apiKey) {
      return {
        success: false,
        error: "ElevenLabs API key not configured"
      };
    }

    try {
      console.log("🎫 [ElevenLabs Realtime] Generating single-use token...");

      // Correct endpoint per docs: /v1/single-use-token/realtime_scribe
      const response = await fetch(`${this.apiBaseUrl}/single-use-token/realtime_scribe`, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ [ElevenLabs Realtime] Token generation failed: ${response.status}`);
        console.error(`❌ [ElevenLabs Realtime] Response: ${errorText}`);

        let errorMessage = `Failed to generate token: ${response.status}`;

        if (response.status === 401) {
          errorMessage = "Invalid ElevenLabs API key.";
        } else if (response.status === 403) {
          errorMessage = "Your ElevenLabs plan may not include real-time transcription.";
        } else if (response.status === 429) {
          errorMessage = "Rate limit exceeded. Please wait and try again.";
        }

        return {
          success: false,
          error: errorMessage
        };
      }

      const result = await response.json();
      console.log("✅ [ElevenLabs Realtime] Token generated successfully");

      return {
        success: true,
        token: result.token
      };
    } catch (error) {
      console.error("❌ [ElevenLabs Realtime] Token generation error:", error);
      return {
        success: false,
        error: error.message || "Failed to generate authentication token"
      };
    }
  }

  /**
   * Check if real-time transcription is available
   * @returns {Promise<{available: boolean, error?: string}>}
   */
  async checkRealtimeAvailability() {
    const apiKey = this.environmentManager.getElevenlabsKey();

    if (!apiKey) {
      return {
        available: false,
        error: "ElevenLabs API key not configured"
      };
    }

    // Try to generate a token as availability check
    const tokenResult = await this.generateSingleUseToken();

    return {
      available: tokenResult.success,
      error: tokenResult.error
    };
  }
}

module.exports = ElevenLabsRealtimeManager;

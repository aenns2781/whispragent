/**
 * ElevenLabs Real-time Speech-to-Text Client
 * Uses the official @elevenlabs/client SDK
 */

import { Scribe, RealtimeEvents, AudioFormat } from '@elevenlabs/client';

interface RealtimeConfig {
  language?: string;
  agentName?: string;
  onPartialTranscript?: (text: string) => void;
  onCommittedTranscript?: (text: string) => void;
  onAgentDetected?: (isAgentMode: boolean) => void;
  onError?: (error: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

interface WordBuffer {
  words: string[];
  fullText: string;
  isAgentMode: boolean;
  agentDetectionComplete: boolean;
}

class ElevenLabsRealtimeClient {
  private connection: any = null;
  private config: RealtimeConfig;
  private wordBuffer: WordBuffer;
  private isConnected: boolean = false;

  // 3-word buffer for agent detection
  private readonly AGENT_BUFFER_SIZE = 3;

  constructor(config: RealtimeConfig = {}) {
    this.config = config;
    this.wordBuffer = {
      words: [],
      fullText: '',
      isAgentMode: false,
      agentDetectionComplete: false,
    };
  }

  /**
   * Log to both console and main process
   */
  private log(message: string, data?: any) {
    console.log(message, data || '');
    (window as any).electronAPI?.logReasoning?.('REALTIME_CLIENT', { message, data });
  }

  /**
   * Connect to ElevenLabs real-time transcription using official SDK
   */
  async connect(): Promise<boolean> {
    try {
      this.log('🎙️ [Realtime] Requesting single-use token...');

      // Get single-use token from main process
      const tokenResult = await (window as any).electronAPI?.generateElevenlabsRealtimeToken();

      if (!tokenResult?.success || !tokenResult.token) {
        this.log('❌ [Realtime] Failed to get token:', tokenResult?.error);
        this.config.onError?.(tokenResult?.error || 'Failed to get authentication token');
        return false;
      }

      const token = tokenResult.token;
      this.log('✅ [Realtime] Token received');

      // Use official SDK to connect
      this.log('🔌 [Realtime] Connecting via SDK...');

      const connectOptions: any = {
        token,
        modelId: 'scribe_v2_realtime',
        audioFormat: AudioFormat?.PCM_16000 || 'pcm_16000',
        sampleRate: 16000,
      };

      if (this.config.language && this.config.language !== 'auto') {
        connectOptions.languageCode = this.config.language;
      }

      this.connection = Scribe.connect(connectOptions);

      // Set up event handlers
      const Events = RealtimeEvents || {
        SESSION_STARTED: 'session_started',
        PARTIAL_TRANSCRIPT: 'partial_transcript',
        COMMITTED_TRANSCRIPT: 'committed_transcript',
        COMMITTED_TRANSCRIPT_WITH_TIMESTAMPS: 'committed_transcript_with_timestamps',
        ERROR: 'error',
        AUTH_ERROR: 'auth_error',
        OPEN: 'open',
        CLOSE: 'close',
      };

      this.connection.on(Events.SESSION_STARTED, () => {
        this.log('✅ [Realtime] Session started');
        this.isConnected = true;
        this.config.onConnected?.();
      });

      this.connection.on(Events.PARTIAL_TRANSCRIPT, (data: any) => {
        this.log('📝 [Realtime] Partial:', data.text?.substring(0, 50));
        this.handlePartialTranscript(data.text || '');
      });

      this.connection.on(Events.COMMITTED_TRANSCRIPT, (data: any) => {
        this.log('✅ [Realtime] Committed:', data.text?.substring(0, 50));
        this.handleCommittedTranscript(data.text || '');
      });

      this.connection.on(Events.COMMITTED_TRANSCRIPT_WITH_TIMESTAMPS, (data: any) => {
        this.log('✅ [Realtime] Committed with timestamps:', data.text?.substring(0, 50));
        this.handleCommittedTranscript(data.text || '');
      });

      this.connection.on(Events.ERROR, (error: any) => {
        this.log('❌ [Realtime] Error:', error);
        this.config.onError?.(error?.message || 'Transcription error');
      });

      this.connection.on(Events.AUTH_ERROR, (data: any) => {
        this.log('❌ [Realtime] Auth error:', data.error);
        this.config.onError?.(data.error || 'Authentication failed');
      });

      this.connection.on(Events.OPEN, () => {
        this.log('✅ [Realtime] Connection opened');
        this.isConnected = true;
      });

      this.connection.on(Events.CLOSE, () => {
        this.log('🔌 [Realtime] Connection closed');
        this.isConnected = false;
        this.config.onDisconnected?.();
      });

      // Wait for connection to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          this.log('❌ [Realtime] Connection timeout');
          reject(new Error('Connection timeout'));
        }, 10000);

        this.connection.on(Events.SESSION_STARTED, () => {
          clearTimeout(timeout);
          resolve();
        });

        this.connection.on(Events.AUTH_ERROR, (data: any) => {
          clearTimeout(timeout);
          reject(new Error(data?.error || 'Auth failed'));
        });
      });

      return true;
    } catch (error) {
      this.log('❌ [Realtime] Connection error:', error);
      this.config.onError?.((error as Error).message || 'Connection failed');
      return false;
    }
  }

  /**
   * Handle partial (in-progress) transcripts
   */
  private handlePartialTranscript(text: string) {
    if (!text.trim()) return;

    const words = text.trim().split(/\s+/);
    this.wordBuffer.words = words;
    this.wordBuffer.fullText = text;

    // Check for agent name in first 3 words if not already detected
    if (!this.wordBuffer.agentDetectionComplete && words.length >= this.AGENT_BUFFER_SIZE) {
      this.detectAgentMode(words.slice(0, this.AGENT_BUFFER_SIZE));
      this.wordBuffer.agentDetectionComplete = true;
    }

    // Only emit partial transcript if agent detection is complete
    if (this.wordBuffer.agentDetectionComplete) {
      this.config.onPartialTranscript?.(text);
    }
  }

  /**
   * Handle committed (final) transcripts
   */
  private handleCommittedTranscript(text: string) {
    if (!text.trim()) return;

    const words = text.trim().split(/\s+/);
    this.wordBuffer.words = words;
    this.wordBuffer.fullText = text;

    // If agent detection wasn't complete yet, do it now
    if (!this.wordBuffer.agentDetectionComplete) {
      this.detectAgentMode(words.slice(0, Math.min(this.AGENT_BUFFER_SIZE, words.length)));
      this.wordBuffer.agentDetectionComplete = true;
    }

    this.config.onCommittedTranscript?.(text);
  }

  /**
   * Detect if user is addressing the agent
   */
  private detectAgentMode(firstWords: string[]) {
    if (!this.config.agentName) {
      this.wordBuffer.isAgentMode = false;
      this.config.onAgentDetected?.(false);
      return;
    }

    const agentName = this.config.agentName.toLowerCase();
    const firstWordsLower = firstWords.map(w => w.toLowerCase().replace(/[.,!?]/g, ''));
    const greetings = ['hey', 'hi', 'hello', 'yo', 'okay'];

    let isAgentMode = false;

    if (firstWordsLower[0] === agentName) {
      isAgentMode = true;
    } else if (firstWordsLower.length >= 2 &&
               greetings.includes(firstWordsLower[0]) &&
               firstWordsLower[1] === agentName) {
      isAgentMode = true;
    }

    this.wordBuffer.isAgentMode = isAgentMode;
    this.log(`🎯 [Realtime] Agent detection: "${firstWords.join(' ')}" -> ${isAgentMode ? 'AGENT MODE' : 'DICTATION MODE'}`);
    this.config.onAgentDetected?.(isAgentMode);
  }

  /**
   * Send audio data
   * @param audioData - PCM audio data as ArrayBuffer
   */
  sendAudio(audioData: ArrayBuffer) {
    if (!this.isConnected || !this.connection) {
      return;
    }

    // Convert to base64
    const base64Audio = this.arrayBufferToBase64(audioData);

    // Send via SDK
    this.connection.send({
      audioBase64: base64Audio,
      sampleRate: 16000,
    });
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Commit the transcription (finalize current segment)
   */
  commit() {
    if (!this.isConnected || !this.connection) return;
    this.log('📤 [Realtime] Sending commit...');
    this.connection.commit?.();
  }

  /**
   * Flush is now commit for ElevenLabs
   */
  flush() {
    this.commit();
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.connection) {
      this.log('🔌 [Realtime] Disconnecting...');
      this.connection.close?.();
      this.connection = null;
    }
    this.isConnected = false;
    this.wordBuffer = {
      words: [],
      fullText: '',
      isAgentMode: false,
      agentDetectionComplete: false,
    };
  }

  /**
   * Get current transcript
   */
  getTranscript(): string {
    return this.wordBuffer.fullText;
  }

  /**
   * Check if in agent mode
   */
  isInAgentMode(): boolean {
    return this.wordBuffer.isAgentMode;
  }

  /**
   * Check if connected
   */
  getIsConnected(): boolean {
    return this.isConnected;
  }
}

export default ElevenLabsRealtimeClient;

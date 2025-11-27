import { useCallback } from "react";
import { useLocalStorage } from "./useLocalStorage";
import { getModelProvider } from "../utils/languages";
import { API_ENDPOINTS } from "../config/constants";

export interface TranscriptionSettings {
  useLocalWhisper: boolean;
  whisperModel: string;
  allowOpenAIFallback: boolean;
  allowLocalFallback: boolean;
  fallbackWhisperModel: string;
  preferredLanguage: string;
  pushToTalk: boolean;
  cloudTranscriptionBaseUrl?: string;
  transcriptionEngine: TranscriptionEngine;
  useRealtimeTranscription: boolean;
}

export interface ReasoningSettings {
  useReasoningModel: boolean;
  reasoningModel: string;
  reasoningProvider: string;
  cloudReasoningBaseUrl?: string;
}

export interface HotkeySettings {
  dictationKey: string;
}

export interface ApiKeySettings {
  openaiApiKey: string;
  anthropicApiKey: string;
  geminiApiKey: string;
  elevenlabsApiKey: string;
}

export type TranscriptionEngine = 'local' | 'elevenlabs';

export function useSettings() {
  const [useLocalWhisper, setUseLocalWhisper] = useLocalStorage(
    "useLocalWhisper",
    true,
    {
      serialize: String,
      deserialize: (value) => value === "true",
    }
  );

  const [whisperModel, setWhisperModel] = useLocalStorage(
    "whisperModel",
    "base",
    {
      serialize: String,
      deserialize: String,
    }
  );

  const [allowOpenAIFallback, setAllowOpenAIFallback] = useLocalStorage(
    "allowOpenAIFallback",
    false,
    {
      serialize: String,
      deserialize: (value) => value === "true",
    }
  );

  const [allowLocalFallback, setAllowLocalFallback] = useLocalStorage(
    "allowLocalFallback",
    false,
    {
      serialize: String,
      deserialize: (value) => value === "true",
    }
  );

  const [fallbackWhisperModel, setFallbackWhisperModel] = useLocalStorage(
    "fallbackWhisperModel",
    "base",
    {
      serialize: String,
      deserialize: String,
    }
  );

  const [preferredLanguage, setPreferredLanguage] = useLocalStorage(
    "preferredLanguage",
    "en",
    {
      serialize: String,
      deserialize: String,
    }
  );

  const [cloudTranscriptionBaseUrl, setCloudTranscriptionBaseUrl] = useLocalStorage(
    "cloudTranscriptionBaseUrl",
    API_ENDPOINTS.TRANSCRIPTION_BASE,
    {
      serialize: String,
      deserialize: String,
    }
  );

  const [pushToTalk, setPushToTalk] = useLocalStorage(
    "pushToTalk",
    false,
    {
      serialize: String,
      deserialize: (value) => value === "true",
    }
  );

  const [cloudReasoningBaseUrl, setCloudReasoningBaseUrl] = useLocalStorage(
    "cloudReasoningBaseUrl",
    API_ENDPOINTS.OPENAI_BASE,
    {
      serialize: String,
      deserialize: String,
    }
  );

  // Reasoning settings
  const [useReasoningModel, setUseReasoningModel] = useLocalStorage(
    "useReasoningModel",
    true,
    {
      serialize: String,
      deserialize: (value) => value !== "false", // Default true
    }
  );

  const [reasoningModel, setReasoningModel] = useLocalStorage(
    "reasoningModel",
    "gpt-5.1",
    {
      serialize: String,
      deserialize: String,
    }
  );

  // GPT-5.1 specific settings
  const [reasoningEffort, setReasoningEffort] = useLocalStorage(
    "reasoningEffort",
    "low", // none, low, medium, high
    {
      serialize: String,
      deserialize: String,
    }
  );

  const [verbosity, setVerbosity] = useLocalStorage(
    "verbosity",
    "medium", // low, medium, high
    {
      serialize: String,
      deserialize: String,
    }
  );

  // API keys
  const [openaiApiKey, setOpenaiApiKey] = useLocalStorage("openaiApiKey", "", {
    serialize: String,
    deserialize: String,
  });

  const [anthropicApiKey, setAnthropicApiKey] = useLocalStorage(
    "anthropicApiKey",
    "",
    {
      serialize: String,
      deserialize: String,
    }
  );

  const [geminiApiKey, setGeminiApiKey] = useLocalStorage(
    "geminiApiKey",
    "",
    {
      serialize: String,
      deserialize: String,
    }
  );

  const [elevenlabsApiKey, setElevenlabsApiKey] = useLocalStorage(
    "elevenlabsApiKey",
    "",
    {
      serialize: String,
      deserialize: String,
    }
  );

  // Transcription engine: 'local' for Whisper, 'elevenlabs' for ElevenLabs cloud
  // Default to ElevenLabs for best accuracy/speed (recommended)
  const [transcriptionEngine, setTranscriptionEngine] = useLocalStorage<TranscriptionEngine>(
    "transcriptionEngine",
    "elevenlabs",
    {
      serialize: String,
      deserialize: (value) => (value === 'local' ? 'local' : 'elevenlabs') as TranscriptionEngine,
    }
  );

  // Real-time transcription mode (uses WebSocket for live transcription)
  // Default to false (batch mode) for stability - real-time is opt-in
  const [useRealtimeTranscription, setUseRealtimeTranscription] = useLocalStorage(
    "useRealtimeTranscription",
    false,
    {
      serialize: String,
      deserialize: (value) => value === "true",
    }
  );

  // Hotkey - backtick is default for all platforms (works best with agent mode)
  const [dictationKey, setDictationKey] = useLocalStorage("dictationKey", "`", {
    serialize: String,
    deserialize: String,
  });

  // Computed values
  const reasoningProvider = getModelProvider(reasoningModel);

  // Batch operations
  const updateTranscriptionSettings = useCallback(
    (settings: Partial<TranscriptionSettings>) => {
      if (settings.useLocalWhisper !== undefined)
        setUseLocalWhisper(settings.useLocalWhisper);
      if (settings.whisperModel !== undefined)
        setWhisperModel(settings.whisperModel);
      if (settings.allowOpenAIFallback !== undefined)
        setAllowOpenAIFallback(settings.allowOpenAIFallback);
      if (settings.allowLocalFallback !== undefined)
        setAllowLocalFallback(settings.allowLocalFallback);
      if (settings.fallbackWhisperModel !== undefined)
        setFallbackWhisperModel(settings.fallbackWhisperModel);
      if (settings.preferredLanguage !== undefined)
        setPreferredLanguage(settings.preferredLanguage);
      if (settings.pushToTalk !== undefined)
        setPushToTalk(settings.pushToTalk);
      if (settings.cloudTranscriptionBaseUrl !== undefined)
        setCloudTranscriptionBaseUrl(settings.cloudTranscriptionBaseUrl);
      if (settings.transcriptionEngine !== undefined)
        setTranscriptionEngine(settings.transcriptionEngine);
      if (settings.useRealtimeTranscription !== undefined)
        setUseRealtimeTranscription(settings.useRealtimeTranscription);
    },
    [
      setUseLocalWhisper,
      setWhisperModel,
      setAllowOpenAIFallback,
      setAllowLocalFallback,
      setFallbackWhisperModel,
      setPreferredLanguage,
      setPushToTalk,
      setCloudTranscriptionBaseUrl,
      setTranscriptionEngine,
      setUseRealtimeTranscription,
    ]
  );

  const updateReasoningSettings = useCallback(
    (settings: Partial<ReasoningSettings>) => {
      if (settings.useReasoningModel !== undefined)
        setUseReasoningModel(settings.useReasoningModel);
      if (settings.reasoningModel !== undefined)
        setReasoningModel(settings.reasoningModel);
      if (settings.cloudReasoningBaseUrl !== undefined)
        setCloudReasoningBaseUrl(settings.cloudReasoningBaseUrl);
      // reasoningProvider is computed from reasoningModel, not stored separately
    },
    [setUseReasoningModel, setReasoningModel, setCloudReasoningBaseUrl]
  );

  const updateApiKeys = useCallback(
    (keys: Partial<ApiKeySettings>) => {
      if (keys.openaiApiKey !== undefined) setOpenaiApiKey(keys.openaiApiKey);
      if (keys.anthropicApiKey !== undefined)
        setAnthropicApiKey(keys.anthropicApiKey);
      if (keys.geminiApiKey !== undefined)
        setGeminiApiKey(keys.geminiApiKey);
      if (keys.elevenlabsApiKey !== undefined)
        setElevenlabsApiKey(keys.elevenlabsApiKey);
    },
    [setOpenaiApiKey, setAnthropicApiKey, setGeminiApiKey, setElevenlabsApiKey]
  );

  return {
    useLocalWhisper,
    whisperModel,
    allowOpenAIFallback,
    allowLocalFallback,
    fallbackWhisperModel,
    preferredLanguage,
    cloudTranscriptionBaseUrl,
    cloudReasoningBaseUrl,
    useReasoningModel,
    reasoningModel,
    reasoningEffort,
    verbosity,
    reasoningProvider,
    openaiApiKey,
    anthropicApiKey,
    geminiApiKey,
    elevenlabsApiKey,
    transcriptionEngine,
    dictationKey,
    setUseLocalWhisper,
    setWhisperModel,
    setAllowOpenAIFallback,
    setAllowLocalFallback,
    setFallbackWhisperModel,
    setPreferredLanguage,
    setCloudTranscriptionBaseUrl,
    setCloudReasoningBaseUrl,
    setUseReasoningModel,
    setReasoningModel,
    setReasoningEffort,
    setVerbosity,
    setReasoningProvider: (provider: string) => {
      if (provider === 'custom') {
        return;
      }

      const providerModels = {
        openai: "gpt-4o-mini", // Start with cost-efficient multimodal model
        anthropic: "claude-3.5-sonnet-20241022",
        gemini: "gemini-2.5-flash",
        local: "llama-3.2-3b",
      };
      setReasoningModel(
        providerModels[provider as keyof typeof providerModels] ||
        "gpt-4o-mini"
      );
    },
    setOpenaiApiKey,
    setAnthropicApiKey,
    setGeminiApiKey,
    setElevenlabsApiKey,
    setTranscriptionEngine,
    setDictationKey,
    pushToTalk,
    setPushToTalk,
    useRealtimeTranscription,
    setUseRealtimeTranscription,
    updateTranscriptionSettings,
    updateReasoningSettings,
    updateApiKeys,
  };
}

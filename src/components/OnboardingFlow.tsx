import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Settings,
  Mic,
  Download,
  Key,
  Shield,
  Keyboard,
  TestTube,
  Sparkles,
  Lock,
  X,
  User,
  Camera,
  Cloud,
  Zap,
} from "lucide-react";
import TitleBar from "./TitleBar";
import WhisperModelPicker from "./WhisperModelPicker";
import appIcon from "../assets/icon.png";
import ProcessingModeSelector from "./ui/ProcessingModeSelector";
import ApiKeyInput from "./ui/ApiKeyInput";
import PermissionCard from "./ui/PermissionCard";
import StepProgress from "./ui/StepProgress";
import { AlertDialog, ConfirmDialog } from "./ui/dialog";
import { useLocalStorage } from "../hooks/useLocalStorage";
import { useDialogs } from "../hooks/useDialogs";
import { useWhisper } from "../hooks/useWhisper";
import { usePython } from "../hooks/usePython";
import { usePermissions } from "../hooks/usePermissions";
import { useClipboard } from "../hooks/useClipboard";
import { useSettings } from "../hooks/useSettings";
import { getLanguageLabel, REASONING_PROVIDERS } from "../utils/languages";
import LanguageSelector from "./ui/LanguageSelector";
import { UnifiedModelPickerCompact } from "./UnifiedModelPicker";
const InteractiveKeyboard = React.lazy(() => import("./ui/Keyboard"));
import { setAgentName as saveAgentName, sanitizeAgentName } from "../utils/agentName";
import { formatHotkeyLabel } from "../utils/hotkeys";
import { API_ENDPOINTS, buildApiUrl, normalizeBaseUrl } from "../config/constants";

interface OnboardingFlowProps {
  onComplete: () => void;
}


type ReasoningModelOption = {
  value: string;
  label: string;
  description?: string;
  icon?: string;
};

export default function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const [currentStep, setCurrentStep, removeCurrentStep] = useLocalStorage(
    "onboardingCurrentStep",
    0,
    {
      serialize: String,
      deserialize: (value) => parseInt(value, 10),
    }
  );

  const {
    useLocalWhisper,
    whisperModel,
    preferredLanguage,
    cloudTranscriptionBaseUrl,
    cloudReasoningBaseUrl,
    useReasoningModel,
    reasoningModel,
    openaiApiKey,
    elevenlabsApiKey,
    transcriptionEngine,
    dictationKey,
    setUseLocalWhisper,
    setWhisperModel,
    setPreferredLanguage,
    setCloudTranscriptionBaseUrl,
    setCloudReasoningBaseUrl,
    setOpenaiApiKey,
    setElevenlabsApiKey,
    setTranscriptionEngine,
    setDictationKey,
    updateTranscriptionSettings,
    updateReasoningSettings,
    updateApiKeys,
  } = useSettings();

  const [apiKey, setApiKey] = useState(openaiApiKey);
  const [elevenLabsKey, setElevenLabsKey] = useState(elevenlabsApiKey);
  // Default to backtick for all platforms (works best with all features)
  const [hotkey, setHotkey] = useState(dictationKey || "`");
  const [transcriptionBaseUrl, setTranscriptionBaseUrl] = useState(cloudTranscriptionBaseUrl);
  const [reasoningBaseUrl, setReasoningBaseUrl] = useState(cloudReasoningBaseUrl);
  const [agentName, setAgentName] = useState("Agent");
  const readableHotkey = formatHotkeyLabel(hotkey);
  const {
    alertDialog,
    confirmDialog,
    showAlertDialog,
    showConfirmDialog,
    hideAlertDialog,
    hideConfirmDialog,
  } = useDialogs();
  const practiceTextareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmedReasoningBase = (reasoningBaseUrl || "").trim();
  const normalizedReasoningBaseUrl = useMemo(
    () => normalizeBaseUrl(trimmedReasoningBase),
    [trimmedReasoningBase]
  );
  const hasEnteredReasoningBase = trimmedReasoningBase.length > 0;
  const isValidReasoningBase = Boolean(
    normalizedReasoningBaseUrl && normalizedReasoningBaseUrl.includes("://")
  );
  const usingCustomReasoningBase = hasEnteredReasoningBase && isValidReasoningBase;

  const [customReasoningModels, setCustomReasoningModels] = useState<ReasoningModelOption[]>([]);
  const [customModelsLoading, setCustomModelsLoading] = useState(false);
  const [customModelsError, setCustomModelsError] = useState<string | null>(null);

  const defaultReasoningModels = useMemo<ReasoningModelOption[]>(() => {
    const provider = REASONING_PROVIDERS.openai;
    return (
      provider?.models?.map((model) => ({
        value: model.value,
        label: model.label,
        description: model.description,
      })) ?? []
    );
  }, []);

  const displayedReasoningModels = usingCustomReasoningBase
    ? customReasoningModels
    : defaultReasoningModels;

  const reasoningModelsEndpoint = useMemo(() => {
    const base =
      usingCustomReasoningBase && normalizedReasoningBaseUrl
        ? normalizedReasoningBaseUrl
        : API_ENDPOINTS.OPENAI_BASE;
    return buildApiUrl(base, "/models");
  }, [usingCustomReasoningBase, normalizedReasoningBaseUrl]);

  const reasoningModelRef = useRef(reasoningModel);
  useEffect(() => {
    reasoningModelRef.current = reasoningModel;
  }, [reasoningModel]);

  useEffect(() => {
    if (!usingCustomReasoningBase) {
      setCustomModelsLoading(false);
      setCustomReasoningModels([]);
      setCustomModelsError(null);
      return;
    }

    if (!normalizedReasoningBaseUrl) {
      return;
    }

    let isCancelled = false;
    const controller = new AbortController();

    const loadModels = async () => {
      setCustomModelsLoading(true);
      setCustomModelsError(null);
      try {
        // Security: Only allow HTTPS endpoints (except localhost for development)
        const isLocalhost = normalizedReasoningBaseUrl.includes('://localhost') ||
          normalizedReasoningBaseUrl.includes('://127.0.0.1');
        if (!normalizedReasoningBaseUrl.startsWith('https://') && !isLocalhost) {
          throw new Error('Only HTTPS endpoints are allowed (except localhost for testing).');
        }

        const headers: Record<string, string> = {};
        const trimmedKey = apiKey.trim();
        if (trimmedKey) {
          headers.Authorization = `Bearer ${trimmedKey}`;
        }

        const response = await fetch(buildApiUrl(normalizedReasoningBaseUrl, "/models"), {
          method: "GET",
          headers,
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text().catch(() => "");
          throw new Error(
            errorText
              ? `${response.status} ${errorText.slice(0, 200)}`
              : `${response.status} ${response.statusText}`
          );
        }

        const payload = await response.json().catch(() => ({}));
        const rawModels = Array.isArray(payload?.data)
          ? payload.data
          : Array.isArray(payload?.models)
            ? payload.models
            : [];

        const mappedModels = (rawModels as Array<any>)
          .map((item) => {
            const value = item?.id || item?.name;
            if (!value) {
              return null;
            }

            const description =
              typeof item?.description === "string" && item.description.trim()
                ? item.description.trim()
                : undefined;
            const ownedBy = typeof item?.owned_by === "string" ? item.owned_by : undefined;

            return {
              value,
              label: item?.id || item?.name || value,
              description: description || (ownedBy ? `Owner: ${ownedBy}` : undefined),
            } as ReasoningModelOption;
          })
          .filter(Boolean) as ReasoningModelOption[];

        if (isCancelled) {
          return;
        }

        setCustomReasoningModels(mappedModels);

        if (mappedModels.length === 0) {
          setCustomModelsError("No models returned by this endpoint.");
        } else if (!mappedModels.some((model) => model.value === reasoningModelRef.current)) {
          updateReasoningSettings({ reasoningModel: mappedModels[0].value });
        }
      } catch (error) {
        if (isCancelled) {
          return;
        }
        if ((error as Error).name === "AbortError") {
          return;
        }
        setCustomModelsError((error as Error).message || "Unable to load models from endpoint.");
        setCustomReasoningModels([]);
      } finally {
        if (!isCancelled) {
          setCustomModelsLoading(false);
        }
      }
    };

    loadModels();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [usingCustomReasoningBase, normalizedReasoningBaseUrl, apiKey, updateReasoningSettings]);

  useEffect(() => {
    if (!usingCustomReasoningBase && defaultReasoningModels.length > 0) {
      if (!defaultReasoningModels.some((model) => model.value === reasoningModel)) {
        updateReasoningSettings({ reasoningModel: defaultReasoningModels[0].value });
      }
    }
  }, [usingCustomReasoningBase, defaultReasoningModels, reasoningModel, updateReasoningSettings]);

  const activeReasoningModelLabel = useMemo(() => {
    const match = displayedReasoningModels.find((model) => model.value === reasoningModel);
    return match?.label || reasoningModel;
  }, [displayedReasoningModels, reasoningModel]);

  const whisperHook = useWhisper(showAlertDialog);
  const pythonHook = usePython(showAlertDialog);
  const permissionsHook = usePermissions(showAlertDialog);
  const { pasteFromClipboard } = useClipboard(showAlertDialog);

  const steps = [
    { title: "Welcome", icon: Sparkles },
    { title: "Setup", icon: Settings },
    { title: "Permissions", icon: Shield },
    { title: "Hotkey", icon: Keyboard },
    { title: "Test", icon: TestTube },
    { title: "Agent Name", icon: User },
    { title: "Finish", icon: Check },
  ];

  useEffect(() => {
    whisperHook.setupProgressListener();
    return () => {
      // Clean up listeners on unmount
      window.electronAPI?.removeAllListeners?.("whisper-install-progress");
    };
  }, []);

  const updateProcessingMode = (useLocal: boolean) => {
    updateTranscriptionSettings({ useLocalWhisper: useLocal });
  };

  useEffect(() => {
    if (currentStep === 4) { // Test & Practice step
      if (practiceTextareaRef.current) {
        practiceTextareaRef.current.focus();
      }
    }
  }, [currentStep]);

  const ensureHotkeyRegistered = useCallback(async () => {
    if (!window.electronAPI?.updateHotkey) {
      return true;
    }

    try {
      const result = await window.electronAPI.updateHotkey(hotkey);
      if (result && !result.success) {
        showAlertDialog({
          title: "Hotkey Not Registered",
          description:
            result.message ||
            "We couldn't register that key. Please choose another hotkey.",
        });
        return false;
      }
      return true;
    } catch (error) {
      console.error("Failed to register onboarding hotkey", error);
      showAlertDialog({
        title: "Hotkey Error",
        description:
          "We couldn't register that key. Please choose another hotkey.",
      });
      return false;
    }
  }, [hotkey, showAlertDialog]);

  const saveSettings = useCallback(async () => {
    const normalizedTranscriptionBase = (transcriptionBaseUrl || '').trim();
    const normalizedReasoningBaseValue = (reasoningBaseUrl || '').trim();

    setCloudTranscriptionBaseUrl(normalizedTranscriptionBase);
    setCloudReasoningBaseUrl(normalizedReasoningBaseValue);

    updateTranscriptionSettings({
      whisperModel,
      preferredLanguage,
      cloudTranscriptionBaseUrl: normalizedTranscriptionBase,
    });
    updateReasoningSettings({
      useReasoningModel,
      reasoningModel,
      cloudReasoningBaseUrl: normalizedReasoningBaseValue,
    });
    const hotkeyRegistered = await ensureHotkeyRegistered();
    if (!hotkeyRegistered) {
      return false;
    }
    setDictationKey(hotkey);
    saveAgentName(agentName);

    localStorage.setItem(
      "micPermissionGranted",
      permissionsHook.micPermissionGranted.toString()
    );
    localStorage.setItem(
      "accessibilityPermissionGranted",
      permissionsHook.accessibilityPermissionGranted.toString()
    );
    localStorage.setItem("onboardingCompleted", "true");
    const trimmedApiKey = apiKey.trim();
    const skipAuth = trimmedApiKey.length === 0;
    localStorage.setItem("skipAuth", skipAuth.toString());

    if (!useLocalWhisper && trimmedApiKey) {
      await window.electronAPI.saveOpenAIKey(trimmedApiKey);
      updateApiKeys({ openaiApiKey: trimmedApiKey });
    }

    // Save ElevenLabs key if using cloud transcription
    const trimmedElevenLabsKey = elevenLabsKey.trim();
    if (transcriptionEngine === 'elevenlabs' && trimmedElevenLabsKey) {
      await window.electronAPI.saveElevenlabsKey(trimmedElevenLabsKey);
      updateApiKeys({ elevenlabsApiKey: trimmedElevenLabsKey });
    }
    return true;
  }, [
    whisperModel,
    hotkey,
    preferredLanguage,
    agentName,
    permissionsHook.micPermissionGranted,
    permissionsHook.accessibilityPermissionGranted,
    useLocalWhisper,
    apiKey,
    elevenLabsKey,
    transcriptionEngine,
    transcriptionBaseUrl,
    reasoningBaseUrl,
    updateTranscriptionSettings,
    updateReasoningSettings,
    updateApiKeys,
    setCloudTranscriptionBaseUrl,
    setCloudReasoningBaseUrl,
    setDictationKey,
    ensureHotkeyRegistered,
  ]);

  const nextStep = useCallback(async () => {
    if (currentStep >= steps.length - 1) {
      return;
    }

    const newStep = currentStep + 1;

    if (currentStep === 3) { // Hotkey step - register before proceeding
      const registered = await ensureHotkeyRegistered();
      if (!registered) {
        return;
      }
      setDictationKey(hotkey);
    }

    setCurrentStep(newStep);
  }, [currentStep, ensureHotkeyRegistered, hotkey, setCurrentStep, setDictationKey, steps.length]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      const newStep = currentStep - 1;
      setCurrentStep(newStep);
    }
  }, [currentStep, setCurrentStep]);

  const finishOnboarding = useCallback(async () => {
    const saved = await saveSettings();
    if (!saved) {
      return;
    }
    // Clear the onboarding step since we're done
    removeCurrentStep();
    onComplete();
  }, [saveSettings, removeCurrentStep, onComplete]);

  const renderStep = () => {
    switch (currentStep) {
      case 0: // Welcome
        return (
          <div className="text-center space-y-8 py-4">
            {/* App icon with subtle glow */}
            <div className="relative mx-auto w-24 h-24">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/40 via-pink-500/40 to-purple-600/40 rounded-2xl blur-2xl" />
              <img
                src={appIcon}
                alt="Tribe Assistant"
                className="relative w-24 h-24 rounded-2xl shadow-xl"
              />
            </div>

            {/* Title and tagline */}
            <div className="space-y-3">
              <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                Tribe Assistant
              </h1>
              <p className="text-xl font-medium text-white/90 tracking-wide">
                Speak. Create. Command.
              </p>
              <p className="text-muted-foreground max-w-md mx-auto">
                Your AI-powered voice assistant for dictation, image generation, and intelligent commands.
              </p>
            </div>

            {/* Feature cards with subtle borders */}
            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="group relative p-[1px] rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 hover:from-purple-500/50 hover:to-pink-500/50 transition-all duration-300">
                <div className="bg-black/40 rounded-xl p-4 h-full">
                  <Mic className="w-6 h-6 text-purple-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-medium text-foreground">Speak</p>
                  <p className="text-xs text-muted-foreground mt-1">Voice to text</p>
                </div>
              </div>
              <div className="group relative p-[1px] rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 hover:from-purple-500/50 hover:to-pink-500/50 transition-all duration-300">
                <div className="bg-black/40 rounded-xl p-4 h-full">
                  <Sparkles className="w-6 h-6 text-pink-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-medium text-foreground">Create</p>
                  <p className="text-xs text-muted-foreground mt-1">Generate images</p>
                </div>
              </div>
              <div className="group relative p-[1px] rounded-xl bg-gradient-to-br from-purple-500/30 to-pink-500/30 hover:from-purple-500/50 hover:to-pink-500/50 transition-all duration-300">
                <div className="bg-black/40 rounded-xl p-4 h-full">
                  <User className="w-6 h-6 text-purple-400 mx-auto mb-2 group-hover:scale-110 transition-transform" />
                  <p className="text-sm font-medium text-foreground">Command</p>
                  <p className="text-xs text-muted-foreground mt-1">AI agent mode</p>
                </div>
              </div>
            </div>

            {/* Feature badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10">
              <Sparkles className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-zinc-400">Fast & Accurate Voice-to-Text</span>
            </div>
          </div>
        );

      case 1: // Setup Processing - Choose between Local and Cloud
        return (
          <div className="space-y-6">
            {/* Header with gradient */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4 shadow-lg shadow-purple-500/20">
                <Mic className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                Choose Your Transcription
              </h2>
              <p className="text-muted-foreground">
                Select how you want your voice converted to text
              </p>
            </div>

            {/* Engine Selection Cards */}
            <div className="grid grid-cols-2 gap-4">
              {/* ElevenLabs Cloud Option - Recommended */}
              <button
                onClick={() => setTranscriptionEngine('elevenlabs')}
                className={`relative p-5 rounded-xl border-2 transition-all text-left ${
                  transcriptionEngine === 'elevenlabs'
                    ? 'border-purple-500/50 bg-purple-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                {transcriptionEngine === 'elevenlabs' && (
                  <div className="absolute top-2 right-2 p-1 bg-purple-500/20 rounded-full">
                    <Check className="w-3 h-3 text-purple-400" />
                  </div>
                )}
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg">
                    <Cloud className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <span className="font-semibold text-white">ElevenLabs</span>
                    <span className="ml-2 px-1.5 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded text-[9px] font-bold text-white uppercase">Best</span>
                  </div>
                </div>
                <p className="text-sm text-zinc-300 mb-3">Fastest & most accurate transcription available</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded-full flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Fast
                  </span>
                  <span className="px-2 py-0.5 text-xs bg-pink-500/20 text-pink-400 rounded-full">Best Quality</span>
                </div>
              </button>

              {/* Local Whisper Option */}
              <button
                onClick={() => setTranscriptionEngine('local')}
                className={`relative p-5 rounded-xl border-2 transition-all text-left ${
                  transcriptionEngine === 'local'
                    ? 'border-green-500/50 bg-green-500/10'
                    : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                }`}
              >
                {transcriptionEngine === 'local' && (
                  <div className="absolute top-2 right-2 p-1 bg-green-500/20 rounded-full">
                    <Check className="w-3 h-3 text-green-400" />
                  </div>
                )}
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Lock className="w-5 h-5 text-green-400" />
                  </div>
                  <span className="font-semibold text-white">Local</span>
                </div>
                <p className="text-sm text-zinc-300 mb-3">100% private - nothing leaves your device</p>
                <div className="flex flex-wrap gap-1.5">
                  <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full flex items-center gap-1">
                    <Shield className="w-3 h-3" /> Private
                  </span>
                  <span className="px-2 py-0.5 text-xs bg-zinc-500/20 text-zinc-400 rounded-full">Offline</span>
                </div>
              </button>
            </div>

            {/* ElevenLabs API Key Input - Show when cloud selected */}
            {transcriptionEngine === 'elevenlabs' && (
              <div className="relative p-[1px] rounded-xl bg-gradient-to-r from-purple-500/50 to-pink-500/50">
                <div className="bg-background/95 rounded-xl p-5">
                  <h4 className="font-medium text-purple-400 mb-3 flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    ElevenLabs API Key
                  </h4>
                  <div className="space-y-3">
                    <div className="relative">
                      <Input
                        type="password"
                        placeholder="Enter your ElevenLabs API Key"
                        value={elevenLabsKey}
                        onChange={(e) => {
                          const key = e.target.value;
                          setElevenLabsKey(key);
                          // Save immediately to localStorage and backend
                          setElevenlabsApiKey(key);
                          window.electronAPI?.saveElevenlabsKey(key);
                        }}
                        className="bg-background/50 border-purple-500/30 focus:border-purple-500 pr-10"
                      />
                      {elevenLabsKey && (
                        <div className="p-1 bg-green-500/20 rounded absolute right-2 top-1/2 -translate-y-1/2">
                          <Check className="w-3 h-3 text-green-400" />
                        </div>
                      )}
                    </div>
                    <a
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        window.electronAPI?.openExternal('https://elevenlabs.io/app/settings/api-keys');
                      }}
                      className="inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors"
                    >
                      <Sparkles className="w-3 h-3" />
                      Get a free API key from ElevenLabs
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Local Setup - Show when local selected */}
            {transcriptionEngine === 'local' && (
              <>
                {/* Privacy Explanation with gradient border */}
                <div className="relative p-[1px] rounded-xl bg-gradient-to-r from-emerald-500/50 to-teal-500/50">
                  <div className="bg-background/95 rounded-xl p-4">
                    <h4 className="font-medium text-emerald-400 mb-3 flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      100% Local Transcription
                    </h4>
                    <div className="text-sm text-emerald-200/80 space-y-2">
                      <p className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5">✓</span>
                        Voice recordings processed entirely on your device
                      </p>
                      <p className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5">✓</span>
                        Zero audio sent to any server or cloud
                      </p>
                      <p className="flex items-start gap-2">
                        <span className="text-emerald-400 mt-0.5">✓</span>
                        Works completely offline
                      </p>
                    </div>
                  </div>
                </div>

            <div className="space-y-4">
              {/* Python Installation Section */}
              {!pythonHook.hasChecked ? (
                <div className="text-center space-y-4 py-4">
                  <div className="relative w-16 h-16 mx-auto">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full opacity-20 animate-ping" />
                    <div className="relative w-16 h-16 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center border border-purple-500/30">
                      <div className="animate-spin rounded-full h-6 w-6 border-2 border-purple-500 border-t-transparent"></div>
                    </div>
                  </div>
                  <h3 className="font-semibold text-foreground">
                    Looking for Python...
                  </h3>
                  <p className="text-sm text-muted-foreground max-w-md mx-auto">
                    Scanning for your existing Python installation...
                  </p>
                </div>
              ) : !pythonHook.pythonInstalled ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
                    <Download className="w-8 h-8 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      Install Python
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Required for local AI processing
                    </p>
                  </div>

                  {pythonHook.installingPython ? (
                    <div className="relative p-[1px] rounded-xl bg-gradient-to-r from-purple-500/50 to-pink-500/50">
                      <div className="bg-background/95 rounded-xl p-4">
                        <div className="flex items-center justify-center gap-3 mb-3">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-500 border-t-transparent"></div>
                          <span className="font-medium bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            Installing Python...
                          </span>
                        </div>
                        {pythonHook.installProgress && (
                          <div className="text-xs text-purple-300 bg-purple-500/10 p-2 rounded-lg font-mono">
                            {pythonHook.installProgress}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          This may take a few minutes
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Button
                        onClick={() => {
                          pythonHook.installPython();
                        }}
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg shadow-purple-500/25"
                        disabled={pythonHook.isChecking}
                      >
                        {pythonHook.isChecking ? "Please Wait..." : "Install Python"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-center text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
                        disabled={pythonHook.isChecking}
                        onClick={() =>
                          showConfirmDialog({
                            title: "Use existing Python?",
                            description:
                              "We'll search for Python already on your system. Continue?",
                            confirmText: "Use Existing",
                            cancelText: "Cancel",
                            onConfirm: () => {
                              pythonHook.checkPythonInstallation();
                            },
                          })
                        }
                      >
                        Use Existing Python Instead
                      </Button>
                    </div>
                  )}
                </div>
              ) : !whisperHook.whisperInstalled ? (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
                    <Download className="w-8 h-8 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      Install Whisper AI
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Python ready! Now installing the speech recognition engine.
                    </p>
                  </div>

                  {whisperHook.installingWhisper ? (
                    <div className="relative p-[1px] rounded-xl bg-gradient-to-r from-purple-500/50 to-pink-500/50">
                      <div className="bg-background/95 rounded-xl p-4">
                        <div className="flex items-center justify-center gap-3 mb-3">
                          <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-500 border-t-transparent"></div>
                          <span className="font-medium bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                            Installing Whisper...
                          </span>
                        </div>
                        {whisperHook.installProgress && (
                          <div className="text-xs text-purple-300 bg-purple-500/10 p-2 rounded-lg font-mono">
                            {whisperHook.installProgress}
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          This may take a few minutes
                        </p>
                      </div>
                    </div>
                  ) : (
                    <Button
                      onClick={whisperHook.installWhisper}
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg shadow-purple-500/25"
                    >
                      Install Whisper AI
                    </Button>
                  )}
                </div>
              ) : whisperHook.downloadingBaseModel ? (
                <div className="text-center space-y-4">
                  <div className="relative w-16 h-16 mx-auto">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl opacity-30 animate-pulse" />
                    <div className="relative w-16 h-16 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-2xl flex items-center justify-center border border-purple-500/30">
                      <Download className="w-8 h-8 text-purple-400" />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                      Downloading AI Model
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Getting the recommended "base" model ready
                    </p>
                  </div>
                  <div className="relative p-[1px] rounded-xl bg-gradient-to-r from-purple-500/50 to-pink-500/50">
                    <div className="bg-background/95 rounded-xl p-4">
                      <div className="flex items-center justify-center gap-3 mb-3">
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-purple-500 border-t-transparent"></div>
                        <span className="font-medium bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                          Downloading...
                        </span>
                      </div>
                      {whisperHook.installProgress && (
                        <div className="text-xs text-purple-300 bg-purple-500/10 p-2 rounded-lg font-mono">
                          {whisperHook.installProgress}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        One-time download (~74MB)
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="relative w-16 h-16 mx-auto mb-4">
                      <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl opacity-30" />
                      <div className="relative w-16 h-16 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-2xl flex items-center justify-center border border-emerald-500/30">
                        <Check className="w-8 h-8 text-emerald-400" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-emerald-400 mb-2">
                      {whisperHook.baseModelDownloaded ? "Ready to Go!" : "Whisper Installed!"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {whisperHook.baseModelDownloaded
                        ? "AI model ready. Change models anytime in Settings."
                        : "Now choose your model quality:"}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground mb-3">
                      {whisperHook.baseModelDownloaded
                        ? "Want a different model?"
                        : "Choose your model quality"}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      Select the model that best fits your needs.
                    </p>
                  </div>

                  <WhisperModelPicker
                    selectedModel={whisperModel}
                    onModelSelect={setWhisperModel}
                    variant="onboarding"
                  />

                  {/* English-only recommendation */}
                  {preferredLanguage === 'en' && !whisperModel.endsWith('.en') && (
                    <div className="relative p-[1px] rounded-lg bg-gradient-to-r from-blue-500/30 to-purple-500/30">
                      <div className="bg-background/95 rounded-lg p-3">
                        <p className="text-sm text-blue-300">
                          <strong>💡 Tip:</strong> English-only models are faster and more accurate!
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
              </>
            )}

          </div>
        );

      case 2: // Permissions
        return (
          <div className="space-y-6">
            {/* Header with gradient */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4 shadow-lg shadow-purple-500/20">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                Grant Permissions
              </h2>
              <p className="text-muted-foreground">
                A few quick permissions to enable all features
              </p>
            </div>

            <div className="space-y-4">
              <PermissionCard
                icon={Mic}
                title="Microphone Access"
                description="Required to record your voice"
                granted={permissionsHook.micPermissionGranted}
                onRequest={permissionsHook.requestMicPermission}
                buttonText="Allow Microphone"
                instructions="Click the button and select 'Allow' when prompted by macOS."
              />

              <PermissionCard
                icon={Shield}
                title="Accessibility Permission"
                description="Required to paste text automatically"
                granted={permissionsHook.accessibilityPermissionGranted}
                onRequest={async () => {
                  // Open System Settings directly to Accessibility
                  await window.electronAPI.openExternal(
                    "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"
                  );
                  // Show instructions
                  showAlertDialog({
                    title: "Enable Accessibility Access",
                    description: "System Settings will open. Find 'Tribe Assistant' in the list and toggle it ON. If it's already on but not working, toggle it OFF then ON again. Then click 'Verify' to confirm.",
                  });
                }}
                onVerify={permissionsHook.testAccessibilityPermission}
                buttonText="Open Settings"
                instructions="Opens System Settings → Privacy & Security → Accessibility. Toggle ON for Tribe Assistant."
              />

              <PermissionCard
                icon={Camera}
                title="Screen Recording"
                description="Optional: Capture screenshots with voice commands"
                granted={permissionsHook.screenPermissionGranted}
                onRequest={async () => {
                  // Open System Settings directly to Screen Recording
                  await window.electronAPI.openExternal(
                    "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
                  );
                  showAlertDialog({
                    title: "Enable Screen Recording",
                    description: "System Settings will open. Find 'Tribe Assistant' in the list and toggle it ON. Then click 'Verify' to confirm.",
                  });
                }}
                onVerify={async () => {
                  const hasPermission = await permissionsHook.checkScreenPermission();
                  if (hasPermission) {
                    showAlertDialog({
                      title: "Screen Recording Enabled",
                      description: "You can now capture screenshots with voice commands.",
                    });
                  } else {
                    showAlertDialog({
                      title: "Permission Not Granted",
                      description: "Screen Recording permission not detected. Please enable it in System Settings and try again.",
                    });
                  }
                }}
                buttonText="Open Settings"
                instructions="Optional for screenshot features. Opens System Settings → Privacy & Security → Screen Recording."
              />
            </div>

            {/* Help text */}
            {(!permissionsHook.micPermissionGranted || !permissionsHook.accessibilityPermissionGranted) && (
              <div className="text-center text-sm text-muted-foreground mt-4">
                <p>After enabling permissions, click the button again to verify.</p>
              </div>
            )}

            {/* Privacy badge - only show for local transcription */}
            {transcriptionEngine === 'local' && (
              <div className="relative p-[1px] rounded-xl bg-gradient-to-r from-emerald-500/50 to-teal-500/50">
                <div className="bg-background/95 rounded-xl p-4">
                  <h4 className="font-medium text-emerald-400 mb-2 flex items-center gap-2">
                    <Lock className="w-4 h-4" />
                    Privacy Protected
                  </h4>
                  <p className="text-sm text-emerald-200/80">
                    All transcription happens locally. Your voice never leaves your device.
                  </p>
                </div>
              </div>
            )}

            {/* Cloud transcription notice - show for ElevenLabs */}
            {transcriptionEngine === 'elevenlabs' && (
              <div className="relative p-[1px] rounded-xl bg-gradient-to-r from-purple-500/50 to-pink-500/50">
                <div className="bg-background/95 rounded-xl p-4">
                  <h4 className="font-medium text-purple-400 mb-2 flex items-center gap-2">
                    <Cloud className="w-4 h-4" />
                    Cloud Transcription
                  </h4>
                  <p className="text-sm text-purple-200/80">
                    Audio is sent to ElevenLabs for fast, accurate transcription.
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      case 3: // Choose Hotkey
        return (
          <div className="space-y-6">
            {/* Header with gradient */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4 shadow-lg shadow-purple-500/20">
                <Keyboard className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                Choose Your Hotkey
              </h2>
              <p className="text-muted-foreground">
                Pick a key to start/stop dictation from anywhere
              </p>
            </div>

            <div className="space-y-4">
              <div className="relative p-[1px] rounded-xl bg-gradient-to-r from-purple-500/30 to-pink-500/30">
                <div className="bg-background/95 rounded-xl p-4">
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Activation Key
                  </label>
                  <Input
                    placeholder="Default: ` (backtick)"
                    value={hotkey}
                    readOnly
                    className="text-center text-lg font-mono bg-background/50 border-purple-500/30 cursor-default"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Press this key from anywhere to start/stop
                  </p>
                </div>
              </div>

              <div className="relative p-[1px] rounded-xl bg-gradient-to-r from-pink-500/30 to-purple-500/30">
                <div className="bg-background/95 rounded-xl p-4">
                  <h4 className="font-medium text-pink-400 mb-2 flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Screenshot Feature
                  </h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Hold <kbd className="bg-purple-500/20 px-2 py-1 rounded text-xs font-mono border border-purple-500/30 text-purple-300">
                      {typeof window !== 'undefined' && window.electronAPI?.getPlatform?.() === 'darwin' ? 'Cmd' : 'Ctrl'}
                    </kbd> + hotkey to capture a screenshot with your voice command.
                  </p>
                  <p className="text-sm text-purple-300/80">
                    Ask questions about what's on your screen!
                  </p>
                </div>
              </div>

              <div className="relative p-[1px] rounded-xl bg-gradient-to-r from-purple-500/20 to-pink-500/20">
                <div className="bg-background/95 rounded-xl p-4">
                  <h4 className="font-medium text-foreground mb-3">
                    Click any key to select:
                  </h4>
                  <React.Suspense fallback={<div className="text-muted-foreground text-center py-4">Loading keyboard...</div>}>
                    <InteractiveKeyboard selectedKey={hotkey} setSelectedKey={setHotkey} />
                  </React.Suspense>
                </div>
              </div>
            </div>
          </div>
        );

      case 4: // Test & Practice
        return (
          <div className="space-y-6">
            {/* Header with gradient */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4 shadow-lg shadow-purple-500/20">
                <TestTube className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                Test & Practice
              </h2>
              <p className="text-muted-foreground">
                Try it out! Your setup is ready to go.
              </p>
            </div>

            <div className="space-y-5">
              {/* Practice area with gradient border */}
              <div className="relative p-[1px] rounded-xl bg-gradient-to-r from-purple-500/50 to-pink-500/50">
                <div className="bg-background/95 rounded-xl p-5">
                  <h3 className="font-semibold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-4">
                    Try Your Hotkey
                  </h3>

                  <div className="space-y-3 mb-4">
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold">1</span>
                      <span className="text-foreground/80">Click in the text area below</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold">2</span>
                      <span className="text-foreground/80">
                        Press <kbd className="bg-purple-500/20 px-2 py-0.5 rounded text-xs font-mono border border-purple-500/30 text-purple-300">{readableHotkey}</kbd> and speak
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold">3</span>
                      <span className="text-foreground/80">
                        Press <kbd className="bg-purple-500/20 px-2 py-0.5 rounded text-xs font-mono border border-purple-500/30 text-purple-300">{readableHotkey}</kbd> again to stop
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                      <Mic className="w-4 h-4 text-purple-400" />
                      <span>Your transcribed text will appear here:</span>
                    </div>
                    <Textarea
                      ref={practiceTextareaRef}
                      rows={3}
                      placeholder="Click here, then press your hotkey to start..."
                      className="bg-background/50 border-purple-500/30 focus:border-purple-500"
                    />
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="relative p-[1px] rounded-xl bg-gradient-to-r from-emerald-500/30 to-teal-500/30">
                <div className="bg-background/95 rounded-xl p-4">
                  <h4 className="font-medium text-emerald-400 mb-3">
                    Quick Tips
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-sm text-emerald-200/80">
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-400">✓</span>
                      <span>Works in any app</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-400">✓</span>
                      <span>Speak naturally</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-400">✓</span>
                      <span>Text appears instantly</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-400">✓</span>
                      <span>{transcriptionEngine === 'local' ? '100% private & local' : 'Fast cloud processing'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 5: // Agent Name
        return (
          <div className="space-y-6">
            {/* Header with gradient */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 mb-4 shadow-lg shadow-purple-500/20">
                <User className="w-7 h-7 text-white" />
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                Name Your Agent
              </h2>
              <p className="text-muted-foreground">
                Give your AI assistant a personal name
              </p>
            </div>

            {/* How it works */}
            <div className="relative p-[1px] rounded-xl bg-gradient-to-r from-purple-500/30 to-pink-500/30">
              <div className="bg-background/95 rounded-xl p-4">
                <h4 className="font-medium text-purple-400 mb-3">
                  How it works:
                </h4>
                <div className="space-y-2 text-sm text-purple-200/80">
                  <p className="flex items-start gap-2">
                    <Sparkles className="w-4 h-4 text-pink-400 mt-0.5 flex-shrink-0" />
                    <span>Say "Hey <span className="text-pink-400 font-medium">{agentName || "Agent"}</span>, write a formal email" for AI commands</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <Mic className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                    <span>Without the name, it's just regular dictation</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Input */}
            <div className="relative p-[1px] rounded-xl bg-gradient-to-r from-pink-500/50 to-purple-500/50">
              <div className="bg-background/95 rounded-xl p-4">
                <label className="block text-sm font-medium text-foreground mb-3">
                  Agent Name <span className="text-muted-foreground font-normal">(single word)</span>
                </label>
                <Input
                  placeholder="e.g., Jarvis, Alex, Luna"
                  value={agentName}
                  onChange={(e) => setAgentName(sanitizeAgentName(e.target.value))}
                  className="text-center text-xl font-medium bg-background/50 border-purple-500/30 focus:border-purple-500"
                />
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Must be a single word for voice detection
                </p>
              </div>
            </div>
          </div>
        );

      case 6: // Complete
        return (
          <div className="text-center space-y-6">
            {/* Celebration header */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-32 h-32 bg-gradient-to-br from-purple-500 via-pink-500 to-purple-600 rounded-full opacity-20 blur-2xl animate-pulse" />
              </div>
              <div className="relative w-20 h-20 mx-auto bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-emerald-500/30">
                <Check className="w-10 h-10 text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent">
                You're All Set!
              </h2>
              <p className="text-lg text-white/90">
                Speak. Create. Command.
              </p>
              <p className="text-muted-foreground">
                Tribe Assistant is ready to go.
              </p>
            </div>

            {/* Summary with gradient border */}
            <div className="relative p-[1px] rounded-xl bg-gradient-to-r from-purple-500/50 to-pink-500/50">
              <div className="bg-background/95 rounded-xl p-5">
                <h3 className="font-semibold text-foreground mb-4">
                  Your Setup
                </h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Model:</span>
                    <span className="font-medium text-purple-400">{whisperModel}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Hotkey:</span>
                    <kbd className="bg-purple-500/20 px-3 py-1 rounded-lg text-sm font-mono border border-purple-500/30 text-purple-300">
                      {hotkey}
                    </kbd>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Language:</span>
                    <span className="font-medium text-foreground">{getLanguageLabel(preferredLanguage)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Agent:</span>
                    <span className="font-medium text-pink-400">{agentName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Status:</span>
                    <span className="font-medium text-emerald-400">
                      {permissionsHook.micPermissionGranted && permissionsHook.accessibilityPermissionGranted
                        ? "✓ Ready"
                        : "⚠ Review permissions"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Transcription mode badge */}
            {transcriptionEngine === 'local' ? (
              <div className="relative p-[1px] rounded-xl bg-gradient-to-r from-emerald-500/30 to-teal-500/30">
                <div className="bg-background/95 rounded-xl p-4">
                  <div className="flex items-center justify-center gap-2 text-emerald-400">
                    <Lock className="w-4 h-4" />
                    <span className="font-medium">100% Private</span>
                  </div>
                  <p className="text-xs text-emerald-200/70 mt-1">
                    Voice never leaves your device
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative p-[1px] rounded-xl bg-gradient-to-r from-purple-500/30 to-pink-500/30">
                <div className="bg-background/95 rounded-xl p-4">
                  <div className="flex items-center justify-center gap-2 text-purple-400">
                    <Cloud className="w-4 h-4" />
                    <span className="font-medium">Cloud Transcription</span>
                  </div>
                  <p className="text-xs text-purple-200/70 mt-1">
                    Powered by ElevenLabs for best accuracy
                  </p>
                </div>
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 0: // Welcome
        return true;
      case 1: // Setup - requirements depend on transcription engine choice
        if (transcriptionEngine === 'elevenlabs') {
          // ElevenLabs cloud only requires API key
          return elevenLabsKey.trim().length > 0;
        }
        // Local requires Python, Whisper, and base model downloaded
        return (
          pythonHook.pythonInstalled &&
          whisperHook.whisperInstalled &&
          whisperHook.baseModelDownloaded &&
          !whisperHook.downloadingBaseModel
        );
      case 2: // Permissions
        return (
          permissionsHook.micPermissionGranted &&
          permissionsHook.accessibilityPermissionGranted
          // Screen permission is optional, so not required to proceed
        );
      case 3: // Hotkey
        return hotkey.trim() !== "";
      case 4: // Test & Practice
        return true;
      case 5: // Agent Name
        return agentName.trim() !== "";
      case 6: // Finish
        return true;
      default:
        return false;
    }
  };

  // Load Google Font only in the browser
  React.useEffect(() => {
    const link = document.createElement("link");
    link.href =
      "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@300;400;500;600;700&display=swap";
    link.rel = "stylesheet";
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return (
    <div
      className="h-screen flex flex-col relative overflow-hidden"
      style={{
        fontFamily: "Inter, sans-serif",
        paddingTop: "env(safe-area-inset-top, 0px)",
      }}
    >
      {/* Full-screen gradient background */}
      <div className="absolute inset-0 bg-background" />
      <div className="absolute inset-0 bg-gradient-to-br from-purple-900/20 via-background to-pink-900/10" />
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-pink-500/5 rounded-full blur-3xl" />

      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && hideConfirmDialog()}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        onConfirm={confirmDialog.onConfirm}
      />

      <AlertDialog
        open={alertDialog.open}
        onOpenChange={(open) => !open && hideAlertDialog()}
        title={alertDialog.title}
        description={alertDialog.description}
        onOk={() => { }}
      />

      {/* Title Bar */}
      <div className="flex-shrink-0 z-10 relative">
        <TitleBar
          showTitle={true}
          className="bg-transparent border-b border-white/5"
        ></TitleBar>
      </div>

      {/* Progress Bar */}
      <div className="flex-shrink-0 relative bg-black/20 backdrop-blur-xl border-b border-white/5 p-6 md:px-16 z-10">
        <div className="max-w-4xl mx-auto">
          <StepProgress steps={steps} currentStep={currentStep} />
        </div>
      </div>

      {/* Content - This will grow to fill available space */}
      <div className="flex-1 px-6 md:px-16 py-8 overflow-y-auto relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Card with subtle border */}
          <div className="relative p-[1px] rounded-2xl bg-gradient-to-br from-white/10 via-white/5 to-white/10">
            <Card className="bg-black/40 backdrop-blur-xl border-0 shadow-2xl rounded-2xl overflow-hidden">
              <CardContent className="p-8 md:p-12">
                <div className="space-y-6">{renderStep()}</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer - This will stick to the bottom */}
      <div className="flex-shrink-0 relative bg-black/20 backdrop-blur-xl border-t border-white/5 px-6 md:px-16 py-6 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button
            onClick={prevStep}
            variant="outline"
            disabled={currentStep === 0}
            className="px-6 py-2.5 h-11 text-sm font-medium border-purple-500/30 hover:bg-purple-500/10 hover:border-purple-500/50 disabled:opacity-30"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Back
          </Button>

          <div className="flex items-center gap-3">
            {currentStep === steps.length - 1 ? (
              <Button
                onClick={finishOnboarding}
                className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white border-0 px-8 py-2.5 h-11 text-sm font-medium shadow-lg shadow-emerald-500/25"
              >
                <Check className="w-4 h-4 mr-2" />
                Get Started
              </Button>
            ) : (
              <Button
                onClick={nextStep}
                disabled={!canProceed()}
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 px-8 py-2.5 h-11 text-sm font-medium shadow-lg shadow-purple-500/25 disabled:opacity-50 disabled:shadow-none"
              >
                Continue
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Toggle } from "./ui/toggle";
import { Keyboard, Mic, Shield, Camera } from "lucide-react";
import WhisperModelPicker from "./WhisperModelPicker";
import ProcessingModeSelector from "./ui/ProcessingModeSelector";
import ApiKeyInput from "./ui/ApiKeyInput";
import { ConfirmDialog, AlertDialog } from "./ui/dialog";
import { useSettings } from "../hooks/useSettings";
import { useDialogs } from "../hooks/useDialogs";
import { useAgentName, sanitizeAgentName } from "../utils/agentName";
import { useWhisper } from "../hooks/useWhisper";
import { usePermissions } from "../hooks/usePermissions";
import { useClipboard } from "../hooks/useClipboard";
import { REASONING_PROVIDERS } from "../utils/languages";
import { formatHotkeyLabel } from "../utils/hotkeys";
import LanguageSelector from "./ui/LanguageSelector";
import PromptStudio from "./ui/PromptStudio";
import { API_ENDPOINTS } from "../config/constants";
import AIModelSelectorEnhanced from "./AIModelSelectorEnhanced";

export type SettingsSectionType =
  | "general"
  | "transcription"
  | "aiModels"
  | "agentConfig"
  | "prompts";

interface SettingsPageProps {
  activeSection?: SettingsSectionType;
}

export default function SettingsPage({
  activeSection = "general",
}: SettingsPageProps) {
  // Use custom hooks
  const {
    confirmDialog,
    alertDialog,
    showConfirmDialog,
    showAlertDialog,
    hideConfirmDialog,
    hideAlertDialog,
  } = useDialogs();

  const {
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
    reasoningProvider,
    openaiApiKey,
    anthropicApiKey,
    geminiApiKey,
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
    setReasoningProvider,
    setOpenaiApiKey,
    setAnthropicApiKey,
    setGeminiApiKey,
    setDictationKey,
    pushToTalk,
    setPushToTalk,
    updateTranscriptionSettings,
    updateReasoningSettings,
    updateApiKeys,
  } = useSettings();

  // Current version state
  const [currentVersion, setCurrentVersion] = useState<string>("");
  const [isRemovingModels, setIsRemovingModels] = useState(false);
  const cachePathHint =
    typeof navigator !== "undefined" && /Windows/i.test(navigator.userAgent)
      ? "%USERPROFILE%\\.cache\\openwhispr\\models"
      : "~/.cache/openwhispr/models";

  // Screenshot modifier key state
  const [screenshotModifier, setScreenshotModifier] = useState(() => {
    return localStorage.getItem("screenshotModifier") || "CmdOrCtrl";
  });

  // Launch on startup state
  const [launchOnStartup, setLaunchOnStartup] = useState(false);

  // Hotkey recording state
  const [isRecordingHotkey, setIsRecordingHotkey] = useState(false);

  const whisperHook = useWhisper(showAlertDialog);
  const permissionsHook = usePermissions(showAlertDialog);
  const { pasteFromClipboardWithFallback } = useClipboard(showAlertDialog);
  const { agentName, setAgentName } = useAgentName();

  // Local state for provider selection (overrides computed value)
  const [localReasoningProvider, setLocalReasoningProvider] = useState(() => {
    return localStorage.getItem("reasoningProvider") || reasoningProvider;
  });

  // Defer heavy operations for better performance
  useEffect(() => {
    let mounted = true;

    // Defer version check and whisper installation to improve initial render
    const timer = setTimeout(async () => {
      if (!mounted) return;

      const versionResult = await window.electronAPI?.getAppVersion();
      if (versionResult && mounted) setCurrentVersion(versionResult.version);

      // Check whisper after initial render
      if (mounted) {
        whisperHook.checkWhisperInstallation();
      }

      // Load launch on startup setting
      const launchResult = await window.electronAPI?.getLaunchOnStartup();
      if (launchResult && mounted) {
        setLaunchOnStartup(launchResult.enabled);
      }
    }, 100);

    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [whisperHook]);

  // Handle hotkey recording
  useEffect(() => {
    if (!isRecordingHotkey) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Ignore modifier keys by themselves
      if (["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(e.key)) {
        return;
      }

      let key = e.key;

      // Map keys to Electron Accelerator format
      if (key === " ") key = "Space";
      if (key === "Escape") {
        setIsRecordingHotkey(false);
        return;
      }

      // For single characters, use the character itself (usually lowercase for accelerators unless Shift is held, but Electron handles it)
      // Actually, for Electron global shortcuts, we usually want the character.
      // But let's stick to what the user presses.

      setDictationKey(key);
      setIsRecordingHotkey(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecordingHotkey, setDictationKey]);

  const saveReasoningSettings = useCallback(async () => {
    const normalizedReasoningBase = (cloudReasoningBaseUrl || '').trim();
    setCloudReasoningBaseUrl(normalizedReasoningBase);

    // Update reasoning settings
    updateReasoningSettings({
      useReasoningModel,
      reasoningModel,
      cloudReasoningBaseUrl: normalizedReasoningBase
    });

    // Save API keys to backend based on provider
    if (localReasoningProvider === "openai" && openaiApiKey) {
      await window.electronAPI?.saveOpenAIKey(openaiApiKey);
    }
    if (localReasoningProvider === "anthropic" && anthropicApiKey) {
      await window.electronAPI?.saveAnthropicKey(anthropicApiKey);
    }
    if (localReasoningProvider === "gemini" && geminiApiKey) {
      await window.electronAPI?.saveGeminiKey(geminiApiKey);
    }

    updateApiKeys({
      ...(localReasoningProvider === "openai" &&
        openaiApiKey.trim() && { openaiApiKey }),
      ...(localReasoningProvider === "anthropic" &&
        anthropicApiKey.trim() && { anthropicApiKey }),
      ...(localReasoningProvider === "gemini" &&
        geminiApiKey.trim() && { geminiApiKey }),
    });

    // Save the provider separately since it's computed from the model
    localStorage.setItem("reasoningProvider", localReasoningProvider);

    const providerLabel =
      localReasoningProvider === 'custom'
        ? 'Custom'
        : REASONING_PROVIDERS[
          localReasoningProvider as keyof typeof REASONING_PROVIDERS
        ]?.name || localReasoningProvider;

    showAlertDialog({
      title: "Reasoning Settings Saved",
      description: `AI text enhancement ${useReasoningModel ? "enabled" : "disabled"
        } with ${providerLabel
        } ${reasoningModel}`,
    });
  }, [
    useReasoningModel,
    reasoningModel,
    localReasoningProvider,
    openaiApiKey,
    anthropicApiKey,
    updateReasoningSettings,
    updateApiKeys,
    showAlertDialog,
  ]);

  const saveApiKey = useCallback(async () => {
    try {
      // Save all API keys to backend
      if (openaiApiKey) {
        await window.electronAPI?.saveOpenAIKey(openaiApiKey);
      }
      if (anthropicApiKey) {
        await window.electronAPI?.saveAnthropicKey(anthropicApiKey);
      }
      if (geminiApiKey) {
        await window.electronAPI?.saveGeminiKey(geminiApiKey);
      }

      updateApiKeys({ openaiApiKey, anthropicApiKey, geminiApiKey });
      updateTranscriptionSettings({ allowLocalFallback, fallbackWhisperModel });

      try {
        if (openaiApiKey) {
          await window.electronAPI?.createProductionEnvFile(openaiApiKey);
        }

        const savedKeys: string[] = [];
        if (openaiApiKey) savedKeys.push("OpenAI");
        if (anthropicApiKey) savedKeys.push("Anthropic");
        if (geminiApiKey) savedKeys.push("Gemini");

        showAlertDialog({
          title: "API Keys Saved",
          description: `${savedKeys.join(", ")} API key${savedKeys.length > 1 ? 's' : ''} saved successfully! Your credentials have been securely recorded.${allowLocalFallback ? " Local Whisper fallback is enabled." : ""
            }`,
        });
      } catch (envError) {
        showAlertDialog({
          title: "API Key Saved",
          description: `OpenAI API key saved successfully and will be available for transcription${allowLocalFallback ? " with Local Whisper fallback enabled" : ""
            }`,
        });
      }
    } catch (error) {
      console.error("Failed to save API key:", error);
      updateApiKeys({ openaiApiKey });
      updateTranscriptionSettings({ allowLocalFallback, fallbackWhisperModel });
      showAlertDialog({
        title: "API Key Saved",
        description: "OpenAI API key saved to localStorage (fallback mode)",
      });
    }
  }, [
    openaiApiKey,
    anthropicApiKey,
    geminiApiKey,
    allowLocalFallback,
    fallbackWhisperModel,
    updateApiKeys,
    updateTranscriptionSettings,
    showAlertDialog,
  ]);

  const resetAccessibilityPermissions = () => {
    const message = `🔄 RESET ACCESSIBILITY PERMISSIONS\n\nIf you've rebuilt or reinstalled Tribe Assistant and automatic inscription isn't functioning, you may have obsolete permissions from the previous version.\n\n📋 STEP-BY-STEP RESTORATION:\n\n1️⃣ Open System Settings (or System Preferences)\n   • macOS Ventura+: Apple Menu → System Settings\n   • Older macOS: Apple Menu → System Preferences\n\n2️⃣ Navigate to Privacy & Security → Accessibility\n\n3️⃣ Look for obsolete Tribe Assistant entries:\n   • Any entries named "Tribe Assistant"\n   • Any entries named "Electron"\n   • Any entries with unclear or generic names\n   • Entries pointing to old application locations\n\n4️⃣ Remove ALL obsolete entries:\n   • Select each old entry\n   • Click the minus (-) button\n   • Enter your password if prompted\n\n5️⃣ Add the current Tribe Assistant:\n   • Click the plus (+) button\n   • Navigate to and select the CURRENT Tribe Assistant app\n   • Ensure the checkbox is ENABLED\n\n6️⃣ Restart Tribe Assistant completely\n\n💡 This is very common during development when rebuilding applications!\n\nClick OK when you're ready to open System Settings.`;

    showConfirmDialog({
      title: "Reset Accessibility Permissions",
      description: message,
      onConfirm: () => {
        showAlertDialog({
          title: "Opening System Settings",
          description:
            "Opening System Settings... Look for the Accessibility section under Privacy & Security.",
        });

        window.open(
          "x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility",
          "_blank"
        );
      },
    });
  };

  const saveKey = async () => {
    try {
      const result = await window.electronAPI?.updateHotkey(dictationKey);

      if (!result?.success) {
        showAlertDialog({
          title: "Hotkey Not Saved",
          description:
            result?.message ||
            "This key could not be registered. Please choose a different key.",
        });
        return;
      }

      showAlertDialog({
        title: "Key Saved",
        description: `Dictation key saved: ${formatHotkeyLabel(dictationKey)}`,
      });
    } catch (error) {
      console.error("Failed to update hotkey:", error);
      showAlertDialog({
        title: "Error",
        description: `Failed to update hotkey: ${(error as Error).message}`,
      });
    }
  };

  const handleRemoveModels = useCallback(() => {
    if (isRemovingModels) return;

    showConfirmDialog({
      title: "Remove downloaded models?",
      description:
        `This deletes all locally cached Whisper models (${cachePathHint}) and frees disk space. You can download them again from the model picker.`,
      confirmText: "Delete Models",
      variant: "destructive",
      onConfirm: () => {
        setIsRemovingModels(true);
        window.electronAPI
          ?.modelDeleteAll?.()
          .then((result) => {
            if (!result?.success) {
              showAlertDialog({
                title: "Unable to Remove Models",
                description:
                  result?.error ||
                  "Something went wrong while deleting the cached models.",
              });
              return;
            }

            window.dispatchEvent(new Event("openwhispr-models-cleared"));

            showAlertDialog({
              title: "Models Removed",
              description:
                "All downloaded Whisper models were deleted. You can re-download any model from the picker when needed.",
            });
          })
          .catch((error) => {
            showAlertDialog({
              title: "Unable to Remove Models",
              description: error?.message || "An unknown error occurred.",
            });
          })
          .finally(() => {
            setIsRemovingModels(false);
          });
      },
    });
  }, [isRemovingModels, cachePathHint, showConfirmDialog, showAlertDialog]);

  const handleLaunchOnStartupToggle = useCallback(async (enabled: boolean) => {
    try {
      const result = await window.electronAPI?.setLaunchOnStartup(enabled);
      if (result?.success) {
        setLaunchOnStartup(enabled);
        localStorage.setItem("launchOnStartup", String(enabled));
        showAlertDialog({
          title: "Launch Setting Updated",
          description: enabled
            ? "Tribe Assistant will now start automatically when you log in."
            : "Tribe Assistant will no longer start automatically at login.",
        });
      } else {
        showAlertDialog({
          title: "Failed to Update Setting",
          description: result?.error || "Could not update launch on startup setting.",
        });
      }
    } catch (error) {
      console.error("Failed to toggle launch on startup:", error);
      showAlertDialog({
        title: "Error",
        description: `Failed to update setting: ${(error as Error).message}`,
      });
    }
  }, [showAlertDialog]);

  const renderSectionContent = () => {
    switch (activeSection) {
      case "general":
        return (
          <div className="space-y-8">
            {/* Hotkey Section */}
            <div>
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Dictation Hotkey
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Configure the key you press to start and stop voice dictation.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Activation Key
                  </label>

                  <div className="flex flex-col gap-3">
                    {/* Current Hotkey Display & Record Button */}
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Input
                          value={dictationKey === "GLOBE" ? "Globe (fn)" : formatHotkeyLabel(dictationKey)}
                          readOnly
                          className={`text-center text-lg font-mono ${isRecordingHotkey ? "border-primary ring-1 ring-primary" : ""}`}
                        />
                        {isRecordingHotkey && (
                          <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-md border border-primary">
                            <span className="text-primary font-medium animate-pulse">Press any key...</span>
                          </div>
                        )}
                      </div>

                      <Button
                        variant={isRecordingHotkey ? "destructive" : "secondary"}
                        onClick={() => {
                          if (isRecordingHotkey) {
                            setIsRecordingHotkey(false);
                          } else {
                            setIsRecordingHotkey(true);
                            // Focus a hidden input or just listen to window
                          }
                        }}
                        className="w-32"
                      >
                        {isRecordingHotkey ? "Cancel" : "Change"}
                      </Button>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setDictationKey("GLOBE");
                          setIsRecordingHotkey(false);
                        }}
                      >
                        🌐 Use Globe (fn) Key
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setDictationKey("`");
                          setIsRecordingHotkey(false);
                        }}
                      >
                        Default (`)
                      </Button>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-2">
                    {dictationKey === "GLOBE"
                      ? "Press the Globe (fn) key to start/stop dictation."
                      : "Press this key to start/stop dictation."}
                  </p>
                </div>

                {/* Hidden listener for hotkey recording */}
                {isRecordingHotkey && (
                  <div className="hidden">
                    <input
                      autoFocus
                      onBlur={() => setIsRecordingHotkey(false)}
                      onKeyDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        // Ignore modifier-only presses if possible, or handle them
                        if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) {
                          return;
                        }

                        let key = e.key;
                        // Map common keys to electron-accelerator format if needed
                        if (key === " ") key = "Space";
                        if (key.length === 1) key = key.toLowerCase();

                        setDictationKey(key);
                        setIsRecordingHotkey(false);
                      }}
                    />
                  </div>
                )}



                <Button
                  onClick={saveKey}
                  disabled={!dictationKey.trim()}
                  className="w-full"
                >
                  Save Hotkey
                </Button>

                {/* Simple info box */}
                {dictationKey && (
                  <div className="mt-4 p-3 bg-secondary/50 rounded-lg space-y-2">
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Hotkey:</span> Press{" "}
                      <span className="font-mono font-bold">{formatHotkeyLabel(dictationKey)}</span> to start/stop recording
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Screenshot:</span> Press{" "}
                      <span className="font-mono font-bold">
                        {dictationKey === "GLOBE" ? "Cmd+Shift+G" : `Cmd+${formatHotkeyLabel(dictationKey)}`}
                      </span> to capture screen with voice
                    </p>
                  </div>
                )}

                {/* Remove the whole modifier dropdown section - keep it simple with just Cmd */}
                <div style={{ display: 'none' }}>
                  <Select value={screenshotModifier} onValueChange={() => {}}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CmdOrCtrl">Cmd</SelectItem>
                            {typeof window !== 'undefined' && window.electronAPI?.getPlatform?.() === 'darwin' ? 'Command + Option' : 'Ctrl + Alt'}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-2">
                        Current shortcut: <kbd className="bg-background px-2 py-1 rounded text-xs font-mono border border-border">
                          {screenshotModifier === 'CmdOrCtrl'
                            ? (typeof window !== 'undefined' && window.electronAPI?.getPlatform?.() === 'darwin' ? 'Cmd' : 'Ctrl')
                            : screenshotModifier.replace('CmdOrCtrl', typeof window !== 'undefined' && window.electronAPI?.getPlatform?.() === 'darwin' ? 'Cmd' : 'Ctrl')}
                          +{formatHotkeyLabel(dictationKey)}
                        </kbd>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div >

            {/* Permissions Section */}
            < div className="border-t pt-8" >
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Permissions
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Test and manage app permissions for microphone and
                  accessibility.
                </p>
              </div>
              <div className="space-y-3">
                <Button
                  onClick={permissionsHook.requestMicPermission}
                  variant="outline"
                  className="w-full"
                >
                  <Mic className="mr-2 h-4 w-4" />
                  Test Microphone Permission
                </Button>
                <Button
                  onClick={permissionsHook.testAccessibilityPermission}
                  variant="outline"
                  className="w-full"
                >
                  <Shield className="mr-2 h-4 w-4" />
                  Test Accessibility Permission
                </Button>
                <Button
                  onClick={async () => {
                    const hasPermission = await permissionsHook.checkScreenPermission();
                    if (hasPermission) {
                      showAlertDialog({
                        title: "✅ Screen Recording Permission Granted",
                        description: "You can now use Cmd+Backtick (Mac) or Ctrl+Backtick (Win/Linux) to capture screenshots with your voice commands.",
                      });
                    }
                  }}
                  variant="outline"
                  className="w-full"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Test Screen Recording Permission
                </Button>
                <Button
                  onClick={resetAccessibilityPermissions}
                  variant="secondary"
                  className="w-full"
                >
                  <span className="mr-2">⚙️</span>
                  Fix Permission Issues
                </Button>
              </div>
            </div >

            {/* Launch on Startup Section */}
            < div className="border-t pt-8" >
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Startup Behavior
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Configure how Tribe Assistant behaves when you start your computer.
                </p>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-card border border-border rounded-xl">
                  <div className="flex-1 mr-4">
                    <h4 className="font-medium text-foreground mb-1">
                      Launch at Startup
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Automatically start Tribe Assistant when you log into your computer
                    </p>
                  </div>
                  <Toggle
                    checked={launchOnStartup}
                    onChange={handleLaunchOnStartupToggle}
                  />
                </div>
              </div>
            </div >

            {/* About Section */}
            < div className="border-t pt-8" >
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  About Tribe Assistant
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Tribe Assistant transcribes speech and captures screenshots with AI-powered processing. Press your hotkey to dictate, address your agent by name for commands, highlight text to enhance it, or use {typeof window !== 'undefined' && window.electronAPI?.getPlatform?.() === 'darwin' ? 'Cmd' : 'Ctrl'}+hotkey to capture screenshots.
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm mb-6">
                <div className="text-center p-4 border border-border rounded-xl bg-card">
                  <div className="w-8 h-8 mx-auto mb-2 bg-primary rounded-lg flex items-center justify-center">
                    <Keyboard className="w-4 h-4 text-white" />
                  </div>
                  <p className="font-medium text-foreground mb-1">
                    Default Hotkey
                  </p>
                  <p className="text-muted-foreground font-mono text-xs">
                    {formatHotkeyLabel(dictationKey)}
                  </p>
                </div>
                <div className="text-center p-4 border border-border rounded-xl bg-card">
                  <div className="w-8 h-8 mx-auto mb-2 bg-secondary rounded-lg flex items-center justify-center">
                    <span className="text-foreground text-sm">🏷️</span>
                  </div>
                  <p className="font-medium text-foreground mb-1">Version</p>
                  <p className="text-muted-foreground text-xs">
                    {currentVersion || "0.1.0"}
                  </p>
                </div>
                <div className="text-center p-4 border border-border rounded-xl bg-card">
                  <div className="w-8 h-8 mx-auto mb-2 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <span className="text-green-500 text-sm">✓</span>
                  </div>
                  <p className="font-medium text-foreground mb-1">Status</p>
                  <p className="text-green-500 text-xs font-medium">Active</p>
                </div>
              </div>

              {/* System Actions */}
              <div className="space-y-3">
                <Button
                  onClick={() => {
                    showConfirmDialog({
                      title: "Reset Onboarding",
                      description:
                        "Are you sure you want to reset the onboarding process? This will clear your setup and show the welcome flow again.",
                      onConfirm: () => {
                        localStorage.removeItem("onboardingCompleted");
                        window.location.reload();
                      },
                      variant: "destructive",
                    });
                  }}
                  variant="outline"
                  className="w-full text-amber-500 border-amber-500/50 hover:bg-amber-500/10 hover:border-amber-500"
                >
                  <span className="mr-2">🔄</span>
                  Reset Onboarding
                </Button>
                <Button
                  onClick={() => {
                    showConfirmDialog({
                      title: "⚠️ DANGER: Cleanup App Data",
                      description:
                        "This will permanently delete ALL OpenWhispr data including:\n\n• Database and transcriptions\n• Local storage settings\n• Downloaded Whisper models\n• Environment files\n\nYou will need to manually remove app permissions in System Settings.\n\nThis action cannot be undone. Are you sure?",
                      onConfirm: () => {
                        window.electronAPI
                          ?.cleanupApp()
                          .then(() => {
                            showAlertDialog({
                              title: "Cleanup Completed",
                              description:
                                "✅ Cleanup completed! All app data has been removed.",
                            });
                            setTimeout(() => {
                              window.location.reload();
                            }, 1000);
                          })
                          .catch((error) => {
                            showAlertDialog({
                              title: "Cleanup Failed",
                              description: `❌ Cleanup failed: ${error.message}`,
                            });
                          });
                      },
                      variant: "destructive",
                    });
                  }}
                  variant="outline"
                  className="w-full text-destructive border-destructive/50 hover:bg-destructive/10 hover:border-destructive"
                >
                  <span className="mr-2">🗑️</span>
                  Clean Up All App Data
                </Button>
              </div>

              <div className="space-y-3 mt-6 p-4 bg-secondary border border-border rounded-xl">
                <h4 className="font-medium text-foreground">Local Model Storage</h4>
                <p className="text-sm text-muted-foreground">
                  Remove all downloaded Whisper models from your cache directory to reclaim disk space. You can re-download any model later.
                </p>
                <Button
                  variant="destructive"
                  onClick={handleRemoveModels}
                  disabled={isRemovingModels}
                  className="w-full"
                >
                  {isRemovingModels ? "Removing models..." : "Remove Downloaded Models"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Current cache location: <code>{cachePathHint}</code>
                </p>
              </div>
            </div >
          </div >
        );

      case "transcription":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-4">
                Speech to Text Processing
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                Transcription is performed locally on your device using Faster Whisper.
              </p>
            </div>

            {whisperHook.whisperInstalled ? (
              <div className="space-y-4 p-4 bg-secondary border border-border rounded-xl">
                <h4 className="font-medium text-foreground">
                  Local Whisper Model
                </h4>
                <WhisperModelPicker
                  selectedModel={whisperModel}
                  onModelSelect={setWhisperModel}
                  variant="settings"
                />
              </div>
            ) : (
              <div className="p-4 bg-secondary border border-border rounded-xl">
                <p className="text-sm text-muted-foreground mb-2">Whisper is not installed.</p>
                <Button onClick={() => whisperHook.installWhisper()}>Install Whisper</Button>
              </div>
            )}

            <div className="space-y-4 p-4 bg-card border border-border rounded-xl">
              <h4 className="font-medium text-foreground">Preferred Language</h4>
              <LanguageSelector
                value={preferredLanguage}
                onChange={(value) => {
                  setPreferredLanguage(value);
                  updateTranscriptionSettings({ preferredLanguage: value });
                }}
                className="w-full"
              />
            </div>

            <Button
              onClick={() => {
                const normalizedTranscriptionBase = (cloudTranscriptionBaseUrl || '').trim();
                setCloudTranscriptionBaseUrl(normalizedTranscriptionBase);

                updateTranscriptionSettings({
                  useLocalWhisper,
                  whisperModel,
                  preferredLanguage,
                  cloudTranscriptionBaseUrl: normalizedTranscriptionBase,
                });

                if (!useLocalWhisper && openaiApiKey.trim()) {
                  updateApiKeys({ openaiApiKey });
                }

                const descriptionParts = [
                  `Transcription mode: ${useLocalWhisper ? 'Local Whisper' : 'Cloud'}.`,
                  `Language: ${preferredLanguage}.`,
                ];

                if (!useLocalWhisper) {
                  const baseLabel = normalizedTranscriptionBase || API_ENDPOINTS.TRANSCRIPTION_BASE;
                  descriptionParts.push(`Endpoint: ${baseLabel}.`);
                }

                showAlertDialog({
                  title: "Settings Saved",
                  description: descriptionParts.join(' '),
                });
              }}
              className="w-full"
            >
              Save Transcription Settings
            </Button>
          </div>
        );

      case "aiModels":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                AI Text Enhancement
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Configure how AI models clean up and format your transcriptions.
                This handles commands like "scratch that", creates proper lists,
                and fixes obvious errors while preserving your natural tone.
              </p>
            </div>

            <AIModelSelectorEnhanced
              useReasoningModel={useReasoningModel}
              setUseReasoningModel={(value) => {
                setUseReasoningModel(value);
                updateReasoningSettings({ useReasoningModel: value });
              }}
              setCloudReasoningBaseUrl={setCloudReasoningBaseUrl}
              cloudReasoningBaseUrl={cloudReasoningBaseUrl}
              reasoningModel={reasoningModel}
              setReasoningModel={setReasoningModel}
              localReasoningProvider={localReasoningProvider}
              setLocalReasoningProvider={setLocalReasoningProvider}
              openaiApiKey={openaiApiKey}
              setOpenaiApiKey={setOpenaiApiKey}
              anthropicApiKey={anthropicApiKey}
              setAnthropicApiKey={setAnthropicApiKey}
              geminiApiKey={geminiApiKey}
              setGeminiApiKey={setGeminiApiKey}
              pasteFromClipboard={pasteFromClipboardWithFallback}
              showAlertDialog={showAlertDialog}
            />

            <Button onClick={saveReasoningSettings} className="w-full">
              Save AI Model Settings
            </Button>
          </div>
        );

      case "agentConfig":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Agent Configuration
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                Customize your AI assistant's name and behavior to make
                interactions more personal and effective.
              </p>
            </div>

            <div className="space-y-4 p-4 bg-primary/10 border border-primary/20 rounded-xl">
              <h4 className="font-medium text-primary mb-3">
                💡 How to use agent names:
              </h4>
              <ul className="text-sm text-primary/80 space-y-2">
                <li>
                  • Say "Hey {agentName}, write a formal email" for specific
                  instructions
                </li>
                <li>
                  • Use "Hey {agentName}, format this as a list" for text
                  enhancement commands
                </li>
                <li>
                  • The agent will recognize when you're addressing it directly
                  vs. dictating content
                </li>
                <li>
                  • Makes conversations feel more natural and helps distinguish
                  commands from dictation
                </li>
              </ul>
            </div>

            <div className="space-y-4 p-4 bg-card border border-border rounded-xl">
              <h4 className="font-medium text-foreground">
                Current Agent Name <span className="text-muted-foreground font-normal">(single word)</span>
              </h4>
              <div className="flex gap-3">
                <Input
                  placeholder="e.g., Jarvis, Alex, Luna"
                  value={agentName}
                  onChange={(e) => setAgentName(sanitizeAgentName(e.target.value))}
                  className="flex-1 text-center text-lg font-mono"
                />
                <Button
                  onClick={() => {
                    const sanitized = sanitizeAgentName(agentName);
                    setAgentName(sanitized);
                    showAlertDialog({
                      title: "Agent Name Updated",
                      description: `Your agent is now named "${sanitized}". You can address it by saying "Hey ${sanitized}" followed by your instructions.`,
                    });
                  }}
                  disabled={!agentName.trim()}
                >
                  Save
                </Button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Must be a single word for accurate voice detection
              </p>
            </div>

            <div className="bg-primary/10 p-4 rounded-lg border border-primary/20">
              <h4 className="font-medium text-primary mb-2">
                🎯 Example Usage:
              </h4>
              <div className="text-sm text-primary/80 space-y-1">
                <p>
                  • "Hey {agentName}, write an email to my team about the
                  meeting"
                </p>
                <p>
                  • "Hey {agentName}, make this more professional" (after
                  dictating text)
                </p>
                <p>• "Hey {agentName}, convert this to bullet points"</p>
                <p>
                  • Regular dictation: "This is just normal text" (no agent name
                  needed)
                </p>
              </div>
            </div>
          </div>
        );


      case "prompts":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                AI Prompt Management
              </h3>
              <p className="text-sm text-muted-foreground mb-6">
                View and customize the prompts that power OpenWhispr's AI text processing.
                Adjust these to change how your transcriptions are formatted and enhanced.
              </p>
            </div>

            <PromptStudio />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && hideConfirmDialog()}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
      />

      <AlertDialog
        open={alertDialog.open}
        onOpenChange={(open) => !open && hideAlertDialog()}
        title={alertDialog.title}
        description={alertDialog.description}
        onOk={() => { }}
      />

      {renderSectionContent()}
    </>
  );
}

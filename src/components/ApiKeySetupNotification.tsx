import React, { useState, useEffect } from 'react';
import { X, Key, Sparkles, Check, ExternalLink, Zap, Brain, Mic } from 'lucide-react';
import { Button } from './ui/button';
import { useSettings } from '../hooks/useSettings';

interface ApiKeySetupNotificationProps {
  onNavigateToAIModels: () => void;
}

export const ApiKeySetupNotification: React.FC<ApiKeySetupNotificationProps> = ({
  onNavigateToAIModels,
}) => {
  const settings = useSettings();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Check API key status
  const hasOpenAI = !!settings.openaiApiKey;
  const hasGemini = !!settings.geminiApiKey;
  const hasElevenLabs = !!settings.elevenlabsApiKey;
  const allKeysConfigured = hasOpenAI && hasGemini && hasElevenLabs;
  const hasAtLeastOneKey = hasOpenAI || hasGemini || hasElevenLabs;

  useEffect(() => {
    // Check if user has completed onboarding
    const hasCompletedOnboarding = localStorage.getItem('hasCompletedOnboarding') === 'true';

    // Check if user has dismissed this modal
    const dismissed = localStorage.getItem('apiKeySetupModalDismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
      return;
    }

    // Show modal if:
    // 1. User has completed onboarding
    // 2. Not all keys are configured
    // 3. Not already dismissed
    if (hasCompletedOnboarding && !allKeysConfigured) {
      // Small delay to let the UI settle after onboarding
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, [allKeysConfigured]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('apiKeySetupModalDismissed', 'true');
  };

  const handleSetupClick = () => {
    onNavigateToAIModels();
    setIsVisible(false);
  };

  // Don't show if dismissed or all keys configured
  if (!isVisible || isDismissed) {
    return null;
  }

  const apiKeys = [
    {
      name: 'ElevenLabs',
      description: 'Real-time speech transcription',
      icon: Mic,
      color: 'purple',
      isConfigured: hasElevenLabs,
      getKeyUrl: 'https://elevenlabs.io/app/settings/api-keys',
    },
    {
      name: 'OpenAI',
      description: 'GPT models for agent mode',
      icon: Brain,
      color: 'green',
      isConfigured: hasOpenAI,
      getKeyUrl: 'https://platform.openai.com/api-keys',
    },
    {
      name: 'Google Gemini',
      description: 'Image generation & AI features',
      icon: Sparkles,
      color: 'blue',
      isConfigured: hasGemini,
      getKeyUrl: 'https://aistudio.google.com/app/apikey',
    },
  ];

  const configuredCount = [hasOpenAI, hasGemini, hasElevenLabs].filter(Boolean).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={handleDismiss}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          className="w-full max-w-lg bg-zinc-900 border border-zinc-700/50 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative p-6 bg-gradient-to-br from-purple-500/20 via-pink-500/10 to-orange-500/20 border-b border-zinc-700/50">
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors p-1 hover:bg-white/10 rounded-lg"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
                <Key className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Complete Your Setup</h2>
                <p className="text-sm text-zinc-400">Unlock all features with API keys</p>
              </div>
            </div>

            {/* Progress indicator */}
            <div className="flex items-center gap-2 mt-4">
              <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
                  style={{ width: `${(configuredCount / 3) * 100}%` }}
                />
              </div>
              <span className="text-xs text-zinc-400 font-medium">{configuredCount}/3</span>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            <p className="text-sm text-zinc-300 mb-5">
              For the best experience, set up these API keys. You can always add them later in Settings.
            </p>

            {/* API Key List */}
            <div className="space-y-3 mb-6">
              {apiKeys.map((api) => {
                const Icon = api.icon;
                const colorClasses = {
                  purple: 'from-purple-500/20 to-purple-500/5 border-purple-500/30',
                  green: 'from-green-500/20 to-green-500/5 border-green-500/30',
                  blue: 'from-blue-500/20 to-blue-500/5 border-blue-500/30',
                };
                const iconColors = {
                  purple: 'text-purple-400',
                  green: 'text-green-400',
                  blue: 'text-blue-400',
                };

                return (
                  <div
                    key={api.name}
                    className={`relative flex items-center gap-4 p-4 rounded-xl border transition-all ${
                      api.isConfigured
                        ? 'bg-zinc-800/30 border-zinc-700/50'
                        : `bg-gradient-to-r ${colorClasses[api.color as keyof typeof colorClasses]}`
                    }`}
                  >
                    <div className={`p-2 rounded-lg ${api.isConfigured ? 'bg-zinc-700/50' : 'bg-white/10'}`}>
                      <Icon className={`w-5 h-5 ${api.isConfigured ? 'text-zinc-400' : iconColors[api.color as keyof typeof iconColors]}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${api.isConfigured ? 'text-zinc-400' : 'text-white'}`}>
                          {api.name}
                        </span>
                        {api.isConfigured && (
                          <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                            <Check className="w-3 h-3" />
                            Added
                          </span>
                        )}
                      </div>
                      <p className={`text-xs ${api.isConfigured ? 'text-zinc-500' : 'text-zinc-400'}`}>
                        {api.description}
                      </p>
                    </div>

                    {!api.isConfigured && (
                      <a
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          window.electronAPI?.openExternal(api.getKeyUrl);
                        }}
                        className="flex items-center gap-1 text-xs text-zinc-400 hover:text-white transition-colors px-2 py-1 hover:bg-white/10 rounded-lg"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Get Key
                      </a>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={handleSetupClick}
                className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium h-11"
              >
                <Zap className="w-4 h-4 mr-2" />
                Set Up in Settings
              </Button>
            </div>

            {/* Skip Link */}
            <button
              onClick={handleDismiss}
              className="w-full mt-4 text-sm text-zinc-500 hover:text-zinc-400 transition-colors"
            >
              I'll do this later
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

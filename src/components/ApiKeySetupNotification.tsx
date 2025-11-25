import React, { useState, useEffect } from 'react';
import { X, Key, Sparkles, Camera, MessageSquare, Image, ExternalLink } from 'lucide-react';
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

  useEffect(() => {
    // Check if user has dismissed this notification
    const dismissed = localStorage.getItem('apiKeySetupDismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
      return;
    }

    // Show notification if neither OpenAI nor Gemini keys are configured
    const hasNoKeys = !settings.openaiApiKey && !settings.geminiApiKey;
    setIsVisible(hasNoKeys);
  }, [settings.openaiApiKey, settings.geminiApiKey]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    localStorage.setItem('apiKeySetupDismissed', 'true');
  };

  const handleSetupClick = () => {
    onNavigateToAIModels();
    // Don't fully dismiss - just hide temporarily so they can set it up
    setIsVisible(false);
  };

  // Don't show if dismissed or if user has keys
  if (!isVisible || isDismissed) {
    return null;
  }

  const missingFeatures = [
    {
      icon: Camera,
      label: 'Screenshot + Voice',
      description: 'Analyze screenshots with voice commands',
      color: 'text-blue-400',
    },
    {
      icon: MessageSquare,
      label: 'Agent Mode',
      description: 'AI-powered text processing',
      color: 'text-amber-400',
    },
    {
      icon: Image,
      label: 'Image Generation',
      description: 'Create images with AI',
      color: 'text-purple-400',
    },
  ];

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[420px] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-b border-zinc-700/50">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Unlock AI Features</h3>
          </div>
          <button
            onClick={handleDismiss}
            className="text-zinc-400 hover:text-white transition-colors"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-zinc-300 mb-4">
            Add an API key to unlock powerful AI features:
          </p>

          {/* Feature List */}
          <div className="space-y-2 mb-4">
            {missingFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="flex items-center gap-3 p-2 bg-zinc-800/50 rounded-lg"
                >
                  <Icon className={`w-4 h-4 ${feature.color}`} />
                  <div className="flex-1">
                    <span className="text-sm text-white font-medium">{feature.label}</span>
                    <span className="text-xs text-zinc-500 ml-2">{feature.description}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA Button */}
          <Button
            onClick={handleSetupClick}
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Set Up API Keys
          </Button>

          {/* Dismiss Link */}
          <button
            onClick={handleDismiss}
            className="w-full mt-3 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
          >
            I'll do this later
          </button>
        </div>
      </div>
    </div>
  );
};

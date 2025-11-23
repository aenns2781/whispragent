import React, { useState, useEffect } from 'react';
import { Cpu, Download, Trash2, Check, AlertCircle, Zap, Shield, Brain, Sparkles, Lock, Cloud, Gauge } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { cn } from '../lib/utils';
import { useSettings } from '../../hooks/useSettings';
import PanelBackground from '../PanelBackground';

interface WhisperModel {
  name: string;
  size: string;
  speed: 'fastest' | 'fast' | 'medium' | 'slow';
  quality: 'lowest' | 'low' | 'medium' | 'high' | 'highest';
  downloaded: boolean;
}

const AIModelsPanel: React.FC = () => {
  const settings = useSettings();

  const [whisperModels, setWhisperModels] = useState<WhisperModel[]>([
    { name: 'tiny', size: '39 MB', speed: 'fastest', quality: 'lowest', downloaded: true },
    { name: 'base', size: '74 MB', speed: 'fast', quality: 'low', downloaded: true },
    { name: 'small', size: '244 MB', speed: 'fast', quality: 'medium', downloaded: false },
    { name: 'medium', size: '769 MB', speed: 'medium', quality: 'high', downloaded: false },
    { name: 'large', size: '1.5 GB', speed: 'slow', quality: 'highest', downloaded: false },
    { name: 'turbo', size: '809 MB', speed: 'fast', quality: 'high', downloaded: false },
  ]);

  const [agentName, setAgentName] = useState('');
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);

  useEffect(() => {
    setAgentName(localStorage.getItem('agentName') || '');
  }, []);

  const saveAPIKey = async (provider: string, key: string) => {
    // Save to localStorage via settings setters
    if (provider === 'openai') {
      settings.setOpenaiApiKey(key);
      await window.electronAPI?.saveOpenAIKey(key);
    } else if (provider === 'anthropic') {
      settings.setAnthropicApiKey(key);
      await window.electronAPI?.saveAnthropicKey(key);
    } else if (provider === 'gemini') {
      settings.setGeminiApiKey(key);
      await window.electronAPI?.saveGeminiKey(key);
    }
  };

  const downloadModel = async (modelName: string) => {
    try {
      setDownloadingModel(modelName);

      const result = await window.electronAPI.downloadWhisperModel(modelName);

      if (result.success) {
        // Update the model's downloaded status
        setWhisperModels(prev => prev.map(model =>
          model.name === modelName
            ? { ...model, downloaded: true }
            : model
        ));
      } else {
        console.error('Failed to download model:', result.error);
        alert(`Failed to download ${modelName} model: ${result.error}`);
      }
    } catch (error) {
      console.error('Error downloading model:', error);
      alert(`Error downloading ${modelName} model: ${error}`);
    } finally {
      setDownloadingModel(null);
    }
  };

  const deleteModel = async (modelName: string) => {
    if (!confirm(`Delete ${modelName} model? This will free up disk space but you'll need to re-download it to use it again.`)) {
      return;
    }

    try {
      setDeletingModel(modelName);

      const result = await window.electronAPI.deleteWhisperModel(modelName);

      if (result.success) {
        // Update the model's downloaded status
        setWhisperModels(prev => prev.map(model =>
          model.name === modelName
            ? { ...model, downloaded: false }
            : model
        ));
      } else {
        console.error('Failed to delete model:', result.error);
        alert(`Failed to delete ${modelName} model: ${result.error}`);
      }
    } catch (error) {
      console.error('Error deleting model:', error);
      alert(`Error deleting ${modelName} model: ${error}`);
    } finally {
      setDeletingModel(null);
    }
  };

  const getSpeedBadge = (speed: string) => {
    const colors = {
      fastest: 'bg-green-500/20 text-green-400',
      fast: 'bg-blue-500/20 text-blue-400',
      medium: 'bg-yellow-500/20 text-yellow-400',
      slow: 'bg-red-500/20 text-red-400'
    };
    return colors[speed as keyof typeof colors];
  };

  return (
    <PanelBackground>
      <div className="space-y-6">
      {/* Header with Gradient */}
      <div className="background-holder rounded-2xl overflow-hidden animate-slideIn">
        <div className="background-layer background-gradient"></div>
        <div className="relative p-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Brain className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white font-heading">AI Models</h2>
              <p className="text-white/80">Configure transcription and reasoning models</p>
            </div>
          </div>
        </div>
      </div>

      {/* Whisper Settings */}
      <div className="card glass animate-slideInLeft" style={{ animationDelay: '100ms' }}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Cpu className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-white font-heading">Transcription Engine</h3>
          </div>

          {/* Privacy Explanation with Enhanced Styling */}
          <div className="space-y-4 mb-6">
            <div className="card glass-success hover-lift">
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Shield className="w-5 h-5 text-green-400" />
                  </div>
                  <h4 className="text-sm font-semibold text-green-400">Privacy-First Transcription</h4>
                </div>
                <div className="space-y-2 text-sm text-color-foreground">
                  <p className="flex items-start gap-2">
                    <Lock className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span><strong>All transcription happens locally</strong> on your computer using Whisper</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <Lock className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>Your voice recordings are processed privately on your device</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <Lock className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span><strong>Zero audio data is sent to any server or cloud service</strong></span>
                  </p>
                  <p className="flex items-start gap-2">
                    <Lock className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span>Works completely offline - no internet required for transcription</span>
                  </p>
                </div>
              </div>
            </div>

            <div className="card glass hover-lift">
              <div className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-gradient-to-br from-primary/20 to-accent-purple/20 rounded-lg">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <h4 className="text-sm font-semibold text-primary">Optional AI Agent Mode</h4>
                </div>
                <div className="space-y-2 text-sm text-color-foreground">
                  <p className="flex items-start gap-2">
                    <Brain className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>When you address your agent by name, AI processing activates</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <Cloud className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Only the <strong>transcribed text</strong> (not audio) is sent to your selected LLM</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <Zap className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Agent uses your chosen provider: GPT/Claude/Gemini</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <Shield className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>This app does not store or log your data</span>
                  </p>
                  <p className="flex items-start gap-2">
                    <Lock className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Only your LLM provider sees the text according to their privacy policy</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Model Selection */}
          <div className="space-y-3">
            <p className="text-sm text-color-foreground-muted mb-3 font-medium">Select a Whisper model:</p>
            {whisperModels.map((model, index) => (
              <div
                key={model.name}
                className={cn(
                  "relative overflow-hidden rounded-xl cursor-pointer transition-all duration-300 hover-lift",
                  "animate-slideInLeft",
                  settings.whisperModel === model.name
                    ? "card-active"
                    : "card hover:shadow-lg"
                )}
                style={{ animationDelay: `${200 + index * 50}ms` }}
                onClick={() => model.downloaded && settings.setWhisperModel(model.name)}
              >
                {/* Active indicator gradient */}
                {settings.whisperModel === model.name && (
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent-purple/10 animate-pulse" />
                )}

                <div className="relative p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg transition-all duration-300",
                        settings.whisperModel === model.name
                          ? "bg-gradient-to-br from-primary/30 to-accent-purple/30"
                          : "bg-white/5"
                      )}>
                        <Gauge className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-white text-sm">{model.name}</span>
                          <span className="text-xs text-color-foreground-muted">{model.size}</span>
                        </div>
                        <div className="flex gap-2 mt-1">
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full font-medium",
                            getSpeedBadge(model.speed)
                          )}>
                            {model.speed}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-white/10 text-color-foreground-muted rounded-full">
                            {model.quality} quality
                          </span>
                        </div>
                      </div>
                    </div>
                    {downloadingModel === model.name ? (
                      <div className="flex items-center gap-2">
                        <div className="spinner"></div>
                        <span className="text-xs text-primary animate-pulse">Downloading...</span>
                      </div>
                    ) : deletingModel === model.name ? (
                      <div className="flex items-center gap-2">
                        <div className="spinner"></div>
                        <span className="text-xs text-red-400 animate-pulse">Deleting...</span>
                      </div>
                    ) : model.downloaded ? (
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-green-500/20 rounded-lg">
                          <Check className="w-4 h-4 text-green-400" />
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteModel(model.name);
                          }}
                          className="btn-ghost hover:text-red-400 hover-scale"
                          disabled={deletingModel !== null || settings.whisperModel === model.name}
                          title={settings.whisperModel === model.name ? "Cannot delete active model" : "Delete model"}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadModel(model.name);
                        }}
                        className="btn-primary hover-scale"
                        disabled={downloadingModel !== null || deletingModel !== null}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Agent Settings */}
      <div className="card glass animate-slideInLeft" style={{ animationDelay: '600ms' }}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Brain className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-white font-heading">AI Agent (Voice Processing)</h3>
          </div>

          {/* Agent Name */}
          <div className="mb-6">
            <label className="text-sm text-color-foreground-muted mb-2 block font-medium">Agent Name</label>
            <div className="relative">
              <Input
                placeholder="e.g., Jarvis, Assistant, Helper"
                value={agentName}
                onChange={(e) => {
                  setAgentName(e.target.value);
                  localStorage.setItem('agentName', e.target.value);
                }}
                className="input-field glass pr-10"
              />
              <Sparkles className="w-4 h-4 text-primary absolute right-3 top-1/2 -translate-y-1/2" />
            </div>
            <p className="text-xs text-color-foreground-muted mt-2">
              Say "Hey {agentName || 'Assistant'}" to trigger AI processing
            </p>
          </div>

          {/* OpenAI Section with Tribe Branding */}
          <div className="space-y-4">
            <div className="card hover-lift background-holder overflow-hidden">
              <div className="background-layer bg-gradient-to-br from-green-500/10 to-emerald-500/10"></div>
              <div className="relative p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-green-500/20 to-emerald-500/20 rounded-lg">
                      <Zap className="w-5 h-5 text-green-400" />
                    </div>
                    <span className="font-medium text-white">OpenAI</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      type="password"
                      placeholder="Enter OpenAI API Key"
                      value={settings.openaiApiKey}
                      onChange={(e) => {
                        const key = e.target.value;
                        settings.setOpenaiApiKey(key);
                        window.electronAPI?.saveOpenAIKey(key);
                        settings.setReasoningProvider('openai');
                      }}
                      className="input-field glass pr-10"
                    />
                    {settings.openaiApiKey && (
                      <div className="p-1 bg-green-500/20 rounded absolute right-2 top-1/2 -translate-y-1/2">
                        <Check className="w-3 h-3 text-green-400" />
                      </div>
                    )}
                  </div>
                  <select
                    className="w-full input-field glass text-sm"
                    value={settings.reasoningModel}
                    onChange={(e) => {
                      settings.setReasoningModel(e.target.value);
                    }}
                  >
                    <option value="gpt-5.1-nano">GPT-5.1 Nano (Fastest)</option>
                    <option value="gpt-5.1-mini">GPT-5.1 Mini (Balanced)</option>
                    <option value="gpt-5.1">GPT-5.1 (Most Capable)</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Image Generation Settings */}
      <div className="card glass animate-slideInLeft" style={{ animationDelay: '700ms' }}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-white font-heading">Image Generation</h3>
          </div>
          <p className="text-sm text-color-foreground-muted mb-6">
            Press <kbd className="kbd-key">Shift</kbd> + <kbd className="kbd-key">[hotkey]</kbd> to generate AI images
          </p>

          {/* Google Gemini Section with Tribe Branding */}
          <div className="space-y-4">
            <div className="card hover-lift background-holder overflow-hidden">
              <div className="background-layer bg-gradient-to-br from-blue-500/10 to-indigo-500/10"></div>
              <div className="relative p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-lg">
                      <Cloud className="w-5 h-5 text-blue-400" />
                    </div>
                    <span className="font-medium text-white">Google Gemini</span>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="relative">
                    <Input
                      type="password"
                      placeholder="Enter Gemini API Key"
                      value={settings.geminiApiKey}
                      onChange={(e) => {
                        const key = e.target.value;
                        settings.setGeminiApiKey(key);
                        window.electronAPI?.saveGeminiKey(key);
                      }}
                      className="input-field glass pr-10"
                    />
                    {settings.geminiApiKey && (
                      <div className="p-1 bg-green-500/20 rounded absolute right-2 top-1/2 -translate-y-1/2">
                        <Check className="w-3 h-3 text-green-400" />
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-color-foreground-muted mb-2 block font-medium">
                      Image Generation Model
                    </label>
                    <select
                      className="w-full input-field glass text-sm"
                      value={localStorage.getItem('imageGenerationModel') || 'gemini-2.5-flash-image'}
                      onChange={(e) => {
                        localStorage.setItem('imageGenerationModel', e.target.value);
                      }}
                    >
                      <option value="gemini-2.5-flash-image">Nano Banana (Fast)</option>
                      <option value="gemini-3-pro-image-preview">Nano Banana Pro (Higher Quality)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </PanelBackground>
  );
};

export default AIModelsPanel;
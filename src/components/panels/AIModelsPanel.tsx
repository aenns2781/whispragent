import React, { useState, useEffect } from 'react';
import { Cpu, Download, Trash2, Check, AlertCircle, Zap } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { cn } from '../lib/utils';
import { useSettings } from '../../hooks/useSettings';

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
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">AI Models</h2>
        <p className="text-zinc-400">Configure transcription and reasoning models</p>
      </div>

      {/* Whisper Settings */}
      <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Transcription Engine</h3>

        {/* Privacy Explanation */}
        <div className="space-y-4 mb-6">
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <h4 className="text-sm font-semibold text-green-400 mb-2">🔒 Privacy-First Transcription</h4>
            <div className="space-y-2 text-sm text-zinc-300">
              <p>• <strong>All transcription happens locally</strong> on your computer using Whisper</p>
              <p>• Your voice recordings are processed privately on your device</p>
              <p>• <strong>Zero audio data is sent to any server or cloud service</strong></p>
              <p>• Works completely offline - no internet required for transcription</p>
            </div>
          </div>

          <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-400 mb-2">🤖 Optional AI Agent Mode</h4>
            <div className="space-y-2 text-sm text-zinc-300">
              <p>• When you address your agent by name, AI processing activates</p>
              <p>• Only the <strong>transcribed text</strong> (not audio) is sent to your selected LLM</p>
              <p>• Agent uses your chosen provider: GPT/Claude/Gemini</p>
              <p>• This app does not store or log your data</p>
              <p>• Only your LLM provider sees the text according to their privacy policy</p>
            </div>
          </div>
        </div>

        {/* Model Selection */}
        <div className="space-y-3">
          <p className="text-sm text-zinc-400 mb-3">Select a Whisper model:</p>
          {whisperModels.map((model) => (
            <div
              key={model.name}
              className={cn(
                "p-4 border rounded-lg cursor-pointer transition-all",
                settings.whisperModel === model.name
                  ? "bg-blue-500/10 border-blue-500/50"
                  : "bg-zinc-900/30 border-zinc-800 hover:bg-zinc-900/50"
              )}
              onClick={() => model.downloaded && settings.setWhisperModel(model.name)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Cpu className="w-5 h-5 text-zinc-400" />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{model.name}</span>
                      <span className="text-xs text-zinc-500">{model.size}</span>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", getSpeedBadge(model.speed))}>
                        {model.speed}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-full">
                        {model.quality} quality
                      </span>
                    </div>
                  </div>
                </div>
                {downloadingModel === model.name ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                    <span className="text-xs text-blue-400">Downloading...</span>
                  </div>
                ) : deletingModel === model.name ? (
                  <div className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400"></div>
                    <span className="text-xs text-red-400">Deleting...</span>
                  </div>
                ) : model.downloaded ? (
                  <div className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-400" />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteModel(model.name);
                      }}
                      className="text-zinc-400 hover:text-red-400"
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
                    className="bg-blue-600 hover:bg-blue-700"
                    disabled={downloadingModel !== null || deletingModel !== null}
                  >
                    <Download className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Agent Settings */}
      <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">AI Agent (Voice Processing)</h3>

        {/* Agent Name */}
        <div className="mb-6">
          <label className="text-sm text-zinc-400 mb-2 block">Agent Name</label>
          <Input
            placeholder="e.g., Jarvis, Assistant, Helper"
            value={agentName}
            onChange={(e) => {
              setAgentName(e.target.value);
              localStorage.setItem('agentName', e.target.value);
            }}
            className="bg-zinc-900 border-zinc-700"
          />
          <p className="text-xs text-zinc-500 mt-2">
            Say "Hey {agentName || 'Assistant'}" to trigger AI processing
          </p>
        </div>

        {/* OpenAI Section */}
        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-green-500/10 border-green-500/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-green-400" />
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
                  className="bg-zinc-900 border-zinc-700 text-sm pr-10"
                />
                {settings.openaiApiKey && (
                  <Check className="w-4 h-4 text-green-400 absolute right-3 top-1/2 -translate-y-1/2" />
                )}
              </div>
              <select
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
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

      {/* Image Generation Settings */}
      <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Image Generation</h3>
        <p className="text-sm text-zinc-400 mb-4">
          Press Shift + [your hotkey] to generate AI images
        </p>

        {/* Google Gemini Section */}
        <div className="space-y-4">
          <div className="p-4 border rounded-lg bg-blue-500/10 border-blue-500/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-blue-400" />
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
                  className="bg-zinc-900 border-zinc-700 text-sm pr-10"
                />
                {settings.geminiApiKey && (
                  <Check className="w-4 h-4 text-green-400 absolute right-3 top-1/2 -translate-y-1/2" />
                )}
              </div>
              <div>
                <label className="text-sm text-zinc-400 mb-2 block">Image Generation Model</label>
                <select
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
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
  );
};

export default AIModelsPanel;
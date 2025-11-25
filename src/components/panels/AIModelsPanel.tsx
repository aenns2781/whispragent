import React, { useState, useEffect } from 'react';
import { Cpu, Zap, Shield, Brain, Sparkles, Cloud, Check } from 'lucide-react';
import { Input } from '../ui/input';
import { useSettings } from '../../hooks/useSettings';
import PanelBackground from '../PanelBackground';
import WhisperModelPicker from '../WhisperModelPicker';

const AIModelsPanel: React.FC = () => {
  const settings = useSettings();
  const [agentName, setAgentName] = useState('');

  useEffect(() => {
    setAgentName(localStorage.getItem('agentName') || '');
  }, []);

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

          {/* Privacy Note - Simplified */}
          <div className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg mb-6">
            <Shield className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-zinc-300">
              <span className="text-green-400 font-medium">100% Local & Private</span> — All transcription runs on your device. No audio ever leaves your computer.
            </p>
          </div>

          {/* Model Selection */}
          <div className="mt-6">
            <WhisperModelPicker
              selectedModel={settings.whisperModel}
              onModelSelect={(model) => settings.setWhisperModel(model)}
              variant="settings"
            />
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
                    <option value="gpt-5-nano">GPT-5 Nano (Fastest)</option>
                    <option value="gpt-5-mini">GPT-5 Mini (Balanced)</option>
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
import React, { useState, useEffect } from 'react';
import { Cpu, Zap, Shield, Brain, Sparkles, Cloud, Check, ExternalLink, Mic, Lock } from 'lucide-react';
import { Input } from '../ui/input';
import { useSettings } from '../../hooks/useSettings';
import PanelBackground from '../PanelBackground';
import WhisperModelPicker from '../WhisperModelPicker';
import type { TranscriptionEngine } from '../../hooks/useSettings';
import { sanitizeAgentName } from '../../utils/agentName';

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

      {/* Transcription Engine Selection */}
      <div className="card glass animate-slideInLeft" style={{ animationDelay: '100ms' }}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Mic className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-white font-heading">Transcription Engine</h3>
          </div>

          {/* Engine Selection Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {/* Local Whisper Option */}
            <button
              onClick={() => {
                settings.setTranscriptionEngine('local');
                // Sync to main process for cross-window access
                window.electronAPI?.setTranscriptionEngine('local');
              }}
              className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                settings.transcriptionEngine === 'local'
                  ? 'border-green-500/50 bg-green-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              {settings.transcriptionEngine === 'local' && (
                <div className="absolute top-2 right-2 p-1 bg-green-500/20 rounded-full">
                  <Check className="w-3 h-3 text-green-400" />
                </div>
              )}
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Lock className="w-4 h-4 text-green-400" />
                </div>
                <span className="font-medium text-white">Local</span>
              </div>
              <p className="text-xs text-zinc-400 mb-2">100% private - runs on your device</p>
              <div className="flex flex-wrap gap-1">
                <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded">Private</span>
                <span className="px-2 py-0.5 text-xs bg-zinc-500/20 text-zinc-400 rounded">Offline</span>
              </div>
            </button>

            {/* ElevenLabs Cloud Option */}
            <button
              onClick={() => {
                settings.setTranscriptionEngine('elevenlabs');
                // Sync to main process for cross-window access
                window.electronAPI?.setTranscriptionEngine('elevenlabs');
                // Default to real-time mode when ElevenLabs is selected
                settings.setUseRealtimeTranscription(true);
                window.electronAPI?.setRealtimeTranscriptionEnabled(true);
              }}
              className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                settings.transcriptionEngine === 'elevenlabs'
                  ? 'border-purple-500/50 bg-purple-500/10'
                  : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
              }`}
            >
              {settings.transcriptionEngine === 'elevenlabs' && (
                <div className="absolute top-2 right-2 p-1 bg-purple-500/20 rounded-full">
                  <Check className="w-3 h-3 text-purple-400" />
                </div>
              )}
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <Cloud className="w-4 h-4 text-purple-400" />
                </div>
                <span className="font-medium text-white">ElevenLabs</span>
              </div>
              <p className="text-xs text-zinc-400 mb-2">Fastest & most accurate</p>
              <div className="flex flex-wrap gap-1">
                <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded">Fast</span>
                <span className="px-2 py-0.5 text-xs bg-pink-500/20 text-pink-400 rounded">Accurate</span>
              </div>
            </button>
          </div>

          {/* Show ElevenLabs API Key input when cloud is selected */}
          {settings.transcriptionEngine === 'elevenlabs' && (
            <>
              <div className="card hover-lift background-holder overflow-hidden mb-4">
                <div className="background-layer bg-gradient-to-br from-purple-500/10 to-pink-500/10"></div>
                <div className="relative p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg">
                        <Cloud className="w-5 h-5 text-purple-400" />
                      </div>
                      <span className="font-medium text-white">ElevenLabs API Key</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="relative">
                      <Input
                        type="password"
                        placeholder="Enter ElevenLabs API Key"
                        value={settings.elevenlabsApiKey}
                        onChange={(e) => {
                          const key = e.target.value;
                          settings.setElevenlabsApiKey(key);
                          window.electronAPI?.saveElevenlabsKey(key);
                        }}
                        className="input-field glass pr-10"
                      />
                      {settings.elevenlabsApiKey && (
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
                      <ExternalLink className="w-3 h-3" />
                      Don't have a key? Get one from ElevenLabs
                    </a>
                  </div>
                </div>
              </div>

              {/* Transcription Mode Toggle */}
              <div className="mb-4">
                <label className="text-sm text-color-foreground-muted mb-2 block font-medium">
                  Transcription Mode
                </label>
                <div className="flex gap-2">
                  {/* Real-time Mode (First/Default) */}
                  <button
                    onClick={() => {
                      settings.setUseRealtimeTranscription(true);
                      window.electronAPI?.setRealtimeTranscriptionEnabled(true);
                    }}
                    className={`relative rounded-xl border-2 transition-all text-left ${
                      settings.useRealtimeTranscription
                        ? 'flex-1 p-3 border-pink-500/50 bg-pink-500/10'
                        : 'px-3 py-2 border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    {settings.useRealtimeTranscription && (
                      <div className="absolute top-2 right-2 p-1 bg-pink-500/20 rounded-full">
                        <Check className="w-3 h-3 text-pink-400" />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Zap className={`w-3 h-3 ${settings.useRealtimeTranscription ? 'text-pink-400' : 'text-zinc-400'}`} />
                      <span className={`font-medium text-sm ${settings.useRealtimeTranscription ? 'text-white' : 'text-zinc-400'}`}>Real-time</span>
                    </div>
                    {settings.useRealtimeTranscription && (
                      <p className="text-xs text-zinc-400 mt-1">Live transcription as you speak <span className="text-zinc-500">· Slightly higher cost</span></p>
                    )}
                  </button>

                  {/* Batch Mode */}
                  <button
                    onClick={() => {
                      settings.setUseRealtimeTranscription(false);
                      window.electronAPI?.setRealtimeTranscriptionEnabled(false);
                    }}
                    className={`relative rounded-xl border-2 transition-all text-left ${
                      !settings.useRealtimeTranscription
                        ? 'flex-1 p-3 border-purple-500/50 bg-purple-500/10'
                        : 'px-3 py-2 border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10'
                    }`}
                  >
                    {!settings.useRealtimeTranscription && (
                      <div className="absolute top-2 right-2 p-1 bg-purple-500/20 rounded-full">
                        <Check className="w-3 h-3 text-purple-400" />
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <span className={`font-medium text-sm ${!settings.useRealtimeTranscription ? 'text-white' : 'text-zinc-400'}`}>Batch</span>
                    </div>
                    {!settings.useRealtimeTranscription && (
                      <p className="text-xs text-zinc-400 mt-1">Transcribe after recording stops</p>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* Show Local Whisper model picker when local is selected */}
          {settings.transcriptionEngine === 'local' && (
            <>
              {/* Privacy Note */}
              <div className="flex items-start gap-3 p-3 bg-green-500/10 border border-green-500/20 rounded-lg mb-6">
                <Shield className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-zinc-300">
                  <span className="text-green-400 font-medium">100% Local & Private</span> — All transcription runs on your device. No audio ever leaves your computer.
                </p>
              </div>

              {/* Model Selection */}
              <div>
                <WhisperModelPicker
                  selectedModel={settings.whisperModel}
                  onModelSelect={(model) => settings.setWhisperModel(model)}
                  variant="settings"
                />
              </div>
            </>
          )}
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
            <label className="text-sm text-color-foreground-muted mb-2 block font-medium">
              Agent Name <span className="text-zinc-500 font-normal">(single word)</span>
            </label>
            <div className="relative">
              <Input
                placeholder="e.g., Jarvis, Alex, Luna"
                value={agentName}
                onChange={(e) => {
                  const sanitized = sanitizeAgentName(e.target.value);
                  setAgentName(sanitized);
                  localStorage.setItem('agentName', sanitized);
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
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      window.electronAPI?.openExternal('https://platform.openai.com/api-keys');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Don't have a key? Get one from OpenAI
                  </a>
                  <select
                    className="w-full input-field glass text-sm"
                    value={settings.reasoningModel}
                    onChange={(e) => {
                      settings.setReasoningModel(e.target.value);
                    }}
                  >
                    <option value="gpt-5.1">GPT-5.1 (Most Capable)</option>
                    <option value="gpt-5-mini">GPT-5 Mini (Balanced)</option>
                    <option value="gpt-5-nano">GPT-5 Nano (Fastest)</option>
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
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      window.electronAPI?.openExternal('https://aistudio.google.com/apikey');
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Don't have a key? Get one from Google AI Studio
                  </a>
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
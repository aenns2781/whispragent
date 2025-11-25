import React, { useState, useEffect } from 'react';
import { Palette, Power } from 'lucide-react';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import PanelBackground from '../PanelBackground';

const StylePanel: React.FC = () => {
  const [styleInstructions, setStyleInstructions] = useState('');
  const [isEnabled, setIsEnabled] = useState(() => {
    const saved = localStorage.getItem('styleEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });

  useEffect(() => {
    // Load saved style instructions
    const saved = localStorage.getItem('styleInstructions');
    if (saved) {
      setStyleInstructions(saved);
    } else {
      // Set a helpful default
      const defaultInstructions = 'Use professional tone, proper grammar, and clear formatting.';
      setStyleInstructions(defaultInstructions);
      localStorage.setItem('styleInstructions', defaultInstructions);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('styleEnabled', JSON.stringify(isEnabled));
  }, [isEnabled]);

  const handleStyleChange = (value: string) => {
    setStyleInstructions(value);
    localStorage.setItem('styleInstructions', value);
  };

  return (
    <div className="relative min-h-full">
      <PanelBackground />
      <div className="relative space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
              <Palette className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white font-heading">Style Guide</h1>
              <p className="text-sm text-zinc-400 mt-0.5">
                Custom instructions for your AI agent's writing style
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 px-4 py-2 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
            <Power className={`w-4 h-4 transition-colors ${isEnabled ? 'text-green-400' : 'text-zinc-500'}`} />
            <span className="text-sm text-zinc-300">
              {isEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <Switch
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
            />
          </div>
        </div>

        {/* Style Instructions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-300">
              Style Instructions
            </label>
            <span className="text-xs text-zinc-500">
              {styleInstructions.length} characters
            </span>
          </div>

          <Textarea
            value={styleInstructions}
            onChange={(e) => handleStyleChange(e.target.value)}
            placeholder="e.g., Use professional tone, keep sentences concise, format as bullet points..."
            className="min-h-[200px] bg-zinc-900/50 border-zinc-700/50 text-zinc-100 placeholder:text-zinc-500 resize-none"
            disabled={!isEnabled}
          />

          <p className="text-xs text-zinc-500 leading-relaxed">
            These instructions will be added to the system prompt when agent mode is active.
            Be specific about tone, formatting, capitalization, punctuation, or any other style preferences.
          </p>
        </div>

        {/* Examples */}
        <div className="p-4 bg-zinc-900/50 border border-zinc-700/50 rounded-xl space-y-3">
          <h3 className="text-sm font-semibold text-zinc-300">Example Instructions:</h3>
          <div className="space-y-2 text-xs text-zinc-400">
            <p>• "Use professional business tone with proper punctuation"</p>
            <p>• "Write casually, like texting a friend"</p>
            <p>• "Be technical and precise, use bullet points"</p>
            <p>• "Keep everything lowercase, minimal punctuation"</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StylePanel;

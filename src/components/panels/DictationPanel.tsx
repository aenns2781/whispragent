import React, { useState, useEffect } from 'react';
import { Keyboard, Camera } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../lib/utils';
import PanelBackground from '../PanelBackground';

const DictationPanel: React.FC = () => {
  const [hotkey, setHotkey] = useState('`');
  const [screenshotKey, setScreenshotKey] = useState('Cmd+`');
  const [isListening, setIsListening] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    const savedHotkey = localStorage.getItem('hotkey') || '`';
    const savedScreenshot = localStorage.getItem('screenshotKey') || 'Cmd+`';

    setHotkey(savedHotkey);
    setScreenshotKey(savedScreenshot);
  };

  const captureHotkey = () => {
    setIsListening(true);
    // Would implement key capture here
    setTimeout(() => {
      setIsListening(false);
    }, 3000);
  };

  return (
    <PanelBackground>
      <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Dictation Settings</h2>
        <p className="text-zinc-400">Configure how you control voice input</p>
      </div>

      {/* Recording Hotkey */}
      <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Keyboard className="w-5 h-5 text-blue-400" />
          Recording Hotkey
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Toggle Recording</label>
            <div className="flex gap-2">
              <Input
                value={isListening ? 'Press a key...' : hotkey}
                readOnly
                className={cn(
                  "font-mono bg-zinc-900 border-zinc-700",
                  isListening && "border-blue-500 animate-pulse"
                )}
              />
              <Button
                onClick={captureHotkey}
                variant="outline"
                className="border-zinc-700"
              >
                {isListening ? 'Listening...' : 'Change'}
              </Button>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Press this key to start/stop recording
            </p>
          </div>
        </div>
      </div>

      {/* Screenshot Capture */}
      <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Camera className="w-5 h-5 text-purple-400" />
          Screenshot Capture
        </h3>

        <div>
          <label className="text-sm text-zinc-400 mb-2 block">Screenshot + Voice</label>
          <Input
            value={screenshotKey}
            readOnly
            className="font-mono bg-zinc-900 border-zinc-700"
          />
          <p className="text-xs text-zinc-500 mt-2">
            Capture screen and describe with voice
          </p>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-sm text-blue-400">
          💡 Tip: The backtick (`) key works best for agent mode. If you're having issues with
          other keys, try switching back to backtick.
        </p>
      </div>
      </div>
    </PanelBackground>
  );
};

export default DictationPanel;
import React, { useState, useEffect } from 'react';
import { Keyboard, Mic, Camera, Globe } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { cn } from '../lib/utils';
import PanelBackground from '../PanelBackground';

const DictationPanel: React.FC = () => {
  const [hotkey, setHotkey] = useState('`');
  const [screenshotKey, setScreenshotKey] = useState('Cmd+`');
  const [isListening, setIsListening] = useState(false);
  const [useGlobeKey, setUseGlobeKey] = useState(false);
  const [autoPaste, setAutoPaste] = useState(true);
  const [pauseDuration, setPauseDuration] = useState(2);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = () => {
    const savedHotkey = localStorage.getItem('hotkey') || '`';
    const savedScreenshot = localStorage.getItem('screenshotKey') || 'Cmd+`';
    const savedAutoPaste = localStorage.getItem('autoPaste') !== 'false';
    const savedPause = parseInt(localStorage.getItem('pauseDuration') || '2');

    setHotkey(savedHotkey);
    setScreenshotKey(savedScreenshot);
    setAutoPaste(savedAutoPaste);
    setPauseDuration(savedPause);
  };

  const saveSettings = (key: string, value: any) => {
    localStorage.setItem(key, value.toString());
    // Also send to main process
    window.electronAPI?.updateSetting(key, value);
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

          {/* Globe Key Option (macOS only) */}
          {window.navigator.platform.includes('Mac') && (
            <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg">
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-zinc-400" />
                <div>
                  <p className="text-sm text-white">Use Globe Key (Fn)</p>
                  <p className="text-xs text-zinc-500">Experimental - requires macOS 13+</p>
                </div>
              </div>
              <Switch
                checked={useGlobeKey}
                onCheckedChange={(checked) => {
                  setUseGlobeKey(checked);
                  setHotkey(checked ? 'Globe' : '`');
                  saveSettings('hotkey', checked ? 'Globe' : '`');
                }}
              />
            </div>
          )}
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

      {/* Behavior Settings */}
      <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Mic className="w-5 h-5 text-green-400" />
          Recording Behavior
        </h3>

        <div className="space-y-4">
          {/* Auto Paste */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Auto-paste after recording</p>
              <p className="text-xs text-zinc-500">Automatically paste transcribed text</p>
            </div>
            <Switch
              checked={autoPaste}
              onCheckedChange={(checked) => {
                setAutoPaste(checked);
                saveSettings('autoPaste', checked);
              }}
            />
          </div>

          {/* Pause Duration */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">
              Silence detection ({pauseDuration}s)
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={pauseDuration}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setPauseDuration(value);
                saveSettings('pauseDuration', value);
              }}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-zinc-500 mt-1">
              <span>1s</span>
              <span>3s</span>
              <span>5s</span>
            </div>
          </div>
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
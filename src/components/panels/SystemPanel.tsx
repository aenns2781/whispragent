import React, { useState, useEffect } from 'react';
import { Monitor, Volume2, Globe2, Shield, HardDrive, Trash2, Folder } from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { cn } from '../lib/utils';
import { getTranscriptionCount } from '../../stores/transcriptionStore';

const SystemPanel: React.FC = () => {
  const [audioDevice, setAudioDevice] = useState('default');
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [language, setLanguage] = useState('auto');
  const [launchAtStartup, setLaunchAtStartup] = useState(false);
  const [showInDock, setShowInDock] = useState(true);
  const [transcriptionCount, setTranscriptionCount] = useState(0);
  const [deletingHistory, setDeletingHistory] = useState(false);
  const [imageSavePath, setImageSavePath] = useState('');

  useEffect(() => {
    loadSettings();
    loadAudioDevices();
    loadTranscriptionCount();
  }, []);

  const loadTranscriptionCount = async () => {
    const count = await getTranscriptionCount();
    setTranscriptionCount(count);
  };

  const loadSettings = () => {
    setLanguage(localStorage.getItem('language') || 'auto');
    setLaunchAtStartup(localStorage.getItem('launchAtStartup') === 'true');
    setShowInDock(localStorage.getItem('showInDock') !== 'false');
    setAudioDevice(localStorage.getItem('audioDevice') || 'default');

    // Load image save path - default to Downloads folder
    const isMac = window.navigator.platform.includes('Mac');
    const isWindows = window.navigator.platform.includes('Win');
    const defaultPath = isMac || !isWindows
      ? '~/Downloads/TribeWhisper'
      : '%USERPROFILE%\\Downloads\\TribeWhisper';
    setImageSavePath(localStorage.getItem('imageSavePath') || defaultPath);
  };

  const selectImageSaveFolder = async () => {
    try {
      // Use electron dialog to select folder
      const result = await window.electronAPI.openDirectoryDialog();
      if (result && !result.canceled && result.filePaths?.length > 0) {
        const selectedPath = result.filePaths[0];
        setImageSavePath(selectedPath);
        localStorage.setItem('imageSavePath', selectedPath);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
      alert('Failed to select folder. Please try again.');
    }
  };

  const loadAudioDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(device => device.kind === 'audioinput');
      setAudioDevices(audioInputs);
    } catch (error) {
      console.error('Failed to load audio devices:', error);
    }
  };

  const clearTranscriptionHistory = async () => {
    if (!confirm(`Delete all ${transcriptionCount} transcriptions? This cannot be undone.`)) {
      return;
    }

    try {
      setDeletingHistory(true);
      await window.electronAPI.clearTranscriptionHistory();
      setTranscriptionCount(0);
      alert('Transcription history cleared successfully');
    } catch (error) {
      console.error('Failed to clear history:', error);
      alert(`Failed to clear history: ${error}`);
    } finally {
      setDeletingHistory(false);
    }
  };

  const languages = [
    { code: 'auto', label: 'Auto-detect' },
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Spanish' },
    { code: 'fr', label: 'French' },
    { code: 'de', label: 'German' },
    { code: 'it', label: 'Italian' },
    { code: 'pt', label: 'Portuguese' },
    { code: 'ru', label: 'Russian' },
    { code: 'ja', label: 'Japanese' },
    { code: 'ko', label: 'Korean' },
    { code: 'zh', label: 'Chinese' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">System Settings</h2>
        <p className="text-zinc-400">Configure system-level preferences</p>
      </div>

      {/* Audio Settings */}
      <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Volume2 className="w-5 h-5 text-green-400" />
          Audio Settings
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Input Device</label>
            <select
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
              value={audioDevice}
              onChange={(e) => {
                setAudioDevice(e.target.value);
                localStorage.setItem('audioDevice', e.target.value);
              }}
            >
              <option value="default">System Default</option>
              {audioDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Transcription Language</label>
            <select
              className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white"
              value={language}
              onChange={(e) => {
                setLanguage(e.target.value);
                localStorage.setItem('language', e.target.value);
              }}
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-zinc-500 mt-2">
              Set to auto-detect or choose a specific language for better accuracy
            </p>
          </div>
        </div>
      </div>

      {/* App Behavior */}
      <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Monitor className="w-5 h-5 text-blue-400" />
          App Behavior
        </h3>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Launch at startup</p>
              <p className="text-xs text-zinc-500">Start Tribe Whisper when you log in</p>
            </div>
            <Switch
              checked={launchAtStartup}
              onCheckedChange={(checked) => {
                setLaunchAtStartup(checked);
                localStorage.setItem('launchAtStartup', checked.toString());
                window.electronAPI?.updateSetting('launchAtStartup', checked);
              }}
            />
          </div>

          {window.navigator.platform.includes('Mac') && (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white">Show in Dock</p>
                <p className="text-xs text-zinc-500">Display app icon in the macOS dock</p>
              </div>
              <Switch
                checked={showInDock}
                onCheckedChange={(checked) => {
                  setShowInDock(checked);
                  localStorage.setItem('showInDock', checked.toString());
                  window.electronAPI?.updateSetting('showInDock', checked);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Data Management */}
      <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <HardDrive className="w-5 h-5 text-purple-400" />
          Data Management
        </h3>

        <div className="space-y-4">
          <div className="p-4 bg-zinc-900/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-zinc-400">Transcription History</span>
              <span className="text-sm text-white font-mono">{transcriptionCount} items</span>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              All your transcriptions are stored locally on your device
            </p>
          </div>

          <Button
            variant="outline"
            onClick={clearTranscriptionHistory}
            disabled={deletingHistory || transcriptionCount === 0}
            className="w-full border-zinc-700 text-zinc-300 hover:text-white hover:border-red-500 hover:text-red-400"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            {deletingHistory ? 'Deleting...' : 'Clear Transcription History'}
          </Button>

          <p className="text-xs text-zinc-500">
            Note: Whisper models are managed in the AI Models section
          </p>
        </div>
      </div>

      {/* Storage Settings */}
      <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Folder className="w-5 h-5 text-yellow-400" />
          Storage Settings
        </h3>

        <div className="space-y-4">
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Generated Images Save Location</label>
            <div className="flex gap-2">
              <div className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-white overflow-hidden">
                <span className="truncate block">{imageSavePath}</span>
              </div>
              <Button
                variant="outline"
                onClick={selectImageSaveFolder}
                className="border-zinc-700 text-zinc-300 hover:text-white hover:border-yellow-500"
              >
                <Folder className="w-4 h-4 mr-2" />
                Browse
              </Button>
            </div>
            <p className="text-xs text-zinc-500 mt-2">
              Images generated with AI will be saved to this folder
            </p>
          </div>
        </div>
      </div>

      {/* Privacy */}
      <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-red-400" />
          Privacy & Security
        </h3>

        <div className="space-y-3">
          <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-sm text-green-400">
              ✓ Local processing mode enabled - Audio never leaves your device
            </p>
          </div>

          <div className="text-sm text-zinc-400 space-y-2">
            <p>• Transcriptions stored locally in encrypted database</p>
            <p>• API keys stored in system keychain when available</p>
            <p>• No telemetry or usage tracking</p>
            <p>• Open source and auditable</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemPanel;
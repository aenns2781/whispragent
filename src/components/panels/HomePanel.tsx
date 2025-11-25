import React, { useState, useEffect } from 'react';
import { Mic, Camera, Image, MessageSquare, Clock, Keyboard } from 'lucide-react';
import PanelBackground from '../PanelBackground';
import { formatHotkeyLabel } from '../../utils/hotkeys';

const HomePanel: React.FC = () => {
  const [stats, setStats] = useState({
    todayWords: 0,
    weekWords: 0,
    totalWords: 0,
    totalTranscriptions: 0,
    timeSaved: 0,
    lastTranscription: null as string | null
  });
  const [dictationKey, setDictationKey] = useState('`');
  const [isMac, setIsMac] = useState(false);
  const [agentName, setAgentName] = useState('');

  useEffect(() => {
    loadStats();
    const savedKey = localStorage.getItem('dictationKey') || '`';
    setDictationKey(savedKey);
    setIsMac(window.navigator.platform.includes('Mac'));
    const savedAgentName = localStorage.getItem('agentName') || '';
    setAgentName(savedAgentName);
  }, []);

  const loadStats = async () => {
    try {
      const history = await window.electronAPI.getTranscriptions(1000);
      const today = new Date();
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(today.getDate() - 7);

      const todayTranscriptions = history.filter((t: any) => {
        const transcriptDate = new Date(t.timestamp);
        return transcriptDate.toDateString() === today.toDateString();
      });

      const weekTranscriptions = history.filter((t: any) => {
        const transcriptDate = new Date(t.timestamp);
        return transcriptDate >= oneWeekAgo;
      });

      const todayWords = todayTranscriptions.reduce((sum: number, t: any) =>
        sum + (t.text?.split(' ').filter((w: string) => w.length > 0).length || 0), 0
      );

      const weekWords = weekTranscriptions.reduce((sum: number, t: any) =>
        sum + (t.text?.split(' ').filter((w: string) => w.length > 0).length || 0), 0
      );

      const totalWords = history.reduce((sum: number, t: any) =>
        sum + (t.text?.split(' ').filter((w: string) => w.length > 0).length || 0), 0
      );

      const typingTimeMinutes = totalWords / 75;
      const effectiveSpeakingTimeMinutes = totalWords / 140;
      const timeSavedMinutes = Math.max(0, typingTimeMinutes - effectiveSpeakingTimeMinutes);

      const totalCount = await window.electronAPI.getTranscriptionCount();

      setStats({
        todayWords,
        weekWords,
        totalWords,
        totalTranscriptions: totalCount,
        timeSaved: Math.round(timeSavedMinutes),
        lastTranscription: history[0]?.text || null
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleHistoryClick = () => {
    if (window.electronAPI?.navigateToHistory) {
      window.electronAPI.navigateToHistory();
    } else {
      window.dispatchEvent(new CustomEvent('navigate-to-history'));
    }
  };

  const formatTimeSaved = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes}m`;
    } else if (minutes < 1440) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    } else {
      const days = Math.floor(minutes / 1440);
      const remainingHours = Math.floor((minutes % 1440) / 60);
      return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
    }
  };

  const formatNumber = (num: number) => num.toLocaleString();

  const hotkeyLabel = dictationKey === 'GLOBE' ? 'fn' : formatHotkeyLabel(dictationKey);
  const cmdKey = isMac ? '⌘' : 'Ctrl';
  const shiftKey = '⇧';

  // Keyboard shortcut component
  const KeyCombo: React.FC<{ keys: string[] }> = ({ keys }) => (
    <div className="flex items-center gap-1">
      {keys.map((key, i) => (
        <React.Fragment key={i}>
          {i > 0 && <span className="text-zinc-600 text-xs">+</span>}
          <kbd className="min-w-[28px] h-7 px-2 bg-zinc-800 border border-zinc-700 rounded-md text-xs font-medium text-white flex items-center justify-center shadow-[0_2px_0_0_rgba(0,0,0,0.3)] hover:bg-zinc-750 transition-colors">
            {key}
          </kbd>
        </React.Fragment>
      ))}
    </div>
  );

  const shortcuts = [
    {
      keys: [hotkeyLabel],
      label: 'Voice to text',
      description: 'Start/stop recording',
      icon: Mic,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
      borderColor: 'border-green-500/20'
    },
    {
      keys: [cmdKey, hotkeyLabel],
      label: 'Screenshot + voice',
      description: 'Capture screen with voice command',
      icon: Camera,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20'
    },
    {
      keys: [shiftKey, hotkeyLabel],
      label: 'Image generation',
      description: 'Create images with AI',
      icon: Image,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
      borderColor: 'border-purple-500/20'
    },
    {
      keys: [],
      label: 'Agent mode',
      description: 'Select text first, then record',
      icon: MessageSquare,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20'
    }
  ];

  return (
    <PanelBackground>
      <div className="space-y-5">
        {/* Welcome Header with Stats */}
        <div className="flex items-start justify-between pt-2">
          <div>
            <h2 className="text-2xl font-bold text-white">Welcome back</h2>
            <p className="text-zinc-400 text-sm mt-1">Your AI-powered voice assistant</p>
          </div>

          {/* Compact Stats - Top Right */}
          <div className="flex items-center gap-3 text-right">
            <div>
              <p className="text-sm font-semibold text-white">{formatNumber(stats.todayWords)} <span className="text-zinc-500 font-normal">words</span></p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Today</p>
            </div>
            <div className="w-px h-6 bg-zinc-800"></div>
            <div>
              <p className="text-sm font-semibold text-white">{formatNumber(stats.weekWords)} <span className="text-zinc-500 font-normal">words</span></p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">This Week</p>
            </div>
            <div className="w-px h-6 bg-zinc-800"></div>
            <div>
              <p className="text-sm font-semibold text-emerald-400">{formatTimeSaved(stats.timeSaved)}</p>
              <p className="text-[10px] text-zinc-500 uppercase tracking-wide">Saved</p>
            </div>
          </div>
        </div>

        {/* Keyboard Shortcuts - Main Focus */}
        <div className="bg-zinc-900/60 backdrop-blur border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Keyboard className="w-5 h-5 text-zinc-400" />
            <h3 className="text-base font-semibold text-white">Keyboard Shortcuts</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {shortcuts.map((shortcut, index) => {
              const Icon = shortcut.icon;
              return (
                <div
                  key={index}
                  className={`flex items-center gap-4 p-3 rounded-lg ${shortcut.bgColor} border ${shortcut.borderColor} transition-all hover:scale-[1.02]`}
                >
                  <div className={`w-9 h-9 rounded-lg bg-zinc-900/50 flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${shortcut.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-white">{shortcut.label}</span>
                      {shortcut.keys.length > 0 ? (
                        <KeyCombo keys={shortcut.keys} />
                      ) : (
                        <span className="text-xs text-zinc-500 italic">Select text first</span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5 truncate">{shortcut.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pro tip */}
          <div className="mt-4 pt-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-500">
              <span className="text-zinc-400 font-medium">Pro tip:</span>{' '}
              {agentName ? (
                <>Say "<span className="text-amber-400 font-medium">Hey {agentName}</span>" to activate smart commands while recording.</>
              ) : (
                <>Set an agent name in AI Models to activate smart commands while recording.</>
              )}
            </p>
          </div>
        </div>

        {/* Last Transcription */}
        {stats.lastTranscription && (
          <div
            className="bg-zinc-900/40 border border-zinc-800/50 rounded-lg p-4 cursor-pointer hover:bg-zinc-900/60 transition-colors"
            onClick={handleHistoryClick}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs text-zinc-500">Last transcription</span>
              </div>
              <span className="text-xs text-blue-400 hover:text-blue-300">View history →</span>
            </div>
            <p className="text-sm text-zinc-300 line-clamp-2">
              {stats.lastTranscription}
            </p>
          </div>
        )}
      </div>
    </PanelBackground>
  );
};

export default HomePanel;

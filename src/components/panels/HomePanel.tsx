import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Zap, Clock, TrendingUp } from 'lucide-react';

const HomePanel: React.FC = () => {
  const [stats, setStats] = useState({
    todayWords: 0,
    weekWords: 0,
    totalTranscriptions: 0,
    avgWPM: 0,
    lastTranscription: null as string | null
  });

  useEffect(() => {
    // Load stats from database
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const history = await window.electronAPI.getTranscriptions(100);
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

      const totalCount = await window.electronAPI.getTranscriptionCount();

      setStats({
        todayWords,
        weekWords,
        totalTranscriptions: todayTranscriptions.length,
        avgWPM: 0, // Not calculating WPM as we don't track recording duration
        lastTranscription: history[0]?.text || null
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Welcome back</h2>
        <p className="text-zinc-400">Your voice-to-text command center</p>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Zap className="w-4 h-4 text-blue-400" />
            </div>
            <span className="text-sm text-zinc-400">Today</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.todayWords}</p>
          <p className="text-xs text-zinc-500 mt-1">words transcribed</p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-500/20 rounded-lg">
              <TrendingUp className="w-4 h-4 text-green-400" />
            </div>
            <span className="text-sm text-zinc-400">This Week</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.weekWords}</p>
          <p className="text-xs text-zinc-500 mt-1">words total</p>
        </div>

        <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Mic className="w-4 h-4 text-purple-400" />
            </div>
            <span className="text-sm text-zinc-400">Sessions</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalTranscriptions}</p>
          <p className="text-xs text-zinc-500 mt-1">today</p>
        </div>

      </div>

      {/* Quick Start Guide */}
      <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Quick Start</h3>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-medium">1</div>
            <p className="text-sm text-zinc-300">Press <kbd className="px-2 py-1 bg-zinc-800 rounded text-xs font-mono">`</kbd> to start recording</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-medium">2</div>
            <p className="text-sm text-zinc-300">Speak naturally - Tribe Whisper transcribes your speech</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-medium">3</div>
            <p className="text-sm text-zinc-300">Press <kbd className="px-2 py-1 bg-zinc-800 rounded text-xs font-mono">`</kbd> again to stop and paste</p>
          </div>
        </div>
      </div>

      {/* Last Transcription Preview */}
      {stats.lastTranscription && (
        <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">Last Transcription</h3>
          <p className="text-sm text-zinc-300 line-clamp-3">{stats.lastTranscription}</p>
        </div>
      )}
    </div>
  );
};

export default HomePanel;
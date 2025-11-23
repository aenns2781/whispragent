import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Zap, Clock, TrendingUp, Sparkles, Activity, Target, Timer } from 'lucide-react';
import PanelBackground from '../PanelBackground';

const HomePanel: React.FC = () => {
  const [stats, setStats] = useState({
    todayWords: 0,
    weekWords: 0,
    totalWords: 0,
    totalTranscriptions: 0,
    timeSaved: 0, // in minutes
    lastTranscription: null as string | null
  });

  useEffect(() => {
    // Load stats from database
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const history = await window.electronAPI.getTranscriptions(1000); // Get more for total calculation
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

      // Calculate total words from all history
      const totalWords = history.reduce((sum: number, t: any) =>
        sum + (t.text?.split(' ').filter((w: string) => w.length > 0).length || 0), 0
      );

      // Calculate time saved with realistic estimates
      // Fast typing speed for power users: 75 WPM
      // Average speaking speed: 160 WPM
      // But account for corrections and pauses: effective 140 WPM
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
    // Emit event to navigate to history
    if (window.electronAPI?.navigateToHistory) {
      window.electronAPI.navigateToHistory();
    } else {
      // Fallback: dispatch custom event for the parent component to handle
      window.dispatchEvent(new CustomEvent('navigate-to-history'));
    }
  };

  // Helper function to format time saved
  const formatTimeSaved = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    } else if (minutes < 1440) { // Less than a day
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`;
    } else {
      const days = Math.floor(minutes / 1440);
      const remainingHours = Math.floor((minutes % 1440) / 60);
      return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days} days`;
    }
  };

  // Format large numbers with commas
  const formatNumber = (num: number) => {
    return num.toLocaleString();
  };

  return (
    <PanelBackground>
      <div className="space-y-6">
        {/* Welcome Header with Gradient */}
        <div className="background-holder rounded-2xl overflow-hidden">
          <div className="background-layer background-gradient"></div>
          <div className="relative p-8 animate-slideIn">
            <h2 className="text-3xl font-bold text-white font-heading">Welcome back</h2>
            <p className="text-white/80 mt-2">Your AI-powered voice command center</p>
          </div>
        </div>

      {/* Compact Stats Display */}
      <div className="card glass hover-lift animate-slideInLeft" style={{ animationDelay: '100ms' }}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white font-heading flex items-center gap-2">
              <Activity className="w-5 h-5 text-primary" />
              Your Impact
            </h3>
            <div className="flex items-center gap-2 text-xs text-color-foreground-muted">
              <Timer className="w-4 h-4" />
              <span>{formatTimeSaved(stats.timeSaved)} saved</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-2xl font-bold text-white animate-float-subtle">{formatNumber(stats.todayWords)}</p>
              <p className="text-xs text-color-foreground-muted">Words Today</p>
            </div>

            <div className="space-y-1">
              <p className="text-2xl font-bold text-white animate-float-subtle">{formatNumber(stats.weekWords)}</p>
              <p className="text-xs text-color-foreground-muted">This Week</p>
            </div>

            <div className="space-y-1">
              <p className="text-2xl font-bold text-white animate-float-subtle">{formatNumber(stats.totalWords)}</p>
              <p className="text-xs text-color-foreground-muted">Total Words</p>
            </div>

            <div className="space-y-1">
              <p className="text-2xl font-bold text-primary animate-float-subtle">{formatTimeSaved(stats.timeSaved)}</p>
              <p className="text-xs text-color-foreground-muted">Time Saved</p>
            </div>
          </div>

          {/* Progress bar showing time saved */}
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between text-xs text-color-foreground-muted mb-2">
              <span>Productivity Boost</span>
              <span>{stats.totalTranscriptions} transcriptions</span>
            </div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-accent-purple rounded-full animate-progress"
                style={{ width: `${Math.min(Math.max((stats.timeSaved / 120) * 100, 0), 100)}%` }}
              ></div>
            </div>
            <p className="text-xs text-color-foreground-muted mt-2 text-center">
              {stats.totalWords > 0
                ? `~${((140 / 75) * 100 - 100).toFixed(0)}% faster than typing at 75 WPM`
                : 'Start transcribing to see your productivity boost!'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Quick Start Guide with Modern Design */}
      <div className="card glass animate-scaleIn" style={{ animationDelay: '400ms' }}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Target className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-white font-heading">Quick Start Guide</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-4 group hover-scale">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent-purple/20 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                1
              </div>
              <p className="text-sm text-color-foreground">
                Press <kbd className="kbd-key ml-1">`</kbd> to start recording
              </p>
            </div>
            <div className="flex items-center gap-4 group hover-scale">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent-purple/20 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                2
              </div>
              <p className="text-sm text-color-foreground">
                Speak naturally - Whisper transcribes in real-time
              </p>
            </div>
            <div className="flex items-center gap-4 group hover-scale">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent-purple/20 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                3
              </div>
              <p className="text-sm text-color-foreground">
                Press <kbd className="kbd-key ml-1">`</kbd> again to stop and paste
              </p>
            </div>
          </div>
        </div>
      </div>

        {/* Last Transcription Preview with Glass Effect */}
        {stats.lastTranscription && (
          <div
            className="card glass animate-fadeIn cursor-pointer hover-lift"
            style={{ animationDelay: '500ms' }}
            onClick={handleHistoryClick}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-color-foreground-muted" />
                  <h3 className="text-sm font-medium text-color-foreground-muted">Last Transcription</h3>
                </div>
                <span className="text-xs text-primary">View all →</span>
              </div>
              <p className="text-sm text-color-foreground text-style-2lines">
                {stats.lastTranscription}
              </p>
            </div>
          </div>
        )}
      </div>
    </PanelBackground>
  );
};

export default HomePanel;
import React, { useState, useEffect } from 'react';
import { X, Plus, Lightbulb, Mail, Link, Phone, MessageSquare } from 'lucide-react';
import { Button } from './ui/button';

interface PhraseSuggestion {
  phrase: string;
  count: number;
  pattern_type: string | null;
  first_seen: string;
  last_seen: string;
}

interface PhraseSuggestionNotificationProps {
  onNavigateToDictionary?: () => void;
  onNavigateToSnippets?: () => void;
}

export const PhraseSuggestionNotification: React.FC<PhraseSuggestionNotificationProps> = ({
  onNavigateToDictionary,
  onNavigateToSnippets,
}) => {
  const [suggestions, setSuggestions] = useState<PhraseSuggestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showSnippetExpansion, setShowSnippetExpansion] = useState(false);
  const [snippetExpansion, setSnippetExpansion] = useState('');

  // Fetch suggestions on mount and periodically
  useEffect(() => {
    fetchSuggestions();

    // Check for new suggestions every 30 seconds
    const interval = setInterval(() => {
      fetchSuggestions();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const fetchSuggestions = async () => {
    try {
      // Check if notifications are enabled
      const notificationsEnabled = localStorage.getItem('suggestionNotificationsEnabled') !== 'false';
      if (!notificationsEnabled) {
        setSuggestions([]);
        setIsVisible(false);
        return;
      }

      // Check if either dictionary or snippets are enabled
      const dictionaryEnabled = JSON.parse(localStorage.getItem('dictionaryEnabled') || 'true');
      const snippetsEnabled = JSON.parse(localStorage.getItem('snippetsEnabled') || 'true');

      // Don't show suggestions if both features are disabled
      if (!dictionaryEnabled && !snippetsEnabled) {
        setSuggestions([]);
        setIsVisible(false);
        return;
      }

      // Check if AI mode is enabled - if so, don't poll for suggestions
      // AI suggestions only appear after user clicks "Test AI Analysis" button
      const aiSuggestionsEnabled = localStorage.getItem('aiSuggestionsEnabled') === 'true';
      if (aiSuggestionsEnabled) {
        // In AI mode, we don't show automatic suggestion popups
        // User must manually trigger AI analysis via the test button
        setSuggestions([]);
        setIsVisible(false);
        return;
      }

      // Local mode - fetch suggestions from database
      const results = await window.electronAPI?.getPhraseSuggestions?.();
      if (results && results.length > 0) {
        setSuggestions(results);
        setIsVisible(true);
      } else {
        setSuggestions([]);
        setIsVisible(false);
      }
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    }
  };

  const currentSuggestion = suggestions[currentIndex];

  const handleAddToDictionary = async () => {
    if (!currentSuggestion) return;

    try {
      // Get existing dictionary
      const dictionary = JSON.parse(localStorage.getItem('dictionary') || '[]');

      // Add new entry with the new format (word + optional correction)
      // For auto-suggestions, we add as a word to recognize (no correction)
      const newEntry = {
        id: Date.now().toString(),
        word: currentSuggestion.phrase,
        // No correction - just teach Whisper to recognize this word/phrase
      };

      dictionary.push(newEntry);
      localStorage.setItem('dictionary', JSON.stringify(dictionary));

      // Mark as suggested and remove from list
      await window.electronAPI?.markPhraseSuggested?.(currentSuggestion.phrase);
      handleNext();

      // Show success feedback
      console.log('✅ Added to dictionary:', currentSuggestion.phrase);
    } catch (error) {
      console.error('Error adding to dictionary:', error);
    }
  };

  const handleAddToSnippets = () => {
    if (!currentSuggestion) return;
    // Show the expansion input instead of adding directly
    setShowSnippetExpansion(true);
    setSnippetExpansion('');
  };

  const handleSaveSnippet = async () => {
    if (!currentSuggestion) return;

    try {
      // Get existing snippets
      const snippets = JSON.parse(localStorage.getItem('snippets') || '[]');

      // Add new entry with the user's expansion text (new format: trigger + content)
      const newEntry = {
        id: Date.now().toString(),
        trigger: currentSuggestion.phrase,
        content: snippetExpansion.trim() || currentSuggestion.phrase,
      };

      snippets.push(newEntry);
      localStorage.setItem('snippets', JSON.stringify(snippets));

      // Mark as suggested and remove from list
      await window.electronAPI?.markPhraseSuggested?.(currentSuggestion.phrase);

      // Reset state and move to next
      setShowSnippetExpansion(false);
      setSnippetExpansion('');
      handleNext();

      // Show success feedback
      console.log('✅ Added to snippets:', currentSuggestion.phrase, '→', newEntry.content);
    } catch (error) {
      console.error('Error adding to snippets:', error);
    }
  };

  const handleCancelSnippet = () => {
    setShowSnippetExpansion(false);
    setSnippetExpansion('');
  };

  const handleDismiss = async () => {
    if (!currentSuggestion) return;

    try {
      console.log('[Suggestions] Dismissing phrase:', currentSuggestion.phrase);
      const result = await window.electronAPI?.dismissPhraseSuggestion?.(currentSuggestion.phrase);
      console.log('[Suggestions] Dismiss result:', result);
      handleNext();
    } catch (error) {
      console.error('Error dismissing suggestion:', error);
    }
  };

  const handleNext = () => {
    if (suggestions.length <= 1) {
      setIsVisible(false);
      setSuggestions([]);
      setCurrentIndex(0);
    } else {
      const newSuggestions = suggestions.filter((_, i) => i !== currentIndex);
      setSuggestions(newSuggestions);
      setCurrentIndex(0);
    }
  };

  const getPatternIcon = (patternType: string | null) => {
    switch (patternType) {
      case 'email':
        return <Mail className="w-4 h-4 text-blue-400" />;
      case 'url':
        return <Link className="w-4 h-4 text-green-400" />;
      case 'phone':
        return <Phone className="w-4 h-4 text-purple-400" />;
      default:
        return <MessageSquare className="w-4 h-4 text-zinc-400" />;
    }
  };

  const getPatternLabel = (patternType: string | null) => {
    switch (patternType) {
      case 'email':
        return 'Email Address';
      case 'url':
        return 'URL';
      case 'phone':
        return 'Phone Number';
      default:
        return 'Frequent Phrase';
    }
  };

  if (!isVisible || suggestions.length === 0) {
    return null;
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
        >
          <Lightbulb className="w-5 h-5 text-white" />
          <span className="text-white font-medium">
            {suggestions.length} suggestion{suggestions.length > 1 ? 's' : ''}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-96 animate-fadeIn">
      <div className="bg-zinc-900 border border-zinc-700/50 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-b border-zinc-700/50">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-yellow-400" />
            <h3 className="text-sm font-semibold text-white">Smart Suggestion</h3>
          </div>
          <div className="flex items-center gap-2">
            {suggestions.length > 1 && (
              <span className="text-xs text-zinc-400">
                {currentIndex + 1} / {suggestions.length}
              </span>
            )}
            <button
              onClick={() => setIsMinimized(true)}
              className="text-zinc-400 hover:text-white transition-colors"
              title="Minimize"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={handleDismiss}
              className="text-zinc-400 hover:text-white transition-colors"
              title="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        {currentSuggestion && (
          <div className="p-4">
            {/* Pattern Type Badge */}
            <div className="flex items-center gap-2 mb-3">
              {getPatternIcon(currentSuggestion.pattern_type)}
              <span className="text-xs text-zinc-400">
                {getPatternLabel(currentSuggestion.pattern_type)}
              </span>
              <span className="ml-auto text-xs text-zinc-500">
                Used {currentSuggestion.count}×
              </span>
            </div>

            {/* Phrase Display */}
            <div className="mb-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/30">
              <p className="text-white font-mono text-sm break-words">
                {currentSuggestion.phrase}
              </p>
            </div>

            {showSnippetExpansion ? (
              /* Snippet Expansion Input */
              <div className="space-y-3">
                <p className="text-xs text-zinc-400">
                  When you say "<span className="text-white font-medium">{currentSuggestion.phrase}</span>", what should it expand to?
                </p>
                <textarea
                  value={snippetExpansion}
                  onChange={(e) => setSnippetExpansion(e.target.value)}
                  placeholder={`e.g., ${currentSuggestion.phrase === 'my email' ? 'john@example.com' : currentSuggestion.phrase === 'fyi' ? 'for your information' : 'Enter the full text...'}`}
                  className="w-full p-2 bg-zinc-800 border border-zinc-700 rounded text-sm text-white placeholder-zinc-500 resize-none"
                  rows={3}
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleCancelSnippet}
                    variant="outline"
                    className="flex-1 border-zinc-600 text-zinc-300 hover:bg-zinc-800 text-xs h-9"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveSnippet}
                    disabled={!snippetExpansion.trim()}
                    className="flex-1 bg-purple-500 hover:bg-purple-600 text-white text-xs h-9 disabled:opacity-50"
                  >
                    Save Snippet
                  </Button>
                </div>
              </div>
            ) : (
              /* Normal View */
              <>
                {/* Description */}
                <p className="text-xs text-zinc-400 mb-4">
                  We noticed you use this {currentSuggestion.pattern_type || 'phrase'} frequently.
                  Would you like to add it to your dictionary or snippets for quicker access?
                </p>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {JSON.parse(localStorage.getItem('dictionaryEnabled') || 'true') && (
                    <Button
                      onClick={handleAddToDictionary}
                      className="flex-1 bg-blue-500 hover:bg-blue-600 text-white text-xs h-9"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Dictionary
                    </Button>
                  )}
                  {JSON.parse(localStorage.getItem('snippetsEnabled') || 'true') && (
                    <Button
                      onClick={handleAddToSnippets}
                      className="flex-1 bg-purple-500 hover:bg-purple-600 text-white text-xs h-9"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1.5" />
                      Snippet
                    </Button>
                  )}
                </div>

                {/* Dismiss Link */}
                <button
                  onClick={handleDismiss}
                  className="w-full mt-3 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
                >
                  Not interested
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

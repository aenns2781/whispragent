import React, { useState, useEffect } from 'react';
import { Plus, Trash2, X, BookOpen, Power, ArrowRight, Sparkles, Loader2, CheckCircle, AlertCircle, Check } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import PanelBackground from '../PanelBackground';
import { cn } from '../lib/utils';
import { useSettings } from '../../hooks/useSettings';

interface DictionaryEntry {
  id: string;
  word: string;
  correction?: string; // Optional - if provided, word gets replaced with this
}

interface AISuggestion {
  phrase: string;
  type: string;
  reason: string;
}

interface AnalysisResult {
  success: boolean;
  suggestions: AISuggestion[];
  transcriptionCount?: number;
  message?: string;
  error?: string;
}

const DictionaryPanel: React.FC = () => {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({ word: '', correction: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [isEnabled, setIsEnabled] = useState(() => {
    const saved = localStorage.getItem('dictionaryEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [showAnalysisResult, setShowAnalysisResult] = useState(false);
  const [addedSuggestions, setAddedSuggestions] = useState<Set<string>>(new Set());
  const settings = useSettings();

  useEffect(() => {
    loadDictionary();
  }, []);

  useEffect(() => {
    localStorage.setItem('dictionaryEnabled', JSON.stringify(isEnabled));
  }, [isEnabled]);

  const loadDictionary = () => {
    const saved = localStorage.getItem('dictionary');
    if (saved) {
      // Migrate old format if needed
      const parsed = JSON.parse(saved);
      const migrated = parsed.map((entry: any) => {
        // Old format had shorthand/expansion, new format has word/correction
        if (entry.shorthand && !entry.word) {
          return {
            id: entry.id,
            word: entry.shorthand,
            correction: entry.expansion !== entry.shorthand ? entry.expansion : undefined
          };
        }
        return entry;
      });
      setEntries(migrated);
      localStorage.setItem('dictionary', JSON.stringify(migrated));
    } else {
      // Set some defaults showing both types
      const defaults: DictionaryEntry[] = [
        // Words & Names - help Whisper recognize these correctly
        { id: '1', word: 'Whispr' },
        { id: '2', word: 'OpenAI' },
        { id: '3', word: 'GitHub' },
        // Auto-corrections - replace spoken shortcuts with full text
        { id: '4', word: 'btw', correction: 'by the way' },
        { id: '5', word: 'imo', correction: 'in my opinion' },
        { id: '6', word: 'tbh', correction: 'to be honest' },
        { id: '7', word: 'fyi', correction: 'for your information' },
        { id: '8', word: 'asap', correction: 'as soon as possible' },
        { id: '9', word: 'lmk', correction: 'let me know' },
      ];
      setEntries(defaults);
      localStorage.setItem('dictionary', JSON.stringify(defaults));
    }
  };

  const saveDictionary = (newEntries: DictionaryEntry[]) => {
    setEntries(newEntries);
    localStorage.setItem('dictionary', JSON.stringify(newEntries));
  };

  const addEntry = () => {
    if (!newEntry.word.trim()) return;

    const entry: DictionaryEntry = {
      id: Date.now().toString(),
      word: newEntry.word.trim(),
      correction: newEntry.correction.trim() || undefined
    };

    const updated = [...entries, entry];
    saveDictionary(updated);
    setNewEntry({ word: '', correction: '' });
    setShowAddForm(false);
  };

  const deleteEntry = (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    saveDictionary(updated);
  };

  const runAIAnalysis = async () => {
    if (!settings.openaiApiKey) {
      setAnalysisResult({
        success: false,
        suggestions: [],
        error: 'OpenAI API key required. Add your API key in AI Models settings.'
      });
      setShowAnalysisResult(true);
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    setAddedSuggestions(new Set()); // Reset added tracking

    try {
      const result = await window.electronAPI?.triggerAIAnalysis?.({
        openaiApiKey: settings.openaiApiKey,
        aiSuggestionsEnabled: true
      }, 'dictionary');

      setAnalysisResult(result || { success: false, suggestions: [], error: 'No response from analysis' });
      setShowAnalysisResult(true);
    } catch (error: any) {
      setAnalysisResult({
        success: false,
        suggestions: [],
        error: error.message || 'Analysis failed'
      });
      setShowAnalysisResult(true);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const addSuggestionToDictionary = (suggestion: AISuggestion) => {
    const entry: DictionaryEntry = {
      id: Date.now().toString(),
      word: suggestion.phrase,
      correction: undefined
    };
    const updated = [...entries, entry];
    saveDictionary(updated);
    // Track that this was added for visual feedback
    setAddedSuggestions(prev => new Set(prev).add(suggestion.phrase));
  };

  // Check if a phrase already exists in dictionary
  const isAlreadyInDictionary = (phrase: string) => {
    const lowerPhrase = phrase.toLowerCase();
    return entries.some(e =>
      e.word.toLowerCase() === lowerPhrase ||
      e.correction?.toLowerCase() === lowerPhrase
    );
  };

  // Separate entries into words (no correction) and corrections (has correction)
  const wordsOnly = entries.filter(e => !e.correction);
  const corrections = entries.filter(e => e.correction);

  const filteredWords = wordsOnly.filter(entry =>
    entry.word.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredCorrections = corrections.filter(entry =>
    entry.word.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.correction?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PanelBackground>
      <div className="space-y-6 relative">
        {/* Header with Toggle */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-2">Dictionary</h2>
            <p className="text-zinc-400">Teach Whisper your unique words and names</p>
          </div>
          <div className="flex items-center gap-3 bg-zinc-800/50 rounded-lg px-3 py-2">
            <Power className={cn("w-4 h-4", isEnabled ? "text-green-400" : "text-zinc-500")} />
            <Switch
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
              className="data-[state=checked]:bg-green-600"
            />
          </div>
        </div>

        <div className={cn("space-y-6", !isEnabled && "opacity-50 saturate-50")}>

          {/* Explanation Card */}
          <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white mb-2">Whisper speaks the way you speak.</h3>
            <p className="text-sm text-zinc-300 mb-4">
              Add personal terms, company jargon, client names, or industry-specific lingo.
              Whisper will learn to recognize and spell them correctly.
            </p>
            <div className="flex flex-wrap gap-2">
              {['Q3 Roadmap', 'Whispr → Wispr', 'SF MOMA', 'Figma Jam'].map((example, i) => (
                <span key={i} className="px-3 py-1.5 bg-zinc-800/80 rounded-full text-sm text-zinc-300 border border-zinc-700">
                  {example}
                </span>
              ))}
            </div>
          </div>

          {/* AI Analysis Section */}
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                <h3 className="text-lg font-semibold text-white">AI Analysis</h3>
              </div>
              <Button
                onClick={runAIAnalysis}
                disabled={isAnalyzing}
                size="sm"
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Analyze My Dictation
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-zinc-300 mb-3">
              Let AI scan your recent transcriptions to find names, emails, technical terms,
              and repeated phrases that should be added to your dictionary.
            </p>
            <div className="bg-zinc-800/50 rounded-lg p-3 text-xs text-zinc-400">
              <p className="font-medium text-zinc-300 mb-1">Two ways to get suggestions:</p>
              <ul className="space-y-1 ml-3 list-disc">
                <li><strong className="text-white">Manual</strong> — Click the button above to analyze anytime</li>
                <li><strong className="text-white">Automatic</strong> — Enable "AI Suggestions" in System settings for daily background analysis</li>
              </ul>
            </div>
            {!settings.openaiApiKey && (
              <p className="text-xs text-amber-400 mt-3">
                ⚠️ Requires OpenAI API key. Add one in AI Models settings.
              </p>
            )}
          </div>

          {/* Analysis Results Modal */}
          {showAnalysisResult && analysisResult && (
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
              <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-lg w-full max-h-[80vh] overflow-hidden">
                <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {analysisResult.success ? (
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    )}
                    <h3 className="text-lg font-semibold text-white">Analysis Results</h3>
                  </div>
                  <button
                    onClick={() => setShowAnalysisResult(false)}
                    className="text-zinc-400 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="p-4 overflow-y-auto max-h-[60vh]">
                  {analysisResult.error ? (
                    <div className="text-red-400 text-sm">{analysisResult.error}</div>
                  ) : (
                    <>
                      <p className="text-sm text-zinc-300 mb-4">{analysisResult.message}</p>
                      {analysisResult.suggestions.length > 0 ? (
                        <div className="space-y-2">
                          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Suggestions</p>
                          {analysisResult.suggestions
                            .filter(s => !isAlreadyInDictionary(s.phrase))
                            .map((suggestion, index) => {
                              const isAdded = addedSuggestions.has(suggestion.phrase);
                              return (
                                <div
                                  key={index}
                                  className={`flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg border ${isAdded ? 'border-green-500/50' : 'border-zinc-700/50'}`}
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-white">{suggestion.phrase}</span>
                                      <span className="text-xs px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded">
                                        {suggestion.type}
                                      </span>
                                      {isAdded && (
                                        <span className="text-xs px-2 py-0.5 bg-green-500/20 text-green-300 rounded">
                                          Added
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-zinc-500 mt-1">{suggestion.reason}</p>
                                  </div>
                                  {isAdded ? (
                                    <div className="w-8 h-8 flex items-center justify-center text-green-400">
                                      <Check className="w-5 h-5" />
                                    </div>
                                  ) : (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        addSuggestionToDictionary(suggestion);
                                      }}
                                      className="text-green-400 hover:text-green-300 hover:bg-green-500/10"
                                    >
                                      <Plus className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          {analysisResult.suggestions.filter(s => !isAlreadyInDictionary(s.phrase)).length === 0 && (
                            <div className="text-center py-4 text-zinc-500">
                              <Check className="w-8 h-8 mx-auto mb-2 text-green-400" />
                              <p>All suggestions already in your dictionary!</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-zinc-500">
                          <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p>No suggestions found</p>
                          <p className="text-xs mt-1">Keep dictating to build up more data!</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="p-4 border-t border-zinc-800">
                  <Button
                    onClick={() => setShowAnalysisResult(false)}
                    className="w-full"
                    variant="outline"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Search and Add */}
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Search dictionary..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-zinc-900/50 border-zinc-800 text-white"
            />
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add new word
            </Button>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-4 space-y-4">
              <div>
                <label className="text-sm text-zinc-300 mb-2 block font-medium">Word or phrase</label>
                <Input
                  placeholder="e.g., Andrew, Wispr, HIPAA"
                  value={newEntry.word}
                  onChange={(e) => setNewEntry({ ...newEntry, word: e.target.value })}
                  className="bg-zinc-900 border-zinc-700"
                  autoFocus
                />
                <p className="text-xs text-zinc-500 mt-1">Enter a word or name you want Whisper to recognize</p>
              </div>
              <div>
                <label className="text-sm text-zinc-300 mb-2 block font-medium">Replace with (optional)</label>
                <Input
                  placeholder="e.g., by the way, Wispr"
                  value={newEntry.correction}
                  onChange={(e) => setNewEntry({ ...newEntry, correction: e.target.value })}
                  className="bg-zinc-900 border-zinc-700"
                />
                <p className="text-xs text-zinc-500 mt-1">Leave empty to just teach the spelling, or enter text to auto-replace</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={addEntry} className="bg-blue-600 hover:bg-blue-700">
                  Add to Dictionary
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewEntry({ word: '', correction: '' });
                  }}
                  className="border-zinc-700"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Words Section */}
          {filteredWords.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Words & Names</h4>
              <div className="flex flex-wrap gap-2">
                {filteredWords.map(entry => (
                  <div
                    key={entry.id}
                    className="group flex items-center gap-2 px-3 py-2 bg-zinc-800/60 hover:bg-zinc-800 rounded-lg border border-zinc-700/50 transition-colors"
                  >
                    <span className="text-white">{entry.word}</span>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-opacity"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Corrections Section */}
          {filteredCorrections.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-zinc-400 uppercase tracking-wide">Auto-Corrections</h4>
              <div className="space-y-2">
                {filteredCorrections.map(entry => (
                  <div
                    key={entry.id}
                    className="group flex items-center justify-between px-4 py-3 bg-zinc-800/40 hover:bg-zinc-800/60 rounded-lg border border-zinc-700/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-300 font-mono">{entry.word}</span>
                      <ArrowRight className="w-4 h-4 text-zinc-600" />
                      <span className="text-white">{entry.correction}</span>
                    </div>
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {filteredWords.length === 0 && filteredCorrections.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              {searchTerm ? (
                <p>No matching entries found</p>
              ) : (
                <div className="space-y-2">
                  <BookOpen className="w-12 h-12 mx-auto text-zinc-600" />
                  <p>No dictionary entries yet</p>
                  <p className="text-sm text-zinc-600">Add words and names you want Whisper to recognize</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </PanelBackground>
  );
};

export default DictionaryPanel;

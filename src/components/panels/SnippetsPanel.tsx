import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Copy, Scissors, Power, ArrowRight, Sparkles, Loader2, CheckCircle, AlertCircle, X, Check } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import PanelBackground from '../PanelBackground';
import { cn } from '../lib/utils';
import { useSettings } from '../../hooks/useSettings';

interface Snippet {
  id: string;
  trigger: string;
  content: string;
}

interface AISuggestion {
  phrase: string;
  trigger?: string; // AI-suggested trigger for snippets
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

const SnippetsPanel: React.FC = () => {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSnippet, setNewSnippet] = useState({ trigger: '', content: '' });
  const [searchTerm, setSearchTerm] = useState('');
  const [isEnabled, setIsEnabled] = useState(() => {
    const saved = localStorage.getItem('snippetsEnabled');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [showAnalysisResult, setShowAnalysisResult] = useState(false);
  const [addedSuggestions, setAddedSuggestions] = useState<Set<string>>(new Set());
  const [editedTriggers, setEditedTriggers] = useState<Record<string, string>>({});
  const settings = useSettings();

  useEffect(() => {
    loadSnippets();
  }, []);

  useEffect(() => {
    localStorage.setItem('snippetsEnabled', JSON.stringify(isEnabled));
  }, [isEnabled]);

  const loadSnippets = () => {
    const saved = localStorage.getItem('snippets');
    if (saved) {
      setSnippets(JSON.parse(saved));
    } else {
      // Set some defaults - useful trigger phrases that expand to full content
      const defaults: Snippet[] = [
        {
          id: '1',
          trigger: 'my email',
          content: 'your.email@example.com',
        },
        {
          id: '2',
          trigger: 'my phone',
          content: '(555) 123-4567',
        },
        {
          id: '3',
          trigger: 'my address',
          content: '123 Main Street, City, State 12345',
        },
        {
          id: '4',
          trigger: 'my linkedin',
          content: 'https://www.linkedin.com/in/yourprofile',
        },
        {
          id: '5',
          trigger: 'my calendly',
          content: 'https://calendly.com/yourname/30min',
        },
        {
          id: '6',
          trigger: 'quick intro',
          content: "Hi! I'd love to connect and learn more about what you're working on. Would you have 15 minutes for a quick call this week?",
        },
        {
          id: '7',
          trigger: 'thanks for meeting',
          content: "Thanks so much for taking the time to meet with me today. I really enjoyed our conversation and look forward to staying in touch!",
        },
      ];
      setSnippets(defaults);
      localStorage.setItem('snippets', JSON.stringify(defaults));
    }
  };

  const saveSnippets = (newSnippets: Snippet[]) => {
    setSnippets(newSnippets);
    localStorage.setItem('snippets', JSON.stringify(newSnippets));
  };

  const addSnippet = () => {
    if (!newSnippet.trigger.trim() || !newSnippet.content.trim()) return;

    const snippet: Snippet = {
      id: Date.now().toString(),
      trigger: newSnippet.trigger.trim(),
      content: newSnippet.content.trim(),
    };

    const updated = [...snippets, snippet];
    saveSnippets(updated);
    setNewSnippet({ trigger: '', content: '' });
    setShowAddForm(false);
  };

  const deleteSnippet = (id: string) => {
    const updated = snippets.filter(s => s.id !== id);
    saveSnippets(updated);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
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
    setEditedTriggers({}); // Reset edited triggers

    try {
      const result = await window.electronAPI?.triggerAIAnalysis?.({
        openaiApiKey: settings.openaiApiKey,
        aiSuggestionsEnabled: true
      }, 'snippets');

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

  const addSuggestionToSnippets = (suggestion: AISuggestion) => {
    // Use edited trigger if available, otherwise use AI-suggested trigger, otherwise generate one
    const editedTrigger = editedTriggers[suggestion.phrase];
    const triggerToUse = editedTrigger || suggestion.trigger || suggestion.type + ' snippet';

    const snippet: Snippet = {
      id: Date.now().toString(),
      trigger: triggerToUse.trim(),
      content: suggestion.phrase,
    };
    const updated = [...snippets, snippet];
    saveSnippets(updated);
    // Track that this was added for visual feedback
    setAddedSuggestions(prev => new Set(prev).add(suggestion.phrase));
  };

  // Check if a phrase already exists in snippets
  const isAlreadyInSnippets = (phrase: string) => {
    const lowerPhrase = phrase.toLowerCase();
    return snippets.some(s =>
      s.trigger.toLowerCase() === lowerPhrase ||
      s.content.toLowerCase() === lowerPhrase
    );
  };

  const filteredSnippets = snippets.filter(snippet =>
    snippet.trigger.toLowerCase().includes(searchTerm.toLowerCase()) ||
    snippet.content.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PanelBackground>
      <div className="space-y-6 relative">
        {/* Header with Toggle */}
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-white mb-2">Snippets</h2>
            <p className="text-zinc-400">Save time with reusable text expansions</p>
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
          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-white mb-2">The stuff you shouldn't have to re-type.</h3>
            <p className="text-sm text-zinc-300 mb-4">
              Save shortcuts to speak the things you type all the time—emails, links, addresses, bios—anything.
              <strong className="text-white"> Just speak and it expands instantly</strong>, without retyping or hunting through old messages.
            </p>
            <div className="space-y-2">
              {[
                { trigger: 'LinkedIn', content: 'https://www.linkedin.com/in/john-doe-9b0139134/' },
                { trigger: 'intro email', content: 'Hey, would love to find some time to chat later...' },
                { trigger: 'my calendly link', content: 'calendly.com/you/invite-name' },
              ].map((example, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="px-3 py-1.5 bg-zinc-800/80 rounded-lg text-zinc-300 border border-zinc-700 font-medium">
                    {example.trigger}
                  </span>
                  <ArrowRight className="w-4 h-4 text-zinc-600" />
                  <span className="text-zinc-400 truncate">{example.content}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Analysis Section */}
          <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border border-blue-500/20 rounded-xl p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-semibold text-white">AI Analysis</h3>
              </div>
              <Button
                onClick={runAIAnalysis}
                disabled={isAnalyzing}
                size="sm"
                className="bg-blue-600 hover:bg-blue-700"
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
              Let AI scan your recent transcriptions to find repeated phrases, email signatures,
              and common responses that could become useful snippets.
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
                        <div className="space-y-3">
                          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Suggestions</p>
                          {analysisResult.suggestions
                            .filter(s => !isAlreadyInSnippets(s.phrase))
                            .map((suggestion, index) => {
                              const isAdded = addedSuggestions.has(suggestion.phrase);
                              const currentTrigger = editedTriggers[suggestion.phrase] ?? suggestion.trigger ?? '';
                              return (
                                <div
                                  key={index}
                                  className={`p-3 bg-zinc-800/50 rounded-lg border ${isAdded ? 'border-green-500/50' : 'border-zinc-700/50'}`}
                                >
                                  <div className="flex items-start gap-3">
                                    {/* Trigger input */}
                                    <div className="flex-shrink-0">
                                      <Input
                                        value={currentTrigger}
                                        onChange={(e) => setEditedTriggers(prev => ({
                                          ...prev,
                                          [suggestion.phrase]: e.target.value
                                        }))}
                                        placeholder="trigger..."
                                        disabled={isAdded}
                                        className="w-32 h-8 text-sm bg-zinc-900 border-zinc-600 text-purple-300 font-medium"
                                      />
                                    </div>
                                    <ArrowRight className="w-4 h-4 text-zinc-600 mt-2 flex-shrink-0" />
                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-white break-words">{suggestion.phrase}</p>
                                      <div className="flex items-center gap-2 mt-1">
                                        <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-300 rounded">
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
                                    {/* Add button */}
                                    {isAdded ? (
                                      <div className="w-8 h-8 flex items-center justify-center text-green-400 flex-shrink-0">
                                        <Check className="w-5 h-5" />
                                      </div>
                                    ) : (
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => addSuggestionToSnippets(suggestion)}
                                        disabled={!currentTrigger.trim()}
                                        className="text-green-400 hover:text-green-300 hover:bg-green-500/10 flex-shrink-0"
                                      >
                                        <Plus className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          {analysisResult.suggestions.filter(s => !isAlreadyInSnippets(s.phrase)).length === 0 && (
                            <div className="text-center py-4 text-zinc-500">
                              <Check className="w-8 h-8 mx-auto mb-2 text-green-400" />
                              <p>All suggestions already in your snippets!</p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-6 text-zinc-500">
                          <Scissors className="w-10 h-10 mx-auto mb-2 opacity-50" />
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
              placeholder="Search snippets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-zinc-900/50 border-zinc-800 text-white"
            />
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-purple-600 hover:bg-purple-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add new snippet
            </Button>
          </div>

          {/* Add Form */}
          {showAddForm && (
            <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-4 space-y-4">
              <div>
                <label className="text-sm text-zinc-300 mb-2 block font-medium">Trigger phrase</label>
                <Input
                  placeholder="e.g., my email, intro message, company address"
                  value={newSnippet.trigger}
                  onChange={(e) => setNewSnippet({ ...newSnippet, trigger: e.target.value })}
                  className="bg-zinc-900 border-zinc-700"
                  autoFocus
                />
                <p className="text-xs text-zinc-500 mt-1">What you'll say to trigger this snippet</p>
              </div>
              <div>
                <label className="text-sm text-zinc-300 mb-2 block font-medium">Expands to</label>
                <Textarea
                  placeholder="e.g., john.doe@company.com, Hello! I'd love to connect..."
                  value={newSnippet.content}
                  onChange={(e) => setNewSnippet({ ...newSnippet, content: e.target.value })}
                  className="bg-zinc-900 border-zinc-700 min-h-[100px]"
                />
                <p className="text-xs text-zinc-500 mt-1">The full text that will replace your trigger phrase</p>
              </div>
              <div className="flex gap-2">
                <Button onClick={addSnippet} className="bg-purple-600 hover:bg-purple-700">
                  Add Snippet
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddForm(false);
                    setNewSnippet({ trigger: '', content: '' });
                  }}
                  className="border-zinc-700"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {/* Snippets List */}
          <div className="space-y-2">
            {filteredSnippets.length === 0 ? (
              <div className="text-center py-12 text-zinc-500">
                {searchTerm ? (
                  <p>No matching snippets found</p>
                ) : (
                  <div className="space-y-2">
                    <Scissors className="w-12 h-12 mx-auto text-zinc-600" />
                    <p>No snippets yet</p>
                    <p className="text-sm text-zinc-600">Add snippets for things you type often</p>
                  </div>
                )}
              </div>
            ) : (
              filteredSnippets.map(snippet => (
                <div
                  key={snippet.id}
                  className="group bg-zinc-800/40 hover:bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-4 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-purple-500/20 rounded-lg text-purple-300 font-medium text-sm border border-purple-500/30">
                          {snippet.trigger}
                        </span>
                        <ArrowRight className="w-4 h-4 text-zinc-600 flex-shrink-0" />
                        <span className="text-zinc-400 text-sm truncate">
                          {snippet.content.length > 50 ? snippet.content.substring(0, 50) + '...' : snippet.content}
                        </span>
                      </div>
                      {snippet.content.length > 50 && (
                        <p className="text-sm text-zinc-400 bg-zinc-900/50 p-3 rounded-lg font-mono text-xs mt-2 break-all">
                          {snippet.content}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(snippet.content)}
                        className="text-zinc-400 hover:text-white h-8 w-8 p-0"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteSnippet(snippet.id)}
                        className="text-zinc-400 hover:text-red-400 h-8 w-8 p-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </PanelBackground>
  );
};

export default SnippetsPanel;

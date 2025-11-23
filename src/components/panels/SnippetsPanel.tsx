import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Copy, Scissors } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import PanelBackground from '../PanelBackground';

interface Snippet {
  id: string;
  trigger: string;
  content: string;
  description?: string;
}

const SnippetsPanel: React.FC = () => {
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSnippet, setNewSnippet] = useState({ trigger: '', content: '', description: '' });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadSnippets();
  }, []);

  const loadSnippets = () => {
    const saved = localStorage.getItem('snippets');
    if (saved) {
      setSnippets(JSON.parse(saved));
    } else {
      // Set some defaults
      const defaults: Snippet[] = [
        {
          id: '1',
          trigger: 'my email',
          content: 'user@example.com',
          description: 'Personal email address'
        },
        {
          id: '2',
          trigger: 'my linkedin',
          content: 'https://www.linkedin.com/in/yourprofile',
          description: 'LinkedIn profile URL'
        },
        {
          id: '3',
          trigger: 'meeting link',
          content: 'https://calendly.com/yourname/30min',
          description: 'Calendly scheduling link'
        }
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
    if (!newSnippet.trigger || !newSnippet.content) return;

    const snippet: Snippet = {
      id: Date.now().toString(),
      ...newSnippet
    };

    const updated = [...snippets, snippet];
    saveSnippets(updated);
    setNewSnippet({ trigger: '', content: '', description: '' });
    setShowAddForm(false);
  };

  const deleteSnippet = (id: string) => {
    const updated = snippets.filter(s => s.id !== id);
    saveSnippets(updated);
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  const filteredSnippets = snippets.filter(snippet =>
    snippet.trigger.toLowerCase().includes(searchTerm.toLowerCase()) ||
    snippet.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    snippet.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <PanelBackground>
      <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Snippets</h2>
        <p className="text-zinc-400">Save time with reusable text expansions</p>
      </div>

      {/* Info Box */}
      <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
        <p className="text-sm text-purple-400">
          ✂️ Speak the trigger phrase and it instantly expands to your saved text.
          Perfect for emails, URLs, addresses, and frequently used phrases.
        </p>
      </div>

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
          Add Snippet
        </Button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-4 space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Trigger Phrase</label>
            <Input
              placeholder="e.g., my address"
              value={newSnippet.trigger}
              onChange={(e) => setNewSnippet({ ...newSnippet, trigger: e.target.value })}
              className="bg-zinc-900 border-zinc-700"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Expands to</label>
            <Textarea
              placeholder="e.g., 123 Main Street, San Francisco, CA 94102"
              value={newSnippet.content}
              onChange={(e) => setNewSnippet({ ...newSnippet, content: e.target.value })}
              className="bg-zinc-900 border-zinc-700 min-h-[80px]"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Description (optional)</label>
            <Input
              placeholder="e.g., Home address"
              value={newSnippet.description}
              onChange={(e) => setNewSnippet({ ...newSnippet, description: e.target.value })}
              className="bg-zinc-900 border-zinc-700"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={addSnippet} className="bg-purple-600 hover:bg-purple-700">
              Save Snippet
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddForm(false);
                setNewSnippet({ trigger: '', content: '', description: '' });
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
          <div className="text-center py-8 text-zinc-500">
            {searchTerm ? 'No matching snippets found' : 'No snippets yet'}
          </div>
        ) : (
          filteredSnippets.map(snippet => (
            <div
              key={snippet.id}
              className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-4 hover:bg-zinc-900/70 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-purple-400">"{snippet.trigger}"</span>
                    {snippet.description && (
                      <span className="text-xs text-zinc-500">• {snippet.description}</span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-300 font-mono bg-zinc-900/50 p-2 rounded mt-2">
                    {snippet.content}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(snippet.content)}
                    className="text-zinc-400 hover:text-white"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteSnippet(snippet.id)}
                    className="text-zinc-400 hover:text-red-400"
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
    </PanelBackground>
  );
};

export default SnippetsPanel;
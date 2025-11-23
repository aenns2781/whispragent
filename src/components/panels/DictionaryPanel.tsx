import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, BookOpen } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';

interface DictionaryEntry {
  id: string;
  shorthand: string;
  expansion: string;
  category?: string;
}

const DictionaryPanel: React.FC = () => {
  const [entries, setEntries] = useState<DictionaryEntry[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEntry, setNewEntry] = useState({ shorthand: '', expansion: '', category: '' });
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadDictionary();
  }, []);

  const loadDictionary = () => {
    const saved = localStorage.getItem('dictionary');
    if (saved) {
      setEntries(JSON.parse(saved));
    } else {
      // Set some defaults
      const defaults: DictionaryEntry[] = [
        { id: '1', shorthand: 'btw', expansion: 'by the way' },
        { id: '2', shorthand: 'imo', expansion: 'in my opinion' },
        { id: '3', shorthand: 'fyi', expansion: 'for your information' },
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
    if (!newEntry.shorthand || !newEntry.expansion) return;

    const entry: DictionaryEntry = {
      id: Date.now().toString(),
      ...newEntry
    };

    const updated = [...entries, entry];
    saveDictionary(updated);
    setNewEntry({ shorthand: '', expansion: '', category: '' });
    setShowAddForm(false);
  };

  const deleteEntry = (id: string) => {
    const updated = entries.filter(e => e.id !== id);
    saveDictionary(updated);
  };

  const filteredEntries = entries.filter(entry =>
    entry.shorthand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.expansion.toLowerCase().includes(searchTerm.toLowerCase()) ||
    entry.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Dictionary</h2>
        <p className="text-zinc-400">Automatically expand shortcuts and abbreviations</p>
      </div>

      {/* Info Box */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
        <p className="text-sm text-blue-400">
          💡 When you speak these shortcuts, they'll automatically expand to the full text.
          For example, saying "btw" will type "by the way".
        </p>
      </div>

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
          Add Entry
        </Button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Shorthand</label>
              <Input
                placeholder="e.g., btw"
                value={newEntry.shorthand}
                onChange={(e) => setNewEntry({ ...newEntry, shorthand: e.target.value })}
                className="bg-zinc-900 border-zinc-700"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Expands to</label>
              <Input
                placeholder="e.g., by the way"
                value={newEntry.expansion}
                onChange={(e) => setNewEntry({ ...newEntry, expansion: e.target.value })}
                className="bg-zinc-900 border-zinc-700"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Category (optional)</label>
            <Input
              placeholder="e.g., General, Work, Medical"
              value={newEntry.category}
              onChange={(e) => setNewEntry({ ...newEntry, category: e.target.value })}
              className="bg-zinc-900 border-zinc-700"
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={addEntry} className="bg-blue-600 hover:bg-blue-700">
              Save Entry
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddForm(false);
                setNewEntry({ shorthand: '', expansion: '', category: '' });
              }}
              className="border-zinc-700"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Entries List */}
      <div className="space-y-2">
        {filteredEntries.length === 0 ? (
          <div className="text-center py-8 text-zinc-500">
            {searchTerm ? 'No matching entries found' : 'No dictionary entries yet'}
          </div>
        ) : (
          filteredEntries.map(entry => (
            <div
              key={entry.id}
              className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-4 hover:bg-zinc-900/70 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-blue-400">{entry.shorthand}</span>
                    <span className="text-zinc-600">→</span>
                    <span className="text-zinc-300">{entry.expansion}</span>
                  </div>
                  {entry.category && (
                    <span className="text-xs text-zinc-500 mt-1 block">
                      Category: {entry.category}
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteEntry(entry.id)}
                  className="text-zinc-400 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default DictionaryPanel;
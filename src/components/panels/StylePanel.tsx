import React, { useState, useEffect } from 'react';
import { Palette, Check, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import PanelBackground from '../PanelBackground';
import { cn } from '../lib/utils';

interface StyleProfile {
  id: string;
  name: string;
  description: string;
  rules: {
    capitalization: 'sentence' | 'title' | 'none';
    punctuation: 'auto' | 'minimal' | 'none';
    formatting: 'paragraphs' | 'single' | 'preserve';
    tone: 'professional' | 'casual' | 'technical';
  };
  isActive: boolean;
}

const StylePanel: React.FC = () => {
  const [profiles, setProfiles] = useState<StyleProfile[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProfile, setNewProfile] = useState<Partial<StyleProfile>>({
    name: '',
    description: '',
    rules: {
      capitalization: 'sentence',
      punctuation: 'auto',
      formatting: 'paragraphs',
      tone: 'professional'
    }
  });

  useEffect(() => {
    loadProfiles();
  }, []);

  const loadProfiles = () => {
    const saved = localStorage.getItem('styleProfiles');
    if (saved) {
      setProfiles(JSON.parse(saved));
    } else {
      // Default profiles
      const defaults: StyleProfile[] = [
        {
          id: '1',
          name: 'Professional',
          description: 'For business communications',
          rules: {
            capitalization: 'sentence',
            punctuation: 'auto',
            formatting: 'paragraphs',
            tone: 'professional'
          },
          isActive: true
        },
        {
          id: '2',
          name: 'Casual',
          description: 'For informal messages',
          rules: {
            capitalization: 'sentence',
            punctuation: 'minimal',
            formatting: 'single',
            tone: 'casual'
          },
          isActive: false
        },
        {
          id: '3',
          name: 'Technical',
          description: 'For documentation and code comments',
          rules: {
            capitalization: 'sentence',
            punctuation: 'auto',
            formatting: 'preserve',
            tone: 'technical'
          },
          isActive: false
        }
      ];
      setProfiles(defaults);
      localStorage.setItem('styleProfiles', JSON.stringify(defaults));
    }
  };

  const saveProfiles = (newProfiles: StyleProfile[]) => {
    setProfiles(newProfiles);
    localStorage.setItem('styleProfiles', JSON.stringify(newProfiles));
  };

  const setActiveProfile = (id: string) => {
    const updated = profiles.map(p => ({
      ...p,
      isActive: p.id === id
    }));
    saveProfiles(updated);
  };

  const addProfile = () => {
    if (!newProfile.name) return;

    const profile: StyleProfile = {
      id: Date.now().toString(),
      name: newProfile.name,
      description: newProfile.description || '',
      rules: newProfile.rules!,
      isActive: false
    };

    const updated = [...profiles, profile];
    saveProfiles(updated);
    setNewProfile({
      name: '',
      description: '',
      rules: {
        capitalization: 'sentence',
        punctuation: 'auto',
        formatting: 'paragraphs',
        tone: 'professional'
      }
    });
    setShowAddForm(false);
  };

  const deleteProfile = (id: string) => {
    const updated = profiles.filter(p => p.id !== id);
    saveProfiles(updated);
  };

  return (
    <PanelBackground>
      <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">Style Profiles</h2>
        <p className="text-zinc-400">Customize how your text is formatted</p>
      </div>

      {/* Active Profile */}
      {profiles.find(p => p.isActive) && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-1">
            <Check className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-green-400">Active Profile</span>
          </div>
          <p className="text-white font-medium">{profiles.find(p => p.isActive)?.name}</p>
        </div>
      )}

      {/* Add Profile Button */}
      <Button
        onClick={() => setShowAddForm(!showAddForm)}
        className="bg-green-600 hover:bg-green-700"
      >
        <Plus className="w-4 h-4 mr-2" />
        Create Profile
      </Button>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-4 space-y-3">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Profile Name</label>
            <Input
              placeholder="e.g., Meeting Notes"
              value={newProfile.name}
              onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
              className="bg-zinc-900 border-zinc-700"
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Description</label>
            <Input
              placeholder="e.g., For team meeting transcriptions"
              value={newProfile.description}
              onChange={(e) => setNewProfile({ ...newProfile, description: e.target.value })}
              className="bg-zinc-900 border-zinc-700"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Capitalization</label>
              <select
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                value={newProfile.rules?.capitalization}
                onChange={(e) => setNewProfile({
                  ...newProfile,
                  rules: { ...newProfile.rules!, capitalization: e.target.value as any }
                })}
              >
                <option value="sentence">Sentence case</option>
                <option value="title">Title Case</option>
                <option value="none">No change</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Punctuation</label>
              <select
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                value={newProfile.rules?.punctuation}
                onChange={(e) => setNewProfile({
                  ...newProfile,
                  rules: { ...newProfile.rules!, punctuation: e.target.value as any }
                })}
              >
                <option value="auto">Auto-punctuate</option>
                <option value="minimal">Minimal</option>
                <option value="none">None</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Formatting</label>
              <select
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                value={newProfile.rules?.formatting}
                onChange={(e) => setNewProfile({
                  ...newProfile,
                  rules: { ...newProfile.rules!, formatting: e.target.value as any }
                })}
              >
                <option value="paragraphs">Paragraphs</option>
                <option value="single">Single line</option>
                <option value="preserve">Preserve</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-zinc-400 mb-1 block">Tone</label>
              <select
                className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm"
                value={newProfile.rules?.tone}
                onChange={(e) => setNewProfile({
                  ...newProfile,
                  rules: { ...newProfile.rules!, tone: e.target.value as any }
                })}
              >
                <option value="professional">Professional</option>
                <option value="casual">Casual</option>
                <option value="technical">Technical</option>
              </select>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={addProfile} className="bg-green-600 hover:bg-green-700">
              Create Profile
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowAddForm(false);
                setNewProfile({
                  name: '',
                  description: '',
                  rules: {
                    capitalization: 'sentence',
                    punctuation: 'auto',
                    formatting: 'paragraphs',
                    tone: 'professional'
                  }
                });
              }}
              className="border-zinc-700"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Profiles Grid */}
      <div className="grid gap-3">
        {profiles.map(profile => (
          <div
            key={profile.id}
            className={cn(
              "bg-zinc-900/50 backdrop-blur border rounded-lg p-4 transition-all cursor-pointer",
              profile.isActive
                ? "border-green-500/50 bg-green-500/5"
                : "border-zinc-800 hover:bg-zinc-900/70"
            )}
            onClick={() => setActiveProfile(profile.id)}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-white">{profile.name}</h3>
                  {profile.isActive && (
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                      Active
                    </span>
                  )}
                </div>
                <p className="text-sm text-zinc-400">{profile.description}</p>
                <div className="flex gap-4 mt-3 text-xs text-zinc-500">
                  <span>Cap: {profile.rules.capitalization}</span>
                  <span>Punct: {profile.rules.punctuation}</span>
                  <span>Format: {profile.rules.formatting}</span>
                  <span>Tone: {profile.rules.tone}</span>
                </div>
              </div>
              {!profile.isActive && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteProfile(profile.id);
                  }}
                  className="text-zinc-400 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      </div>
    </PanelBackground>
  );
};

export default StylePanel;
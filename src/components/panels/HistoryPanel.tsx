import React, { useState, useEffect } from 'react';
import { Clock, Copy, Trash2, Search, Image as ImageIcon } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import {
  useTranscriptions,
  initializeTranscriptions,
  removeTranscription as removeFromStore,
  getTranscriptionCount
} from '../../stores/transcriptionStore';

type HistoryItem = {
  id: number;
  timestamp: string;
  type: 'transcription' | 'image';
  text?: string;
  prompt?: string;
  image_path?: string;
  model?: string;
  aspect_ratio?: string;
  resolution?: string;
};

const HistoryPanel: React.FC = () => {
  const transcriptions = useTranscriptions();
  const [generatedImages, setGeneratedImages] = useState<any[]>([]);
  const [mergedHistory, setMergedHistory] = useState<HistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<HistoryItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [displayLimit, setDisplayLimit] = useState(50);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  // Merge transcriptions and images when they change
  useEffect(() => {
    const transcriptionItems: HistoryItem[] = transcriptions.map(t => ({
      id: t.id,
      timestamp: t.timestamp,
      type: 'transcription' as const,
      text: t.text
    }));

    const imageItems: HistoryItem[] = generatedImages.map(img => ({
      id: img.id,
      timestamp: img.timestamp,
      type: 'image' as const,
      prompt: img.prompt,
      image_path: img.image_path,
      model: img.model,
      aspect_ratio: img.aspect_ratio,
      resolution: img.resolution
    }));

    // Merge and sort by timestamp (newest first)
    const merged = [...transcriptionItems, ...imageItems].sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    setMergedHistory(merged);
  }, [transcriptions, generatedImages]);

  // Handle scroll to bottom - load more
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Load more when within 100px of bottom
      if (scrollHeight - scrollTop - clientHeight < 100 && !loading) {
        if (displayLimit < mergedHistory.length) {
          setDisplayLimit(prev => prev + 50);
        }
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [displayLimit, mergedHistory.length, loading]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = mergedHistory.filter(item => {
        if (item.type === 'transcription') {
          return item.text?.toLowerCase().includes(searchTerm.toLowerCase());
        } else {
          return item.prompt?.toLowerCase().includes(searchTerm.toLowerCase());
        }
      });
      setFilteredHistory(filtered);
    } else {
      setFilteredHistory(mergedHistory);
    }
  }, [searchTerm, mergedHistory]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      await initializeTranscriptions(displayLimit);
      const images = await window.electronAPI.getAllGeneratedImages();
      setGeneratedImages(images);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    // You could add a toast notification here
  };

  const openImage = async (imagePath: string) => {
    try {
      await window.electronAPI.openExternal(`file://${imagePath}`);
    } catch (error) {
      console.error('Failed to open image:', error);
    }
  };

  const deleteItem = async (id: number, type: 'transcription' | 'image') => {
    try {
      if (type === 'transcription') {
        await window.electronAPI.deleteTranscription(id);
        removeFromStore(id);
      } else {
        await window.electronAPI.deleteGeneratedImage(id);
        setGeneratedImages(prev => prev.filter(img => img.id !== id));
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const formatDate = (timestamp: string) => {
    // Handle timestamps that might not have Z suffix
    const timestampSource = timestamp.endsWith("Z") ? timestamp : `${timestamp}Z`;
    const date = new Date(timestampSource);

    // Check if date is valid
    if (Number.isNaN(date.getTime())) {
      return timestamp; // Return original if invalid
    }

    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">History</h2>
        <p className="text-zinc-400">Your recent transcriptions and generated images</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input
          type="text"
          placeholder="Search history..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 bg-zinc-900/50 border-zinc-800 text-white placeholder:text-zinc-500"
        />
      </div>

      {/* History List */}
      <div ref={scrollContainerRef} className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
        {loading ? (
          <div className="text-center py-8 text-zinc-500">Loading...</div>
        ) : filteredHistory.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-zinc-500">No items found</p>
            {searchTerm && (
              <p className="text-sm text-zinc-600 mt-2">Try a different search term</p>
            )}
          </div>
        ) : (
          filteredHistory.slice(0, displayLimit).map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="bg-zinc-900/50 backdrop-blur border border-zinc-800 rounded-lg p-4 hover:bg-zinc-900/70 transition-colors"
            >
              {item.type === 'transcription' ? (
                // Transcription item
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-3 h-3 text-zinc-500" />
                      <span className="text-xs text-zinc-500">{formatDate(item.timestamp)}</span>
                    </div>
                    <p className="text-sm text-zinc-300">
                      {item.text}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(item.text || '')}
                      className="text-zinc-400 hover:text-white"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteItem(item.id, 'transcription')}
                      className="text-zinc-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                // Generated image item
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3 flex-1 min-w-0">
                    {/* Image thumbnail */}
                    <div
                      className="w-20 h-20 rounded-lg bg-zinc-800 flex-shrink-0 cursor-pointer overflow-hidden"
                      onClick={() => openImage(item.image_path || '')}
                    >
                      <img
                        src={`file://${item.image_path}`}
                        alt={item.prompt}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    {/* Image details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <ImageIcon className="w-3 h-3 text-purple-400" />
                        <Clock className="w-3 h-3 text-zinc-500" />
                        <span className="text-xs text-zinc-500">{formatDate(item.timestamp)}</span>
                        {item.model && (
                          <span className="text-xs text-purple-400">
                            {item.model.includes('pro') ? 'Nano Banana Pro' : 'Nano Banana'}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-zinc-300 mb-1">
                        {item.prompt}
                      </p>
                      {(item.aspect_ratio || item.resolution) && (
                        <p className="text-xs text-zinc-500">
                          {item.aspect_ratio && item.aspect_ratio !== 'auto' && `${item.aspect_ratio} • `}
                          {item.resolution}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(item.prompt || '')}
                      className="text-zinc-400 hover:text-white"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteItem(item.id, 'image')}
                      className="text-zinc-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        {displayLimit < filteredHistory.length && (
          <div className="text-center py-4 text-xs text-zinc-500">
            Scroll for more...
          </div>
        )}
      </div>
    </div>
  );
};

export default HistoryPanel;
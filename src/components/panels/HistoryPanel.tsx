import React, { useState, useEffect, useRef } from 'react';
import { Clock, Copy, Trash2, Search, Image as ImageIcon } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import PanelBackground from '../PanelBackground';
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadHistory();

    // Listen for new generated images
    const unsubscribe = window.electronAPI.onGeneratedImageAdded?.((newImage: any) => {
      setGeneratedImages(prev => [newImage, ...prev]);
    });

    return () => {
      unsubscribe?.();
    };
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

  const renderHistoryCard = (item: HistoryItem) => (
    <div
      key={`${item.type}-${item.id}`}
      className="card hover-lift animate-fadeIn"
    >
      {item.type === 'transcription' ? (
        // Transcription item
        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="w-3 h-3 text-color-foreground-muted" />
                <span className="text-xs text-color-foreground-muted">{formatDate(item.timestamp)}</span>
              </div>
              <p className="text-sm text-style-2lines">
                {item.text}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(item.text || '')}
                className="btn-ghost hover-scale"
              >
                <Copy className="w-4 h-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteItem(item.id, 'transcription')}
                className="btn-ghost text-red-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      ) : (
        // Generated image item
        <div className="overflow-hidden">
          {/* Image thumbnail */}
          <div
            className="aspect-video bg-gradient-to-br from-primary/20 to-accent-pink/20 cursor-pointer relative group"
            onClick={() => openImage(item.image_path || '')}
          >
            <img
              src={`file://${item.image_path}`}
              alt={item.prompt}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end p-4">
              <span className="text-white text-sm font-medium">Click to open</span>
            </div>
          </div>
          {/* Image details */}
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ImageIcon className="w-3 h-3 text-color-purple" />
              <Clock className="w-3 h-3 text-color-foreground-muted" />
              <span className="text-xs text-color-foreground-muted">{formatDate(item.timestamp)}</span>
              {item.model && (
                <span className="text-xs text-color-purple font-medium">
                  {item.model.includes('pro') ? 'Nano Banana Pro' : 'Nano Banana'}
                </span>
              )}
            </div>
            <p className="text-sm mb-1 text-style-2lines">
              {item.prompt}
            </p>
            {(item.aspect_ratio || item.resolution) && (
              <p className="text-xs text-color-foreground-muted">
                {item.aspect_ratio && item.aspect_ratio !== 'auto' && `${item.aspect_ratio} • `}
                {item.resolution}
              </p>
            )}
            <div className="flex items-center gap-2 mt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copyToClipboard(item.prompt || '')}
                className="btn-ghost hover-scale flex-1"
              >
                <Copy className="w-4 h-4 mr-1" />
                Copy
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteItem(item.id, 'image')}
                className="btn-ghost text-red-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <PanelBackground>
      <div className="space-y-4">
      {/* Header with Gradient */}
      <div className="relative rounded-2xl overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent"></div>
        <div className="relative p-6">
          <h2 className="text-2xl font-bold animate-slideIn">History</h2>
          <p className="text-color-foreground-muted">Your recent transcriptions and generated images</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative animate-slideIn" style={{ animationDelay: '100ms' }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-color-foreground-muted" />
        <Input
          type="text"
          placeholder="Search history..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 glass"
        />
      </div>

      {/* History Display */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner"></div>
        </div>
      ) : filteredHistory.length === 0 ? (
        <div className="text-center py-12 animate-fadeIn">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <Search className="w-8 h-8 text-primary" />
          </div>
          <p className="text-color-foreground-muted text-lg">No items found</p>
          {searchTerm && (
            <p className="text-sm text-color-foreground-muted mt-2">Try a different search term</p>
          )}
        </div>
      ) : (
        /* List View */
        <div ref={scrollContainerRef} className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto no-scrollbar">
          {filteredHistory.slice(0, displayLimit).map((item, index) => (
            <div
              key={`${item.type}-${item.id}`}
              className="animate-slideInLeft"
              style={{ animationDelay: `${Math.min(index * 50, 500)}ms` }}
            >
              {renderHistoryCard(item)}
            </div>
          ))}
          {displayLimit < filteredHistory.length && (
            <div className="text-center py-4 text-xs text-color-foreground-muted animate-pulse">
              Scroll for more...
            </div>
          )}
        </div>
      )}
      </div>
    </PanelBackground>
  );
};

export default HistoryPanel;
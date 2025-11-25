import React, { useState, useEffect, useRef } from 'react';
import { Clock, Copy, Trash2, Search, Image as ImageIcon, Download, FileText, FileJson, FolderArchive, X, Check, Loader2 } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import PanelBackground from '../PanelBackground';
import {
  useTranscriptions,
  initializeTranscriptions,
  removeTranscription as removeFromStore,
  getTranscriptionCount,
  updateDisplayLimit
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
  const [showExportModal, setShowExportModal] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [totalTranscriptionCount, setTotalTranscriptionCount] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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

    const handleScroll = async () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // Load more when within 100px of bottom
      if (scrollHeight - scrollTop - clientHeight < 100 && !loading && !loadingMore) {
        const totalItems = totalTranscriptionCount + generatedImages.length;
        if (displayLimit < totalItems) {
          setLoadingMore(true);
          const newLimit = displayLimit + 50;
          setDisplayLimit(newLimit);
          await updateDisplayLimit(newLimit);
          setLoadingMore(false);
        }
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [displayLimit, totalTranscriptionCount, generatedImages.length, loading, loadingMore]);

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
      // Get total count for pagination
      const count = await getTranscriptionCount();
      setTotalTranscriptionCount(count);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, itemId: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(itemId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const copyImageToClipboard = async (imagePath: string, itemId: string) => {
    try {
      const result = await window.electronAPI.copyImageFileToClipboard(imagePath);
      if (result.success) {
        setCopiedId(itemId);
        setTimeout(() => setCopiedId(null), 1500);
      } else {
        console.error('Failed to copy image:', result.error);
      }
    } catch (error) {
      console.error('Failed to copy image to clipboard:', error);
    }
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

  // Export functions
  const exportAsCSV = async () => {
    setExporting('csv');
    setExportSuccess(null);
    try {
      const transcriptionItems = mergedHistory.filter(item => item.type === 'transcription');
      if (transcriptionItems.length === 0) {
        alert('No transcriptions to export');
        return;
      }

      // Create CSV content
      const headers = ['ID', 'Timestamp', 'Text'];
      const rows = transcriptionItems.map(item => [
        item.id.toString(),
        item.timestamp,
        `"${(item.text || '').replace(/"/g, '""')}"` // Escape quotes in CSV
      ]);

      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

      // Save file
      const result = await window.electronAPI.saveFile({
        defaultPath: `transcriptions-${new Date().toISOString().split('T')[0]}.csv`,
        filters: [{ name: 'CSV Files', extensions: ['csv'] }],
        content: csvContent
      });

      if (result?.success) {
        setExportSuccess('csv');
        setTimeout(() => setExportSuccess(null), 2000);
      }
    } catch (error) {
      console.error('Failed to export CSV:', error);
    } finally {
      setExporting(null);
    }
  };

  const exportAsJSON = async () => {
    setExporting('json');
    setExportSuccess(null);
    try {
      const transcriptionItems = mergedHistory.filter(item => item.type === 'transcription');
      if (transcriptionItems.length === 0) {
        alert('No transcriptions to export');
        return;
      }

      const jsonContent = JSON.stringify(transcriptionItems.map(item => ({
        id: item.id,
        timestamp: item.timestamp,
        text: item.text
      })), null, 2);

      const result = await window.electronAPI.saveFile({
        defaultPath: `transcriptions-${new Date().toISOString().split('T')[0]}.json`,
        filters: [{ name: 'JSON Files', extensions: ['json'] }],
        content: jsonContent
      });

      if (result?.success) {
        setExportSuccess('json');
        setTimeout(() => setExportSuccess(null), 2000);
      }
    } catch (error) {
      console.error('Failed to export JSON:', error);
    } finally {
      setExporting(null);
    }
  };

  const exportImages = async () => {
    setExporting('images');
    setExportSuccess(null);
    try {
      const imageItems = mergedHistory.filter(item => item.type === 'image');
      if (imageItems.length === 0) {
        alert('No images to export');
        return;
      }

      // Get image paths
      const imagePaths = imageItems
        .map(item => item.image_path)
        .filter(Boolean) as string[];

      const result = await window.electronAPI.exportImages({
        imagePaths,
        defaultPath: `images-${new Date().toISOString().split('T')[0]}.zip`
      });

      if (result?.success) {
        setExportSuccess('images');
        setTimeout(() => setExportSuccess(null), 2000);
      }
    } catch (error) {
      console.error('Failed to export images:', error);
    } finally {
      setExporting(null);
    }
  };

  const exportAll = async () => {
    setExporting('all');
    setExportSuccess(null);
    try {
      const transcriptionItems = mergedHistory.filter(item => item.type === 'transcription');
      const imageItems = mergedHistory.filter(item => item.type === 'image');

      if (transcriptionItems.length === 0 && imageItems.length === 0) {
        alert('No data to export');
        return;
      }

      // Prepare transcriptions JSON
      const transcriptionsJson = JSON.stringify(transcriptionItems.map(item => ({
        id: item.id,
        timestamp: item.timestamp,
        text: item.text
      })), null, 2);

      // Prepare images metadata
      const imagesJson = JSON.stringify(imageItems.map(item => ({
        id: item.id,
        timestamp: item.timestamp,
        prompt: item.prompt,
        model: item.model,
        aspect_ratio: item.aspect_ratio,
        resolution: item.resolution,
        filename: item.image_path?.split('/').pop()
      })), null, 2);

      // Get image paths
      const imagePaths = imageItems
        .map(item => item.image_path)
        .filter(Boolean) as string[];

      const result = await window.electronAPI.exportAll({
        transcriptionsJson,
        imagesJson,
        imagePaths,
        defaultPath: `openwhispr-export-${new Date().toISOString().split('T')[0]}.zip`
      });

      if (result?.success) {
        setExportSuccess('all');
        setTimeout(() => setExportSuccess(null), 2000);
      }
    } catch (error) {
      console.error('Failed to export all:', error);
    } finally {
      setExporting(null);
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
                onClick={() => copyToClipboard(item.text || '', `transcription-${item.id}`)}
                className={`btn-ghost hover-scale transition-all duration-300 ${
                  copiedId === `transcription-${item.id}`
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : ''
                }`}
              >
                {copiedId === `transcription-${item.id}` ? (
                  <Check className="w-4 h-4 animate-in zoom-in-50 duration-300" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
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
                onClick={() => copyImageToClipboard(item.image_path || '', `image-${item.id}`)}
                className={`btn-ghost hover-scale flex-1 transition-all duration-300 ${
                  copiedId === `image-${item.id}`
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : ''
                }`}
              >
                {copiedId === `image-${item.id}` ? (
                  <>
                    <Check className="w-4 h-4 mr-1 animate-in zoom-in-50 duration-300" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4 mr-1" />
                    Copy Image
                  </>
                )}
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
        <div className="relative p-6 flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold animate-slideIn">History</h2>
            <p className="text-color-foreground-muted">Your recent transcriptions and generated images</p>
          </div>
          <Button
            onClick={() => setShowExportModal(true)}
            className="bg-primary/20 hover:bg-primary/30 text-white"
            size="sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-xl max-w-md w-full overflow-hidden animate-fadeIn">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold text-white">Export History</h3>
              </div>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm text-zinc-400 mb-4">
                Export your {mergedHistory.filter(i => i.type === 'transcription').length} transcriptions and {mergedHistory.filter(i => i.type === 'image').length} images
              </p>

              {/* CSV Export */}
              <button
                onClick={exportAsCSV}
                disabled={exporting !== null}
                className="w-full flex items-center gap-3 p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg border border-zinc-700/50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                  <FileText className="w-5 h-5 text-green-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Export as CSV</p>
                  <p className="text-xs text-zinc-500">Transcriptions only, spreadsheet format</p>
                </div>
                {exporting === 'csv' ? (
                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                ) : exportSuccess === 'csv' ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : null}
              </button>

              {/* JSON Export */}
              <button
                onClick={exportAsJSON}
                disabled={exporting !== null}
                className="w-full flex items-center gap-3 p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg border border-zinc-700/50 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                  <FileJson className="w-5 h-5 text-blue-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Export as JSON</p>
                  <p className="text-xs text-zinc-500">Transcriptions only, developer format</p>
                </div>
                {exporting === 'json' ? (
                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                ) : exportSuccess === 'json' ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : null}
              </button>

              {/* Images Export */}
              <button
                onClick={exportImages}
                disabled={exporting !== null || mergedHistory.filter(i => i.type === 'image').length === 0}
                className="w-full flex items-center gap-3 p-3 bg-zinc-800/50 hover:bg-zinc-800 rounded-lg border border-zinc-700/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                  <ImageIcon className="w-5 h-5 text-purple-400" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Export Images</p>
                  <p className="text-xs text-zinc-500">All generated images as ZIP</p>
                </div>
                {exporting === 'images' ? (
                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                ) : exportSuccess === 'images' ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : null}
              </button>

              {/* Export All */}
              <button
                onClick={exportAll}
                disabled={exporting !== null}
                className="w-full flex items-center gap-3 p-3 bg-gradient-to-r from-primary/20 to-purple-500/20 hover:from-primary/30 hover:to-purple-500/30 rounded-lg border border-primary/30 transition-colors text-left"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center">
                  <FolderArchive className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">Export Everything</p>
                  <p className="text-xs text-zinc-500">All data + images in one ZIP</p>
                </div>
                {exporting === 'all' ? (
                  <Loader2 className="w-5 h-5 text-zinc-400 animate-spin" />
                ) : exportSuccess === 'all' ? (
                  <Check className="w-5 h-5 text-green-400" />
                ) : null}
              </button>
            </div>
            <div className="p-4 border-t border-zinc-800">
              <Button
                onClick={() => setShowExportModal(false)}
                className="w-full"
                variant="outline"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}

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
          {displayLimit < (totalTranscriptionCount + generatedImages.length) && (
            <div className="text-center py-4 text-xs text-color-foreground-muted">
              {loadingMore ? (
                <div className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading more...
                </div>
              ) : (
                <span className="animate-pulse">Scroll for more...</span>
              )}
            </div>
          )}
        </div>
      )}
      </div>
    </PanelBackground>
  );
};

export default HistoryPanel;
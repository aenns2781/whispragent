import React, { useState, useRef, useEffect } from 'react';
import { X, Image as ImageIcon, Upload, Sparkles, Loader2, Check, Send } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from './lib/utils';
import { useSettings } from '../hooks/useSettings';

interface ImageGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Mode = 'generation' | 'editing';
type AspectRatio = 'auto' | '1:1' | '2:3' | '3:2' | '3:4' | '4:3' | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
type Resolution = '1K' | '2K' | '4K';

interface ReferenceImage {
  id: string;
  data: string; // base64
  thumbnail: string; // base64
}

interface GeneratedImageHistory {
  id: string;
  image: string; // base64
  prompt: string;
  timestamp: number;
  aspectRatio: AspectRatio;
  model: string;
}

const ImageGenerationModal: React.FC<ImageGenerationModalProps> = ({ isOpen, onClose }) => {
  const settings = useSettings();

  // State
  const [mode, setMode] = useState<Mode>('generation');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('auto');
  const [resolution, setResolution] = useState<Resolution>('1K');
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [useGoogleSearch, setUseGoogleSearch] = useState(true); // Default enabled for Pro
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3-pro-image-preview');
  const [isCompactMode, setIsCompactMode] = useState(true);
  const [showSuccessCheck, setShowSuccessCheck] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setMode('generation');
      setAspectRatio('auto');
      setResolution('1K');
      setReferenceImages([]);
      setPrompt('');
      setGeneratedImages([]);
      setError(null);
      setIsCompactMode(true); // Reset to compact mode
      setShowSuccessCheck(false);
    } else {
      // Load default model from localStorage when opening
      const savedModel = localStorage.getItem('imageGenerationModel') || 'gemini-3-pro-image-preview';
      setSelectedModel(savedModel);
      setIsCompactMode(true); // Always start in compact mode
      setShowSuccessCheck(false);
      // Enable Google Search by default for Pro models
      setUseGoogleSearch(savedModel.includes('pro'));
    }
  }, [isOpen]);

  // Auto-enable Google Search when switching to Pro model
  useEffect(() => {
    if (selectedModel.includes('pro')) {
      setUseGoogleSearch(true);
    } else {
      setUseGoogleSearch(false);
    }
  }, [selectedModel]);

  // Auto-focus prompt textarea when modal opens or switches to compact mode
  useEffect(() => {
    if (isOpen && promptTextareaRef.current) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        promptTextareaRef.current?.focus();
      }, 100);
    }
  }, [isOpen, isCompactMode]);

  // Auto-resize textarea based on content (up to max height, then scroll)
  useEffect(() => {
    const textarea = promptTextareaRef.current;
    if (textarea && isCompactMode) {
      // Reset height to auto to get accurate scrollHeight
      textarea.style.height = 'auto';
      // Set height to content or max height (120px), whichever is smaller
      const newHeight = Math.min(textarea.scrollHeight, 120);
      textarea.style.height = newHeight + 'px';
    }
  }, [prompt, isCompactMode]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Close modal when window loses focus (both compact and expanded)
  useEffect(() => {
    const handleBlur = () => {
      if (isOpen) {
        onClose();
      }
    };

    window.addEventListener('blur', handleBlur);
    return () => window.removeEventListener('blur', handleBlur);
  }, [isOpen, onClose]);

  // Handle paste events for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!isOpen) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (item.type.startsWith('image/')) {
          e.preventDefault();

          const blob = item.getAsFile();
          if (!blob) continue;

          const reader = new FileReader();
          reader.onload = async (event) => {
            const base64Data = event.target?.result as string;
            await addReferenceImage(base64Data);
          };
          reader.readAsDataURL(blob);
          break;
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen, referenceImages]);

  // Screenshot capture - hides modal during capture
  const captureScreenshot = async () => {
    try {
      setIsCapturingScreenshot(true);
      setError(null);

      // Small delay to let the modal hide
      await new Promise(resolve => setTimeout(resolve, 200));

      const result = await window.electronAPI.captureScreenshot();

      if (result.success && result.screenshot) {
        await addReferenceImage(result.screenshot);
        // Stay in compact mode after screenshot
      } else {
        throw new Error(result.error || 'Screenshot capture failed');
      }
    } catch (err) {
      setError('Failed to capture screenshot. Please check screen recording permissions.');
      console.error('Screenshot error:', err);
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  // Image handling
  const addReferenceImage = async (base64Data: string) => {
    if (referenceImages.length >= 14) {
      setError('Maximum 14 reference images allowed');
      return;
    }

    // Create thumbnail
    const thumbnail = await createThumbnail(base64Data);

    const newImage: ReferenceImage = {
      id: `img-${Date.now()}-${Math.random()}`,
      data: base64Data,
      thumbnail
    };

    setReferenceImages(prev => [...prev, newImage]);
    setError(null);
  };

  const createThumbnail = async (base64Data: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxSize = 80; // Larger thumbnail size
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = base64Data;
    });
  };

  const removeReferenceImage = (id: string) => {
    setReferenceImages(prev => prev.filter(img => img.id !== id));
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return;

    for (let i = 0; i < files.length; i++) {
      if (referenceImages.length >= 14) {
        setError('Maximum 14 reference images allowed');
        break;
      }

      const file = files[i];
      if (!file.type.startsWith('image/')) {
        continue;
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64Data = e.target?.result as string;
        await addReferenceImage(base64Data);
      };
      reader.readAsDataURL(file);
    }
  };

  // Drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    await handleFileSelect(e.dataTransfer.files);
  };

  // Image generation
  const generateImage = async () => {
    if (!prompt.trim()) {
      setError('Please provide a prompt');
      return;
    }

    if (mode === 'editing' && referenceImages.length === 0) {
      setError('Image editing mode requires at least one reference image');
      return;
    }

    if (!settings.geminiApiKey) {
      setError('Gemini API key not configured. Please add it in Settings > AI Models.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setGeneratedImages([]);

    try {
      // Use selected model from state
      const isPro = selectedModel.includes('pro');

      // Generate image with optional Google Search grounding
      const result = await window.electronAPI.generateImage({
        prompt: prompt.trim(),
        modelId: selectedModel,
        aspectRatio: aspectRatio === 'auto' ? undefined : aspectRatio, // Don't specify if auto
        resolution: isPro ? resolution : '1K',
        referenceImages: referenceImages.map(img => img.data),
        apiKey: settings.geminiApiKey,
        useGoogleSearch: useGoogleSearch && isPro // Only Pro supports Google Search
      });

      if (!result.success) {
        throw new Error(result.error || 'Image generation failed');
      }

      // Handle multiple images from API response
      const images = result.images || [result.image];
      setGeneratedImages(images);

      // Copy first image to clipboard
      await window.electronAPI.writeClipboard(images[0]);

      // Save all images to disk and database
      const usedPrompt = prompt.trim();
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        const filename = `generated-${Date.now()}-${i}.png`;

        // Save to Downloads folder (no custom path needed)
        const saveResult = await window.electronAPI.saveGeneratedImage({
          image,
          savePath: null, // Will use Downloads folder
          filename
        });

        // Save to database with file path
        if (saveResult.success && saveResult.filePath) {
          await window.electronAPI.saveGeneratedImageToDb({
            prompt: usedPrompt,
            imagePath: saveResult.filePath,
            model: selectedModel,
            aspectRatio: aspectRatio === 'auto' ? null : aspectRatio,
            resolution: isPro ? resolution : '1K'
          });
        }
      }

      // Show success checkmark in compact mode
      if (isCompactMode) {
        setShowSuccessCheck(true);
        // Clear prompt after successful generation
        setPrompt('');
        setTimeout(() => {
          setShowSuccessCheck(false);
          // Re-focus input after success message
          promptTextareaRef.current?.focus();
        }, 2500);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate image. Please try again.');
      console.error('Generation error:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isOpen || isCapturingScreenshot) return null;

  // Compact mode - minimal input at bottom center
  if (isCompactMode) {
    return (
      <>
        {/* Backdrop - click outside to close */}
        <div
          className="fixed inset-0 z-50 bg-transparent animate-in fade-in duration-200"
          onClick={onClose}
        />

        {/* Modal content */}
        <div className="fixed inset-0 z-50 pointer-events-none flex items-end justify-center pb-8">
          <div
            className="pointer-events-auto bg-zinc-900/95 backdrop-blur-xl border border-zinc-700/50 rounded-xl shadow-2xl p-2 flex flex-col gap-2 min-w-[520px] max-w-[600px] transition-all duration-500 ease-out animate-in slide-in-from-bottom-8 zoom-in-95 fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              {/* Reference images count badge */}
              {referenceImages.length > 0 && (
                <div className="flex items-center gap-1.5 h-9 px-2.5 bg-zinc-800/80 border border-zinc-700/50 rounded-lg">
                  <ImageIcon className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-xs text-zinc-400 font-medium">{referenceImages.length}</span>
                </div>
              )}

              {/* Text input container with send button */}
              <div className="flex-1 flex items-center gap-2 bg-zinc-800/80 rounded-lg px-3 py-2 min-h-[36px] transition-all outline-none">
                <textarea
                  ref={promptTextareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !isGenerating) {
                      e.preventDefault();
                      generateImage();
                    } else if (e.key === 'Escape') {
                      onClose();
                    }
                  }}
                  placeholder="Describe the image you want to generate..."
                  className="flex-1 bg-transparent border-none text-white placeholder-zinc-500 text-sm focus:outline-none resize-none overflow-y-auto leading-tight [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-zinc-600 [&::-webkit-scrollbar-thumb]:rounded-full"
                  disabled={isGenerating}
                  rows={1}
                  style={{ minHeight: '20px', maxHeight: '120px' }}
                />

                {/* Send button */}
                {prompt.trim() && !isGenerating && !showSuccessCheck && (
                  <button
                    onClick={generateImage}
                    className="flex-shrink-0 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-lg p-2 transition-all duration-150"
                    title="Generate (Enter)"
                  >
                    <Send className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Right side controls */}
              {showSuccessCheck ? (
                <div className="flex items-center gap-2 h-9 px-3 bg-green-500/20 border border-green-500/30 rounded-lg animate-in zoom-in-90 fade-in duration-200">
                  <Check className="w-4 h-4 text-green-400" />
                  <span className="text-xs text-green-400 font-medium">Copied!</span>
                </div>
              ) : isGenerating ? (
                <div className="flex items-center justify-center h-9 w-9 bg-zinc-800/80 border border-zinc-700/50 rounded-lg">
                  <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                </div>
              ) : (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={captureScreenshot}
                    className="bg-zinc-800/80 hover:bg-zinc-700 border border-zinc-700/50 text-white h-9 w-9 p-0 transition-all"
                    title="Screenshot"
                  >
                    <ImageIcon className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setIsCompactMode(false)}
                    className="bg-purple-600 hover:bg-purple-700 active:bg-purple-800 border-0 text-white h-9 w-9 p-0 transition-all"
                    title="Expand"
                  >
                    <Sparkles className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </div>

            {error && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2 animate-in fade-in slide-in-from-top-1">
                {error}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // Full mode - complete modal
  return (
    <>
      {/* Backdrop with blur */}
      <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm animate-in fade-in duration-300" />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-900/95 backdrop-blur-md border border-zinc-700 rounded-lg w-full max-w-4xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 slide-in-from-bottom-8 fade-in duration-500 ease-out">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-semibold text-white">AI Image Generation</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCompactMode(true)}
              className="text-zinc-400 hover:text-white transition-colors"
              title="Minimize"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-zinc-900 [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-zinc-800 hover:[&::-webkit-scrollbar-thumb]:bg-zinc-600">
          {/* Mode Toggle */}
          <div className="flex gap-2">
            <Button
              onClick={() => setMode('generation')}
              className={cn(
                "flex-1",
                mode === 'generation'
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-zinc-900 hover:bg-zinc-800"
              )}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              Image Generation
            </Button>
            <Button
              onClick={() => setMode('editing')}
              className={cn(
                "flex-1",
                mode === 'editing'
                  ? "bg-purple-600 hover:bg-purple-700"
                  : "bg-zinc-900 hover:bg-zinc-800"
              )}
            >
              <ImageIcon className="w-4 h-4 mr-2" />
              Image Editing
            </Button>
          </div>

          {/* Generation/Editing Mode Content */}
              {/* Reference Images */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300">
                    Reference Images {mode === 'editing' && <span className="text-red-400">*</span>}
                  </label>
                  <span className="text-xs text-zinc-500">{referenceImages.length}/14</span>
                </div>

                {/* Image Horizontal Scroll */}
                {referenceImages.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-track]:bg-zinc-900 [&::-webkit-scrollbar-thumb]:bg-zinc-700 [&::-webkit-scrollbar-thumb]:rounded-full">
                    {referenceImages.map((img) => (
                      <div key={img.id} className="relative group flex-shrink-0">
                        <img
                          src={img.thumbnail}
                          alt="Reference"
                          className="w-20 h-20 object-cover rounded border border-zinc-700"
                        />
                        <button
                          onClick={() => removeReferenceImage(img.id)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

            {/* Upload Zone */}
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                "border-2 border-dashed rounded-lg p-3 transition-colors",
                isDragging
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-zinc-800 bg-zinc-950/50"
              )}
            >
              <div className="flex items-center justify-center gap-2">
                <Button
                  size="sm"
                  onClick={captureScreenshot}
                  className="bg-zinc-900 hover:bg-zinc-800 text-xs h-7"
                  disabled={referenceImages.length >= 14}
                >
                  <ImageIcon className="w-3 h-3 mr-1.5" />
                  Screenshot
                </Button>
                <Button
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-zinc-900 hover:bg-zinc-800 text-xs h-7"
                  disabled={referenceImages.length >= 14}
                >
                  <Upload className="w-3 h-3 mr-1.5" />
                  Upload
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => handleFileSelect(e.target.files)}
                  className="hidden"
                />
              </div>
              <p className="text-xs text-zinc-500 text-center mt-1.5">
                Drag, drop, or paste images (Cmd+V)
              </p>
            </div>
          </div>

          {/* Prompt */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-300">
              Prompt <span className="text-red-400">*</span>
            </label>
            <textarea
              ref={promptTextareaRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the image you want to generate..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-xs text-white placeholder-zinc-500 resize-none focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows={3}
            />
            <p className="text-xs text-zinc-500">
              Tip: Use your dictation hotkey to voice-type if needed
            </p>
          </div>

          {/* Settings */}
          <div className="space-y-3">
            {/* Model Selection */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Model</label>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white"
              >
                <option value="gemini-2.5-flash-image">Nano Banana (Fast)</option>
                <option value="gemini-3-pro-image-preview">Nano Banana Pro (4K + Search)</option>
              </select>
            </div>

            {/* Google Search Grounding (Pro only) */}
            {selectedModel.includes('pro') && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-zinc-300">Google Search Grounding</label>
                  <button
                    onClick={() => setUseGoogleSearch(!useGoogleSearch)}
                    className={cn(
                      "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
                      useGoogleSearch ? "bg-purple-600" : "bg-zinc-700"
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                        useGoogleSearch ? "translate-x-5" : "translate-x-0.5"
                      )}
                    />
                  </button>
                </div>
                <p className="text-xs text-zinc-500">
                  Uses real-time data for weather, stocks, events, etc.
                </p>
              </div>
            )}

            {/* Aspect Ratio */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Aspect Ratio</label>
              <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white"
              >
                <option value="auto">Auto (Let AI decide)</option>
                <option value="1:1">1:1 (Square)</option>
                <option value="16:9">16:9 (Landscape)</option>
                <option value="9:16">9:16 (Portrait)</option>
                <option value="21:9">21:9 (Ultrawide)</option>
                <option value="2:3">2:3</option>
                <option value="3:2">3:2</option>
                <option value="3:4">3:4</option>
                <option value="4:3">4:3</option>
                <option value="4:5">4:5</option>
                <option value="5:4">5:4</option>
              </select>
            </div>

            {/* Resolution (Pro only) */}
            {selectedModel.includes('pro') && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Resolution</label>
                <div className="flex gap-2">
                  {(['1K', '2K', '4K'] as Resolution[]).map((res) => (
                    <Button
                      key={res}
                      onClick={() => setResolution(res)}
                      className={cn(
                        "flex-1 text-xs h-7",
                        resolution === res
                          ? "bg-purple-600 hover:bg-purple-700"
                          : "bg-zinc-800 hover:bg-zinc-700"
                      )}
                    >
                      {res}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </div>

              {/* Error */}
              {error && (
                <div className="p-2 bg-red-500/10 border border-red-500/30 rounded text-xs text-red-400 animate-in slide-in-from-top-2 fade-in duration-200">
                  {error}
                </div>
              )}

              {/* Generated Images */}
              {generatedImages.length > 0 && (
                <div className="space-y-2 animate-in slide-in-from-bottom-4 fade-in duration-300">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-zinc-300">Generated Images</label>
                    <span className="text-xs text-green-400">✓ Copied to clipboard & Downloads</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {generatedImages.map((img, idx) => (
                      <div key={idx} className="group relative bg-zinc-800 rounded overflow-hidden border border-zinc-700 hover:border-purple-500 transition-colors">
                        <img
                          src={img}
                          alt={`Generated ${idx + 1}`}
                          className="w-full aspect-square object-cover"
                        />
                        <button
                          onClick={() => copyImageToClipboard(img)}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
        </div>

        {/* Actions Footer */}
        <div className="flex gap-2 p-4 border-t border-zinc-800 flex-shrink-0">
          <Button
            onClick={onClose}
            className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-xs h-8"
            disabled={isGenerating}
          >
            Cancel
          </Button>
          <Button
            onClick={generateImage}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-xs h-8"
            disabled={isGenerating || !prompt.trim()}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-3 h-3 mr-1.5" />
                Generate Image
              </>
            )}
          </Button>
        </div>
        </div>
      </div>
    </>
  );
};

export default ImageGenerationModal;

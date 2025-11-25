import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { Alert, AlertDescription } from "./ui/alert";
import {
  Download,
  Trash2,
  AlertCircle,
  ExternalLink,
  Globe,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight
} from "lucide-react";
import { useDialogs } from "../hooks/useDialogs";
import { useToast } from "./ui/Toast";
import { formatBytes } from "../utils/formatBytes";
import "../types/electron";

// Hardcoded model sizes from Hugging Face
const WHISPER_MODEL_SIZES: Record<string, string> = {
  // Multilingual
  tiny: "39 MB",
  base: "74 MB",
  small: "244 MB",
  medium: "769 MB",
  large: "1.5 GB",
  turbo: "809 MB",
  // English-only
  "tiny.en": "39 MB",
  "base.en": "74 MB",
  "small.en": "244 MB",
  "medium.en": "769 MB"
};

// Model descriptions
const WHISPER_MODEL_DESCRIPTIONS: Record<string, string> = {
  tiny: "Fastest, lower quality",
  base: "Good balance (recommended)",
  small: "Better quality, slower",
  medium: "High quality",
  large: "Best quality, slowest",
  turbo: "Fast with good quality",
  "tiny.en": "Fastest, English optimized",
  "base.en": "Good balance, English optimized",
  "small.en": "Best for English speakers",
  "medium.en": "High quality, English optimized"
};

interface Model {
  id: string;
  name: string;
  model?: string; // For Whisper compatibility
  size: string;
  size_mb?: number;
  sizeBytes?: number;
  description: string;
  downloaded?: boolean;
  isDownloaded?: boolean;
  recommended?: boolean;
  englishOnly?: boolean;
  type: 'whisper' | 'llm';
}

interface DownloadProgress {
  percentage: number;
  downloadedBytes: number;
  totalBytes: number;
  speed?: number;
  eta?: number;
}

interface UnifiedModelPickerProps {
  selectedModel: string;
  onModelSelect: (modelId: string) => void;
  modelType: 'whisper' | 'llm';
  className?: string;
  variant?: "onboarding" | "settings";
}

const VARIANT_STYLES = {
  onboarding: {
    container: "bg-card p-4 rounded-lg border border-border",
    progress: "bg-secondary border-b border-border",
    progressText: "text-foreground",
    progressBar: "bg-secondary",
    progressFill: "bg-primary",
    header: "font-medium text-foreground mb-3",
    modelCard: {
      selected: "border-primary bg-primary/10",
      default: "border-border bg-card hover:border-primary/50",
    },
    badges: {
      selected: "text-xs text-primary bg-primary/10 px-2 py-1 rounded-full font-medium",
      downloaded: "text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded",
    },
    buttons: {
      download: "bg-primary hover:bg-primary/90 text-primary-foreground",
      select: "border-border text-foreground hover:bg-secondary",
      delete: "text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20",
      refresh: "border-border text-foreground hover:bg-secondary",
    },
  },
  settings: {
    container: "bg-card border border-border rounded-lg overflow-hidden",
    progress: "bg-secondary border-b border-border",
    progressText: "text-foreground",
    progressBar: "bg-secondary",
    progressFill: "bg-primary",
    header: "font-medium text-foreground",
    modelCard: {
      selected: "border-primary bg-primary/10",
      default: "border-border bg-card hover:border-primary/50",
    },
    badges: {
      selected: "text-xs text-primary bg-primary/10 px-2 py-1 rounded-full font-medium",
      downloaded: "text-xs text-green-500 bg-green-500/10 px-2 py-1 rounded-md",
    },
    buttons: {
      download: "bg-primary hover:bg-primary/90 text-primary-foreground",
      select: "border-primary text-primary hover:bg-primary/10",
      delete: "text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20",
      refresh: "border-primary text-primary hover:bg-primary/10",
    },
  },
};

function formatETA(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

// Export the compact variant for cloud models
export function UnifiedModelPickerCompact({
  selectedModel,
  onModelSelect,
  models,
  className = "",
}: {
  selectedModel: string;
  onModelSelect: (modelId: string) => void;
  models: Array<{ value: string; label: string; description?: string; icon?: string }>;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {models.map((model) => (
        <button
          key={model.value}
          onClick={() => onModelSelect(model.value)}
          className={`w-full p-3 rounded-lg border-2 text-left transition-all ${selectedModel === model.value
            ? 'border-primary bg-primary/10'
            : 'border-border bg-card hover:border-primary/50'
            }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                {model.icon ? (
                  <img src={model.icon} alt="" className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Globe className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
                )}
                <span className="font-medium text-foreground">{model.label}</span>
              </div>
              {model.description && (
                <div className="text-xs text-muted-foreground mt-1">{model.description}</div>
              )}
            </div>
            {selectedModel === model.value && (
              <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-full font-medium">
                ✓ Selected
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}

export default function UnifiedModelPicker({
  selectedModel,
  onModelSelect,
  modelType,
  className = "",
  variant = "settings",
}: UnifiedModelPickerProps) {
  const [models, setModels] = useState<Model[]>([]);
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({
    percentage: 0,
    downloadedBytes: 0,
    totalBytes: 0,
  });
  const [loadingModels, setLoadingModels] = useState(false);
  const [showEnglishOnly, setShowEnglishOnly] = useState(false);
  const [llamaCppStatus, setLlamaCppStatus] = useState<{
    isInstalled: boolean;
    version?: string;
    checking: boolean;
  }>({ isInstalled: true, checking: false }); // Default to true for now

  const { showAlertDialog } = useDialogs();
  const { toast } = useToast();
  const styles = useMemo(() => VARIANT_STYLES[variant], [variant]);

  // Check llama.cpp installation for LLM models
  // Commented out for now - defaulting to installed
  /*
  useEffect(() => {
    if (modelType === 'llm') {
      const checkLlamaCpp = async () => {
        try {
          const result = await window.electronAPI?.llamaCppCheck();
          setLlamaCppStatus({
            isInstalled: result?.isInstalled || false,
            version: result?.version,
            checking: false,
          });
        } catch {
          setLlamaCppStatus({ isInstalled: false, checking: false });
        }
      };
      checkLlamaCpp();
    }
  }, [modelType]);
  */

  const loadModels = useCallback(async () => {
    try {
      setLoadingModels(true);

      if (modelType === 'whisper') {
        const result = await window.electronAPI.listWhisperModels();
        if (result.success) {
          const whisperModels: Model[] = result.models.map((m: any) => {
            // Format display name (capitalize, handle .en suffix)
            let displayName = m.model.charAt(0).toUpperCase() + m.model.slice(1);
            if (m.model.endsWith('.en')) {
              displayName = displayName.replace('.en', ' (English)');
            }

            return {
              ...m,
              id: m.model,
              name: displayName,
              size: WHISPER_MODEL_SIZES[m.model] || (m.size_mb ? `${m.size_mb} MB` : 'Unknown'),
              description: WHISPER_MODEL_DESCRIPTIONS[m.model] || "Model",
              type: 'whisper' as const,
              isDownloaded: m.downloaded,
              recommended: m.model === 'base' || m.model === 'small.en',
              englishOnly: m.english_only || m.model.endsWith('.en')
            };
          });
          setModels(whisperModels);
        }
      } else {
        console.log('[UnifiedModelPicker] Loading LLM models...');
        const result = await window.electronAPI.modelGetAll();
        console.log('[UnifiedModelPicker] Got result:', result);

        if (!result || !Array.isArray(result)) {
          console.error('[UnifiedModelPicker] Invalid result format:', result);
          setModels([]);
          return;
        }

        const llmModels: Model[] = result.map((m: any) => ({
          ...m,
          type: 'llm' as const,
          downloaded: m.isDownloaded
        }));
        console.log('[UnifiedModelPicker] Mapped models:', llmModels);
        setModels(llmModels);
      }
    } catch (error) {
      console.error("[UnifiedModelPicker] Failed to load models:", error);
      setModels([]);
    } finally {
      setLoadingModels(false);
    }
  }, [modelType]);

  useEffect(() => {
    loadModels();
  }, [loadModels]);

  useEffect(() => {
    const handleModelsCleared = () => {
      loadModels();
    };

    window.addEventListener("openwhispr-models-cleared", handleModelsCleared);
    return () => {
      window.removeEventListener("openwhispr-models-cleared", handleModelsCleared);
    };
  }, [loadModels]);

  const handleDownloadProgress = useCallback((_event: any, data: any) => {
    if (modelType === 'whisper') {
      // Whisper progress format
      if (data.type === "progress") {
        const progress: DownloadProgress = {
          percentage: data.percentage || 0,
          downloadedBytes: data.downloaded_bytes || 0,
          totalBytes: data.total_bytes || 0,
        };

        if (data.speed_mbps && data.speed_mbps > 0) {
          const remainingBytes = progress.totalBytes - progress.downloadedBytes;
          progress.eta = (remainingBytes * 8) / (data.speed_mbps * 1_000_000);
          progress.speed = data.speed_mbps;
        }

        setDownloadProgress(progress);
      } else if (data.type === "complete" || data.type === "error") {
        setDownloadingModel(null);
        setDownloadProgress({ percentage: 0, downloadedBytes: 0, totalBytes: 0 });
        loadModels();
      }
    } else {
      // LLM progress format
      setDownloadProgress({
        percentage: data.progress || 0,
        downloadedBytes: data.downloadedSize || 0,
        totalBytes: data.totalSize || 0,
      });
    }
  }, [modelType, loadModels]);

  useEffect(() => {
    if (modelType === 'whisper') {
      window.electronAPI.onWhisperDownloadProgress(handleDownloadProgress);
    } else {
      window.electronAPI.onModelDownloadProgress(handleDownloadProgress);
    }
  }, [handleDownloadProgress, modelType]);

  const downloadModel = useCallback(async (modelId: string) => {
    try {
      setDownloadingModel(modelId);
      setDownloadProgress({ percentage: 0, downloadedBytes: 0, totalBytes: 0 });
      onModelSelect(modelId);

      if (modelType === 'whisper') {
        const result = await window.electronAPI.downloadWhisperModel(modelId);
        if (!result.success && !result.error?.includes("interrupted by user")) {
          showAlertDialog({
            title: "Download Failed",
            description: `Failed to download model: ${result.error}`,
          });
        }
      } else {
        await window.electronAPI.modelDownload(modelId);
      }

      await loadModels();
    } catch (error: any) {
      if (!error.toString().includes("interrupted by user")) {
        showAlertDialog({
          title: "Download Failed",
          description: `Failed to download model: ${error}`,
        });
      }
    } finally {
      setDownloadingModel(null);
      setDownloadProgress({ percentage: 0, downloadedBytes: 0, totalBytes: 0 });
    }
  }, [modelType, onModelSelect, loadModels, showAlertDialog]);

  const deleteModel = useCallback(async (modelId: string) => {
    // Use native confirm dialog
    const confirmed = window.confirm(
      `Delete ${modelId.toUpperCase()} model?\n\nYou'll need to re-download it if you want to use it again.`
    );

    if (!confirmed) return;

    try {
      if (modelType === 'whisper') {
        const result = await window.electronAPI.deleteWhisperModel(modelId);
        if (result.success) {
          toast({
            title: "Model Deleted",
            description: `Model deleted successfully! Freed ${result.freed_mb || 0}MB of disk space.`,
          });
        }
      } else {
        await window.electronAPI.modelDelete(modelId);
        toast({
          title: "Model Deleted",
          description: "Model deleted successfully!",
        });
      }
      loadModels();
    } catch (error) {
      console.error("Failed to delete model:", error);
      alert(`Failed to delete model: ${error}`);
    }
  }, [modelType, loadModels, toast]);

  const handleInstallLlamaCpp = async () => {
    try {
      const result = await window.electronAPI?.llamaCppInstall();
      if (result?.success) {
        const status = await window.electronAPI?.llamaCppCheck();
        setLlamaCppStatus({
          isInstalled: status?.isInstalled || false,
          version: status?.version,
          checking: false,
        });
        loadModels();
      }
    } catch (error) {
      console.error("Installation error:", error);
    }
  };

  // Show llama.cpp installation prompt for LLM models
  if (modelType === 'llm' && !llamaCppStatus.isInstalled && !llamaCppStatus.checking) {
    return (
      <div className={`${styles.container} ${className}`}>
        <div className="p-4">
          <h3 className="text-lg font-semibold mb-4">Local AI Models</h3>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="space-y-3">
              <p>llama.cpp is required to run local AI models.</p>
              <div className="flex items-center gap-3">
                <Button onClick={handleInstallLlamaCpp} size="sm">
                  Install llama.cpp
                </Button>
                <Button
                  variant="link"
                  className="p-0 h-auto text-primary"
                  onClick={() => window.electronAPI?.openExternal("https://github.com/ggerganov/llama.cpp#installation")}
                >
                  Manual installation
                  <ExternalLink className="ml-1 h-3 w-3" />
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const progressDisplay = useMemo(() => {
    if (!downloadingModel) return null;

    const { percentage, speed, eta } = downloadProgress;
    const progressText = `${Math.round(percentage)}%`;
    const speedText = speed ? ` • ${speed.toFixed(1)} MB/s` : "";
    const etaText = eta ? ` • ETA: ${formatETA(eta)}` : "";

    return (
      <div className={`${styles.progress} p-3`}>
        <div className="flex items-center justify-between mb-2">
          <span className={`text-sm font-medium ${styles.progressText}`}>
            Downloading {models.find(m => m.id === downloadingModel)?.name || downloadingModel}...
          </span>
          <span className={`text-xs ${styles.progressText}`}>
            {progressText}{speedText}{etaText}
          </span>
        </div>
        <div className={`w-full ${styles.progressBar} rounded-full h-2`}>
          <div
            className={`${styles.progressFill} h-2 rounded-full transition-all duration-300 ease-out`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    );
  }, [downloadingModel, downloadProgress, models, styles]);

  // Split models into standard and English-only
  const standardModels = models.filter(m => !m.englishOnly);
  const englishOnlyModels = models.filter(m => m.englishOnly);

  // Helper to render a model card
  const renderModelCard = (model: Model) => {
    const modelId = model.id || model.model || '';
    const isSelected = modelId === selectedModel;
    const isDownloading = downloadingModel === modelId;
    const isDownloaded = model.downloaded || model.isDownloaded;

    return (
      <div
        key={modelId}
        onClick={() => {
          if (isDownloaded && !isSelected) {
            onModelSelect(modelId);
          }
        }}
        className={`relative flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
          isSelected
            ? 'border-green-500 bg-green-500/10 ring-1 ring-green-500/30'
            : isDownloaded
              ? 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 cursor-pointer'
              : 'border-zinc-800 bg-zinc-900/50'
        }`}
      >
        {/* Selected indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2">
            <div className="flex items-center gap-1 text-xs text-green-400 bg-green-500/20 px-2 py-1 rounded-full">
              <Check size={12} />
              <span>Active</span>
            </div>
          </div>
        )}

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{model.name}</span>
            {model.recommended && (
              <span className="text-[10px] uppercase tracking-wide bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded font-medium">
                Recommended
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-zinc-400">{model.description}</span>
            <span className="text-xs text-zinc-500">•</span>
            <span className="text-xs text-zinc-500">{model.size}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isDownloaded && !isSelected && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                deleteModel(modelId);
              }}
              size="sm"
              variant="ghost"
              className="text-zinc-500 hover:text-red-400 hover:bg-red-500/10 h-8 w-8 p-0"
            >
              <Trash2 size={14} />
            </Button>
          )}
          {isDownloaded && isSelected && (
            <span className="text-xs text-zinc-500">In use</span>
          )}
          {!isDownloaded && !isDownloading && (
            <Button
              onClick={(e) => {
                e.stopPropagation();
                downloadModel(modelId);
              }}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download size={14} className="mr-1" />
              Download
            </Button>
          )}
          {isDownloading && (
            <Button disabled size="sm" className="bg-blue-600/50 text-white">
              <Loader2 size={14} className="mr-1 animate-spin" />
              {`${Math.round(downloadProgress.percentage)}%`}
            </Button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`${styles.container} ${className}`}>
      {progressDisplay}

      <div className={variant === 'onboarding' ? 'p-2' : 'p-4'}>
        {variant !== 'onboarding' && (
          <h5 className={`${styles.header} mb-3`}>
            {modelType === 'whisper' ? 'Whisper Models' : 'Local AI Models'}
          </h5>
        )}

        {/* Standard multilingual models */}
        <div className="space-y-2">
          {standardModels.map(renderModelCard)}
        </div>

        {/* English-only models collapsible section */}
        {modelType === 'whisper' && englishOnlyModels.length > 0 && (
          <div className="mt-4">
            <button
              onClick={() => setShowEnglishOnly(!showEnglishOnly)}
              className="w-full flex items-center gap-2 p-3 rounded-lg bg-zinc-800/30 hover:bg-zinc-800/50 border border-zinc-700/50 transition-colors text-left"
            >
              {showEnglishOnly ? (
                <ChevronDown size={16} className="text-zinc-400" />
              ) : (
                <ChevronRight size={16} className="text-zinc-400" />
              )}
              <div className="flex-1">
                <span className="text-sm font-medium text-zinc-300">English-Only Models</span>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Slightly faster & more accurate if you only speak English
                </p>
              </div>
              <span className="text-xs text-zinc-500 bg-zinc-700/50 px-2 py-1 rounded">
                {englishOnlyModels.length} models
              </span>
            </button>

            {showEnglishOnly && (
              <div className="space-y-2 mt-2 pl-2 border-l-2 border-zinc-700/50">
                {englishOnlyModels.map(renderModelCard)}
              </div>
            )}
          </div>
        )}

        {modelType === 'llm' && (
          <div className="mt-6 text-xs text-muted-foreground">
            <p>Models are stored in: ~/.cache/openwhispr/models/</p>
          </div>
        )}
      </div>
    </div>
  );
}

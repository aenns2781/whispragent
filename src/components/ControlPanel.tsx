import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Trash2, Settings, FileText, Mic, X, Download, ChevronDown } from "lucide-react";
import SettingsModal from "./SettingsModal";
import TitleBar from "./TitleBar";
import TranscriptionItem from "./ui/TranscriptionItem";
import { ConfirmDialog, AlertDialog } from "./ui/dialog";
import { useDialogs } from "../hooks/useDialogs";
import { useHotkey } from "../hooks/useHotkey";
import { useToast } from "./ui/Toast";
import {
  useTranscriptions,
  initializeTranscriptions,
  removeTranscription as removeFromStore,
  clearTranscriptions as clearStoreTranscriptions,
  updateDisplayLimit,
  getTranscriptionCount,
} from "../stores/transcriptionStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

export default function ControlPanel() {
  const history = useTranscriptions();
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const { hotkey } = useHotkey();
  const { toast } = useToast();
  const [updateStatus, setUpdateStatus] = useState({
    updateAvailable: false,
    updateDownloaded: false,
    isDevelopment: false,
  });
  const isWindows = typeof window !== "undefined" && window.electronAPI?.getPlatform?.() === "win32";
  const [displayLimit, setDisplayLimit] = useState<number>(
    parseInt(localStorage.getItem("transcriptionDisplayLimit") || "50")
  );
  const [totalCount, setTotalCount] = useState<number>(0);

  const {
    confirmDialog,
    alertDialog,
    showConfirmDialog,
    showAlertDialog,
    hideConfirmDialog,
    hideAlertDialog,
  } = useDialogs();

  const handleClose = () => {
    void window.electronAPI.windowClose();
  };

  useEffect(() => {
    loadTranscriptions();

    // Initialize update status
    const initializeUpdateStatus = async () => {
      try {
        const status = await window.electronAPI.getUpdateStatus();
        setUpdateStatus(status);
      } catch (error) {
        // Update status not critical for app function
      }
    };

    initializeUpdateStatus();

    // Listen for new transcriptions to update count
    const updateCount = async () => {
      const count = await getTranscriptionCount();
      setTotalCount(count);
    };

    const handleTranscriptionAdded = () => {
      updateCount();
    };

    if (window.electronAPI?.onTranscriptionAdded) {
      const dispose = window.electronAPI.onTranscriptionAdded(handleTranscriptionAdded);
      return () => {
        if (typeof dispose === "function") dispose();
      };
    }

    // Set up update event listeners
    const handleUpdateAvailable = (_event: any, _info: any) => {
      setUpdateStatus((prev) => ({ ...prev, updateAvailable: true }));
    };

    const handleUpdateDownloaded = (_event: any, _info: any) => {
      setUpdateStatus((prev) => ({ ...prev, updateDownloaded: true }));
    };

    const handleUpdateError = (_event: any, _error: any) => {
      // Update errors are handled by the update service
    };

    window.electronAPI.onUpdateAvailable(handleUpdateAvailable);
    window.electronAPI.onUpdateDownloaded(handleUpdateDownloaded);
    window.electronAPI.onUpdateError(handleUpdateError);

    // Cleanup listeners on unmount
    return () => {
      window.electronAPI.removeAllListeners?.("update-available");
      window.electronAPI.removeAllListeners?.("update-downloaded");
      window.electronAPI.removeAllListeners?.("update-error");
    };
  }, []);

  const loadTranscriptions = async () => {
    try {
      setIsLoading(true);
      await initializeTranscriptions(displayLimit);
      const count = await getTranscriptionCount();
      setTotalCount(count);
    } catch (error) {
      showAlertDialog({
        title: "Unable to load history",
        description: "Please try again in a moment.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisplayLimitChange = async (newLimit: string) => {
    const limit = parseInt(newLimit);
    setDisplayLimit(limit);
    localStorage.setItem("transcriptionDisplayLimit", newLimit);
    try {
      await updateDisplayLimit(limit);
    } catch (error) {
      showAlertDialog({
        title: "Unable to update display limit",
        description: "Please try again.",
      });
    }
  };

  const exportTranscriptions = async (format: "csv" | "json" | "txt") => {
    try {
      console.log("Starting export...", format);

      if (!window.electronAPI?.getAllTranscriptions) {
        console.error("getAllTranscriptions method not available");
        toast({
          title: "Export Failed",
          description: "Export function not available. Please restart the app.",
          variant: "destructive",
        });
        return;
      }

      const allTranscriptions = await window.electronAPI.getAllTranscriptions();
      console.log("Fetched transcriptions:", allTranscriptions?.length);

      if (!allTranscriptions || allTranscriptions.length === 0) {
        toast({
          title: "No Data to Export",
          description: "There are no transcriptions to export.",
          variant: "destructive",
        });
        return;
      }

      let content = "";
      let filename = "";
      let mimeType = "";

      switch (format) {
        case "csv":
          content = "ID,Timestamp,Text\n";
          content += allTranscriptions
            .map((t: any) => {
              const escapedText = `"${t.text.replace(/"/g, '""')}"`;
              return `${t.id},"${t.timestamp}",${escapedText}`;
            })
            .join("\n");
          filename = `transcriptions-${new Date().toISOString().split("T")[0]}.csv`;
          mimeType = "text/csv";
          break;
        case "json":
          content = JSON.stringify(allTranscriptions, null, 2);
          filename = `transcriptions-${new Date().toISOString().split("T")[0]}.json`;
          mimeType = "application/json";
          break;
        case "txt":
          content = allTranscriptions
            .map((t: any) => `[${t.timestamp}]\n${t.text}\n`)
            .join("\n---\n\n");
          filename = `transcriptions-${new Date().toISOString().split("T")[0]}.txt`;
          mimeType = "text/plain";
          break;
      }

      console.log("Generated content, creating blob...");

      // Create blob and download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log("Export successful!");
      toast({
        title: "Export Successful",
        description: `Exported ${allTranscriptions.length} transcriptions as ${format.toUpperCase()}`,
        variant: "success",
        duration: 3000,
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Export Failed",
        description: error instanceof Error ? error.message : "Failed to export transcriptions",
        variant: "destructive",
      });
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: "Text copied to your clipboard",
        variant: "success",
        duration: 2000,
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy text to clipboard",
        variant: "destructive",
      });
    }
  };

  const clearHistory = async () => {
    showConfirmDialog({
      title: "Clear History",
      description:
        "Are you certain you wish to clear all inscribed records? This action cannot be undone.",
      onConfirm: async () => {
        try {
          const result = await window.electronAPI.clearTranscriptions();
          clearStoreTranscriptions();
          setTotalCount(0);
          showAlertDialog({
            title: "History Cleared",
            description: `Successfully cleared ${result.cleared} transcriptions from your chronicles.`,
          });
        } catch (error) {
          showAlertDialog({
            title: "Error",
            description: "Failed to clear history. Please try again.",
          });
        }
      },
      variant: "destructive",
    });
  };

  const deleteTranscription = async (id: number) => {
    showConfirmDialog({
      title: "Delete Transcription",
      description:
        "Are you certain you wish to remove this inscription from your records?",
      onConfirm: async () => {
        try {
          const result = await window.electronAPI.deleteTranscription(id);
          if (result.success) {
            removeFromStore(id);
            setTotalCount((prev) => Math.max(0, prev - 1));
          } else {
            showAlertDialog({
              title: "Delete Failed",
              description:
                "Failed to delete transcription. It may have already been removed.",
            });
          }
        } catch (error) {
          showAlertDialog({
            title: "Delete Failed",
            description: "Failed to delete transcription. Please try again.",
          });
        }
      },
      variant: "destructive",
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={hideConfirmDialog}
        title={confirmDialog.title}
        description={confirmDialog.description}
        onConfirm={confirmDialog.onConfirm}
        variant={confirmDialog.variant}
      />

      <AlertDialog
        open={alertDialog.open}
        onOpenChange={hideAlertDialog}
        title={alertDialog.title}
        description={alertDialog.description}
        onOk={() => {}}
      />

      <TitleBar
        actions={
          <>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSettings(!showSettings)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600 hover:border-indigo-700 gap-2"
              >
                <Settings size={16} />
                Settings
              </Button>
            </div>
            {isWindows && (
              <div className="flex items-center gap-1 ml-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={handleClose}
                  aria-label="Close window"
                >
                  <X size={14} />
                </Button>
              </div>
            )}
          </>
        }
      />

      <SettingsModal open={showSettings} onOpenChange={setShowSettings} />

      {/* Main content */}
      <div className="h-[calc(100vh-40px)]">
        <Card className="h-full flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between mb-4">
                <CardTitle className="flex items-center gap-2">
                  <FileText size={18} className="text-indigo-600" />
                  Recent Transcriptions
                </CardTitle>
                <div className="flex gap-2">
                  {history.length > 0 && (
                    <>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="gap-2">
                            <Download size={14} />
                            Export
                            <ChevronDown size={14} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => exportTranscriptions("csv")}>
                            Export as CSV
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportTranscriptions("json")}>
                            Export as JSON
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => exportTranscriptions("txt")}>
                            Export as TXT
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        onClick={clearHistory}
                        variant="ghost"
                        size="icon"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 size={16} />
                      </Button>
                    </>
                  )}
                </div>
              </div>
              {totalCount > 0 && (
                <div className="flex items-center justify-between gap-4 pb-4 border-b">
                  <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-600">
                      Showing <span className="font-medium text-gray-900">{history.length}</span> of{" "}
                      <span className="font-medium text-gray-900">{totalCount}</span> total
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor="display-limit" className="text-sm text-gray-600">
                        Display:
                      </label>
                      <Select value={displayLimit.toString()} onValueChange={handleDisplayLimitChange}>
                        <SelectTrigger id="display-limit" className="w-[100px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="25">25</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                          <SelectItem value="200">200</SelectItem>
                          <SelectItem value="500">500</SelectItem>
                          <SelectItem value="1000">1000</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden">
              {isLoading ? (
                <div className="text-center py-8">
                  <div className="w-8 h-8 mx-auto mb-3 bg-indigo-600 rounded-lg flex items-center justify-center">
                    <span className="text-white text-sm">📝</span>
                  </div>
                  <p className="text-neutral-600">Loading transcriptions...</p>
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 bg-neutral-100 rounded-full flex items-center justify-center">
                    <Mic className="w-8 h-8 text-neutral-400" />
                  </div>
                  <h3 className="text-lg font-medium text-neutral-900 mb-2">
                    No transcriptions yet
                  </h3>
                  <p className="text-neutral-600 mb-4 max-w-sm mx-auto">
                    Press your hotkey to start recording and create your first
                    transcription.
                  </p>
                  <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-4 max-w-md mx-auto">
                    <h4 className="font-medium text-neutral-800 mb-2">
                      Quick Start:
                    </h4>
                    <ol className="text-sm text-neutral-600 text-left space-y-1">
                      <li>1. Click in any text field</li>
                      <li>
                        2. Press{" "}
                        <kbd className="bg-white px-2 py-1 rounded text-xs font-mono border border-neutral-300">
                          {hotkey}
                        </kbd>{" "}
                        to start recording
                      </li>
                      <li>3. Speak your text</li>
                      <li>
                        4. Press{" "}
                        <kbd className="bg-white px-2 py-1 rounded text-xs font-mono border border-neutral-300">
                          {hotkey}
                        </kbd>{" "}
                        again to stop
                      </li>
                      <li>5. Your text will appear automatically!</li>
                    </ol>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 h-full overflow-y-auto">
                  {history.map((item, index) => (
                    <TranscriptionItem
                      key={item.id}
                      item={item}
                      index={index}
                      total={history.length}
                      onCopy={copyToClipboard}
                      onDelete={deleteTranscription}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
      </div>
    </div>
  );
}

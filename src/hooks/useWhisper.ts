import { useState, useCallback, useEffect } from "react";
import { WhisperCheckResult, WhisperInstallResult } from "../types/electron";

export interface UseWhisperReturn {
  // State
  whisperInstalled: boolean;
  checkingWhisper: boolean;
  installingWhisper: boolean;
  installProgress: string;
  downloadingBaseModel: boolean;
  baseModelDownloaded: boolean;

  checkWhisperInstallation: () => Promise<void>;
  installWhisper: () => Promise<void>;
  setupProgressListener: () => void;
  downloadBaseModel: () => Promise<void>;
}

export interface UseWhisperProps {
  showAlertDialog: (dialog: { title: string; description?: string }) => void;
}

export const useWhisper = (
  showAlertDialog?: UseWhisperProps["showAlertDialog"]
): UseWhisperReturn => {
  const [whisperInstalled, setWhisperInstalled] = useState(false);
  const [checkingWhisper, setCheckingWhisper] = useState(false);
  const [installingWhisper, setInstallingWhisper] = useState(false);
  const [installProgress, setInstallProgress] = useState("");
  const [downloadingBaseModel, setDownloadingBaseModel] = useState(false);
  const [baseModelDownloaded, setBaseModelDownloaded] = useState(false);

  const checkWhisperInstallation = useCallback(async () => {
    try {
      setCheckingWhisper(true);
      const result: WhisperCheckResult =
        await window.electronAPI.checkWhisperInstallation();
      setWhisperInstalled(result.installed && result.working);
    } catch (error) {
      console.error("Error checking Whisper installation:", error);
      setWhisperInstalled(false);
    } finally {
      setCheckingWhisper(false);
    }
  }, []);

  const installWhisper = useCallback(async () => {
    try {
      setInstallingWhisper(true);
      setInstallProgress("Starting Whisper installation...");

      const result: WhisperInstallResult =
        await window.electronAPI.installWhisper();

      if (result.success) {
        setWhisperInstalled(true);
        setInstallProgress("Installation complete!");
      } else {
        if (showAlertDialog) {
          showAlertDialog({
            title: "❌ Whisper Installation Failed",
            description: `Failed to install Whisper: ${result.message}`,
          });
        } else {
          alert(`❌ Failed to install Whisper: ${result.message}`);
        }
      }
    } catch (error) {
      console.error("Error installing Whisper:", error);
      if (showAlertDialog) {
        showAlertDialog({
          title: "❌ Whisper Installation Failed",
          description: `Failed to install Whisper: ${error}`,
        });
      } else {
        alert(`❌ Failed to install Whisper: ${error}`);
      }
    } finally {
      setInstallingWhisper(false);
      setTimeout(() => setInstallProgress(""), 2000); // Clear progress after 2 seconds
    }
  }, [showAlertDialog]);

  const setupProgressListener = useCallback(() => {
    // Remove any existing listeners first
    window.electronAPI?.removeAllListeners?.("whisper-install-progress");
    window.electronAPI?.removeAllListeners?.("whisper-download-progress");

    window.electronAPI.onWhisperInstallProgress((_, data) => {
      setInstallProgress(data.message);
    });

    // Also listen for download progress
    window.electronAPI.onWhisperDownloadProgress((_, data) => {
      if (data.type === "progress") {
        const percentage = Math.round(data.percentage || 0);
        setInstallProgress(`Downloading base model... ${percentage}%`);
      } else if (data.type === "complete") {
        setInstallProgress("Base model downloaded!");
        setBaseModelDownloaded(true);
        setDownloadingBaseModel(false);
      } else if (data.type === "error") {
        setInstallProgress(`Download failed: ${data.error}`);
        setDownloadingBaseModel(false);
      }
    });
  }, []);

  const downloadBaseModel = useCallback(async () => {
    try {
      setDownloadingBaseModel(true);
      setInstallProgress("Downloading base model...");

      const result = await window.electronAPI.downloadWhisperModel("base");

      if (result.success) {
        setBaseModelDownloaded(true);
        setInstallProgress("Base model ready!");
        // Set the whisperModel in localStorage to "base"
        localStorage.setItem("whisperModel", "base");
      } else {
        if (showAlertDialog) {
          showAlertDialog({
            title: "Model Download Failed",
            description: `Failed to download base model: ${result.error}`,
          });
        }
      }
    } catch (error) {
      console.error("Error downloading base model:", error);
      if (showAlertDialog) {
        showAlertDialog({
          title: "Model Download Failed",
          description: `Failed to download base model: ${error}`,
        });
      }
    } finally {
      setDownloadingBaseModel(false);
      setTimeout(() => setInstallProgress(""), 2000);
    }
  }, [showAlertDialog]);

  // Check Whisper installation on mount
  useEffect(() => {
    checkWhisperInstallation();
  }, [checkWhisperInstallation]);

  // Check base model status when whisper is installed, and auto-download if not present
  useEffect(() => {
    if (whisperInstalled) {
      const checkAndDownloadBaseModel = async () => {
        try {
          const result = await window.electronAPI.listWhisperModels();
          if (result.success && result.models) {
            const baseModel = result.models.find((m: any) => m.model === "base");
            if (baseModel?.downloaded) {
              setBaseModelDownloaded(true);
            } else {
              // Auto-download base model if not present
              console.log("Base model not found, auto-downloading...");
              setDownloadingBaseModel(true);
              setInstallProgress("Downloading base model (recommended)...");

              try {
                const downloadResult = await window.electronAPI.downloadWhisperModel("base");
                if (downloadResult.success) {
                  setBaseModelDownloaded(true);
                  setInstallProgress("Base model ready!");
                  localStorage.setItem("whisperModel", "base");
                }
              } catch (downloadError) {
                console.error("Auto-download of base model failed:", downloadError);
                setInstallProgress("");
              } finally {
                setDownloadingBaseModel(false);
              }
            }
          }
        } catch (error) {
          console.error("Error checking base model status:", error);
        }
      };

      checkAndDownloadBaseModel();
    }
  }, [whisperInstalled]);

  return {
    whisperInstalled,
    checkingWhisper,
    installingWhisper,
    installProgress,
    downloadingBaseModel,
    baseModelDownloaded,
    checkWhisperInstallation,
    installWhisper,
    setupProgressListener,
    downloadBaseModel,
  };
};

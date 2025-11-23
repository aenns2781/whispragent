import React, { useState, useEffect, useRef } from "react";
import "./index.css";
import { useToast } from "./components/ui/Toast";
import { LoadingDots } from "./components/ui/LoadingDots";
import { useHotkey } from "./hooks/useHotkey";
import { useWindowDrag } from "./hooks/useWindowDrag";
import { useSettings } from "./hooks/useSettings";
import AudioManager from "./helpers/audioManager";

// Sound Wave Icon Component (for idle/hover states)
const SoundWaveIcon = ({ size = 16 }) => {
  return (
    <div className="flex items-center justify-center gap-1">
      <div
        className={`bg-white rounded-full`}
        style={{ width: size * 0.25, height: size * 0.6 }}
      ></div>
      <div
        className={`bg-white rounded-full`}
        style={{ width: size * 0.25, height: size }}
      ></div>
      <div
        className={`bg-white rounded-full`}
        style={{ width: size * 0.25, height: size * 0.6 }}
      ></div>
    </div>
  );
};

// Voice Wave Animation Component (for processing state)
const VoiceWaveIndicator = ({ isListening }) => {
  return (
    <div className="flex items-center justify-center gap-0.5">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className={`w-0.5 bg-white rounded-full transition-all duration-150 ${isListening ? "animate-pulse h-4" : "h-2"
            }`}
          style={{
            animationDelay: isListening ? `${i * 0.1}s` : "0s",
            animationDuration: isListening ? `${0.6 + i * 0.1}s` : "0s",
          }}
        />
      ))}
    </div>
  );
};

// Enhanced Tooltip Component
const Tooltip = ({ children, content, emoji }) => {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
      </div>
      {isVisible && (
        <div
          className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-1 py-1 text-popover-foreground bg-popover border border-border rounded-md whitespace-nowrap z-10 transition-opacity duration-150"
          style={{ fontSize: "9.7px" }}
        >
          {emoji && <span className="mr-1">{emoji}</span>}
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-2 border-r-2 border-t-2 border-transparent border-t-popover"></div>
        </div>
      )}
    </div>
  );
};

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState("");
  const [isHovered, setIsHovered] = useState(false);
  const [isCommandMenuOpen, setIsCommandMenuOpen] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const commandMenuRef = useRef(null);
  const buttonRef = useRef(null);
  const audioManagerRef = useRef(null);
  const { toast } = useToast();
  const { hotkey } = useHotkey();
  const { isDragging, handleMouseDown, handleMouseUp } =
    useWindowDrag();
  const [dragStartPos, setDragStartPos] = useState(null);
  const [hasDragged, setHasDragged] = useState(false);

  // Add dictation-window class to body on mount
  useEffect(() => {
    document.body.classList.add('dictation-window');
    return () => document.body.classList.remove('dictation-window');
  }, []);

  const setWindowInteractivity = React.useCallback((shouldCapture) => {
    window.electronAPI?.setMainWindowInteractivity?.(shouldCapture);
  }, []);

  useEffect(() => {
    setWindowInteractivity(false);
    return () => setWindowInteractivity(false);
  }, [setWindowInteractivity]);

  useEffect(() => {
    if (isCommandMenuOpen) {
      setWindowInteractivity(true);
    } else if (!isHovered) {
      setWindowInteractivity(false);
    }
  }, [isCommandMenuOpen, isHovered, setWindowInteractivity]);

  // Keep track of state for event listeners without re-subscribing
  const stateRef = useRef({ isProcessing });
  const isRecordingRef = useRef(false); // Synchronous source of truth for recording state

  useEffect(() => {
    stateRef.current = { isProcessing };
  }, [isProcessing]);

  const startRecording = async (withScreenshot = false) => {
    try {
      // If screenshot mode, capture screenshot FIRST before starting recording
      let capturedScreenshot = null;
      if (withScreenshot) {
        console.error("📸 CAPTURING SCREENSHOT BEFORE RECORDING...");
        const screenshotResult = await window.electronAPI.captureScreenshot();
        if (screenshotResult.success) {
          capturedScreenshot = screenshotResult.screenshot;
          window.capturedScreenshot = capturedScreenshot;
          console.error("✅ SCREENSHOT CAPTURED - Now starting recording...");
        } else if (screenshotResult.error?.includes('permission')) {
          console.error("❌ Screen recording permission denied");
          alert("Screen recording permission required!");
          return; // Don't start recording if screenshot failed
        } else {
          console.error("❌ Screenshot failed:", screenshotResult.error);
          // Continue with recording even if screenshot fails
        }
      }

      // 1. Immediate UI feedback & State Lock
      isRecordingRef.current = true;
      setIsRecording(true);
      setError("");

      // 2. Start Audio Stream
      const streamPromise = navigator.mediaDevices.getUserMedia({ audio: true });

      // 3. Capture Context in background (don't block recording start)
      const captureContextPromise = (async () => {
        let capturedContext = null;
        let originalClipboard = null;

        try {

          // Highlighted Text
          console.error("🎤 RECORDING STARTED - Checking for highlighted text...");
          originalClipboard = await window.electronAPI.readClipboard();
          await window.electronAPI.simulateCopy();
          // Short delay for copy to complete
          await new Promise(resolve => setTimeout(resolve, 300));
          const newClipboard = await window.electronAPI.readClipboard();

          if (newClipboard !== originalClipboard && newClipboard) {
            capturedContext = newClipboard;
            console.error("✅ HIGHLIGHTED TEXT CAPTURED!");
          }
        } catch (error) {
          console.error("❌ Capture error:", error);
        }

        return { capturedContext, originalClipboard };
      })();

      // 4. Initialize Recorder
      const stream = await streamPromise;

      // Check if user cancelled while we were initializing
      if (!isRecordingRef.current) {
        console.log("Recording cancelled during initialization");
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      mediaRecorderRef.current = new window.MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        setIsProcessing(true);
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/wav",
        });

        // Ensure context capture is finished before processing
        try {
          const { capturedContext, originalClipboard } = await captureContextPromise;
          window.capturedHighlightedContext = capturedContext;
          window.originalClipboardContent = originalClipboard;
        } catch (e) {
          console.error("Context capture failed:", e);
        }

        // Start processing
        processAudio(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      // isRecording is already true
    } catch (err) {
      console.error("Recording error:", err);
      isRecordingRef.current = false;
      setIsRecording(false); // Revert state on error
      toast({
        title: "Recording Error",
        description: "Failed to access microphone: " + err.message,
        variant: "destructive",
      });
    }
  };

  const lastToggleTimeRef = useRef(0);

  const stopRecording = () => {
    console.log("stopRecording called - current state:", isRecordingRef.current);

    // Always update state immediately to prevent double-triggers
    if (!isRecordingRef.current) {
      console.log("Already stopped, ignoring");
      return;
    }

    isRecordingRef.current = false;
    setIsRecording(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      console.log("Stopping MediaRecorder...");
      mediaRecorderRef.current.stop();
    }
  };

  const safePaste = async (text) => {
    try {
      await window.electronAPI.pasteText(text);
    } catch (err) {
      toast({
        title: "Paste Error",
        description:
          "Failed to paste text. Please check accessibility permissions.",
        variant: "destructive",
      });
    }
  };

  const processAudio = async (audioBlob) => {
    try {
      const audioManager = new AudioManager();
      audioManagerRef.current = audioManager;
      audioManager.setCallbacks({
        onStateChange: ({ isRecording, isProcessing }) => {
          // Only update processing state here, recording state is managed manually
          // setIsRecording(isRecording); 
          setIsProcessing(isProcessing);
        },
        onError: (error) => {
          toast({
            title: error.title,
            description: error.description,
            variant: "destructive",
          });
        },
        onTranscriptionComplete: async (result) => {
          // Check if result exists and has text - if text is null, processing was cancelled
          if (result.success && result.text !== null && result.text !== undefined) {
            setTranscript(result.text);

            // Paste immediately - don't wait for database save
            const pastePromise = safePaste(result.text);

            // Save to database in parallel
            const savePromise = window.electronAPI
              .saveTranscription(result.text)
              .catch((err) => {
                // Failed to save transcription
              });

            // Wait for paste to complete, but don't block on database save
            await pastePromise;
          } else if (result.success && result.text === null) {
            console.log("Processing was cancelled - not pasting");
          }
        },
      });

      // Process the audio using our enhanced AudioManager
      await audioManager.processAudio(audioBlob);
    } catch (err) {
      toast({
        title: "Transcription Error",
        description: "Transcription failed: " + err.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    window.electronAPI.hideWindow();
  };

  useEffect(() => {
    if (!isCommandMenuOpen) {
      return;
    }

    const handleClickOutside = (event) => {
      if (
        commandMenuRef.current &&
        !commandMenuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsCommandMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCommandMenuOpen]);

  const { dictationKey } = useSettings();

  useEffect(() => {
    const handleToggle = () => {
      // Simplified debouncing - only prevent if VERY rapid (under 200ms)
      const now = Date.now();
      if (now - lastToggleTimeRef.current < 200) {
        console.log("Ignoring rapid toggle (debounce)");
        return;
      }
      lastToggleTimeRef.current = now;

      const { isProcessing } = stateRef.current;
      const isRecording = isRecordingRef.current;

      console.log("Toggle hotkey pressed - Recording:", isRecording, "Processing:", isProcessing);
      setIsCommandMenuOpen(false);

      // Simple toggle logic
      if (!isRecording && !isProcessing) {
        console.log("Starting recording...");
        startRecording(false);
      } else if (isRecording) {
        console.log("Stopping recording...");
        stopRecording();
      } else if (isProcessing) {
        console.log("Cancelling processing...");
        if (audioManagerRef.current) {
          audioManagerRef.current.cancelProcessing();
        }
        setIsProcessing(false);
      }
    };

    const handleStopDictation = () => {
      // This is for special stop events (like Globe key up)
      const isRecording = isRecordingRef.current;
      if (isRecording) {
        stopRecording();
      }
    };

    // Globe key specific handlers
    const handleGlobeKeyDown = () => {
      // Same as toggle for Globe key
      handleToggle();
    };

    const handleGlobeKeyUp = () => {
      // Globe key up doesn't do anything in toggle mode
      // Could be used for push-to-talk in future
    };

    const handleScreenshotToggle = () => {
      const { isProcessing } = stateRef.current;
      const isRecording = isRecordingRef.current;

      setIsCommandMenuOpen(false);

      if (!isRecording && !isProcessing) {
        startRecording(true);
      } else if (isRecording) {
        stopRecording();
      }
    };

    // Clean up any existing listeners to prevent duplicates
    window.electronAPI.removeAllListeners("toggle-dictation");
    window.electronAPI.removeAllListeners("stop-dictation");
    window.electronAPI.removeAllListeners("toggle-screenshot");
    window.electronAPI.removeAllListeners("globe-key-down");
    window.electronAPI.removeAllListeners("globe-key-up");

    window.electronAPI.onToggleDictation(handleToggle);
    window.electronAPI.onStopDictation(handleStopDictation);
    window.electronAPI.onToggleScreenshot(handleScreenshotToggle);
    window.electronAPI.onGlobeKeyDown(handleGlobeKeyDown);
    window.electronAPI.onGlobeKeyUp(handleGlobeKeyUp);

    return () => {
      window.electronAPI.removeAllListeners("toggle-dictation");
      window.electronAPI.removeAllListeners("stop-dictation");
      window.electronAPI.removeAllListeners("toggle-screenshot");
      window.electronAPI.removeAllListeners("globe-key-down");
      window.electronAPI.removeAllListeners("globe-key-up");
    };
  }, [dictationKey]); // Re-bind when key changes

  const toggleListening = () => {
    setIsCommandMenuOpen(false);
    if (!isRecording && !isProcessing) {
      startRecording();
    } else if (isRecording) {
      stopRecording();
    }
  };

  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.key === "Escape") {
        if (isCommandMenuOpen) {
          setIsCommandMenuOpen(false);
        } else {
          handleClose();
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [isCommandMenuOpen]);

  // Determine current mic state
  const getMicState = () => {
    if (isRecording) return "recording";
    if (isProcessing) return "processing";
    if (isHovered && !isRecording && !isProcessing) return "hover";
    return "idle";
  };

  const micState = getMicState();
  const isListening = isRecording || isProcessing;

  // Get microphone button properties based on state
  const getMicButtonProps = () => {
    const baseClasses =
      "rounded-full w-10 h-10 flex items-center justify-center relative overflow-hidden border-2 border-white/70 cursor-pointer";

    switch (micState) {
      case "idle":
        return {
          className: `${baseClasses} bg-transparent cursor-pointer`,
          tooltip: `Press [${hotkey}] to speak`,
        };
      case "hover":
        return {
          className: `${baseClasses} bg-white/10 backdrop-blur-sm cursor-pointer`,
          tooltip: `Press [${hotkey}] to speak`,
        };
      case "recording":
        return {
          className: `${baseClasses} bg-primary cursor-pointer`,
          tooltip: "Recording...",
        };
      case "processing":
        return {
          className: `${baseClasses} bg-primary/80 cursor-not-allowed`,
          tooltip: "Processing...",
        };
      default:
        return {
          className: `${baseClasses} bg-transparent cursor-pointer`,
          style: { transform: "scale(0.8)" },
          tooltip: "Click to speak",
        };
    }
  };

  const micProps = getMicButtonProps();

  return (
    <>
      {/* Fixed bottom-right voice button */}
      <div className="fixed bottom-6 right-6 z-50 bg-transparent">
        <div className="relative bg-transparent">
          <Tooltip content={micProps.tooltip}>
            <button
              ref={buttonRef}
              onMouseDown={(e) => {
                setIsCommandMenuOpen(false);
                setDragStartPos({ x: e.clientX, y: e.clientY });
                setHasDragged(false);
                setWindowInteractivity(true); // Enable interaction for dragging
                handleMouseDown(e);
              }}
              onMouseMove={(e) => {
                if (dragStartPos && !hasDragged) {
                  const distance = Math.sqrt(
                    Math.pow(e.clientX - dragStartPos.x, 2) +
                    Math.pow(e.clientY - dragStartPos.y, 2)
                  );
                  if (distance > 5) {
                    // 5px threshold for drag
                    setHasDragged(true);
                  }
                }
              }}
              onMouseUp={(e) => {
                handleMouseUp(e);
                setDragStartPos(null);
                // Small delay before disabling to ensure drag completes
                setTimeout(() => {
                  if (!isHovered && !isCommandMenuOpen) {
                    setWindowInteractivity(false);
                  }
                }, 100);
              }}
              onClick={(e) => {
                if (!hasDragged) {
                  setIsCommandMenuOpen(false);
                  toggleListening();
                }
                e.preventDefault();
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                if (!hasDragged) {
                  setWindowInteractivity(true);
                  setIsCommandMenuOpen((prev) => !prev);
                }
              }}
              onMouseEnter={() => {
                setIsHovered(true);
                setWindowInteractivity(true);
              }}
              onMouseLeave={() => {
                setIsHovered(false);
                // Don't disable if we're currently dragging
                if (!isCommandMenuOpen && !dragStartPos) {
                  setWindowInteractivity(false);
                }
              }}
              onFocus={() => setIsHovered(true)}
              onBlur={() => setIsHovered(false)}
              className={micProps.className}
              style={{
                ...micProps.style,
                cursor:
                  micState === "processing"
                    ? "not-allowed !important"
                    : isDragging
                      ? "grabbing !important"
                      : "pointer !important",
                transition:
                  "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.25s ease-out",
              }}
            >
              {/* Background effects */}
              <div
                className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent transition-opacity duration-150"
                style={{ opacity: micState === "hover" ? 0.8 : 0 }}
              ></div>
              <div
                className="absolute inset-0 transition-colors duration-150"
                style={{
                  backgroundColor:
                    micState === "hover" ? "rgba(0,0,0,0.1)" : "transparent",
                }}
              ></div>

              {/* Dynamic content based on state */}
              {micState === "idle" || micState === "hover" ? (
                <SoundWaveIcon size={micState === "idle" ? 12 : 14} />
              ) : micState === "recording" ? (
                <LoadingDots />
              ) : micState === "processing" ? (
                <VoiceWaveIndicator isListening={true} />
              ) : null}

              {/* State indicator ring for recording */}
              {micState === "recording" && (
                <div className="absolute inset-0 rounded-full border-2 border-primary animate-pulse"></div>
              )}

              {/* State indicator ring for processing */}
              {micState === "processing" && (
                <div className="absolute inset-0 rounded-full border-2 border-primary opacity-50"></div>
              )}
            </button>
          </Tooltip>
          {isCommandMenuOpen && (
            <div
              ref={commandMenuRef}
              className="absolute bottom-full right-0 mb-3 w-48 rounded-lg border border-border bg-popover text-popover-foreground shadow-lg backdrop-blur-sm"
              onMouseEnter={() => {
                setWindowInteractivity(true);
              }}
              onMouseLeave={() => {
                if (!isHovered) {
                  setWindowInteractivity(false);
                }
              }}
            >
              <button
                className="w-full px-3 py-2 text-left text-sm font-medium hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:outline-none"
                onClick={() => {
                  toggleListening();
                }}
              >
                {isRecording ? "Stop listening" : "Start listening"}
              </button>
              <div className="h-px bg-border" />
              <button
                className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:outline-none"
                onClick={() => {
                  setIsCommandMenuOpen(false);
                  setWindowInteractivity(false);
                  handleClose();
                }}
              >
                Hide this for now
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

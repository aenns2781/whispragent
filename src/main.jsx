import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ControlPanelV2 from "./components/ControlPanelV2.tsx";
import OnboardingFlow from "./components/OnboardingFlow.tsx";
import ImageGenerationWindow from "./components/ImageGenerationWindow.tsx";
import { ToastProvider } from "./components/ui/Toast.tsx";
import "./index.css";

function AppRouter() {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Check which window type this is
  const isImageGeneration = window.location.search.includes("mode=image-generation");
  const isControlPanel =
    window.location.pathname.includes("control") ||
    window.location.search.includes("panel=true");

  // Check if this is the dictation panel (main app)
  const isDictationPanel = !isControlPanel && !isImageGeneration;

  useEffect(() => {
    // Check if onboarding has been completed
    const onboardingCompleted =
      localStorage.getItem("onboardingCompleted") === "true";
    const currentStep = parseInt(
      localStorage.getItem("onboardingCurrentStep") || "0"
    );

    if (isControlPanel && !onboardingCompleted) {
      // Show onboarding for control panel if not completed
      setShowOnboarding(true);
    }

    // Hide dictation panel window unless onboarding is complete or we're past the permissions step
    if (isDictationPanel && !onboardingCompleted && currentStep < 4) {
      window.electronAPI?.hideWindow?.();
    }

    setIsLoading(false);
  }, [isControlPanel, isDictationPanel]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    localStorage.setItem("onboardingCompleted", "true");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading Tribe Whisper...</p>
        </div>
      </div>
    );
  }

  // Image generation window - show modal directly
  if (isImageGeneration) {
    console.log("Loading ImageGenerationWindow");
    return <ImageGenerationWindow />;
  }

  if (isControlPanel && showOnboarding) {
    console.log("Showing onboarding");
    return <OnboardingFlow onComplete={handleOnboardingComplete} />;
  }

  console.log("isControlPanel:", isControlPanel, "- Loading:", isControlPanel ? "ControlPanelV2" : "App");
  return isControlPanel ? <ControlPanelV2 /> : <App />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <AppRouter />
    </ToastProvider>
  </React.StrictMode>
);

import { useState, useCallback } from "react";

export interface UsePermissionsReturn {
  // State
  micPermissionGranted: boolean;
  accessibilityPermissionGranted: boolean;
  screenPermissionGranted: boolean;

  requestMicPermission: () => Promise<void>;
  testAccessibilityPermission: () => Promise<void>;
  checkScreenPermission: () => Promise<boolean>;
  setMicPermissionGranted: (granted: boolean) => void;
  setAccessibilityPermissionGranted: (granted: boolean) => void;
  setScreenPermissionGranted: (granted: boolean) => void;
}

export interface UsePermissionsProps {
  showAlertDialog: (dialog: { title: string; description?: string }) => void;
}

export const usePermissions = (
  showAlertDialog?: UsePermissionsProps["showAlertDialog"]
): UsePermissionsReturn => {
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [accessibilityPermissionGranted, setAccessibilityPermissionGranted] =
    useState(false);
  const [screenPermissionGranted, setScreenPermissionGranted] = useState(false);

  const requestMicPermission = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermissionGranted(true);
    } catch (err) {
      console.error("Microphone permission denied:", err);
      if (showAlertDialog) {
        showAlertDialog({
          title: "Microphone Permission Required",
          description:
            "Please grant microphone permissions to use voice dictation.",
        });
      } else {
        alert("Please grant microphone permissions to use voice dictation.");
      }
    }
  }, [showAlertDialog]);

  const testAccessibilityPermission = useCallback(async () => {
    try {
      await window.electronAPI.pasteText("OpenWhispr accessibility test");
      setAccessibilityPermissionGranted(true);
      if (showAlertDialog) {
        showAlertDialog({
          title: "✅ Accessibility Test Successful",
          description:
            "Accessibility permissions working! Check if the test text appeared in another app.",
        });
      } else {
        alert(
          "✅ Accessibility permissions working! Check if the test text appeared in another app."
        );
      }
    } catch (err) {
      console.error("Accessibility permission test failed:", err);
      if (showAlertDialog) {
        showAlertDialog({
          title: "❌ Accessibility Permissions Needed",
          description:
            "Please grant accessibility permissions in System Settings to enable automatic text pasting.",
        });
      } else {
        alert(
          "❌ Accessibility permissions needed! Please grant them in System Settings."
        );
      }
    }
  }, [showAlertDialog]);

  const checkScreenPermission = useCallback(async () => {
    try {
      // Try to capture a screenshot to check permission
      const result = await window.electronAPI.captureScreenshot();
      if (result.success) {
        setScreenPermissionGranted(true);
        return true;
      } else if (result.error?.includes('permission')) {
        setScreenPermissionGranted(false);
        if (showAlertDialog) {
          showAlertDialog({
            title: "Screen Recording Permission Required",
            description:
              "Please grant screen recording permissions in System Settings to use screenshot features. Go to System Settings > Privacy & Security > Screen Recording and enable OpenWhispr.",
          });
        } else {
          alert(
            "Screen recording permission required! Please grant it in System Settings > Privacy & Security > Screen Recording."
          );
        }
        return false;
      }
      return false;
    } catch (err) {
      console.error("Screen permission check failed:", err);
      setScreenPermissionGranted(false);
      return false;
    }
  }, [showAlertDialog]);

  return {
    micPermissionGranted,
    accessibilityPermissionGranted,
    screenPermissionGranted,
    requestMicPermission,
    testAccessibilityPermission,
    checkScreenPermission,
    setMicPermissionGranted,
    setAccessibilityPermissionGranted,
    setScreenPermissionGranted,
  };
};

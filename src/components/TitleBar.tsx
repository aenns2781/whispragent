import React from "react";
import WindowControls from "./WindowControls";

interface TitleBarProps {
  title?: string;
  showTitle?: boolean;
  children?: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export default function TitleBar({
  title = "",
  showTitle = false,
  children,
  className = "",
  actions,
}: TitleBarProps) {
  // Get platform info
  const platform =
    typeof window !== "undefined" && window.electronAPI?.getPlatform
      ? window.electronAPI.getPlatform()
      : "darwin";

  return (
    <div
      className={`glass-dark border-b border-white/10 select-none ${className}`}
    >
      <div
        className="flex items-center justify-between h-12 px-4 drag-region background-holder"
      >
        <div className="background-layer background-gradient opacity-20"></div>

        {/* Left section - title or custom content */}
        <div className="flex items-center gap-2 relative">
          {showTitle && title && (
            <h1 className="text-sm font-semibold text-white font-heading animate-fadeIn">{title}</h1>
          )}
          {children}
        </div>

        {/* Center - Optional decorative element */}
        <div className="flex-1 flex items-center justify-center">
          <div className="h-0.5 w-20 bg-gradient-to-r from-transparent via-primary/30 to-transparent rounded-full"></div>
        </div>

        {/* Right section - actions and window controls */}
        <div
          className="flex items-center gap-2 no-drag-region relative"
        >
          {actions}
          {/* Show window controls on Linux and Windows (macOS uses native controls) */}
          {platform !== "darwin" && <WindowControls />}
        </div>
      </div>
    </div>
  );
}

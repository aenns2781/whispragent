import React from "react";
import { Button } from "./button";
import { Check, ChevronRight, RefreshCw, LucideIcon } from "lucide-react";

interface PermissionCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  granted: boolean;
  onRequest: () => void;
  onVerify?: () => void;
  buttonText?: string;
  instructions?: string;
}

export default function PermissionCard({
  icon: Icon,
  title,
  description,
  granted,
  onRequest,
  onVerify,
  buttonText = "Grant Access",
  instructions,
}: PermissionCardProps) {
  return (
    <div className={`relative rounded-xl overflow-hidden transition-all duration-300 ${
      granted
        ? "bg-emerald-500/10 border border-emerald-500/30"
        : "bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-white/10"
    }`}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className={`p-2 rounded-lg ${
              granted
                ? "bg-emerald-500/20"
                : "bg-purple-500/20"
            }`}>
              <Icon className={`w-5 h-5 ${
                granted ? "text-emerald-400" : "text-purple-400"
              }`} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-foreground">{title}</h3>
              <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
              {instructions && !granted && (
                <p className="text-xs text-purple-300/70 mt-2 leading-relaxed">
                  {instructions}
                </p>
              )}
            </div>
          </div>
          {granted ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/20 text-emerald-400">
              <Check className="w-4 h-4" />
              <span className="text-sm font-medium">Granted</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {onVerify && (
                <Button
                  onClick={onVerify}
                  size="sm"
                  variant="outline"
                  className="border-purple-500/30 hover:bg-purple-500/10 hover:border-purple-500/50 text-purple-300 font-medium px-3 py-2 rounded-lg transition-all duration-200 flex items-center gap-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Verify
                </Button>
              )}
              <Button
                onClick={onRequest}
                size="sm"
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-medium px-4 py-2 rounded-lg shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all duration-200 flex items-center gap-1"
              >
                {buttonText}
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

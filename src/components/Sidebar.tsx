import React, { useState } from 'react';
import { cn } from './lib/utils';
import {
  Home,
  Clock,
  BookOpen,
  Scissors,
  Palette,
  Mic,
  Brain,
  Settings,
  HelpCircle,
  Sparkles
} from 'lucide-react';
// Removed TribeLogo import

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeSection, onSectionChange }) => {
  const sections = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'dictionary', label: 'Dictionary', icon: BookOpen },
    { id: 'snippets', label: 'Snippets', icon: Scissors },
    { id: 'style', label: 'Style', icon: Palette },
    { id: 'divider1', isDivider: true },
    { id: 'dictation', label: 'Dictation', icon: Mic },
    { id: 'ai', label: 'AI Models', icon: Brain },
    { id: 'system', label: 'System', icon: Settings },
    { id: 'divider2', isDivider: true },
    { id: 'help', label: 'Help', icon: HelpCircle }
  ];

  const [hoveredSection, setHoveredSection] = useState<string | null>(null);

  return (
    <div className="w-56 glass-dark h-full flex flex-col animate-slideInLeft">
      {/* App Title */}
      <div className="p-4 border-b border-white/10 background-holder">
        <div className="background-layer background-gradient"></div>
        <div className="relative">
          <h1 className="text-lg font-bold text-white font-heading">Whisper</h1>
          <p className="text-xs text-color-foreground-muted">Voice to Text AI</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 no-scrollbar">
        {sections.map((section, index) => {
          if (section.isDivider) {
            return <div key={section.id} className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent my-3" />;
          }

          const Icon = section.icon;
          const isHovered = hoveredSection === section.id;
          const isActive = activeSection === section.id;

          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              onMouseEnter={() => setHoveredSection(section.id)}
              onMouseLeave={() => setHoveredSection(null)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300",
                "group relative overflow-hidden",
                isActive
                  ? "bg-gradient-to-r from-primary/20 to-accent-purple/20 text-white"
                  : "text-color-foreground-muted hover:text-white"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* Hover Background Effect */}
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-r from-primary/10 to-accent-purple/10 transition-transform duration-300",
                  isHovered && !isActive ? "translate-x-0" : "-translate-x-full"
                )}
              />

              {/* Active Indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-primary to-accent-purple rounded-r-full animate-pulse" />
              )}

              <Icon className={cn(
                "w-4 h-4 flex-shrink-0 relative transition-all duration-300",
                isActive && "text-primary",
                isHovered && "scale-110"
              )} />
              <span className={cn(
                "text-sm font-medium relative transition-all duration-300",
                isActive && "font-semibold"
              )}>
                {section.label}
              </span>

              {/* Hover Glow */}
              {isHovered && !isActive && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-1 bg-primary rounded-full animate-pulse" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
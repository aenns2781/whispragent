import React from 'react';
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
  HelpCircle
} from 'lucide-react';

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

  return (
    <div className="w-56 bg-zinc-900/50 backdrop-blur-lg border-r border-zinc-800 h-full flex flex-col">
      {/* App Title */}
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-lg font-semibold text-white">Tribe Whisper</h1>
        <p className="text-xs text-zinc-500 mt-1">Voice to Text</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        {sections.map((section) => {
          if (section.isDivider) {
            return <div key={section.id} className="h-px bg-zinc-800 my-2" />;
          }

          const Icon = section.icon;
          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200",
                "hover:bg-zinc-800/50 group",
                activeSection === section.id
                  ? "bg-zinc-800 text-white"
                  : "text-zinc-400 hover:text-white"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="text-sm font-medium">{section.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Sidebar;
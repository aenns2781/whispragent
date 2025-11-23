import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import TitleBar from './TitleBar';
import HomePanel from './panels/HomePanel';
import HistoryPanel from './panels/HistoryPanel';
import DictionaryPanel from './panels/DictionaryPanel';
import SnippetsPanel from './panels/SnippetsPanel';
import StylePanel from './panels/StylePanel';
import DictationPanel from './panels/DictationPanel';
import AIModelsPanel from './panels/AIModelsPanel';
import SystemPanel from './panels/SystemPanel';
import HelpPanel from './panels/HelpPanel';
import ImageGenerationModal from './ImageGenerationModal';
import { useSettings } from '../hooks/useSettings';

const ControlPanelV2: React.FC = () => {
  const [activeSection, setActiveSection] = useState('home');
  const [isImageGenModalOpen, setIsImageGenModalOpen] = useState(false);
  const settings = useSettings();

  // Add control-panel class to body on mount
  useEffect(() => {
    document.body.classList.add('control-panel');
    return () => document.body.classList.remove('control-panel');
  }, []);

  // Listen for image generation hotkey
  useEffect(() => {
    const handleImageGenToggle = () => {
      setIsImageGenModalOpen(prev => !prev);
    };

    window.electronAPI?.onToggleImageGeneration?.(handleImageGenToggle);

    return () => {
      window.electronAPI?.removeAllListeners?.('toggle-image-generation');
    };
  }, []);

  // Listen for navigation to history event
  useEffect(() => {
    const handleNavigateToHistory = () => {
      setActiveSection('history');
    };

    window.addEventListener('navigate-to-history', handleNavigateToHistory);

    return () => {
      window.removeEventListener('navigate-to-history', handleNavigateToHistory);
    };
  }, []);

  const renderPanel = () => {
    switch (activeSection) {
      case 'home':
        return <HomePanel />;
      case 'history':
        return <HistoryPanel />;
      case 'dictionary':
        return <DictionaryPanel />;
      case 'snippets':
        return <SnippetsPanel />;
      case 'style':
        return <StylePanel />;
      case 'dictation':
        return <DictationPanel />;
      case 'ai':
        return <AIModelsPanel />;
      case 'system':
        return <SystemPanel />;
      case 'help':
        return <HelpPanel />;
      default:
        return <HomePanel />;
    }
  };

  // Add error boundary
  if (!activeSection) {
    return <div className="flex h-screen background-color-1 text-white items-center justify-center">
      <div className="text-center animate-fadeIn">
        <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-accent-purple flex items-center justify-center animate-float">
          <div className="spinner"></div>
        </div>
        <h1 className="text-2xl font-bold text-white mb-4 font-heading">Loading Whisper...</h1>
        <p className="text-color-foreground-muted animate-pulse">Please wait while we set up your workspace</p>
      </div>
    </div>;
  }

  return (
    <div className="flex flex-col h-screen background-color-1 text-white">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar activeSection={activeSection} onSectionChange={setActiveSection} />
        <div className="flex-1 overflow-hidden background-holder">
          <div className="background-layer background-color-2"></div>
          <div className="h-full overflow-y-auto no-scrollbar relative">
            <div className="p-6 max-w-5xl mx-auto animate-fadeIn">
              {renderPanel()}
            </div>
          </div>
        </div>
      </div>

      {/* Image Generation Modal */}
      <ImageGenerationModal
        isOpen={isImageGenModalOpen}
        onClose={() => setIsImageGenModalOpen(false)}
      />
    </div>
  );
};

export default ControlPanelV2;
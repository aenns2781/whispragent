import React, { useState, useEffect } from 'react';
import ImageGenerationModal from './ImageGenerationModal';

const ImageGenerationWindow: React.FC = () => {
  const [isOpen] = useState(true);

  // Add image-generation-window class to body on mount
  useEffect(() => {
    document.body.classList.add('image-generation-window');
    return () => document.body.classList.remove('image-generation-window');
  }, []);

  const handleClose = () => {
    // Hide the window when modal is closed
    window.electronAPI?.hideWindow?.();
  };

  return <ImageGenerationModal isOpen={isOpen} onClose={handleClose} />;
};

export default ImageGenerationWindow;

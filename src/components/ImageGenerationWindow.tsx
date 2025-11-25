import React, { useState, useEffect } from 'react';
import ImageGenerationModal from './ImageGenerationModal';

const ImageGenerationWindow: React.FC = () => {
  const [isOpen, setIsOpen] = useState(true);
  const [hasBeenClosed, setHasBeenClosed] = useState(false);

  // Add image-generation-window class to body on mount
  useEffect(() => {
    document.body.classList.add('image-generation-window');

    // Listen for window visibility changes to reset when shown again
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && hasBeenClosed) {
        // Reset the modal by closing and reopening it
        setIsOpen(false);
        setHasBeenClosed(false);
        setTimeout(() => setIsOpen(true), 50);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.body.classList.remove('image-generation-window');
    };
  }, [hasBeenClosed]);

  const handleClose = () => {
    // Mark that we've closed the modal
    setHasBeenClosed(true);

    // Hide the window
    window.electronAPI?.hideWindow?.();
  };

  return <ImageGenerationModal isOpen={isOpen} onClose={handleClose} />;
};

export default ImageGenerationWindow;

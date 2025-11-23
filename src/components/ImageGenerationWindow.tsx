import React, { useState } from 'react';
import ImageGenerationModal from './ImageGenerationModal';

const ImageGenerationWindow: React.FC = () => {
  const [isOpen] = useState(true);

  const handleClose = () => {
    // Hide the window when modal is closed
    window.electronAPI?.hideWindow?.();
  };

  return (
    <div className="fixed inset-0 bg-transparent">
      <ImageGenerationModal isOpen={isOpen} onClose={handleClose} />
    </div>
  );
};

export default ImageGenerationWindow;

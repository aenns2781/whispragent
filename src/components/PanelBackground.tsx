import React from 'react';
import backgroundImage from '../assets/panel-background.png';

interface PanelBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

const PanelBackground: React.FC<PanelBackgroundProps> = ({ children, className = '' }) => {
  return (
    <div className={`relative min-h-full ${className}`}>
      {/* Fixed Background Image Layer - stays in place while content scrolls */}
      <div
        className="fixed inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
          zIndex: 0
        }}
      />
      {/* Content Layer */}
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default PanelBackground;
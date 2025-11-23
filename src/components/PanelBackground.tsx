import React from 'react';
import backgroundImage from '../assets/panel-background.png';

interface PanelBackgroundProps {
  children: React.ReactNode;
  className?: string;
}

const PanelBackground: React.FC<PanelBackgroundProps> = ({ children, className = '' }) => {
  return (
    <div className={`relative min-h-full ${className}`}>
      {/* Background Image Layer */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage: `url(${backgroundImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
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
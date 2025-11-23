import React from 'react';

interface TribeLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'animated' | 'gradient' | 'icon';
  className?: string;
}

const TribeLogo: React.FC<TribeLogoProps> = ({
  size = 'md',
  variant = 'default',
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24'
  };

  // Use the app icon
  if (variant === 'icon' || variant === 'default') {
    return (
      <div className={`${sizeClasses[size]} ${className}`}>
        <img
          src="../assets/icon.png"
          alt="TribeWhisper"
          className="w-full h-full object-contain"
        />
      </div>
    );
  }

  if (variant === 'animated') {
    return (
      <div className={`relative ${sizeClasses[size]} ${className}`}>
        <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent-purple rounded-lg animate-spin-slow opacity-30"></div>
        <div className="absolute inset-0 bg-gradient-to-tr from-accent-purple to-primary rounded-lg animate-spin-slow animation-delay-1000 opacity-20"></div>
        <img
          src="../assets/icon.png"
          alt="TribeWhisper"
          className="relative w-full h-full object-contain z-10"
        />
      </div>
    );
  }

  if (variant === 'gradient') {
    return (
      <div className={`relative ${sizeClasses[size]} ${className} group`}>
        <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-accent-purple rounded-lg blur opacity-60 group-hover:opacity-100 transition duration-1000 group-hover:duration-200 animate-gradient"></div>
        <div className="relative flex items-center justify-center h-full bg-black rounded-lg p-1">
          <img
            src="../assets/icon.png"
            alt="TribeWhisper"
            className="w-full h-full object-contain"
          />
        </div>
      </div>
    );
  }

  // Default - just show the icon
  return (
    <div className={`${sizeClasses[size]} ${className}`}>
      <img
        src="../assets/icon.png"
        alt="TribeWhisper"
        className="w-full h-full object-contain"
      />
    </div>
  );
};

export default TribeLogo;
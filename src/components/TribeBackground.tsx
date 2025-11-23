import React from 'react';

interface TribeBackgroundProps {
  variant?: 'dots' | 'grid' | 'waves' | 'orbs' | 'logo-pattern';
  className?: string;
  children?: React.ReactNode;
}

const TribeBackground: React.FC<TribeBackgroundProps> = ({
  variant = 'orbs',
  className = '',
  children
}) => {
  const renderPattern = () => {
    switch (variant) {
      case 'dots':
        return (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_50%,rgba(147,51,234,0.1),transparent_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_80%,rgba(139,92,246,0.1),transparent_50%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_20%,rgba(168,85,247,0.1),transparent_50%)]"></div>
            <svg className="absolute inset-0 w-full h-full opacity-10">
              <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="currentColor" className="text-primary" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#dots)" />
            </svg>
          </>
        );

      case 'grid':
        return (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent-purple/5"></div>
            <svg className="absolute inset-0 w-full h-full opacity-5">
              <defs>
                <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
                  <path d="M 60 0 L 0 0 0 60" fill="none" stroke="currentColor" strokeWidth="1" className="text-primary" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </>
        );

      case 'waves':
        return (
          <>
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-gradient-to-br from-primary/10 via-transparent to-accent-purple/10 animate-wave"></div>
              <div className="absolute -bottom-1/2 -right-1/2 w-[200%] h-[200%] bg-gradient-to-tl from-accent-purple/10 via-transparent to-primary/10 animate-wave animation-delay-2000"></div>
            </div>
          </>
        );

      case 'logo-pattern':
        return (
          <>
            <div className="absolute inset-0 overflow-hidden">
              {/* Large floating T logos */}
              <div className="absolute top-10 left-10 w-32 h-32 opacity-5">
                <div className="w-full h-full bg-gradient-to-br from-primary to-accent-purple rounded-2xl flex items-center justify-center animate-float">
                  <span className="text-6xl font-bold text-white/50 font-heading">T</span>
                </div>
              </div>
              <div className="absolute bottom-20 right-20 w-40 h-40 opacity-5">
                <div className="w-full h-full bg-gradient-to-br from-accent-purple to-primary rounded-2xl flex items-center justify-center animate-float animation-delay-2000">
                  <span className="text-7xl font-bold text-white/50 font-heading">T</span>
                </div>
              </div>
              <div className="absolute top-1/2 left-1/3 w-24 h-24 opacity-5">
                <div className="w-full h-full bg-gradient-to-br from-primary to-accent-purple rounded-2xl flex items-center justify-center animate-float animation-delay-1000">
                  <span className="text-5xl font-bold text-white/50 font-heading">T</span>
                </div>
              </div>
              {/* Gradient overlay */}
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/50 to-black/80"></div>
            </div>
          </>
        );

      case 'orbs':
      default:
        return (
          <>
            <div className="absolute inset-0 overflow-hidden">
              {/* Animated orbs */}
              <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-primary/20 rounded-full filter blur-3xl animate-float"></div>
              <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-purple/20 rounded-full filter blur-3xl animate-float animation-delay-2000"></div>
              <div className="absolute top-3/4 left-3/4 w-48 h-48 bg-primary/10 rounded-full filter blur-3xl animate-float animation-delay-1000"></div>

              {/* Mesh gradient */}
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(147,51,234,0.1),transparent_50%)]"></div>
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,rgba(139,92,246,0.1),transparent_50%)]"></div>
            </div>
          </>
        );
    }
  };

  return (
    <div className={`relative ${className}`}>
      {renderPattern()}
      {children && <div className="relative z-10">{children}</div>}
    </div>
  );
};

export default TribeBackground;
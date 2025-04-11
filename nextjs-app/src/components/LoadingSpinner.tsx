'use client';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: string;
}

const LoadingSpinner = ({ size = 'md', color = '#9ACBD0' }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className="flex items-center justify-center">
      <div className={`relative ${sizeClasses[size]}`}>
        <div className="absolute top-0 left-0 w-full h-full border-2 border-gray-200 rounded-full"></div>
        <div 
          className="absolute top-0 left-0 w-full h-full border-2 rounded-full animate-spin"
          style={{
            borderColor: `${color} transparent transparent transparent`,
            borderWidth: '2px'
          }}
        ></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div 
            className="w-1 h-1 rounded-full animate-ping"
            style={{ backgroundColor: color }}
          ></div>
        </div>
      </div>
    </div>
  );
};

export default LoadingSpinner; 
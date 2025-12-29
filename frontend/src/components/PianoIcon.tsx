import React from 'react';

interface PianoIconProps {
  className?: string;
}

const PianoIcon: React.FC<PianoIconProps> = ({ className }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M21 3H3C1.9 3 1 3.9 1 5v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zm-7-8h-2v7h2v-7zm-4 0H8v7h2v-7zm8 0h-2v7h2v-7zm-12 0H4v7h2v-7z"/>
    </svg>
  );
};

export default PianoIcon; 
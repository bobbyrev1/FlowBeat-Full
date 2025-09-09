
import React from 'react';

interface StepProps {
  subdivision: number;
  isCurrent: boolean;
  isBeat: boolean;
  isBeatEnd: boolean;
  isBarEnd: boolean;
  onClick: () => void;
  onSubdivide: () => void;
}

const SubdivisionDots: React.FC<{ count: number }> = ({ count }) => {
  if (count < 2) return null;
  
  const dot = <div className="w-1.5 h-1.5 bg-white/80 rounded-full" />;
  
  if (count === 2) {
    return (
      <div className="absolute inset-0 flex justify-evenly items-center px-2">
        {dot}{dot}
      </div>
    );
  }
  if (count === 3) {
    return (
      <div className="absolute inset-0 flex justify-evenly items-center px-1">
        {dot}{dot}{dot}
      </div>
    );
  }
  if (count === 4) {
    return (
      <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0 place-items-center p-2">
        {dot}{dot}{dot}{dot}
      </div>
    );
  }
  return null;
};


export const Step: React.FC<StepProps> = React.memo(({ subdivision, isCurrent, isBeat, isBeatEnd, isBarEnd, onClick, onSubdivide }) => {
  const isActive = subdivision > 0;
  const baseClasses = "relative w-full h-12 rounded-none transition-all duration-100 cursor-pointer border-y border-r";
  
  const getBackgroundColor = () => {
    if (isActive) {
      return isCurrent ? 'bg-accent' : 'bg-step-active';
    }
    if (isCurrent) {
      return 'bg-step-playing';
    }
    return isBeat ? 'bg-step-inactive/80' : 'bg-step-inactive';
  };

  const getBorderColor = () => {
     if (isBarEnd) {
        return 'border-primary/40';
     }
     if (isBeatEnd) {
        return 'border-secondary/30'
     }
     return 'border-border-color'
  };
  
  const classes = `${baseClasses} ${getBackgroundColor()} ${getBorderColor()} hover:bg-step-hover`;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    onSubdivide();
  };

  return (
    <div
      onClick={onClick}
      onContextMenu={handleContextMenu}
      className={classes}
    >
        <div className="w-full h-full shadow-inner-sm" />
        <SubdivisionDots count={subdivision} />
    </div>
  );
});

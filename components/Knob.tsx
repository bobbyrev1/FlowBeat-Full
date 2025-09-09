

import React, { useCallback, useRef } from 'react';

interface KnobProps {
  size?: number;
  min: number;
  max: number;
  step?: number;
  value: number;
  onChange: (value: number) => void;
  label?: string;
}

const SENSITIVITY = 0.005;

export const Knob: React.FC<KnobProps> = ({
  size = 60,
  min,
  max,
  value,
  onChange,
  label,
}) => {
  const knobRef = useRef<SVGSVGElement>(null);
  const dataRef = useRef({
    isDragging: false,
    startY: 0,
    startValue: 0,
  });

  const valueToRotation = useCallback((v: number) => {
    const range = max - min;
    const valueInRange = Math.max(min, Math.min(max, v));
    const percentage = (valueInRange - min) / range;
    return percentage * 270 - 135;
  }, [min, max]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dataRef.current.isDragging) {
      const { startY, startValue } = dataRef.current;
      const deltaY = startY - e.clientY;
      const range = max - min;
      let newValue = startValue + deltaY * SENSITIVITY * range;
      newValue = Math.max(min, Math.min(max, newValue));
      onChange(newValue);
    }
  }, [min, max, onChange]);

  const handleMouseUp = useCallback(() => {
    dataRef.current.isDragging = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'default';
  }, [handleMouseMove]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dataRef.current = {
      isDragging: true,
      startY: e.clientY,
      startValue: value,
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'ns-resize';
  };
  
  const rotation = valueToRotation(value);

  return (
    <div className="flex flex-col items-center">
      <div
        className="relative flex items-center justify-center cursor-pointer"
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
      >
        <svg
          ref={knobRef}
          width={size}
          height={size}
          viewBox="0 0 100 100"
          className="transition-transform duration-100"
        >
          <circle cx="50" cy="50" r="45" fill="#E5E5E7" stroke="#D1D1D6" strokeWidth="2" />
          <g transform={`rotate(${rotation} 50 50)`}>
            <line
              x1="50"
              y1="50"
              x2="50"
              y2="15"
              stroke="#000000"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </g>
        </svg>
      </div>
      {label && <label className="text-[10px] font-medium text-secondary mt-0.5">{label}</label>}
    </div>
  );
};
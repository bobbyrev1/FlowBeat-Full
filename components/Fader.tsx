import React, { useCallback, useRef } from 'react';

interface FaderProps {
    min: number;
    max: number;
    step: number;
    value: number;
    onChange: (value: number) => void;
    label: string;
}

// Lower value = less sensitive. This is in units per pixel.
const FADER_SENSITIVITY = 0.3; 

export const Fader: React.FC<FaderProps> = ({ min, max, step, value, onChange, label }) => {
    const dataRef = useRef({
        isDragging: false,
        startY: 0,
        startValue: 0,
    });

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (dataRef.current.isDragging) {
            const { startY, startValue } = dataRef.current;
            const deltaY = startY - e.clientY; // Moving up is positive delta
            let newValue = startValue + deltaY * FADER_SENSITIVITY;
            
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
    
    const handleKeyDown = (e: React.KeyboardEvent) => {
        let newValue = value;
        const largeStep = (max - min) / 10;
    
        switch(e.key) {
            case 'ArrowUp':
            case 'ArrowRight':
                newValue += step;
                break;
            case 'ArrowDown':
            case 'ArrowLeft':
                newValue -= step;
                break;
            case 'PageUp':
                newValue += largeStep;
                break;
            case 'PageDown':
                newValue -= largeStep;
                break;
            case 'Home':
                newValue = min;
                break;
            case 'End':
                newValue = max;
                break;
            default:
                return;
        }
        
        e.preventDefault();
        newValue = Math.max(min, Math.min(max, newValue));
        onChange(newValue);
    };

    const valueToPercentage = (v: number) => {
        const range = max - min;
        if (range === 0) return 0;
        const valueInRange = Math.max(min, Math.min(max, v));
        return ((valueInRange - min) / range) * 100;
    };

    const thumbPosition = valueToPercentage(value);

    return (
        <div 
            className="relative w-full h-full flex justify-center py-2 cursor-ns-resize focus:outline-none focus:ring-2 focus:ring-accent rounded"
            onMouseDown={handleMouseDown}
            onKeyDown={handleKeyDown}
            tabIndex={0}
            role="slider"
            aria-label={`${label} volume fader`}
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={parseFloat(value.toFixed(2))}
        >
            {/* Track */}
            <div className="relative w-1 h-full bg-gray-300 rounded-full">
                {/* Thumb */}
                <div 
                    className="absolute left-1/2 -translate-x-1/2 w-10 h-5 bg-gray-700 border-2 border-white rounded-md shadow-md"
                    style={{ 
                        bottom: `calc(${thumbPosition}% - 10px)`, // center thumb on position
                        pointerEvents: 'none',
                    }}
                />
            </div>
        </div>
    );
};
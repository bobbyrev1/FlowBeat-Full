import React from 'react';

interface VUMeterProps {
    level: number; // Level in dBFS, from -Infinity to 0 or more
}

const MIN_DB = -60;
const MAX_DB = 6;

const dbToPercentage = (db: number): number => {
    if (db < MIN_DB) return 0;

    // Normalize db to a 0-1 range
    const normalizedDb = (Math.min(db, MAX_DB) - MIN_DB) / (MAX_DB - MIN_DB);

    // Apply an aggressive power curve to make the meter more sensitive to peaks
    const curved = Math.pow(normalizedDb, 2.5);

    return Math.min(curved * 100, 100);
};

export const VUMeter: React.FC<VUMeterProps> = ({ level }) => {
    const heightPercentage = dbToPercentage(level);
    const isClipping = level >= 0;

    return (
        <div className="relative w-4 h-full bg-gray-200 rounded-sm overflow-hidden border border-border-color shadow-inner-sm">
            <div 
                className="absolute bottom-0 w-full"
                style={{ 
                    height: `${heightPercentage}%`,
                    backgroundImage: 'linear-gradient(to top, #4ade80, #facc15 70%, #f87171 95%)' 
                }}
            />
             {isClipping && (
                <div className="absolute top-0 w-full h-1.5 bg-red-600 animate-pulse" />
            )}
        </div>
    );
};

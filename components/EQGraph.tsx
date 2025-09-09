
import React, { useEffect, useRef } from 'react';
import type { EQState } from '../types';

interface EQGraphProps {
    eq: EQState;
    width?: number;
    height?: number;
}

const MIN_FREQ = 20;
const MAX_FREQ = 20000;
const MIN_GAIN_DB = -18;
const MAX_GAIN_DB = 18;
const MID_FREQ_HZ = 1000;
const MID_Q = 1.2;

export const EQGraph: React.FC<EQGraphProps> = ({ eq, width = 100, height = 50 }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        ctx.clearRect(0, 0, width, height);
        
        // --- Helper functions for coordinate mapping ---
        const freqToX = (freq: number) => {
            const logFreq = Math.log10(freq);
            const logMin = Math.log10(MIN_FREQ);
            const logMax = Math.log10(MAX_FREQ);
            return ((logFreq - logMin) / (logMax - logMin)) * width;
        };
        const gainToY = (gain: number) => {
            const clampedGain = Math.max(MIN_GAIN_DB, Math.min(MAX_GAIN_DB, gain));
            return (1 - (clampedGain - MIN_GAIN_DB) / (MAX_GAIN_DB - MIN_GAIN_DB)) * height;
        };

        // --- Draw Grid Lines ---
        ctx.strokeStyle = '#E5E5E7';
        ctx.lineWidth = 0.5;
        // Center line (0 dB)
        ctx.beginPath();
        const zeroY = gainToY(0);
        ctx.moveTo(0, zeroY);
        ctx.lineTo(width, zeroY);
        ctx.stroke();

        // --- Calculate total EQ response ---
        const calculateGainAtFreq = (freq: number): number => {
            // Low Shelf: Apply gain below the low frequency cutoff.
            // The original formula was inverted, behaving as a high-pass shelf. This is the corrected version.
            const s_low = 1 / (1 + Math.pow(freq / eq.lowFrequency, 2));
            const gainLow = eq.low * s_low;
            
            // High Shelf: Apply gain above the high frequency cutoff.
            // The original formula was inverted, behaving as a low-pass shelf. This is the corrected version.
            const s_high = 1 / (1 + Math.pow(eq.highFrequency / freq, 2));
            const gainHigh = eq.high * s_high;

            // Mid Peak filter calculation (approximation)
            const w0 = 2 * Math.PI * MID_FREQ_HZ / 44100; // Normalized frequency
            const alpha = Math.sin(w0) / (2 * MID_Q);
            const A = Math.pow(10, eq.mid / 40);
            const w = 2 * Math.PI * freq / 44100;
            const cos_w = Math.cos(w);
            const H_num = Math.pow(A,2) * (Math.pow(1+alpha/A, 2) - 2*(1+alpha/A)*cos_w + Math.pow(cos_w,2) + Math.pow(Math.sin(w),2));
            const H_den = Math.pow(1+alpha*A, 2) - 2*(1+alpha*A)*cos_w + Math.pow(cos_w,2) + Math.pow(Math.sin(w),2);
            const mag = Math.sqrt(H_num / H_den);
            const gainMid = 20 * Math.log10(mag);

            return gainLow + gainHigh + gainMid;
        };
        
        // --- Draw EQ Curve ---
        ctx.beginPath();
        ctx.strokeStyle = '#007AFF';
        ctx.lineWidth = 1.5;

        for (let i = 0; i <= width; i++) {
            const percent = i / width;
            const logFreq = Math.log10(MIN_FREQ) + percent * (Math.log10(MAX_FREQ) - Math.log10(MIN_FREQ));
            const freq = Math.pow(10, logFreq);
            const totalGain = calculateGainAtFreq(freq);
            const y = gainToY(totalGain);

            if (i === 0) {
                ctx.moveTo(i, y);
            } else {
                ctx.lineTo(i, y);
            }
        }
        ctx.stroke();

    }, [eq, width, height]);

    return (
        <canvas 
            ref={canvasRef} 
            width={width} 
            height={height}
            className="w-full h-auto rounded-sm bg-white"
        />
    );
};

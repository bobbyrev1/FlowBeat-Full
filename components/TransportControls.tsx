

import React, { useCallback, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Circle } from 'lucide-react';
import { Knob } from './Knob';

interface TransportControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  bpm: number;
  onBpmChange: (value: number) => void;
  swing: number;
  onSwingChange: (value: number) => void;
  masterVolume: number;
  onMasterVolumeChange: (value: number) => void;
  patternLength: number;
  onPatternLengthChange: (value: number) => void;
  isMetronomeOn: boolean;
  onMetronomeToggle: (value: boolean) => void;
  isRecording: boolean;
  isArmedForRecording: boolean;
  onToggleRecord: () => void;
  countInBars: number;
  onCountInBarsChange: (bars: number) => void;
}

const BPM_SENSITIVITY = 0.5;
const MIN_BPM = 40;
const MAX_BPM = 300;

export const TransportControls: React.FC<TransportControlsProps> = ({
  isPlaying,
  onTogglePlay,
  bpm,
  onBpmChange,
  swing,
  onSwingChange,
  masterVolume,
  onMasterVolumeChange,
  patternLength,
  onPatternLengthChange,
  isMetronomeOn,
  onMetronomeToggle,
  isRecording,
  isArmedForRecording,
  onToggleRecord,
  countInBars,
  onCountInBarsChange,
}) => {
  const dragData = useRef({
    isDragging: false,
    startY: 0,
    startBpm: 0,
  });

  const handleBpmMouseMove = useCallback((e: MouseEvent) => {
    if (dragData.current.isDragging) {
      const { startY, startBpm } = dragData.current;
      const deltaY = startY - e.clientY;
      let newBpm = startBpm + deltaY * BPM_SENSITIVITY;
      newBpm = Math.round(Math.max(MIN_BPM, Math.min(MAX_BPM, newBpm)));
      onBpmChange(newBpm);
    }
  }, [onBpmChange]);

  const handleBpmMouseUp = useCallback(() => {
    dragData.current.isDragging = false;
    document.removeEventListener('mousemove', handleBpmMouseMove);
    document.removeEventListener('mouseup', handleBpmMouseUp);
    document.body.style.cursor = 'default';
  }, [handleBpmMouseMove]);
  
  const handleBpmMouseDown = (e: React.MouseEvent<HTMLInputElement>) => {
    e.preventDefault();
    dragData.current = {
      isDragging: true,
      startY: e.clientY,
      startBpm: bpm,
    };
    document.addEventListener('mousemove', handleBpmMouseMove);
    document.addEventListener('mouseup', handleBpmMouseUp);
    document.body.style.cursor = 'ns-resize';
  };


  return (
    <div className="flex items-center space-x-4 bg-main p-3 rounded-lg shadow-main">
      <button
        onClick={onToggleRecord}
        className={`p-3 rounded-md transition-colors ${isRecording || isArmedForRecording ? 'bg-red-500/20 text-red-500' : 'bg-gray-100 hover:bg-gray-200'}`}
        title="Record"
      >
        <Circle size={20} className={isRecording ? 'animate-pulse' : ''} fill="currentColor" />
      </button>

      <button
        onClick={onTogglePlay}
        disabled={isArmedForRecording}
        className="p-3 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
      </button>

       <button
        onClick={() => onMetronomeToggle(!isMetronomeOn)}
        className={`p-3 rounded-md transition-colors ${isMetronomeOn ? 'bg-accent/20 text-accent' : 'bg-gray-100 hover:bg-gray-200'}`}
        title="Toggle Metronome"
      >
        {isMetronomeOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
      </button>
      
       <div className="flex items-center space-x-2">
        <label className="text-sm font-medium text-secondary">Count-in</label>
        <select
          value={countInBars}
          onChange={(e) => onCountInBarsChange(Number(e.target.value))}
          className="bg-gray-100 rounded-md p-1 text-sm"
          disabled={isPlaying || isRecording || isArmedForRecording}
        >
          <option value={0}>Off</option>
          <option value={1}>1 Bar</option>
          <option value={2}>2 Bars</option>
          <option value={4}>4 Bars</option>
        </select>
      </div>

      <div className="flex items-center space-x-2">
        <label className="text-sm font-medium text-secondary">BPM</label>
        <input
          type="number"
          value={bpm}
          onChange={(e) => onBpmChange(Number(e.target.value))}
          onMouseDown={handleBpmMouseDown}
          className="w-16 text-center bg-gray-100 rounded-md p-1 cursor-ns-resize"
          min={MIN_BPM}
          max={MAX_BPM}
        />
      </div>

       <div className="flex flex-col items-center">
        <label className="text-xs font-medium text-secondary -mb-1">Swing</label>
        <Knob
          size={40}
          min={0}
          max={1}
          step={0.01}
          value={swing}
          onChange={onSwingChange}
        />
      </div>

      <div className="flex flex-col items-center">
        <label className="text-xs font-medium text-secondary -mb-1">Master</label>
        <Knob
          size={40}
          min={-40}
          max={6}
          value={masterVolume}
          onChange={onMasterVolumeChange}
        />
      </div>

      <div className="flex items-center space-x-2">
        <label className="text-sm font-medium text-secondary">Length</label>
        <select
          value={patternLength}
          onChange={(e) => onPatternLengthChange(Number(e.target.value))}
          className="bg-gray-100 rounded-md p-1 text-sm"
        >
          <option value={16}>1 Bar</option>
          <option value={32}>2 Bars</option>
          <option value={64}>4 Bars</option>
          <option value={128}>8 Bars</option>
        </select>
      </div>
    </div>
  );
};

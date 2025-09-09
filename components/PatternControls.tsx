

import React from 'react';
import { Plus, Trash2, Keyboard } from 'lucide-react';
import type { Pattern, QuantizeSnapValue } from '../types';

interface PatternControlsProps {
  patterns: Pattern[];
  activePatternId: string;
  onPatternSelect: (id: string) => void;
  onAddPattern: () => void;
  onClearPattern: () => void;
  followPlayhead: boolean;
  onFollowPlayheadChange: (value: boolean) => void;
  playbackOnTrigger: boolean;
  onPlaybackOnTriggerChange: (value: boolean) => void;
  isMusicalTypingEnabled: boolean;
  onIsMusicalTypingEnabledChange: (value: boolean) => void;
  quantizeSnapValue: QuantizeSnapValue;
  onQuantizeSnapValueChange: (value: QuantizeSnapValue) => void;
}

export const PatternControls: React.FC<PatternControlsProps> = ({
  patterns,
  activePatternId,
  onPatternSelect,
  onAddPattern,
  onClearPattern,
  followPlayhead,
  onFollowPlayheadChange,
  playbackOnTrigger,
  onPlaybackOnTriggerChange,
  isMusicalTypingEnabled,
  onIsMusicalTypingEnabledChange,
  quantizeSnapValue,
  onQuantizeSnapValueChange,
}) => {
  return (
    <div className="mb-4 p-4 bg-main rounded-xl shadow-main flex justify-between items-center">
      <h2 className="text-lg font-semibold">Pattern Editor</h2>
      <div className="flex items-center space-x-6">
         <div className="flex items-center space-x-2">
            <label htmlFor="musical-typing" className="text-sm font-medium text-secondary cursor-pointer flex items-center gap-1.5">
              <Keyboard size={14} /> Musical Typing
            </label>
            <button
              id="musical-typing"
              onClick={() => onIsMusicalTypingEnabledChange(!isMusicalTypingEnabled)}
              className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 ${isMusicalTypingEnabled ? 'bg-accent' : 'bg-gray-300'}`}
              aria-pressed={isMusicalTypingEnabled}
              title={isMusicalTypingEnabled ? 'Disable musical typing keyboard' : 'Enable musical typing keyboard'}
            >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-200 ${isMusicalTypingEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
            </button>
        </div>
        <div className="flex items-center space-x-2">
            <label htmlFor="playback-on-trigger" className="text-sm font-medium text-secondary cursor-pointer">
              Playback on Trigger
            </label>
            <button
              id="playback-on-trigger"
              onClick={() => onPlaybackOnTriggerChange(!playbackOnTrigger)}
              className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 ${playbackOnTrigger ? 'bg-accent' : 'bg-gray-300'}`}
              aria-pressed={playbackOnTrigger}
              title={playbackOnTrigger ? 'Disable audio feedback on click' : 'Enable audio feedback on click'}
            >
                <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-200 ${playbackOnTrigger ? 'translate-x-5' : 'translate-x-0'}`}></div>
            </button>
        </div>
        <div className="flex items-center space-x-2">
          <label htmlFor="follow-playhead" className="text-sm font-medium text-secondary cursor-pointer">
            Follow Playhead
          </label>
          <button
            id="follow-playhead"
            onClick={() => onFollowPlayheadChange(!followPlayhead)}
            className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 ${followPlayhead ? 'bg-accent' : 'bg-gray-300'}`}
            aria-pressed={followPlayhead}
            title={followPlayhead ? 'Disable playhead following' : 'Enable playhead following'}
          >
              <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-200 ${followPlayhead ? 'translate-x-5' : 'translate-x-0'}`}></div>
          </button>
        </div>
        <div className="flex items-center space-x-2">
          <label htmlFor="pattern-select" className="text-sm font-medium text-secondary">
            Current Pattern:
          </label>
          <select
            id="pattern-select"
            value={activePatternId}
            onChange={(e) => onPatternSelect(e.target.value)}
            className="bg-gray-100 rounded-md p-2 text-sm border border-border-color"
          >
            {patterns.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={onClearPattern}
            className="p-2 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors border border-border-color"
            title="Clear all steps in pattern"
          >
            <Trash2 size={16} className="text-secondary" />
          </button>
          <button
            onClick={onAddPattern}
            className="p-2 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors border border-border-color"
            title="Add new pattern"
          >
            <Plus size={16} />
          </button>
          <div className="flex items-center space-x-2 border-l border-border-color pl-4 ml-2">
             <label htmlFor="quantize-snap" className="text-sm font-medium text-secondary">
                Snap
              </label>
              <select
                id="quantize-snap"
                value={quantizeSnapValue}
                onChange={(e) => onQuantizeSnapValueChange(e.target.value as QuantizeSnapValue)}
                className="bg-gray-100 rounded-md p-2 text-sm border border-border-color"
              >
                <option value="1/64">1/64</option>
                <option value="1/32">1/32</option>
                <option value="1/16">1/16</option>
                <option value="1/8">1/8</option>
                <option value="1/4">1/4</option>
                <option value="1/2">1/2</option>
                <option value="None">None</option>
              </select>
          </div>
        </div>
      </div>
    </div>
  );
};



import React, { useState, useRef, useEffect } from 'react';
import type { ChannelState, Sample } from '../types';
import { MidiPattern } from '../types';
import { Knob } from './Knob';
import { Step } from './Step';
import { useDrop } from 'react-dnd';
import { SlidersHorizontal, Music2, Music, Keyboard } from 'lucide-react';

interface ChannelProps {
  channel: ChannelState;
  currentStep: number;
  patternLength: number;
  onStepToggle: (channelId: string, stepIndex: number) => void;
  onStepSubdivide: (channelId: string, stepIndex: number) => void;
  onChannelChange: (id: string, newProps: Partial<ChannelState>) => void;
  onSampleDrop: (channelId: string, sample: Sample) => void;
  onApplyMidiPattern: (channelId: string, pattern: MidiPattern) => void;
  onOpenPianoRoll: (channelId: string) => void;
  onChannelMuteSoloChange: (channelId: string, type: 'mute' | 'solo') => void;
  isSelected: boolean;
  onSelect: (channelId: string) => void;
}

export const Channel: React.FC<ChannelProps> = ({
  channel,
  currentStep,
  patternLength,
  onStepToggle,
  onStepSubdivide,
  onChannelChange,
  onSampleDrop,
  onApplyMidiPattern,
  onOpenPianoRoll,
  onChannelMuteSoloChange,
  isSelected,
  onSelect,
}) => {
  const [showMidiOptions, setShowMidiOptions] = useState(false);
  const midiButtonRef = useRef<HTMLButtonElement>(null);
  const midiMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        // If the click is outside both the button and the menu itself, close the menu.
        if (
            midiButtonRef.current && !midiButtonRef.current.contains(event.target as Node) &&
            midiMenuRef.current && !midiMenuRef.current.contains(event.target as Node)
        ) {
            setShowMidiOptions(false);
        }
    };
    
    // Only add the listener when the menu is open
    if (showMidiOptions) {
        document.addEventListener('mousedown', handleClickOutside);
    }

    // Cleanup the listener
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMidiOptions]);


  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'sample',
    drop: (item: Sample) => onSampleDrop(channel.id, item),
    collect: (monitor) => ({
      isOver: !!monitor.isOver(),
    }),
  }));
  
  const handleMidiOptionClick = (pattern: MidiPattern) => {
    onApplyMidiPattern(channel.id, pattern);
    setShowMidiOptions(false);
  };

  const hasNotes = channel.notes && channel.notes.length > 0;

  return (
    <div className="flex items-center">
      <div 
        ref={drop as any}
        onClick={() => onSelect(channel.id)}
        className={`w-56 shrink-0 p-2 rounded-lg transition-all duration-200 flex flex-col cursor-pointer
          ${isOver ? 'bg-accent/20' : hasNotes ? 'bg-blue-50' :'bg-light-bg'}
          ${isSelected ? 'outline outline-2 outline-accent outline-offset-[-1px]' : ''}
        `}
      >
        <div className="text-center truncate pb-2">
            <span className="font-semibold text-sm" title={channel.name}>
                {channel.isAudioClipChannel && <Music size={12} className="inline-block mr-1 text-secondary" />}
                {channel.name}
            </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
             <div className="flex flex-col items-center">
                <label className="text-xs text-secondary -mb-2">Vol</label>
                <Knob
                    size={32}
                    min={-60}
                    max={6}
                    value={channel.volume}
                    onChange={(val) => onChannelChange(channel.id, { volume: val })}
                />
            </div>
            <div className="flex flex-col items-center">
                <label className="text-xs text-secondary -mb-2">Pan</label>
                <Knob
                    size={32}
                    min={-1}
                    max={1}
                    step={0.01}
                    value={channel.pan}
                    onChange={(val) => onChannelChange(channel.id, { pan: val })}
                />
            </div>
          </div>

          <div className="flex items-center space-x-1">
             <div className="flex flex-col items-center space-y-1">
                 <label className="text-xs text-secondary">Cut</label>
                <button 
                  onClick={(e) => { e.stopPropagation(); onChannelChange(channel.id, { cutItself: !channel.cutItself }); }}
                  className={`w-8 h-4 rounded-full p-0.5 transition-colors duration-200 ${channel.cutItself ? 'bg-accent' : 'bg-gray-300'}`}
                >
                    <div className={`w-3 h-3 bg-white rounded-full transition-transform duration-200 ${channel.cutItself ? 'translate-x-4' : 'translate-x-0'}`}></div>
                </button>
            </div>
             <div className="flex flex-col gap-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); onChannelMuteSoloChange(channel.id, 'solo'); }}
                  className={`w-5 h-5 rounded-sm text-xs font-bold transition-colors ${channel.isSoloed ? 'bg-yellow-400 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                  title="Solo"
                >
                  S
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onChannelMuteSoloChange(channel.id, 'mute'); }}
                  className={`w-5 h-5 rounded-sm text-xs font-bold transition-colors ${channel.isMuted ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                  title="Mute"
                >
                  M
                </button>
            </div>
            <div className="flex flex-col gap-1">
                <button
                    onClick={(e) => { e.stopPropagation(); onOpenPianoRoll(channel.id); }}
                    className="p-1 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Piano Roll"
                    disabled={channel.isAudioClipChannel}
                >
                    <Keyboard size={16} className="text-secondary"/>
                </button>
                 <div className="relative">
                    <button
                        ref={midiButtonRef}
                        onClick={(e) => { e.stopPropagation(); setShowMidiOptions(!showMidiOptions); }}
                        className="p-1 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        title="MIDI Patterns"
                        disabled={channel.isAudioClipChannel}
                    >
                        <Music2 size={16} className="text-secondary"/>
                    </button>
                    {showMidiOptions && (
                        <div ref={midiMenuRef} className="absolute z-20 right-0 mt-2 w-48 bg-white shadow-lg rounded-md border border-border-color py-1">
                            <button onClick={(e) => { e.stopPropagation(); handleMidiOptionClick(MidiPattern.HiHat); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100">HiHat Pattern</button>
                            <button onClick={(e) => { e.stopPropagation(); handleMidiOptionClick(MidiPattern.TrapHiHat); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100">Trap HiHat Rolls</button>
                            <button onClick={(e) => { e.stopPropagation(); handleMidiOptionClick(MidiPattern.HalfTimeClap1); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100">Half-Time Clap 1</button>
                            <button onClick={(e) => { e.stopPropagation(); handleMidiOptionClick(MidiPattern.Clap); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100">Clap Pattern</button>
                            <button onClick={(e) => { e.stopPropagation(); handleMidiOptionClick(MidiPattern.FourOnTheFloor); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100">4 on the Floor</button>
                            <button onClick={(e) => { e.stopPropagation(); handleMidiOptionClick(MidiPattern.HalfTimeClap2); }} className="block w-full text-left px-4 py-2 text-sm hover:bg-gray-100">Half-Time Clap 2</button>
                            <div className="border-t border-border-color my-1" />
                            <button onClick={(e) => { e.stopPropagation(); handleMidiOptionClick(MidiPattern.Erase); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50">Erase Channel</button>
                        </div>
                    )}
                </div>
            </div>
          </div>
        </div>
      </div>
      {channel.isAudioClipChannel || hasNotes ? (
        <div 
            className={`flex-1 h-12 flex items-center justify-start px-4 text-secondary text-sm transition-colors ${hasNotes && !channel.isAudioClipChannel ? 'cursor-pointer hover:bg-gray-200/50' : ''}`}
            style={{ 
                backgroundImage: 'linear-gradient(45deg, #EDEDF0 25%, transparent 25%, transparent 75%, #EDEDF0 75%, #EDEDF0), linear-gradient(45deg, #EDEDF0 25%, transparent 25%, transparent 75%, #EDEDF0 75%, #EDEDF0)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 10px 10px',
            }}
            onClick={hasNotes && !channel.isAudioClipChannel ? () => onOpenPianoRoll(channel.id) : undefined}
            title={hasNotes && !channel.isAudioClipChannel ? 'Open Piano Roll' : undefined}
        >
          {channel.isAudioClipChannel ? '(Audio Clip Controls)' : '(Piano Roll Notes)'}
        </div>
      ) : (
        <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${patternLength}, minmax(2.5rem, 1fr))` }}>
            {channel.steps.slice(0, patternLength).map((stepValue, i) => (
            <Step
                key={i}
                subdivision={stepValue}
                isCurrent={currentStep >= 0 && (currentStep % patternLength) === i}
                isBeat={(i % 4) === 0}
                isBarEnd={(i + 1) % 16 === 0}
                isBeatEnd={(i + 1) % 4 === 0}
                onClick={() => onStepToggle(channel.id, i)}
                onSubdivide={() => onStepSubdivide(channel.id, i)}
            />
            ))}
        </div>
      )}
    </div>
  );
};

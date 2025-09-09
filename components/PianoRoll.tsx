


import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { ChannelState, Note } from '../types';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

// --- Constants ---
const NUM_OCTAVES = 7;
const NUM_NOTES = NUM_OCTAVES * 12;
const MIN_PITCH = 24; // C1
const MAX_PITCH = MIN_PITCH + NUM_NOTES - 1;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

type SnapValue = '1 Bar' | '1/8' | '1/16' | '1/32' | 'None';

interface PianoRollProps {
    channel: ChannelState;
    patternLength: number;
    onClose: () => void;
    onNotesChange: (channelId: string, notes: Note[]) => void;
    currentStep: number;
    isPlaying: boolean;
    followPlayhead: boolean;
    onTriggerNote: (pitch: number) => void;
}

const getSnapStep = (snap: SnapValue): number => {
    switch (snap) {
        case '1 Bar': return 16;
        case '1/8': return 2;
        case '1/16': return 1;
        case '1/32': return 0.5;
        case 'None': return 0;
        default: return 1;
    }
};

const snap = (value: number, snapStep: number): number => {
    if (snapStep === 0) return value;
    return Math.round(value / snapStep) * snapStep;
};

export const PianoRoll: React.FC<PianoRollProps> = ({ channel, patternLength, onClose, onNotesChange, currentStep, isPlaying, followPlayhead, onTriggerNote }) => {
    const [notes, setNotes] = useState<Note[]>(() => {
        const initialNotes = channel.notes || [];
        if (initialNotes.length > 0) {
            return JSON.parse(JSON.stringify(initialNotes));
        }
        const notesFromSteps: Note[] = [];
        const defaultPitch = 48; // C3
        channel.steps.forEach((stepValue, stepIndex) => {
            if (stepValue > 0) {
                notesFromSteps.push({
                    id: `note-from-step-${stepIndex}-${Math.random()}`,
                    pitch: defaultPitch,
                    start: stepIndex,
                    duration: 1,
                    velocity: 0.75,
                });
            }
        });
        return notesFromSteps;
    });
    
    const [stepWidth, setStepWidth] = useState(25);
    const [noteHeight, setNoteHeight] = useState(20);
    const [snapValue, setSnapValue] = useState<SnapValue>('1/16');
    const [ghostNote, setGhostNote] = useState<{ pitch: number; start: number; } | null>(null);

    const gridContainerRef = useRef<HTMLDivElement>(null);
    const pianoKeysRef = useRef<HTMLDivElement>(null);
    const isSyncingScroll = useRef(false);

    const dragData = useRef<{
        type: 'move' | 'resize';
        noteId: string;
        startX: number;
        startY: number;
        originalStart: number;
        originalPitch: number;
        originalDuration: number;
    } | null>(null);

    // Effect for real-time updates
    useEffect(() => {
        onNotesChange(channel.id, notes);
    }, [notes, channel.id, onNotesChange]);
    
    // Effect to scroll to notes when opened or when notes/zoom changes
    useEffect(() => {
        // A small delay ensures that the DOM has been fully painted and scrollHeight is accurate.
        const timer = setTimeout(() => {
            if (gridContainerRef.current && pianoKeysRef.current) {
                const container = gridContainerRef.current;
                // If container has no height yet, don't try to scroll.
                if (container.clientHeight === 0) return;

                let targetPitch = 48; // Default to C3 (MIDI note 48)

                if (notes && notes.length > 0) {
                    const pitches = notes.map(n => n.pitch);
                    const avgPitch = pitches.reduce((sum, p) => sum + p, 0) / pitches.length;
                    targetPitch = avgPitch;
                }

                const targetY = (MAX_PITCH - targetPitch) * noteHeight;
                const scrollTop = targetY - (container.clientHeight / 2) + (noteHeight / 2);
                const clampedScrollTop = Math.max(0, Math.min(scrollTop, container.scrollHeight - container.clientHeight));

                container.scrollTop = clampedScrollTop;
                pianoKeysRef.current.scrollTop = clampedScrollTop;
            }
        }, 0);

        return () => clearTimeout(timer);
    }, [notes, noteHeight]); // Run when notes are populated or vertical zoom changes

    const handleQuantize = () => {
        const snapStep = getSnapStep(snapValue);
        if (snapStep === 0) return; // Can't quantize to 'None'

        setNotes(prevNotes =>
            prevNotes.map(note => ({
                ...note,
                start: snap(note.start, snapStep),
                duration: Math.max(snapStep, snap(note.duration, snapStep))
            }))
        );
    };

    const addNote = (pitch: number, start: number) => {
        const snapStep = getSnapStep(snapValue);
        const newNote: Note = {
            id: `note-${Date.now()}-${Math.random()}`,
            pitch,
            start: snap(start, snapStep),
            duration: snapStep > 0 ? snapStep : 1,
            velocity: 0.75,
        };
        setNotes(prev => [...prev, newNote]);
    };
    
    const deleteNote = (noteId: string) => {
        setNotes(prev => prev.filter(n => n.id !== noteId));
    };

    const handleGridClick = (e: React.MouseEvent) => {
        if (!gridContainerRef.current) return;
        const rect = gridContainerRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top + gridContainerRef.current.scrollTop;
        const x = e.clientX - rect.left + gridContainerRef.current.scrollLeft;

        const pitch = MAX_PITCH - Math.floor(y / noteHeight);
        const start = x / stepWidth;
        
        if (start < patternLength) {
            addNote(pitch, start);
        }
    };
    
    const handleMouseDown = (e: React.MouseEvent, note: Note, type: 'move' | 'resize') => {
        e.stopPropagation();
        dragData.current = { type, noteId: note.id, startX: e.clientX, startY: e.clientY, originalStart: note.start, originalPitch: note.pitch, originalDuration: note.duration };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!dragData.current) return;
        const { type, noteId, startX, startY, originalStart, originalPitch, originalDuration } = dragData.current;
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;
        const snapStep = getSnapStep(snapValue);

        setNotes(prevNotes => prevNotes.map(note => {
            if (note.id !== noteId) return note;
            
            let newStart = note.start;
            let newPitch = note.pitch;
            let newDuration = note.duration;

            if (type === 'move') {
                const startOffset = deltaX / stepWidth;
                const pitchOffset = Math.round(deltaY / noteHeight);
                newStart = snap(Math.max(0, originalStart + startOffset), snapStep);
                newPitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, originalPitch - pitchOffset));
            } else if (type === 'resize') {
                const durationOffset = deltaX / stepWidth;
                const rawDuration = originalDuration + durationOffset;
                newDuration = Math.max(snapStep || 0.25, snap(rawDuration, snapStep));
            }
            return { ...note, start: newStart, pitch: newPitch, duration: newDuration };
        }));
    }, [stepWidth, noteHeight, snapValue]);

    const handleMouseUp = useCallback(() => {
        dragData.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }, [handleMouseMove]);
    
    const handleGridMouseMove = (e: React.MouseEvent) => {
        if (dragData.current || !gridContainerRef.current) return;
        const rect = gridContainerRef.current.getBoundingClientRect();
        const y = e.clientY - rect.top + gridContainerRef.current.scrollTop;
        const x = e.clientX - rect.left + gridContainerRef.current.scrollLeft;

        const snapStep = getSnapStep(snapValue);
        const pitch = MAX_PITCH - Math.floor(y / noteHeight);
        const start = snap(x / stepWidth, snapStep);

        if (start < patternLength) setGhostNote({ pitch, start });
        else setGhostNote(null);
    };

    const handleGridMouseLeave = () => { setGhostNote(null); };
    
    useEffect(() => {
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [handleMouseMove, handleMouseUp]);

    const syncScroll = (source: 'keys' | 'grid') => {
        if (isSyncingScroll.current) return;
        isSyncingScroll.current = true;
        if (source === 'grid' && pianoKeysRef.current && gridContainerRef.current) {
            pianoKeysRef.current.scrollTop = gridContainerRef.current.scrollTop;
        } else if (source === 'keys' && pianoKeysRef.current && gridContainerRef.current) {
            gridContainerRef.current.scrollTop = pianoKeysRef.current.scrollTop;
        }
        requestAnimationFrame(() => { isSyncingScroll.current = false; });
    };

    useEffect(() => {
        if (isPlaying && followPlayhead && gridContainerRef.current && currentStep >= 0) {
            const container = gridContainerRef.current;
            if (container.scrollWidth <= container.clientWidth) return;
            
            const currentStepPosition = (currentStep % patternLength) * stepWidth;
            const containerWidth = container.clientWidth;
            
            let targetScrollLeft = currentStepPosition - (containerWidth / 2) + (stepWidth / 2);
            targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, container.scrollWidth - containerWidth));

            const deadZone = containerWidth / 4;
            const scrollLeft = container.scrollLeft;
            const viewStart = scrollLeft + deadZone;
            const viewEnd = scrollLeft + containerWidth - deadZone;

            if (currentStepPosition < viewStart || currentStepPosition > viewEnd) {
                container.scrollTo({ left: targetScrollLeft, behavior: 'smooth' });
            }
        }
    }, [currentStep, isPlaying, followPlayhead, patternLength, stepWidth]);


    const gridWidth = patternLength * stepWidth;
    const gridHeight = NUM_NOTES * noteHeight;
    const playheadPosition = isPlaying && currentStep >= 0 ? (currentStep % patternLength) * stepWidth : -1;

    const backgroundGrid = useMemo(() => {
        const verticalLines = Array.from({ length: patternLength + 1 }).map((_, i) => {
            const isBar = i % 16 === 0;
            const isBeat = i % 4 === 0;
            return <div key={`v-${i}`} className="absolute top-0 bottom-0" style={{ left: i * stepWidth, width: '1px', backgroundColor: isBar ? 'rgba(0,0,0,0.2)' : isBeat ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.05)' }} />;
        });
        const horizontalLines = Array.from({ length: NUM_NOTES }).map((_, i) => {
             const pitch = MAX_PITCH - i;
             const isBlackKey = [1, 3, 6, 8, 10].includes(pitch % 12);
             return <div key={`h-${i}`} className="absolute left-0 right-0" style={{ top: i * noteHeight, height: noteHeight, backgroundColor: isBlackKey ? '#00000008' : 'transparent' }} />;
        });
        return <div className="absolute inset-0 pointer-events-none" style={{ width: gridWidth, height: gridHeight }}>{horizontalLines}{verticalLines}</div>
    }, [patternLength, stepWidth, noteHeight, gridWidth, gridHeight]);

    const gridHeader = useMemo(() => (
        <div className="sticky top-0 h-6 bg-gray-200 z-20 border-b border-border-color" style={{ width: gridWidth }}>
            <div className="relative h-full">
                {Array.from({ length: Math.ceil(patternLength / 4) }).map((_, beatIndex) => {
                    const barNumber = Math.floor(beatIndex / 4) + 1;
                    const beatInBar = beatIndex % 4;
                    const isBarStart = beatInBar === 0;
                    
                    let labelText;
                    if (isBarStart) {
                        labelText = barNumber.toString();
                    } else {
                        labelText = (barNumber + beatInBar * 0.25).toString();
                    }

                    return (
                        <div key={beatIndex} 
                             className="absolute top-0 h-full flex items-center pl-1 text-xs text-secondary font-medium" 
                             style={{ left: beatIndex * 4 * stepWidth, borderLeft: isBarStart ? '1px solid #8A8A8E' : '1px solid #D1D1D6' }}>
                            {labelText}
                        </div>
                    );
                })}
            </div>
        </div>
    ), [patternLength, stepWidth, gridWidth]);

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-40 p-4" onMouseDown={onClose}>
            <div className="bg-gradient-to-b from-gray-100 to-gray-200 w-full h-full max-w-7xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden" onMouseDown={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-3 border-b border-border-color shrink-0 bg-white/30">
                    <h2 className="text-lg font-bold">Piano Roll - <span className="text-accent">{channel.name}</span></h2>
                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2">
                             <label className="text-sm font-medium">Snap</label>
                             <select value={snapValue} onChange={e => setSnapValue(e.target.value as SnapValue)} className="bg-white rounded-md p-1.5 text-sm border border-border-color shadow-sm">
                                 <option value="1 Bar">1 Bar</option>
                                 <option value="1/8">1/8</option>
                                 <option value="1/16">1/16</option>
                                 <option value="1/32">1/32</option>
                                 <option value="None">None</option>
                             </select>
                        </div>
                        <button onClick={handleQuantize} className="px-3 py-1.5 bg-gray-200 rounded-md text-sm font-semibold hover:bg-gray-300 transition-colors border border-border-color shadow-sm">Quantize</button>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium flex items-center gap-1"><ZoomIn size={14} /> H</label>
                            <input type="range" min="10" max="80" value={stepWidth} onChange={e => setStepWidth(Number(e.target.value))} className="w-24" />
                        </div>
                         <div className="flex items-center gap-2">
                            <label className="text-sm font-medium flex items-center gap-1"><ZoomOut size={14}/> V</label>
                            <input type="range" min="10" max="40" value={noteHeight} onChange={e => setNoteHeight(Number(e.target.value))} className="w-24" />
                        </div>
                        <button onClick={onClose} className="p-2 rounded-md hover:bg-light-bg transition-colors">
                            <X size={20} />
                        </button>
                    </div>
                </header>

                <div className="flex-grow flex overflow-hidden">
                    <div ref={pianoKeysRef} onScroll={() => syncScroll('keys')} className="w-24 shrink-0 bg-white border-r border-border-color overflow-y-scroll">
                        {/* This sticky spacer aligns the keys with the grid which has its own sticky header */}
                        <div className="sticky top-0 h-6 bg-gray-200 z-20 border-b border-border-color" />
                        <div className="relative" style={{ height: gridHeight }}>
                           {Array.from({ length: NUM_NOTES }).map((_, i) => {
                                const pitch = MAX_PITCH - i;
                                const isBlackKey = [1, 3, 6, 8, 10].includes(pitch % 12);
                                const isOctaveStart = pitch % 12 === 0;
                                const noteName = NOTE_NAMES[pitch % 12];
                                const octave = Math.floor(pitch / 12) - 1;
                                return ( <div key={pitch} style={{height: noteHeight}} className={`text-xs flex items-center justify-end pr-2 box-border cursor-pointer ${isBlackKey ? 'bg-gray-800 text-white hover:bg-gray-700' : 'bg-white text-gray-600 hover:bg-gray-200'} ${isOctaveStart ? 'border-t border-secondary' : 'border-t border-border-color'}`} onMouseDown={() => onTriggerNote(pitch)}> {isOctaveStart ? `${noteName}${octave}` : ''} </div> )
                           })}
                        </div>
                    </div>

                    <div ref={gridContainerRef} onScroll={() => syncScroll('grid')} onClick={handleGridClick} onMouseMove={handleGridMouseMove} onMouseLeave={handleGridMouseLeave} className="flex-grow overflow-auto relative bg-main cursor-cell">
                        {gridHeader}
                        <div className="relative" style={{ width: gridWidth, height: gridHeight }}>
                           {backgroundGrid}
                           
                           {ghostNote && (
                               <div className="absolute bg-accent/30 border border-dashed border-accent rounded-sm z-10 pointer-events-none" style={{ top: (MAX_PITCH - ghostNote.pitch) * noteHeight, left: ghostNote.start * stepWidth, width: (getSnapStep(snapValue) || 1) * stepWidth, height: noteHeight }} />
                           )}

                           {notes.map(note => (
                               <div key={note.id} onMouseDown={(e) => handleMouseDown(e, note, 'move')} onContextMenu={(e) => { e.preventDefault(); deleteNote(note.id); }}
                                    className="absolute bg-accent/80 border border-accent rounded-sm z-10 flex items-center justify-end group" 
                                    style={{ top: (MAX_PITCH - note.pitch) * noteHeight, left: note.start * stepWidth, width: note.duration * stepWidth, height: noteHeight, minWidth: 4, cursor: 'move' }}>
                                   <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize z-20 group-hover:bg-white/30" onMouseDown={(e) => handleMouseDown(e, note, 'resize')} />
                               </div>
                           ))}
                           
                           {playheadPosition > -1 && <div className="absolute top-0 bottom-0 w-0.5 bg-red-500/70 z-30 pointer-events-none" style={{ left: playheadPosition }} />}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
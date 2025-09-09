




import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { Pattern, Playlist, AudioClip, SnapMode, Sample, ArrangementOptions } from '../types';
import * as Tone from 'tone';
import { useDrag, useDrop } from 'react-dnd';
import { Scissors, Wand2 } from 'lucide-react';
import { AutoArrangeModal } from './AutoArrangeModal';

const MAX_BARS = 72;
const MAX_TRACKS = 32;
const BAR_WIDTH_PX = 80;
const TRACK_HEIGHT_PX = 40; // Increased height for better interaction

// Helper to draw waveform
const drawWaveform = (canvas: HTMLCanvasElement, audioBuffer: AudioBuffer, color: string) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    const data = audioBuffer.getChannelData(0);
    const step = Math.ceil(data.length / width);
    const amp = height / 2;

    ctx.lineWidth = 1;
    ctx.strokeStyle = color;
    ctx.beginPath();

    for (let i = 0; i < width; i++) {
        let min = 1.0;
        let max = -1.0;
        for (let j = 0; j < step; j++) {
            const datum = data[(i * step) + j];
            if (datum < min) min = datum;
            if (datum > max) max = datum;
        }
        ctx.moveTo(i, (1 + min) * amp);
        ctx.lineTo(i, (1 + max) * amp);
    }
    ctx.stroke();
};


interface AudioClipViewProps {
    clip: AudioClip;
    onUpdate: (id: string, newProps: Partial<AudioClip>) => void;
    onDelete: (id: string) => void;
    snap: (bar: number) => number;
    bpm: number;
}

const AudioClipView: React.FC<AudioClipViewProps> = ({ clip, onUpdate, onDelete, snap }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const trimDataRef = useRef<{
        type: 'start' | 'end';
        startX: number;
        initialStartBar: number;
        initialTrimStartBars: number;
        initialTrimDurationBars: number;
    } | null>(null);

    useEffect(() => {
        if (!clip.sample.url) return;
        const loadBuffer = async () => {
            try {
                const response = await fetch(clip.sample.url);
                const arrayBuffer = await response.arrayBuffer();
                const buffer = await Tone.context.decodeAudioData(arrayBuffer);
                setAudioBuffer(buffer);
            } catch (error) {
                console.error("Error loading audio buffer for clip:", error);
            }
        };
        loadBuffer();
    }, [clip.sample.url]);

    useEffect(() => {
        if (audioBuffer && canvasRef.current) {
            drawWaveform(canvasRef.current, audioBuffer, '#FFFFFF');
        }
    }, [audioBuffer, clip.trimDurationBars]);

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        onDelete(clip.id);
    };

    const [{ isDragging }, drag] = useDrag(() => ({
        type: 'audioclip',
        item: { id: clip.id, startBar: clip.startBar, track: clip.track, type: 'audioclip' },
        collect: (monitor) => ({
            isDragging: !!monitor.isDragging(),
        }),
    }), [clip.id, clip.startBar, clip.track]);

    const handleTrimMouseMove = useCallback((e: MouseEvent) => {
        if (!trimDataRef.current) return;
        const { type, startX, initialStartBar, initialTrimStartBars, initialTrimDurationBars } = trimDataRef.current;
        const deltaX = e.clientX - startX;
        const deltaBars = deltaX / BAR_WIDTH_PX;

        if (type === 'start') {
            const initialEndBar = initialStartBar + initialTrimDurationBars;
            let newStartBar = snap(initialStartBar + deltaBars);
            let newTrimStartBars = initialTrimStartBars + (newStartBar - initialStartBar);
            
            if (newTrimStartBars < 0) {
                const trimCorrection = -newTrimStartBars;
                newTrimStartBars = 0;
                newStartBar += trimCorrection;
            }
            
            let newTrimDurationBars = initialEndBar - newStartBar;
            if (newTrimDurationBars <= 0.01) return;

            onUpdate(clip.id, { 
                startBar: newStartBar, 
                trimStartBars: newTrimStartBars, 
                trimDurationBars: newTrimDurationBars 
            });

        } else { // type === 'end'
            const initialEndBar = clip.startBar + initialTrimDurationBars;
            const newEndBar = snap(initialEndBar + deltaBars);
            let newTrimDurationBars = newEndBar - clip.startBar;

            if (newTrimDurationBars <= 0.01) return;
            if (clip.trimStartBars + newTrimDurationBars > clip.durationInBars) {
                newTrimDurationBars = clip.durationInBars - clip.trimStartBars;
            }
            onUpdate(clip.id, { trimDurationBars: newTrimDurationBars });
        }
    }, [clip, onUpdate, snap]);

    const handleTrimMouseUp = useCallback(() => {
        document.removeEventListener('mousemove', handleTrimMouseMove);
        document.removeEventListener('mouseup', handleTrimMouseUp);
        trimDataRef.current = null;
    }, [handleTrimMouseMove]);

    const handleTrimStartMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        trimDataRef.current = {
            type: 'start',
            startX: e.clientX,
            initialStartBar: clip.startBar,
            initialTrimStartBars: clip.trimStartBars,
            initialTrimDurationBars: clip.trimDurationBars,
        };
        document.addEventListener('mousemove', handleTrimMouseMove);
        document.addEventListener('mouseup', handleTrimMouseUp);
    };

    const handleTrimEndMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        trimDataRef.current = {
            type: 'end',
            startX: e.clientX,
            initialStartBar: clip.startBar, // not needed but keeps type consistent
            initialTrimStartBars: clip.trimStartBars, // not needed
            initialTrimDurationBars: clip.trimDurationBars,
        };
        document.addEventListener('mousemove', handleTrimMouseMove);
        document.addEventListener('mouseup', handleTrimMouseUp);
    };

    const left = clip.startBar * BAR_WIDTH_PX;
    const width = clip.trimDurationBars * BAR_WIDTH_PX;
    const top = clip.track * TRACK_HEIGHT_PX;
    
    return (
        <div
            ref={drag as any}
            style={{
                position: 'absolute',
                left,
                top,
                width,
                height: TRACK_HEIGHT_PX,
                opacity: isDragging ? 0.5 : 1,
            }}
            className="z-10"
            onContextMenu={handleContextMenu}
        >
            <div className="relative w-full h-full bg-accent rounded-sm shadow-md flex items-center px-2 cursor-move overflow-hidden">
                 <div
                    className="absolute top-0 left-0 w-4 h-full z-20 flex items-center justify-center cursor-ew-resize group"
                    onMouseDown={handleTrimStartMouseDown}
                    title="Trim Start"
                >
                    <Scissors size={12} className="text-white/50 group-hover:text-white transition-colors pointer-events-none" />
                </div>
                <canvas 
                    ref={canvasRef} 
                    width={width} 
                    height={TRACK_HEIGHT_PX}
                    className="absolute top-0 left-0 w-full h-full opacity-30"
                />
                <span className="text-white text-xs truncate font-medium relative z-10 pointer-events-none" title={clip.sample.name}>
                    {clip.sample.name}
                </span>
                 <div
                    className="absolute top-0 right-0 w-4 h-full z-20 flex items-center justify-center cursor-ew-resize group"
                    onMouseDown={handleTrimEndMouseDown}
                    title="Trim End"
                >
                     <Scissors size={12} className="text-white/50 group-hover:text-white transition-colors pointer-events-none" />
                </div>
            </div>
        </div>
    );
};


interface SongModeProps {
  patterns: Pattern[];
  playlist: Playlist;
  brushPatternId: string;
  onBrushPatternIdChange: (id: string) => void;
  onPlaylistChange: (newPlaylist: Playlist) => void;
  currentStep: number;
  isPlaying: boolean;
  audioClips: AudioClip[];
  snapMode: SnapMode;
  onSnapModeChange: (mode: SnapMode) => void;
  onAddAudioClip: (file: File, track: number, startBar: number) => void;
  onUpdateAudioClip: (id: string, newProps: Partial<AudioClip>) => void;
  onDeleteAudioClip: (id: string) => void;
  bpm: number;
}

export const SongMode: React.FC<SongModeProps> = ({
  patterns,
  playlist,
  brushPatternId,
  onBrushPatternIdChange,
  onPlaylistChange,
  currentStep,
  isPlaying,
  audioClips,
  snapMode,
  onSnapModeChange,
  onAddAudioClip,
  onUpdateAudioClip,
  onDeleteAudioClip,
  bpm,
}) => {
  const [isArrangeModalOpen, setIsArrangeModalOpen] = useState(false);

  const snapToGrid = useCallback((bar: number) => {
    switch (snapMode) {
        case 'bar': return Math.round(bar);
        case 'grid': return Math.round(bar * 16) / 16; // Snap to 1/16th note
        case 'none': return bar;
        default: return bar;
    }
  }, [snapMode]);

  const handleGridClick = (track: number, bar: number) => {
    const brushPattern = patterns.find(p => p.id === brushPatternId);
    if (!brushPattern) return;

    const lengthInBars = brushPattern.length / 16;
    const newPlaylist = new Map(playlist);

    for (const [key, patternId] of newPlaylist.entries()) {
      const [entryTrack, entryBar] = key.split(':').map(Number);
      if (entryTrack === track) {
        const existingPattern = patterns.find(p => p.id === patternId);
        if (!existingPattern) continue;
        const existingLengthInBars = existingPattern.length / 16;
        const newStart = bar;
        const newEnd = bar + lengthInBars;
        const existingStart = entryBar;
        const existingEnd = entryBar + existingLengthInBars;
        if (newStart < existingEnd && newEnd > existingStart) {
          newPlaylist.delete(key);
        }
      }
    }

    const newKey = `${track}:${bar}`;
    newPlaylist.set(newKey, brushPatternId);
    onPlaylistChange(newPlaylist);
  };

  const handleGridContextMenu = (e: React.MouseEvent, track: number, bar: number) => {
    e.preventDefault();
    const key = `${track}:${bar}`;
    const newPlaylist = new Map(playlist);
    if (newPlaylist.has(key)) {
      newPlaylist.delete(key);
      onPlaylistChange(newPlaylist);
    }
  };

    const [{ isOver }, drop] = useDrop(() => ({
        accept: ['audioclip', '__NATIVE_FILE__'],
        drop: (item: any, monitor) => {
            const offset = monitor.getClientOffset();
            const dropTarget = gridRef.current?.getBoundingClientRect();
            if (!offset || !dropTarget) return;

            const x = offset.x - dropTarget.left + (gridRef.current?.scrollLeft ?? 0);
            const y = offset.y - dropTarget.top;

            const calculatedTrack = Math.floor(y / TRACK_HEIGHT_PX);
            let finalTrack = calculatedTrack;

            // For existing audio clips, make vertical dragging less sensitive
            if (item.type === 'audioclip' && item.track !== undefined) {
                const originalTrack = item.track;
                const initialOffset = monitor.getInitialClientOffset();
                
                if (initialOffset) {
                    const verticalMoveDistance = Math.abs(offset.y - initialOffset.y);
                    // Threshold: user must drag more than 75% of a track's height to switch tracks
                    const VERTICAL_THRESHOLD = TRACK_HEIGHT_PX * 0.75; 
                    
                    if (verticalMoveDistance < VERTICAL_THRESHOLD) {
                        finalTrack = originalTrack;
                    }
                }
            }

            const bar = x / BAR_WIDTH_PX;
            const snappedBar = snapToGrid(bar);

            if (item.type === 'audioclip') {
                onUpdateAudioClip(item.id, { track: finalTrack, startBar: snappedBar });
            } else if (monitor.getItemType() === '__NATIVE_FILE__') {
                const files = monitor.getItem().files as File[];
                if (files.length > 0) {
                    onAddAudioClip(files[0], finalTrack, snappedBar);
                }
            }
        },
        collect: (monitor) => ({
            isOver: !!monitor.isOver(),
        }),
    }), [snapToGrid, onUpdateAudioClip, onAddAudioClip]);

  const handleArrange = (options: ArrangementOptions) => {
    const { introPatternId, chorusPatternId, versePatternId, numVerses, useBridge, bridgePatternId, introBars, verseBars, chorusBars, useOutro, outroPatternId } = options;
    const newPlaylist = new Map<string, string>();
    let currentBar = 0;
    const arrangementTrack = 0; // Arrange everything on the first track for simplicity

    const placePatternMultiple = (patternId: string, targetBars: number) => {
        if (targetBars <= 0) return;
        const pattern = patterns.find(p => p.id === patternId);
        if (!pattern || pattern.length === 0) return;
        
        const patternLengthInBars = pattern.length / 16;
        const repeatCount = Math.ceil(targetBars / patternLengthInBars);

        for (let i = 0; i < repeatCount; i++) {
            const key = `${arrangementTrack}:${currentBar}`;
            newPlaylist.set(key, patternId);
            currentBar += patternLengthInBars;
        }
    };

    // 1. Intro
    placePatternMultiple(introPatternId, introBars);

    // 2. Verses and Choruses
    for (let i = 0; i < numVerses; i++) {
        // Chorus
        placePatternMultiple(chorusPatternId, chorusBars);
        
        // Verse
        if (useBridge && bridgePatternId) {
            const verseHalfBars = verseBars / 2;
            placePatternMultiple(versePatternId, verseHalfBars);
            placePatternMultiple(bridgePatternId, verseHalfBars);
        } else {
            placePatternMultiple(versePatternId, verseBars);
        }
    }
    
    // 3. Final Chorus
    placePatternMultiple(chorusPatternId, chorusBars);

    // 4. Outro (optional)
    if (useOutro && outroPatternId) {
        placePatternMultiple(outroPatternId, introBars); // Outro length matches intro length
    }


    onPlaylistChange(newPlaylist);
    setIsArrangeModalOpen(false);
  };


  const gridRef = useRef<HTMLDivElement>(null);
  const playheadPosition = isPlaying && currentStep >= 0 ? (currentStep / 16) * BAR_WIDTH_PX : -1;

  const patternSelector = (
    <div className="w-56 shrink-0 bg-light-bg border-r border-border-color flex flex-col">
      <div className="p-2 border-b border-border-color">
        <h3 className="font-bold text-lg">Patterns</h3>
      </div>
      <div className="overflow-y-auto flex-grow">
        {patterns.map(p => (
          <div
            key={p.id}
            onClick={() => onBrushPatternIdChange(p.id)}
            className={`p-2 cursor-pointer text-sm truncate ${
              p.id === brushPatternId
                ? 'bg-accent text-white font-semibold'
                : 'hover:bg-gray-100'
            }`}
            title={p.name}
          >
            {p.name}
          </div>
        ))}
      </div>
      <div className="p-2 border-t border-border-color">
        <button onClick={() => setIsArrangeModalOpen(true)} className="w-full flex items-center justify-center gap-2 mb-2 px-3 py-1.5 bg-main rounded-md text-sm font-semibold hover:bg-gray-200 transition-colors border border-border-color shadow-sm">
            <Wand2 size={16} />
            Auto Arrange
        </button>
        <label className="text-sm font-medium text-secondary block mb-1">Snap</label>
        <select value={snapMode} onChange={(e) => onSnapModeChange(e.target.value as SnapMode)}
            className="w-full bg-main rounded-md p-1 text-sm border border-border-color">
            <option value="bar">Bar</option>
            <option value="grid">Grid (1/16)</option>
            <option value="none">None</option>
        </select>
      </div>
    </div>
  );

  const playlistGrid = (
    <div ref={gridRef} className="flex-grow overflow-auto relative bg-main">
      <div className="sticky top-0 h-8 bg-light-bg flex z-20 shadow-sm" style={{ width: MAX_BARS * BAR_WIDTH_PX }}>
        {Array.from({ length: MAX_BARS }).map((_, i) => (
          <div
            key={i}
            style={{ width: BAR_WIDTH_PX }}
            className={`flex items-center justify-start pl-2 border-r ${
                ((i + 1) % 4 === 0) ? 'border-secondary/50' : 'border-border-color'
            } text-secondary text-xs`}
          >
            {i + 1}
          </div>
        ))}
      </div>

      <div
        ref={drop as any}
        className="relative"
        style={{ width: MAX_BARS * BAR_WIDTH_PX, height: MAX_TRACKS * TRACK_HEIGHT_PX, background: isOver ? 'rgba(0,122,255,0.1)' : 'transparent' }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundSize: `${BAR_WIDTH_PX}px ${TRACK_HEIGHT_PX}px`,
            backgroundImage: `
              linear-gradient(to right, #E5E5E7 1px, transparent 1px),
              linear-gradient(to bottom, #E5E5E7 1px, transparent 1px)
            `,
          }}
        />

        {Array.from(playlist.entries()).map(([key, patternId]) => {
          const [track, bar] = key.split(':').map(Number);
          const pattern = patterns.find(p => p.id === patternId);
          if (!pattern) return null;
          const patternLengthInBars = pattern.length / 16;
          return (
            <div
              key={key}
              style={{
                position: 'absolute',
                left: bar * BAR_WIDTH_PX,
                top: track * TRACK_HEIGHT_PX,
                width: patternLengthInBars * BAR_WIDTH_PX,
                height: TRACK_HEIGHT_PX - 2,
                marginTop: 1,
                backgroundColor: '#A5A5AA',
              }}
              className="rounded-sm flex items-center px-2 z-5 pointer-events-none"
              title={pattern?.name}
            >
              <span className="text-white text-xs truncate font-medium">{pattern?.name}</span>
            </div>
          );
        })}

        {audioClips.map(clip => (
            <AudioClipView key={clip.id} clip={clip} onUpdate={onUpdateAudioClip} onDelete={onDeleteAudioClip} snap={snapToGrid} bpm={bpm} />
        ))}

        <div
          className="absolute inset-0 grid z-0"
          style={{
            gridTemplateColumns: `repeat(${MAX_BARS}, ${BAR_WIDTH_PX}px)`,
            gridTemplateRows: `repeat(${MAX_TRACKS}, ${TRACK_HEIGHT_PX}px)`,
          }}
        >
          {Array.from({ length: MAX_TRACKS }).flatMap((_, trackIndex) =>
            Array.from({ length: MAX_BARS }).map((_, barIndex) => (
              <div
                key={`${trackIndex}:${barIndex}`}
                className="hover:bg-accent/10 transition-colors"
                onClick={() => handleGridClick(trackIndex, barIndex)}
                onContextMenu={(e) => handleGridContextMenu(e, trackIndex, barIndex)}
              />
            ))
          )}
        </div>

        {playheadPosition > -1 && (
            <div
                className="absolute top-0 bottom-0 w-0.5 bg-accent z-30 pointer-events-none"
                style={{ left: playheadPosition }}
            />
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="bg-main rounded-xl shadow-main flex h-[70vh] max-h-[800px] overflow-hidden border border-border-color mt-6">
        {patternSelector}
        {playlistGrid}
      </div>
      {isArrangeModalOpen && (
          <AutoArrangeModal
              isOpen={isArrangeModalOpen}
              onClose={() => setIsArrangeModalOpen(false)}
              onArrange={handleArrange}
              patterns={patterns}
          />
      )}
    </>
  );
};
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import * as Tone from 'tone';
import { TransportControls } from './components/TransportControls';
import { Channel } from './components/Channel';
import { SamplePool } from './components/SamplePool';
import { SongMode } from './components/SongMode';
import { PatternControls } from './components/PatternControls';
import { FileMenu } from './components/FileMenu';
import { useDrop } from 'react-dnd';
import { initialPatterns, createNewPattern, createNewChannel, DEFAULT_SAMPLES } from './constants';
import type { ChannelState, Sample, Pattern, Playlist, AudioClip, SnapMode, ProjectState, Note, SampleTree, SerializedSample, EQState, EffectState, EffectType, ReverbParams, DelayParams, ChorusParams, DistortionParams, FilterParams, CompressorParams, QuantizeSnapValue } from './types';
import { generateMidiPattern } from './services/midiService';
import { MidiPattern } from './types';
import { Plus, Music, ListMusic, Undo, Redo, SlidersHorizontal } from 'lucide-react';
import { sampleToSerializedSample, deserializeTree, dataUrlToBlobUrl, serializeTree } from './services/audioUtils';
import { exportPatternToWav, exportSongToWav, exportSongToMp3 } from './services/exportService';
import { PianoRoll } from './components/PianoRoll';
import { Mixer } from './components/Mixer';


interface ChannelAudioNodes {
  sampler: Tone.Sampler;
  // FIX: Changed Tone.AudioNode to Tone.ToneAudioNode, which is the correct base type for audio nodes in Tone.js.
  effects: Tone.ToneAudioNode[];
  panner: Tone.Panner;
  eq: Tone.EQ3;
  meter: Tone.Meter;
}

interface AudioClipNodes {
    player: Tone.Player;
    // FIX: Changed Tone.AudioNode to Tone.ToneAudioNode, which is the correct base type for audio nodes in Tone.js.
    effects: Tone.ToneAudioNode[];
    panner: Tone.Panner;
    eq: Tone.EQ3;
    meter: Tone.Meter;
}

// Custom hook for state history management (Undo/Redo)
const useHistory = <T,>(initialState: T) => {
  const [state, setState] = useState({
    past: [] as T[],
    present: initialState,
    future: [] as T[],
  });

  const canUndo = state.past.length > 0;
  const canRedo = state.future.length > 0;

  const set = useCallback((newPresent: T | ((currentState: T) => T), fromHistory = false) => {
    setState(currentState => {
      const newPresentValue = typeof newPresent === 'function' 
        ? (newPresent as (currentState: T) => T)(currentState.present) 
        : newPresent;

      if (JSON.stringify(newPresentValue) === JSON.stringify(currentState.present)) {
        return currentState;
      }
      
      if (fromHistory) {
          return {
              ...currentState,
              present: newPresentValue,
          }
      }

      return {
        past: [...currentState.past, currentState.present],
        present: newPresentValue,
        future: [],
      };
    });
  }, []);
  
  const setInitial = useCallback((initialState: T) => {
      setState({
          past: [],
          present: initialState,
          future: [],
      })
  }, [])

  const undo = useCallback(() => {
    setState(currentState => {
      if (!canUndo) return currentState;
      const newPresent = currentState.past[currentState.past.length - 1];
      const newPast = currentState.past.slice(0, currentState.past.length - 1);
      return {
        past: newPast,
        present: newPresent,
        future: [currentState.present, ...currentState.future],
      };
    });
  }, [canUndo]);

  const redo = useCallback(() => {
    setState(currentState => {
      if (!canRedo) return currentState;
      const newPresent = currentState.future[0];
      const newFuture = currentState.future.slice(1);
      return {
        past: [...currentState.past, currentState.present],
        present: newPresent,
        future: newFuture,
      };
    });
  }, [canRedo]);

  return { 
    state: state.present, 
    set, 
    setInitial,
    undo, 
    redo, 
    canUndo, 
    canRedo 
  };
};

const SAVE_REMINDER_INTERVAL = 5 * 60 * 1000; // 5 minutes
const SAVE_REMINDER_AUTODISMISS_DELAY = 8 * 1000; // 8 seconds

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const KEY_TO_MIDI: { [key: string]: number } = {
    // Bottom row (white keys, starts at C4 = 60)
    'KeyZ': 60, 'KeyX': 62, 'KeyC': 64, 'KeyV': 65, 'KeyB': 67, 'KeyN': 69, 'KeyM': 71,
    'Comma': 72, 'Period': 74, 'Slash': 76,
    // Bottom row (black keys)
    'KeyS': 61, 'KeyD': 63, 'KeyG': 66, 'KeyH': 68, 'KeyJ': 70,
    'KeyL': 73, 'Semicolon': 75,

    // Top row (white keys, starts at C5 = 72)
    'KeyQ': 72, 'KeyW': 74, 'KeyE': 76, 'KeyR': 77, 'KeyT': 79, 'KeyY': 81, 'KeyU': 83,
    'KeyI': 84, 'KeyO': 86, 'KeyP': 88, 'BracketLeft': 89, 'BracketRight': 91,
    // Top row (black keys)
    'Digit2': 73, 'Digit3': 75, 'Digit5': 78, 'Digit6': 80, 'Digit7': 82,
    'Digit9': 85, 'Digit0': 87, 'Minus': 90, 'Equal': 92,
};

const getSnapStepFromQuantizeValue = (snap: QuantizeSnapValue): number => {
    switch (snap) {
        case '1/2': return 8;
        case '1/4': return 4;
        case '1/8': return 2;
        case '1/16': return 1;
        case '1/32': return 0.5;
        case '1/64': return 0.25;
        case 'None': return 0;
        default: return 0;
    }
};

const quantizeNotes = (notes: Note[], snapValue: QuantizeSnapValue): Note[] => {
    const snapStep = getSnapStepFromQuantizeValue(snapValue);
    if (snapStep === 0) return notes;

    return notes.map(note => ({
        ...note,
        start: Math.round(note.start / snapStep) * snapStep,
        duration: Math.max(snapStep, Math.round(note.duration / snapStep) * snapStep),
    }));
};

const App: React.FC = () => {
  const [isAudioStarted, setIsAudioStarted] = useState(Tone.context.state === 'running');
  const [isPlaying, setIsPlaying] = useState(false);
  const [bpm, setBpm] = useState(120);
  const [swing, setSwing] = useState(0);
  const [masterVolume, setMasterVolume] = useState(0); // Master volume in dB
  const [currentStep, setCurrentStep] = useState(-1);
  const [userSamples, setUserSamples] = useState<SampleTree>([]);
  const [view, setView] = useState<'pattern' | 'song' | 'mixer'>('pattern');
  const [playbackMode, setPlaybackMode] = useState<'pattern' | 'song'>('pattern');
  const [isMetronomeOn, setIsMetronomeOn] = useState(false);
  
  const { 
    state: patterns, 
    set: setPatterns,
    setInitial: setInitialPatterns,
    undo: undoPatterns, 
    redo: redoPatterns, 
    canUndo: canUndoPatterns, 
    canRedo: canRedoPatterns 
  } = useHistory<Pattern[]>(initialPatterns);

  const [activePatternId, setActivePatternId] = useState<string>(initialPatterns[0].id);
  const [playlist, setPlaylist] = useState<Playlist>(new Map());
  const [brushPatternId, setBrushPatternId] = useState<string>(initialPatterns[0].id);
  const [audioClips, setAudioClips] = useState<AudioClip[]>([]);
  const [snapMode, setSnapMode] = useState<SnapMode>('bar');
  
  const [followPlayhead, setFollowPlayhead] = useState(true);
  const [playbackOnTrigger, setPlaybackOnTrigger] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [showSaveReminder, setShowSaveReminder] = useState(false);
  const [isSaveReminderEnabled, setIsSaveReminderEnabled] = useState(true);
  const [editingChannelId, setEditingChannelId] = useState<string | null>(null);
  const [meterLevels, setMeterLevels] = useState<Map<string, number>>(new Map());
  const [isBrowserVisible, setIsBrowserVisible] = useState(true);

  // State for resizable browser
  const [browserWidth, setBrowserWidth] = useState(320); // Tailwind's w-80
  const [isResizing, setIsResizing] = useState(false);
  const resizeData = useRef({ startX: 0, startWidth: 0 });

  // State for typing keyboard & recording
  const [isMusicalTypingEnabled, setIsMusicalTypingEnabled] = useState(true);
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(initialPatterns[0]?.channels[0]?.id ?? null);
  const [transpose, setTranspose] = useState(-24); // In semitones, start 2 octaves down
  const pressedKeys = useRef(new Set<string>());
  const [isRecording, setIsRecording] = useState(false);
  const [isArmedForRecording, setIsArmedForRecording] = useState(false);
  const [countInBars, setCountInBars] = useState(1);
  const recordingStartTime = useRef(0);
  const activeNotes = useRef<Map<number, { startTime: number, velocity: number }>>(new Map());
  const [quantizeSnapValue, setQuantizeSnapValue] = useState<QuantizeSnapValue>('1/8');
  const recordedNotesRef = useRef<Note[]>([]);


  const audioNodes = useRef<Map<string, ChannelAudioNodes>>(new Map());
  const audioClipNodes = useRef<Map<string, AudioClipNodes>>(new Map());
  const masterMeter = useRef<Tone.Meter | null>(null);
  const sequencerContainerRef = useRef<HTMLDivElement>(null);
  const sequence = useRef<Tone.Sequence | null>(null);
  const channelParts = useRef<Map<string, Tone.Part>>(new Map());
  const previewPlayer = useRef<Tone.Player | null>(null);
  const metronomeSynth = useRef<Tone.MembraneSynth | null>(null);
  const metronomeEventId = useRef<number | null>(null);
  const isCountingInRef = useRef(false);
  const recordingScheduleIds = useRef<number[]>([]);
  const countInPartRef = useRef<Tone.Part | null>(null);
  
  // Refs to hold the latest state for the audio thread to access without re-triggering effects.
  const patternsRef = useRef(patterns);
  useEffect(() => {
    patternsRef.current = patterns;
  }, [patterns]);
  
  const activePatternIdRef = useRef(activePatternId);
  useEffect(() => {
    activePatternIdRef.current = activePatternId;
  }, [activePatternId]);

  const playlistRef = useRef(playlist);
  useEffect(() => {
      playlistRef.current = playlist;
  }, [playlist]);

  const userSamplesRef = useRef(userSamples);
  useEffect(() => {
    userSamplesRef.current = userSamples;
  }, [userSamples]);
  
  const isMetronomeOnRef = useRef(isMetronomeOn);
    useEffect(() => {
        isMetronomeOnRef.current = isMetronomeOn;
    }, [isMetronomeOn]);
    
    const quantizeSnapValueRef = useRef(quantizeSnapValue);
    useEffect(() => {
        quantizeSnapValueRef.current = quantizeSnapValue;
    }, [quantizeSnapValue]);

    // FIX: Ref to track recording state to prevent stale closures in callbacks.
    const isRecordingRef = useRef(isRecording);
    useEffect(() => {
        isRecordingRef.current = isRecording;
    }, [isRecording]);

    // FIX: Ref to prevent transport race conditions from rapid clicks.
    const isTransportTransitioning = useRef(false);
    useEffect(() => {
        // This effect runs after a state change, unlocking the transport controls
        // once the new state is reflected.
        isTransportTransitioning.current = false;
    }, [isPlaying, isRecording, isArmedForRecording]);


  // Sync playback mode with the current view (but don't change it for mixer)
  useEffect(() => {
      if (view === 'pattern' || view === 'song') {
          setPlaybackMode(view);
      }
  }, [view]);

  const activePattern = useMemo(() => {
    return patterns.find(p => p.id === activePatternId) ?? patterns[0];
  }, [patterns, activePatternId]);

  const editingChannel = useMemo(() => {
    if (!editingChannelId || !activePattern) return null;
    return activePattern.channels.find(c => c.id === editingChannelId) ?? null;
  }, [activePattern, editingChannelId]);
  
  const patternLength = activePattern.length;
  
  const handlePatternLengthChange = useCallback((newLength: number) => {
    setPatterns(currentPatterns =>
        currentPatterns.map(p => {
            if (p.id !== activePatternId) {
                return p;
            }

            // For the active pattern, update its length and ensure all its channels have enough steps.
            const updatedChannels = p.channels.map(channel => {
                if (channel.isAudioClipChannel) {
                    return channel;
                }
                
                const currentSteps = channel.steps;
                // If the steps array is shorter than the new pattern length, pad it with 0s.
                if (currentSteps.length < newLength) {
                    const diff = newLength - currentSteps.length;
                    const newSteps = [...currentSteps, ...Array(diff).fill(0)];
                    return { ...channel, steps: newSteps };
                }
                
                return channel;
            });

            return { ...p, length: newLength, channels: updatedChannels };
        })
    );
  }, [activePatternId, setPatterns]);

  const startAudio = useCallback(async () => {
    if (isAudioStarted) return;
    try {
      await Tone.start();
      Tone.context.lookAhead = 0.01; // Lower latency for interactive playing
      setIsAudioStarted(true);
      console.log("Audio context started");
    } catch (e) {
      console.error("Could not start audio context", e);
    }
  }, [isAudioStarted]);

  const loadSampler = useCallback((sample: Sample, channel: ChannelState) => {
    if (audioNodes.current.has(sample.name) || !sample.url) return;
    
    const meter = new Tone.Meter({ smoothing: 0 });
    const eq = new Tone.EQ3(channel.eq).connect(meter);
    const panner = new Tone.Panner(channel.pan).connect(eq);

    const sampler = new Tone.Sampler({
        urls: { C3: sample.url },
        release: 10.0,
        onload: () => {
            sampler.connect(panner);
            meter.toDestination();
            audioNodes.current.set(sample.name, { sampler, panner, eq, meter, effects: [] });
            console.log(`Sampler for ${sample.name} loaded`);
        },
        onerror: (error) => {
            console.error(`Error loading sample ${sample.name}:`, error);
        }
    });
  }, []);
  
  const disposeAllNodes = () => {
      audioNodes.current.forEach(nodes => {
          nodes.sampler.dispose();
          nodes.panner.dispose();
          nodes.eq.dispose();
          nodes.meter.dispose();
          nodes.effects.forEach(fx => fx.dispose());
      });
      audioNodes.current.clear();
      
      audioClipNodes.current.forEach(nodes => {
          nodes.player.dispose();
          nodes.panner.dispose();
          nodes.eq.dispose();
          nodes.meter.dispose();
          nodes.effects.forEach(fx => fx.dispose());
      });
      audioClipNodes.current.clear();

      channelParts.current.forEach(part => part.dispose());
      channelParts.current.clear();
      
      previewPlayer.current?.dispose();
      previewPlayer.current = null;
      
      masterMeter.current?.dispose();
      masterMeter.current = null;
  };

  const scheduleMetronome = useCallback(() => {
    if (metronomeEventId.current !== null) {
        Tone.Transport.clear(metronomeEventId.current);
        metronomeEventId.current = null;
    }
    metronomeEventId.current = Tone.Transport.scheduleRepeat(time => {
        if (!isMetronomeOnRef.current || Tone.Transport.state !== 'started' || isCountingInRef.current) return;
        
        const position = Tone.Transport.position.toString();
        const parts = position.split(':');
        const beat = parseInt(parts[1], 10);
        
        if (beat === 0) {
            metronomeSynth.current?.triggerAttackRelease('C5', '32n', time); // High click
        } else {
            metronomeSynth.current?.triggerAttackRelease('C4', '32n', time); // Low click
        }
    }, '4n');
  }, []);

  useEffect(() => {
    masterMeter.current = new Tone.Meter({ smoothing: 0 });
    Tone.Destination.connect(masterMeter.current);

    metronomeSynth.current = new Tone.MembraneSynth({
        pitchDecay: 0.01,
        octaves: 6,
        envelope: { attack: 0.001, decay: 0.2, sustain: 0 }
    }).toDestination();
    metronomeSynth.current.volume.value = -10;
    
    initialPatterns[0].channels.forEach(channel => {
        if (!channel.isAudioClipChannel) {
             loadSampler(channel.sample, channel);
        }
    });
    
    return () => {
        disposeAllNodes();
        
        if (metronomeEventId.current !== null) {
            Tone.Transport.clear(metronomeEventId.current);
        }
        metronomeSynth.current?.dispose();

        const revokeUrls = (tree: SampleTree) => {
            tree.forEach(node => {
                if (node.type === 'file' && node.url.startsWith('blob:')) {
                    URL.revokeObjectURL(node.url);
                } else if (node.type === 'folder') {
                    revokeUrls(node.children);
                }
            });
        };
        revokeUrls(userSamplesRef.current);
    };
  }, [loadSampler]);

  // Metering loop
  useEffect(() => {
    let animationFrameId: number;
    const updateMeters = () => {
        const newLevels = new Map<string, number>();
        const allChannels = patternsRef.current[0]?.channels || [];

        allChannels.forEach(channel => {
            const nodes = channel.isAudioClipChannel
                ? audioClipNodes.current.get(channel.id)
                : audioNodes.current.get(channel.sample.name);
            
            if (nodes) {
                newLevels.set(channel.id, nodes.meter.getValue() as number);
            }
        });
        
        if (masterMeter.current) {
            newLevels.set('master', masterMeter.current.getValue() as number);
        }

        setMeterLevels(newLevels);
        animationFrameId = requestAnimationFrame(updateMeters);
    };

    updateMeters();

    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  useEffect(() => {
    Tone.Transport.bpm.value = bpm;
  }, [bpm]);

  useEffect(() => {
    Tone.Destination.volume.value = masterVolume;
  }, [masterVolume]);

  useEffect(() => {
    // Only apply swing if it's significant to avoid artifacts from tiny float values.
    Tone.Transport.swing = swing > 0.01 ? swing : 0;
    Tone.Transport.swingSubdivision = '16n';
  }, [swing]);

  // Effect to control audio node volumes based on global mute/solo state
  useEffect(() => {
    const masterChannels = patterns[0]?.channels;
    if (!masterChannels) return;

    const isAnySoloed = masterChannels.some(c => c.isSoloed);

    masterChannels.forEach(channel => {
        let shouldPlay = true;
        if (isAnySoloed) {
            shouldPlay = !!channel.isSoloed;
        } else {
            shouldPlay = !channel.isMuted;
        }
        
        const targetVolume = shouldPlay ? channel.volume : -Infinity;
        const sourceNode = channel.isAudioClipChannel 
            ? audioClipNodes.current.get(channel.id)?.player
            : audioNodes.current.get(channel.sample.name)?.sampler;

        if (sourceNode && sourceNode.volume.value !== targetVolume) {
            sourceNode.volume.value = targetVolume;
        }
    });
  }, [patterns]);
  
  // Save Reminder Effect
  useEffect(() => {
    if (!isSaveReminderEnabled) {
        setShowSaveReminder(false);
        return;
    }
  
    const intervalId = setInterval(() => {
        if (canUndoPatterns) {
            setShowSaveReminder(true);
        }
    }, SAVE_REMINDER_INTERVAL);

    return () => clearInterval(intervalId);
  }, [canUndoPatterns, isSaveReminderEnabled]);

  // Auto-dismiss Save Reminder Effect
  useEffect(() => {
      if (showSaveReminder) {
          const timeoutId = setTimeout(() => {
              setShowSaveReminder(false);
          }, SAVE_REMINDER_AUTODISMISS_DELAY);

          return () => clearTimeout(timeoutId);
      }
  }, [showSaveReminder]);

  const structuralDataString = useMemo(() => {
    return JSON.stringify({
        patterns: patterns.map(p => ({
            id: p.id,
            length: p.length,
            channels: p.channels.map(c => ({ 
                id: c.id, 
                steps: c.steps, 
                notes: c.notes,
            }))
        })),
        playlist: Array.from(playlist.entries()),
    });
  }, [patterns, playlist]);

   // Effect to manage Tone.Part for Piano Roll channels
    useEffect(() => {
        const wasPlaying = Tone.Transport.state === 'started';
        const currentPosition = Tone.Transport.position;

        channelParts.current.forEach(part => part.dispose());
        channelParts.current.clear();

        if (!activePattern || playbackMode !== 'pattern') {
            return;
        }

        const midiToNoteName = (midi: number) => {
            const octave = Math.floor(midi / 12) - 1;
            const noteIndex = midi % 12;
            return NOTE_NAMES[noteIndex] + octave;
        };
        
        const secondsPer16th = 60 / bpm / 4;

        activePattern.channels.forEach(channel => {
            if (channel.notes && channel.notes.length > 0) {
                const nodes = audioNodes.current.get(channel.sample.name);
                if (!nodes?.sampler.loaded) return;

                const events = channel.notes.map(note => {
                    const startIn16ths = note.start;
                    const bars = Math.floor(startIn16ths / 16);
                    const quarters = Math.floor((startIn16ths % 16) / 4);
                    const sixteenths = startIn16ths % 4;
                    const time = `${bars}:${quarters}:${sixteenths}`;
                    
                    return {
                        time,
                        duration: note.duration * secondsPer16th,
                        note: midiToNoteName(note.pitch),
                        velocity: note.velocity,
                        originalDuration: note.duration, 
                    };
                });

                const part = new Tone.Part((time, value) => {
                    if (channel.cutItself) {
                        nodes.sampler.releaseAll(time);
                    }
                    if (value.originalDuration <= 1) {
                        nodes.sampler.triggerAttack(value.note, time, value.velocity);
                    } else {
                        // FIX: The error "Argument of type 'Time' is not assignable to parameter of type 'number'" suggests
                        // a type mismatch. While `value.duration` (seconds as a number) is a valid `Time`, some Tone.js
                        // versions or their typings can be picky. Converting the duration to a transport-relative
                        // time string is more robust. `value.originalDuration` holds the duration in 16th note steps.
                        nodes.sampler.triggerAttackRelease(value.note, `0:0:${value.originalDuration}`, time, value.velocity);
                    }
                }, events);

                part.loop = true;
                const patternLengthIn16ths = activePattern.length;
                const loopEndBars = Math.floor(patternLengthIn16ths / 16);
                const loopEndQuarters = Math.floor((patternLengthIn16ths % 16) / 4);
                const loopEndSixteenths = patternLengthIn16ths % 4;
                part.loopEnd = `${loopEndBars}:${loopEndQuarters}:${loopEndSixteenths}`;

                channelParts.current.set(channel.id, part);
            }
        });
        
        if (wasPlaying) {
            channelParts.current.forEach(part => part.start(0, currentPosition));
        }

        return () => {
            channelParts.current.forEach(part => part.dispose());
            channelParts.current.clear();
        };
    }, [activePattern, playbackMode, bpm]);


  useEffect(() => {
    const wasPlaying = Tone.Transport.state === 'started';
    const currentPosition = Tone.Transport.position;
  
    if (sequence.current) {
      sequence.current.dispose();
    }
  
    const triggerStep = (time: number, stepValue: number, channel: ChannelState) => {
      if (channel.isAudioClipChannel) return;
      if (channel.notes && channel.notes.length > 0) return; // Handled by Tone.Part
      
      if (stepValue > 0) {
        const nodes = audioNodes.current.get(channel.sample.name);
        if (nodes) {
          if (channel.cutItself) {
            nodes.sampler.releaseAll(time);
          }
          if (stepValue === 1) {
            nodes.sampler.triggerAttack("C3", time);
          } else {
            const subdivisions = stepValue === 3 ? 3 : stepValue;
            const noteDuration = Tone.Time('16n').toSeconds();
            const subNoteDuration = noteDuration / subdivisions;
            for (let i = 0; i < subdivisions; i++) {
              const noteTime = time + i * subNoteDuration;
              nodes.sampler.triggerAttack("C3", noteTime);
            }
          }
        }
      }
    };

    if (playbackMode === 'pattern') {
        const currentPatterns = patternsRef.current;
        const currentActivePattern = currentPatterns.find(p => p.id === activePatternIdRef.current);
        if (!currentActivePattern) return;

        const patternSteps = Array.from({ length: currentActivePattern.length }, (_, i) => i);
        
        const patternSequenceCallback = (time: number, step: number) => {
            currentActivePattern.channels.forEach(channel => {
                const stepValue = channel.steps[step];
                triggerStep(time, stepValue, channel);
            });
            Tone.Draw.schedule(() => setCurrentStep(step), time);
        };

        sequence.current = new Tone.Sequence(patternSequenceCallback, patternSteps, '16n');
        sequence.current.loop = true;

    } else { // playbackMode === 'song'
        const songLengthBars = 72;
        const songLengthSteps = songLengthBars * 16;
        const songSteps = Array.from({ length: songLengthSteps }, (_, i) => i);
    
        const songSequenceCallback = (time: number, step: number) => {
            const currentPatterns = patternsRef.current;
            const currentPlaylist = playlistRef.current;

            const currentBar = Math.floor(step / 16);
            const stepInBar = step % 16;
    
            let patternToPlay: Pattern | undefined;
            let patternStartBar = -1;
  
            for (let track = 0; track < 32; track++) {
              for (let searchBar = currentBar; searchBar >= 0; searchBar--) {
                const key = `${track}:${searchBar}`;
                const patternId = currentPlaylist.get(key);
                if (patternId) {
                  const candidatePattern = currentPatterns.find(p => p.id === patternId);
                  if (candidatePattern) {
                    const patternLengthInBars = candidatePattern.length / 16;
                    if (currentBar < searchBar + patternLengthInBars) {
                      patternToPlay = candidatePattern;
                      patternStartBar = searchBar;
                      break; 
                    }
                  }
                }
              }
              if (patternToPlay) break; 
            }
    
            if (patternToPlay && patternStartBar !== -1) {
                const stepInPattern = (currentBar - patternStartBar) * 16 + stepInBar;
                patternToPlay.channels.forEach(channel => {
                    const stepValue = channel.steps[stepInPattern % channel.steps.length];
                    triggerStep(time, stepValue, channel);
                });
            }
            Tone.Draw.schedule(() => setCurrentStep(step), time);
        };
        
        sequence.current = new Tone.Sequence(songSequenceCallback, songSteps, '16n');
        sequence.current.loop = false;
    }
    
    if (wasPlaying) {
        // FIX: Re-scheduling a sequence that was already playing requires an offset.
        // Using the string-based position is more robust than calculating steps manually.
        sequence.current.start(0, currentPosition);
    }
  
    return () => {
      sequence.current?.dispose();
    };
  }, [playbackMode, structuralDataString, activePatternId, patternLength]);
  
  const stopPlayback = useCallback(() => {
    const wasRecording = isRecordingRef.current;
    const stopTimeInSeconds = Tone.Transport.seconds;

    if (Tone.Transport.state !== 'stopped') {
        Tone.Transport.stop();
        Tone.Transport.cancel();
    }
    // FIX: Removing transport position reset from stop. It creates a race condition with
    // note-off events that rely on Tone.Transport.seconds. The position is now only
    // reset in togglePlay before starting playback from the beginning.
    // Tone.Transport.position = 0;

    if (wasRecording && selectedChannelId) {
        const secondsPer16th = (60 / bpm) / 4;
        const stopStep = (stopTimeInSeconds - recordingStartTime.current) / secondsPer16th;

        activeNotes.current.forEach((noteOn, pitch) => {
            const duration = Math.max(0.1, stopStep - noteOn.startTime);
            recordedNotesRef.current.push({
                id: `note-${Date.now()}-${pitch}`,
                pitch,
                start: noteOn.startTime,
                duration,
                velocity: noteOn.velocity,
            });
        });

        let finalNotes = [...recordedNotesRef.current];
        if (quantizeSnapValueRef.current !== 'None') {
            finalNotes = quantizeNotes(finalNotes, quantizeSnapValueRef.current);
        }

        if (finalNotes.length > 0) {
             setPatterns(currentPatterns => currentPatterns.map(p => {
                if (p.id !== activePatternIdRef.current) return p;
                return {
                    ...p,
                    channels: p.channels.map(c => 
                        c.id === selectedChannelId ? { ...c, notes: finalNotes } : c
                    )
                };
            }));
        }
    }
    
    setIsPlaying(false);
    setIsRecording(false);
    setIsArmedForRecording(false);
    isCountingInRef.current = false;
    setCurrentStep(-1);
    activeNotes.current.clear();
    recordedNotesRef.current = [];
    recordingStartTime.current = 0;
    
    // Safety call to release any stuck notes from samplers and stop audio clip players
    audioNodes.current.forEach(({ sampler }) => sampler.releaseAll());
    audioClipNodes.current.forEach(({ player }) => player.stop());
  }, [bpm, selectedChannelId, setPatterns]);
  
    const togglePlay = useCallback(async () => {
        if (isTransportTransitioning.current) return;
        isTransportTransitioning.current = true;
    
        await startAudio();
    
        // If transport is running, stop it. `stopPlayback` handles state updates.
        if (Tone.Transport.state === 'started') {
            stopPlayback();
            // The useEffect will unlock the transport after stopPlayback's state changes are applied.
            return;
        }
    
        // --- It's not playing, so let's start it from the beginning ---
        
        // 1. Clean slate: stop/cancel any lingering events and reset position.
        // This is the main fix for the "time must be greater..." error and starting from "the 1".
        Tone.Transport.stop();
        Tone.Transport.cancel();
        Tone.Transport.position = 0;
    
        // 2. Reschedule all audio events for playback.
        sequence.current?.start(0);
        channelParts.current.forEach(part => part.start(0));
    
        if (playbackMode === 'song') {
            audioClipNodes.current.forEach(({ player }) => player.unsync().stop());
            
            const firstPattern = patterns[0];
            if (firstPattern) {
                audioClips.forEach(clip => {
                    const channel = firstPattern.channels.find(c => c.id === clip.channelId);
                    const nodes = audioClipNodes.current.get(clip.channelId);
    
                    if (channel && nodes?.player.loaded) {
                        const secondsPerBar = (60 / bpm) * 4;
                        const startTimeInSeconds = clip.startBar * secondsPerBar;
    
                        const totalDurationSeconds = nodes.player.buffer.duration;
                        const offsetSeconds = (clip.trimStartBars / clip.durationInBars) * totalDurationSeconds;
                        const durationSeconds = (clip.trimDurationBars / clip.durationInBars) * totalDurationSeconds;
                        
                        nodes.player.sync().start(startTimeInSeconds, offsetSeconds, durationSeconds);
                    }
                });
            }
        }
        
        // 3. Schedule the metronome and start the transport.
        scheduleMetronome();
        Tone.Transport.start();
    
        // 4. Update React state to reflect the new playing state.
        setIsPlaying(true);
        // The useEffect will unlock the transport.
    
    }, [startAudio, stopPlayback, playbackMode, audioClips, patterns, bpm, scheduleMetronome]);

    const handleToggleRecord = useCallback(async () => {
    if (isTransportTransitioning.current) return;

    if (isRecording || isArmedForRecording) {
        isTransportTransitioning.current = true;
        stopPlayback();
        return;
    }

    if (!selectedChannelId) {
        alert("Please select a channel to record to.");
        return;
    }

    isTransportTransitioning.current = true;
    await startAudio();
    
    // Clean up any previous recording schedules just in case. This is a safety measure; stopPlayback should handle it.
    recordingScheduleIds.current.forEach(id => Tone.Transport.clear(id));
    recordingScheduleIds.current = [];
    if (countInPartRef.current) {
        countInPartRef.current.dispose();
        countInPartRef.current = null;
    }

    // Clear previous notes and steps, and initialize recording buffer
    recordedNotesRef.current = [];
    setPatterns(patterns => patterns.map(p => {
        if (p.id !== activePatternId) return p;
        return {
            ...p,
            channels: p.channels.map(c =>
                c.id === selectedChannelId ? { ...c, notes: [], steps: Array(c.steps.length).fill(0) } : c
            )
        };
    }));

    setIsArmedForRecording(true);
    isCountingInRef.current = false;

    const secondsPerBar = (60 / bpm) * 4;
    const countInDuration = countInBars * secondsPerBar;

    // Schedule count-in metronome clicks if count-in is enabled
    if (countInBars > 0) {
        isCountingInRef.current = true;
        const countInEvents = [];
        for (let i = 0; i < countInBars * 4; i++) {
            const time = i * (secondsPerBar / 4);
            const note = i % 4 === 0 ? 'C5' : 'C4';
            countInEvents.push({ time, note });
        }
        const countInPart = new Tone.Part((time, value) => {
            metronomeSynth.current?.triggerAttackRelease(value.note, '32n', time);
        }, countInEvents).start(0);
        countInPart.loop = false;
        countInPartRef.current = countInPart;
        
        const disposeId = Tone.Transport.scheduleOnce(() => {
            countInPart.dispose();
            if (countInPartRef.current === countInPart) {
                countInPartRef.current = null;
            }
        }, countInDuration);
        recordingScheduleIds.current.push(disposeId);

        // FIX: Schedule the flag change slightly before the downbeat to avoid race condition with the main metronome.
        const flagChangeTime = countInDuration - 0.05; // 50ms buffer
        if (flagChangeTime > 0) {
            const flagEventId = Tone.Transport.scheduleOnce(() => {
                isCountingInRef.current = false;
            }, flagChangeTime);
            recordingScheduleIds.current.push(flagEventId);
        } else {
            // If count-in is very short, set it immediately.
            isCountingInRef.current = false;
        }
    }

    // Schedule the actual recording start
    const startRecordingEventId = Tone.Transport.scheduleOnce((time) => {
        // By the time this event fires, the isCountingInRef flag is already false.
        Tone.Draw.schedule(() => {
            setIsArmedForRecording(false);
            setIsRecording(true);
            setIsPlaying(true); // Now set playing to true
            recordingStartTime.current = time;
        }, time);

        sequence.current?.start(time);
        channelParts.current.forEach(part => part.start(time));
    }, countInDuration);
    recordingScheduleIds.current.push(startRecordingEventId);

    // Schedule transport stop at the end of the pattern recording session
    const patternDuration = (activePattern.length / 16) * secondsPerBar;
    const stopTransportEventId = Tone.Transport.scheduleOnce(() => {
        stopPlayback();
    }, countInDuration + patternDuration);
    recordingScheduleIds.current.push(stopTransportEventId);

    scheduleMetronome();
    Tone.Transport.start();
    }, [stopPlayback, startAudio, countInBars, bpm, selectedChannelId, activePattern, setPatterns, isRecording, isArmedForRecording, scheduleMetronome]);

  useEffect(() => {
    if (isPlaying && view === 'pattern' && followPlayhead && sequencerContainerRef.current && currentStep >= 0) {
      const container = sequencerContainerRef.current;
      if (container.scrollWidth <= container.clientWidth) return;

      const stepWidth = container.scrollWidth / patternLength;
      const currentStepPosition = currentStep * stepWidth;
      const containerWidth = container.clientWidth;

      let targetScrollLeft = currentStepPosition - (containerWidth / 2) + (stepWidth / 2);
      targetScrollLeft = Math.max(0, Math.min(targetScrollLeft, container.scrollWidth - containerWidth));
      
      const deadZone = containerWidth / 4; 
      const scrollLeft = container.scrollLeft;
      const viewStart = scrollLeft + deadZone;
      const viewEnd = scrollLeft + containerWidth - deadZone;

      if (currentStepPosition < viewStart || currentStepPosition > viewEnd) {
          container.scrollTo({
              left: targetScrollLeft,
              behavior: 'smooth',
          });
      }
    }
  }, [currentStep, isPlaying, view, followPlayhead, patternLength]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        const target = event.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT' && target.tagName !== 'TEXTAREA' && !target.isContentEditable) {
          event.preventDefault();
          togglePlay();
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
        event.preventDefault();
        if (event.shiftKey) {
          redoPatterns();
        } else {
          undoPatterns();
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'y') {
        event.preventDefault();
        redoPatterns();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [togglePlay, undoPatterns, redoPatterns]);

  const handleStepToggle = useCallback(async (channelId: string, stepIndex: number) => {
    await startAudio();

    if (playbackOnTrigger) {
        const currentPattern = patternsRef.current.find(p => p.id === activePatternIdRef.current);
        const channel = currentPattern?.channels.find(c => c.id === channelId);
        
        if (channel && channel.steps[stepIndex] === 0) {
            const nodes = audioNodes.current.get(channel.sample.name);
            if (nodes?.sampler.loaded) {
                if (channel.cutItself) nodes.sampler.releaseAll();
                nodes.sampler.triggerAttack('C3', Tone.now());
            }
        }
    }

    setPatterns(currentPatterns => currentPatterns.map(p => {
        if (p.id !== activePatternIdRef.current) return p;
        const newChannels = p.channels.map(ch => {
            if (ch.id !== channelId) return ch;
            
            const newSteps = [...ch.steps];
            const currentStepValue = newSteps[stepIndex];
            let nextStepValue: number;
            if (currentStepValue === 0) {
                nextStepValue = 1;
            } else {
                switch (currentStepValue) {
                    case 1: nextStepValue = 2; break;
                    case 2: nextStepValue = 4; break;
                    case 4: nextStepValue = 3; break;
                    case 3: nextStepValue = 1; break;
                    default: nextStepValue = 1;
                }
            }
            newSteps[stepIndex] = nextStepValue;
            return { ...ch, steps: newSteps };
        });
        return { ...p, channels: newChannels };
    }));
  }, [startAudio, setPatterns, playbackOnTrigger]);
  
  const handleStepSubdivide = useCallback((channelId: string, stepIndex: number) => {
    setPatterns(currentPatterns => currentPatterns.map(p => {
      if (p.id !== activePatternId) return p;
      const newChannels = p.channels.map(ch => {
        if (ch.id !== channelId) return ch;
        const newSteps = [...ch.steps];
        newSteps[stepIndex] = 0;
        return { ...ch, steps: newSteps };
      });
      return { ...p, channels: newChannels };
    }));
  }, [activePatternId, setPatterns]);

    // FIX: Changed Tone.AudioNode to Tone.ToneAudioNode to match the correct base type in Tone.js.
    const createEffectNode = (effectState: EffectState): Tone.ToneAudioNode | null => {
        if (!effectState.enabled) return null;
        switch (effectState.type) {
            case 'Reverb': {
                const p = effectState.params as ReverbParams;
                return new Tone.Reverb({ decay: p.decay, wet: p.wet });
            }
            case 'Delay': {
                const p = effectState.params as DelayParams;
                return new Tone.FeedbackDelay({ delayTime: p.delayTime, feedback: p.feedback, wet: p.wet });
            }
            case 'Chorus': {
                const p = effectState.params as ChorusParams;
                return new Tone.Chorus(p.frequency, p.delayTime, p.depth).set({ wet: p.wet }).start();
            }
            case 'Distortion': {
                const p = effectState.params as DistortionParams;
                return new Tone.Distortion({ distortion: p.distortion, wet: p.wet });
            }
            case 'Filter': {
                const p = effectState.params as FilterParams;
                return new Tone.Filter(p.frequency, p.type, p.rolloff).set({ Q: p.Q });
            }
            case 'Compressor': {
                const p = effectState.params as CompressorParams;
                return new Tone.Compressor({
                    threshold: p.threshold,
                    ratio: p.ratio,
                    attack: p.attack,
                    release: p.release,
                });
            }
            default: return null;
        }
    };
    
    const handleChannelChange = useCallback((id: string, newProps: Partial<ChannelState>) => {
        setPatterns(currentPatterns => {
            const channelIndex = currentPatterns[0].channels.findIndex(c => c.id === id);
            if (channelIndex === -1) return currentPatterns;

            return currentPatterns.map(p => ({
                ...p,
                channels: p.channels.map((ch, index) => {
                    if (index !== channelIndex) return ch;

                    const updatedChannel = { ...ch, ...newProps };
                    const isAudioClip = ch.isAudioClipChannel;
                    const nodes = isAudioClip ? audioClipNodes.current.get(id) : audioNodes.current.get(ch.sample.name);
                    
                    if (!nodes) return updatedChannel;

                    // --- Effects Handling ---
                    if (newProps.effects && JSON.stringify(newProps.effects) !== JSON.stringify(ch.effects)) {
                        // FIX: Added type casting to correctly access 'player' or 'sampler' properties on the union type.
                        const sourceNode = isAudioClip ? (nodes as AudioClipNodes).player : (nodes as ChannelAudioNodes).sampler;
                        
                        sourceNode.disconnect();
                        nodes.effects.forEach(fx => fx.dispose());

                        const newEffectNodes = (newProps.effects || [])
                            .map(fxState => fxState ? createEffectNode(fxState) : null)
                            // FIX: Changed Tone.AudioNode to Tone.ToneAudioNode in the type guard.
                            .filter((n): n is Tone.ToneAudioNode => n !== null);
                        
                        // FIX: Changed Tone.AudioNode[] to Tone.ToneAudioNode[] to match the created nodes.
                        const chain: Tone.ToneAudioNode[] = [sourceNode, ...newEffectNodes, nodes.panner, nodes.eq, nodes.meter];
                        
                        for (let i = 0; i < chain.length - 1; i++) {
                            chain[i].connect(chain[i+1]);
                        }
                        nodes.meter.toDestination();
                        nodes.effects = newEffectNodes;
                    }

                    // --- Other Parameter Handling ---
                    if (newProps.volume !== undefined) {
                        (isAudioClip ? (nodes as AudioClipNodes).player : (nodes as ChannelAudioNodes).sampler).volume.value = newProps.volume;
                    }
                    if (newProps.pan !== undefined) {
                        nodes.panner.pan.value = newProps.pan;
                    }
                    if (newProps.eq) {
                        nodes.eq.low.value = newProps.eq.low;
                        nodes.eq.mid.value = newProps.eq.mid;
                        nodes.eq.high.value = newProps.eq.high;
                        nodes.eq.lowFrequency.value = newProps.eq.lowFrequency;
                        nodes.eq.highFrequency.value = newProps.eq.highFrequency;
                    }
                    
                    return updatedChannel;
                })
            }));
        });
    }, [setPatterns]);
  
  const handleChannelMuteSoloChange = useCallback((channelId: string, type: 'mute' | 'solo') => {
    setPatterns(currentPatterns => {
        const channelIndex = currentPatterns[0].channels.findIndex(c => c.id === channelId);
        if (channelIndex === -1) return currentPatterns;

        const currentChannelState = currentPatterns[0].channels[channelIndex];
        let newMutedState = !!currentChannelState.isMuted;
        let newSoloState = !!currentChannelState.isSoloed;

        if (type === 'mute') {
            newMutedState = !currentChannelState.isMuted;
            if (newMutedState) newSoloState = false;
        }
        if (type === 'solo') {
            newSoloState = !currentChannelState.isSoloed;
            if (newSoloState) newMutedState = false;
        }

        return currentPatterns.map(p => ({
            ...p,
            channels: p.channels.map((ch, index) => {
                if (index !== channelIndex) return ch;
                return { 
                    ...ch, 
                    isMuted: newMutedState,
                    isSoloed: newSoloState,
                };
            })
        }));
    });
  }, [setPatterns]);

  const handleSampleDrop = useCallback(async (channelId: string, sample: Sample) => {
    let shouldCutItself: boolean | undefined = undefined;

    if (sample.url) {
        try {
            const buffer = await new Tone.ToneAudioBuffer(sample.url).load(sample.url);
            shouldCutItself = buffer.duration < 1.5;
            buffer.dispose();
        } catch (e) {
            console.error("Could not get buffer duration for auto-cut feature:", e);
        }
    }

    setPatterns(currentPatterns => {
        const patternIndex = currentPatterns.findIndex(p => p.id === activePatternId);
        if (patternIndex === -1) return currentPatterns;

        const channelIndex = currentPatterns[patternIndex].channels.findIndex(c => c.id === channelId);
        if (channelIndex === -1) return currentPatterns;
        
        const channelToUpdate = currentPatterns[patternIndex].channels[channelIndex];

        if (channelToUpdate) {
            const updatedChannel = { 
                ...channelToUpdate, 
                sample,
                name: sample.name,
                ...(shouldCutItself !== undefined && { cutItself: shouldCutItself })
            };
            loadSampler(sample, updatedChannel);
        }

        return currentPatterns.map(p => {
            if (p.id !== activePatternId) return p;
            const newChannels = p.channels.map(ch => ch.id === channelId ? { 
                ...ch, 
                sample, 
                name: sample.name,
                ...(shouldCutItself !== undefined && { cutItself: shouldCutItself })
            } : ch);
            return { ...p, channels: newChannels };
        });
    });
  }, [activePatternId, loadSampler, setPatterns]);

  const handleAddSamples = useCallback((newSamples: SampleTree) => {
      setUserSamples(prev => [...prev, ...newSamples]);
  }, []);

  const loadedSamplersRef = useRef(new Set<string>());

  useEffect(() => {
      const traverseAndLoad = (nodes: SampleTree) => {
          nodes.forEach(node => {
              if (node.type === 'file') {
                  if (!loadedSamplersRef.current.has(node.url)) {
                      const defaultChannel = patterns[0]?.channels[0];
                      if (defaultChannel) {
                          loadSampler({ name: node.name, url: node.url }, defaultChannel);
                          loadedSamplersRef.current.add(node.url);
                      }
                  }
              } else if (node.type === 'folder') {
                  traverseAndLoad(node.children);
              }
          });
      };
      traverseAndLoad(userSamples);
  }, [userSamples, loadSampler, patterns]);

  
  const applyMidiPattern = useCallback((channelId: string, pattern: MidiPattern) => {
    setPatterns(currentPatterns => currentPatterns.map(p => {
        if (p.id !== activePatternId) return p;
        
        const newChannels = p.channels.map(ch => {
            if (ch.id !== channelId) return ch;
            const generatedPart = generateMidiPattern(pattern, patternLength);
            const newSteps = [...ch.steps];

            for (let i = 0; i < patternLength; i++) {
                newSteps[i] = generatedPart[i] || 0;
            }

            return { ...ch, steps: newSteps, notes: [] };
        });
        return { ...p, channels: newChannels };
    }));
  }, [patternLength, activePatternId, setPatterns]);

  const handleAddPattern = () => {
    const newPatternName = `Pattern ${patterns.length + 1}`;
    const currentActivePattern = patterns.find(p => p.id === activePatternId);
    const newPattern = createNewPattern(newPatternName, currentActivePattern?.channels);
    setPatterns(prev => [...prev, newPattern]);
    setActivePatternId(newPattern.id);
  };
  
  const handleAddChannel = useCallback(async (sample?: Sample) => {
      const newSample = sample || { name: 'New Channel', url: '' };
      const newChannel = createNewChannel(newSample);
      
      if (sample?.url) {
          try {
              const buffer = await new Tone.ToneAudioBuffer(sample.url).load(sample.url);
              if (buffer.duration < 1.5) { // Auto-enable Cut Itself for short samples
                  newChannel.cutItself = true;
              }
              buffer.dispose();
          } catch (e) {
              console.error("Could not get buffer duration for auto-cut feature:", e);
          }
          loadSampler(sample, newChannel);
      }
      
      setPatterns(currentPatterns => currentPatterns.map(p => ({
            ...p,
            channels: [...p.channels, newChannel]
      })));
  }, [loadSampler, setPatterns]);
  
  const handleClearPattern = useCallback(() => {
    setPatterns(currentPatterns => currentPatterns.map(p => {
      if (p.id !== activePatternId) return p;
      const clearedChannels = p.channels.map(channel => ({
        ...channel,
        steps: Array(channel.steps.length).fill(0),
        notes: [],
      }));
      return { ...p, channels: clearedChannels };
    }));
  }, [activePatternId, setPatterns]);

  const handleAddAudioClip = useCallback(async (file: File, track: number, startBar: number) => {
    await startAudio();
    const url = URL.createObjectURL(file);
    const sample: Sample = { name: file.name.replace(/\.[^/.]+$/, ""), url };
    
    const newChannel = createNewChannel(sample, true);
    
    const meter = new Tone.Meter({ smoothing: 0 });
    const eq = new Tone.EQ3(newChannel.eq).connect(meter);
    const panner = new Tone.Panner(0).connect(eq);
    
    const player = new Tone.Player({
        url,
        onload: () => {
            player.connect(panner);
            meter.toDestination();

            const durationInSeconds = player.buffer.duration;
            const secondsPerBar = (60 / bpm) * 4;
            const durationInBars = durationInSeconds / secondsPerBar;

            audioClipNodes.current.set(newChannel.id, { player, panner, eq, meter, effects: [] });
            
            setPatterns(currentPatterns => 
                currentPatterns.map(p => ({
                    ...p,
                    channels: [...p.channels, newChannel]
                }))
            );
            
            const newClip: AudioClip = {
                id: `audioclip-${Date.now()}-${Math.random()}`,
                sample,
                track,
                startBar,
                durationInBars,
                trimStartBars: 0,
                trimDurationBars: durationInBars,
                channelId: newChannel.id,
            };

            setAudioClips(prev => [...prev, newClip]);
        },
        onerror: (e) => {
            console.error("Error loading audio clip player:", e);
            URL.revokeObjectURL(url);
        }
    });
  }, [bpm, startAudio, setPatterns]);

  const handleUpdateAudioClip = useCallback((clipId: string, newProps: Partial<AudioClip>) => {
    setAudioClips(clips => clips.map(c => c.id === clipId ? {...c, ...newProps} : c));
  }, []);

  const handleDeleteAudioClip = useCallback((clipId: string) => {
    const clipToDelete = audioClips.find(c => c.id === clipId);
    if (!clipToDelete) return;

    setAudioClips(clips => clips.filter(c => c.id !== clipId));
    
    const nodes = audioClipNodes.current.get(clipToDelete.channelId);
    nodes?.player.dispose();
    nodes?.panner.dispose();
    nodes?.eq.dispose();
    nodes?.meter.dispose();
    nodes?.effects.forEach(fx => fx.dispose());
    audioClipNodes.current.delete(clipToDelete.channelId);

    setPatterns(patterns => patterns.map(p => ({
        ...p,
        channels: p.channels.filter(ch => ch.id !== clipToDelete.channelId)
    })));
  }, [audioClips, setPatterns]);

  const handleOpenPianoRoll = useCallback((channelId: string) => {
    setEditingChannelId(channelId);
  }, []);

  const handleClosePianoRoll = useCallback(() => {
    setEditingChannelId(null);
  }, []);

  const handleUpdateChannelNotes = useCallback((channelId: string, notes: Note[]) => {
      setPatterns(currentPatterns => currentPatterns.map(p => {
          if (p.id !== activePatternId) return p;
          return {
              ...p,
              channels: p.channels.map(ch => 
                  ch.id === channelId ? { ...ch, notes, steps: Array(ch.steps.length).fill(0) } : ch
              )
          };
      }));
  }, [activePatternId, setPatterns]);

    const triggerNotePreview = useCallback(async (channelId: string, pitch: number, velocity = 0.75) => {
        if (!playbackOnTrigger) return;
        
        await startAudio();
        
        const currentPattern = patternsRef.current.find(p => p.id === activePatternIdRef.current);
        if (!currentPattern) return;
        
        const channel = currentPattern.channels.find(c => c.id === channelId);
        if (!channel) return;
        
        const nodes = audioNodes.current.get(channel.sample.name);
        if (nodes?.sampler.loaded) {
            const midiToNoteName = (midi: number) => {
                const octave = Math.floor(midi / 12) - 1;
                const noteIndex = midi % 12;
                return NOTE_NAMES[noteIndex] + octave;
            };
            const noteName = midiToNoteName(pitch);
            
            if (channel.cutItself) nodes.sampler.releaseAll();
            nodes.sampler.triggerAttack(noteName, Tone.now(), velocity);
        }
    }, [playbackOnTrigger, startAudio]);
    
    const handleSamplePreview = useCallback(async (sample: Sample) => {
        if (!playbackOnTrigger) return;
        await startAudio();
    
        const nodes = audioNodes.current.get(sample.name);
        if (nodes?.sampler.loaded) {
            nodes.sampler.releaseAll();
            nodes.sampler.triggerAttack('C3', Tone.now());
            return;
        }
    
        if (!previewPlayer.current) {
            previewPlayer.current = new Tone.Player().toDestination();
        }
        
        try {
            if (previewPlayer.current.state === 'started') {
                previewPlayer.current.stop();
            }
            await previewPlayer.current.load(sample.url);
            previewPlayer.current.start();
        } catch(e) {
            console.error("Error playing sample preview:", e);
        }
    }, [playbackOnTrigger, startAudio]);

    // --- Typing Keyboard & Recording Logic ---
    const triggerTypingNote = useCallback(async (channelId: string, pitch: number, velocity: number) => {
        await startAudio();
        const masterChannelList = patternsRef.current[0]?.channels;
        if (!masterChannelList) return;
        const channel = masterChannelList.find(c => c.id === channelId);
        if (!channel) return;
        const nodes = audioNodes.current.get(channel.sample.name);
        if (nodes?.sampler.loaded) {
            const midiToNoteName = (midi: number) => {
                const octave = Math.floor(midi / 12) - 1;
                const noteIndex = midi % 12;
                return NOTE_NAMES[noteIndex] + octave;
            };
            const noteName = midiToNoteName(pitch);
            if (channel.cutItself) nodes.sampler.releaseAll();
            nodes.sampler.triggerAttack(noteName, Tone.now(), velocity);
        }

        if (isRecordingRef.current && selectedChannelId && recordingStartTime.current > 0) {
            const secondsPer16th = (60 / bpm) / 4;
            const timeSinceStart = Tone.Transport.seconds - recordingStartTime.current;
            const startStep = timeSinceStart / secondsPer16th;
            if (startStep >= 0) { // Ensure we don't record notes during count-in
                activeNotes.current.set(pitch, { startTime: startStep, velocity });
            }
        }
    }, [startAudio, bpm, selectedChannelId]);

    const releaseTypingNote = useCallback((channelId: string, pitch: number) => {
        const masterChannelList = patternsRef.current[0]?.channels;
        if (!masterChannelList) return;
        const channel = masterChannelList.find(c => c.id === channelId);
        if (!channel) return;

        // For polyphonic instruments, release the specific note
        if (!channel.cutItself) {
            const nodes = audioNodes.current.get(channel.sample.name);
            if (nodes?.sampler.loaded) {
                const midiToNoteName = (midi: number) => {
                    const octave = Math.floor(midi / 12) - 1;
                    const noteIndex = midi % 12;
                    return NOTE_NAMES[noteIndex] + octave;
                };
                const noteName = midiToNoteName(pitch);
                nodes.sampler.triggerRelease(noteName, Tone.now());
            }
        }
        // For 'cut itself' (monophonic) instruments, the note plays out until the next one is triggered, so no release action is needed here.

        if (isRecordingRef.current && recordingStartTime.current > 0) {
            const noteOnData = activeNotes.current.get(pitch);
            if (noteOnData) {
                const secondsPer16th = (60 / bpm) / 4;
                const timeSinceStart = Tone.Transport.seconds - recordingStartTime.current;
                const endStep = timeSinceStart / secondsPer16th;
                
                const duration = Math.max(0.1, endStep - noteOnData.startTime);
                
                const newNote: Note = {
                    id: `note-${Date.now()}-${pitch}`,
                    pitch: pitch,
                    start: noteOnData.startTime,
                    duration: duration,
                    velocity: noteOnData.velocity,
                };

                recordedNotesRef.current.push(newNote);
                
                activeNotes.current.delete(pitch);
            }
        }
    }, [bpm]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isMusicalTypingEnabled) return;

            const target = event.target as HTMLElement;
            if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                return;
            }
            if (event.repeat) return;

            if (event.key === 'ArrowUp') { setTranspose(t => t + 12); event.preventDefault(); return; }
            if (event.key === 'ArrowDown') { setTranspose(t => t - 12); event.preventDefault(); return; }
            if (event.key === 'ArrowRight') { setTranspose(t => t + 1); event.preventDefault(); return; }
            if (event.key === 'ArrowLeft') { setTranspose(t => t - 1); event.preventDefault(); return; }

            const baseMidi = KEY_TO_MIDI[event.code];
            if (baseMidi && selectedChannelId && !pressedKeys.current.has(event.code)) {
                event.preventDefault();
                pressedKeys.current.add(event.code);
                const finalMidi = baseMidi + transpose;
                
                const velocity = event.getModifierState("CapsLock") ? 1.0 : 0.75;
                
                triggerTypingNote(selectedChannelId, finalMidi, velocity);
            }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
            if (!isMusicalTypingEnabled) return;
            
            pressedKeys.current.delete(event.code);
            const baseMidi = KEY_TO_MIDI[event.code];
            if (baseMidi && selectedChannelId) {
                const finalMidi = baseMidi + transpose;
                releaseTypingNote(selectedChannelId, finalMidi);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [selectedChannelId, transpose, triggerTypingNote, releaseTypingNote, isMusicalTypingEnabled]);


    const handleToggleFavorite = useCallback((sampleId: string) => {
        const toggleRecursively = (nodes: SampleTree): SampleTree => {
            return nodes.map(node => {
                if (node.type === 'file' && node.id === sampleId) {
                    return { ...node, isFavorite: !node.isFavorite };
                }
                if (node.type === 'folder') {
                    return { ...node, children: toggleRecursively(node.children) };
                }
                return node;
            });
        };
        setUserSamples(prev => toggleRecursively(prev));
    }, []);


  const gatherProjectState = useCallback(async (): Promise<ProjectState> => {
    const serializedUserSamples = await serializeTree(userSamples);
    
    const clipSamples: SerializedSample[] = await Promise.all(
        audioClips.map(clip => sampleToSerializedSample(clip.sample))
    );
    
    const audioClipsWithDataUrl = audioClips.map((clip, i) => ({
        ...clip,
        sample: { name: clip.sample.name, url: clipSamples[i].dataUrl }
    }));

    return {
        patterns,
        playlist: Array.from(playlist.entries()),
        audioClips: audioClipsWithDataUrl,
        userSamples: serializedUserSamples,
        bpm,
        swing,
        version: '1.4.0', 
    };
  }, [userSamples, audioClips, patterns, playlist, bpm, swing]);

  const loadProjectState = useCallback(async (state: ProjectState) => {
    if (Tone.Transport.state !== 'stopped') {
        Tone.Transport.stop();
        Tone.Transport.cancel();
        setIsPlaying(false);
        setCurrentStep(-1);
    }
    disposeAllNodes();

    const oldUserSamples = userSamplesRef.current;
    const oldAudioClips = audioClips;
    
    const revokeUrls = (tree: SampleTree) => tree.forEach(node => {
        if(node.type === 'file') URL.revokeObjectURL(node.url);
        else revokeUrls(node.children);
    });
    revokeUrls(oldUserSamples);
    oldAudioClips.forEach(c => URL.revokeObjectURL(c.sample.url));

    const newUserSamples = await deserializeTree(state.userSamples || []);

    setBpm(state.bpm);
    setSwing(state.swing);
    setUserSamples(newUserSamples);
    
    const newAudioClips = await Promise.all((state.audioClips || []).map(async clip => {
        const url = await sampleToSerializedSample({name: clip.sample.name, url: (clip.sample as any).dataUrl || clip.sample.url}).then(s => s.dataUrl).then(dataUrlToBlobUrl);
        return { ...clip, sample: { ...clip.sample, url } };
    }));
    setAudioClips(newAudioClips);

    const findSampleUrlInTree = (name: string, tree: SampleTree): string | undefined => {
        for (const node of tree) {
            if (node.type === 'file' && node.name === name) {
                return node.url;
            }
            if (node.type === 'folder') {
                const found = findSampleUrlInTree(name, node.children);
                if (found) return found;
            }
        }
        return undefined;
    };
    
    const newPatterns = state.patterns.map(p => ({
        ...p,
        channels: p.channels.map(c => {
            const sampleUrl = findSampleUrlInTree(c.sample.name, newUserSamples) || '';
            return { ...c, sample: { ...c.sample, url: sampleUrl }};
        })
    }));
    
    setInitialPatterns(newPatterns);
    setPlaylist(new Map(state.playlist));
    
    if (newPatterns.length > 0) {
        setActivePatternId(newPatterns[0].id);
        setBrushPatternId(newPatterns[0].id);
        setSelectedChannelId(newPatterns[0]?.channels[0]?.id ?? null);
    }
    
    // Re-create all audio nodes
    newPatterns[0].channels.forEach(channel => {
        if (!channel.isAudioClipChannel && channel.sample.url) {
            loadSampler(channel.sample, channel);
        } else if (channel.isAudioClipChannel) {
            const clip = newAudioClips.find(c => c.channelId === channel.id);
            if (clip) {
                const meter = new Tone.Meter({ smoothing: 0 });
                const eq = new Tone.EQ3(channel.eq).connect(meter);
                const panner = new Tone.Panner(channel.pan).connect(eq);
                const player = new Tone.Player(clip.sample.url, () => {
                    player.connect(panner);
                    meter.toDestination();
                    audioClipNodes.current.set(clip.channelId, { player, panner, eq, meter, effects: [] });
                });
            }
        }
    });

    setTimeout(() => {
        newPatterns[0].channels.forEach(channel => {
            handleChannelChange(channel.id, { effects: channel.effects });
        });
    }, 500);

  }, [setInitialPatterns, audioClips, loadSampler, handleChannelChange]);


  const handleSaveAs = async () => {
    try {
        const projectState = await gatherProjectState();
        const projectString = JSON.stringify(projectState, null, 2);
        const blob = new Blob([projectString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'project.flow';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (err) {
        console.error('Error saving file:', err);
    }
  };

  const handleSave = async () => {
    await handleSaveAs();
  };
  
  const handleOpen = () => {
      try {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.flow,application/json';
        input.onchange = (event) => {
            const target = event.target as HTMLInputElement;
            const file = target.files?.[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const contents = e.target?.result as string;
                        const projectState = JSON.parse(contents);
                        await loadProjectState(projectState);
                    } catch (loadErr) {
                        console.error('Error processing or loading project file:', loadErr);
                        alert('Failed to load project file. It may be corrupted.');
                    }
                };
                reader.onerror = (err) => {
                    console.error('Error reading file:', err);
                    alert('An error occurred while reading the file.');
                };
                reader.readAsText(file);
            }
        };
        document.body.appendChild(input);
        input.click();
        document.body.removeChild(input);
    } catch (err) {
        console.error('Error opening file picker:', err);
    }
  };

  const handleExportPattern = async () => {
      if (!activePattern) return;
      setIsExporting(true);
      try {
          await exportPatternToWav(activePattern, bpm, swing);
      } catch (e) {
          console.error("Failed to export pattern", e);
          alert(`Error exporting pattern: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
          setIsExporting(false);
      }
  };

  const handleExportSong = async () => {
      setIsExporting(true);
      try {
          await exportSongToWav({ patterns, playlist, audioClips, bpm, swing });
      } catch (e) {
          console.error("Failed to export song", e);
          alert(`Error exporting song: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
          setIsExporting(false);
      }
  };

  const handleExportSongAsMp3 = async () => {
      setIsExporting(true);
      try {
          await exportSongToMp3({ patterns, playlist, audioClips, bpm, swing });
      } catch (e) {
          console.error("Failed to export song as MP3", e);
          alert(`Error exporting song as MP3: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
          setIsExporting(false);
      }
  };
  
    // Browser resizing logic
  const handleMouseDownOnResizeHandle = (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      resizeData.current = {
          startX: e.clientX,
          startWidth: browserWidth,
      };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      const deltaX = e.clientX - resizeData.current.startX;
      const newWidth = resizeData.current.startWidth + deltaX;
      const MIN_WIDTH = 240;
      const MAX_WIDTH = 600;
      setBrowserWidth(Math.max(MIN_WIDTH, Math.min(newWidth, MAX_WIDTH)));
    };

    const handleMouseUp = () => {
        setIsResizing(false);
    };
    
    if (isResizing) {
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);


  const [, drop] = useDrop(() => ({
    accept: 'sample',
    drop: (item: Sample) => handleAddChannel(item),
  }));

  const renderCurrentView = () => {
      switch (view) {
          case 'pattern':
              return (
                  <>
                      <PatternControls
                          patterns={patterns}
                          activePatternId={activePatternId}
                          onPatternSelect={setActivePatternId}
                          onAddPattern={handleAddPattern}
                          onClearPattern={handleClearPattern}
                          followPlayhead={followPlayhead}
                          onFollowPlayheadChange={setFollowPlayhead}
                          playbackOnTrigger={playbackOnTrigger}
                          onPlaybackOnTriggerChange={setPlaybackOnTrigger}
                          isMusicalTypingEnabled={isMusicalTypingEnabled}
                          onIsMusicalTypingEnabledChange={setIsMusicalTypingEnabled}
                          quantizeSnapValue={quantizeSnapValue}
                          onQuantizeSnapValueChange={setQuantizeSnapValue}
                      />
                      <div className="bg-main rounded-xl shadow-main p-6 mt-4">
                          <div ref={sequencerContainerRef} className="overflow-x-auto">
                              <div className="flex items-center border-b border-border-color pb-2 mb-2 sticky top-0 bg-main z-10">
                                  <div className="w-56 shrink-0 flex items-center pl-2">
                                      <button onClick={() => handleAddChannel()} className="p-1 rounded-md hover:bg-gray-200 transition-colors" title="Add Channel">
                                          <Plus size={16} />
                                      </button>
                                  </div>
                                  <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${patternLength}, minmax(2.5rem, 1fr))` }}>
                                      {Array.from({ length: patternLength }).map((_, i) => (
                                          <div
                                              key={i}
                                              className={`h-8 text-center text-xs font-medium flex items-center justify-center border-r ${
                                                  (i + 1) % 16 === 0 ? 'border-primary/40' : (i + 1) % 4 === 0 ? 'border-secondary/30' : 'border-transparent'
                                                  } ${(i % 4 === 0) ? 'text-primary' : 'text-secondary'}`}
                                          >
                                              {i + 1}
                                          </div>
                                      ))}
                                  </div>
                              </div>
                              <div className="space-y-1">
                                  {activePattern?.channels.map(channel => (
                                      <Channel
                                          key={channel.id}
                                          channel={channel}
                                          currentStep={currentStep}
                                          patternLength={patternLength}
                                          onStepToggle={handleStepToggle}
                                          onStepSubdivide={handleStepSubdivide}
                                          onChannelChange={handleChannelChange}
                                          onSampleDrop={handleSampleDrop}
                                          onApplyMidiPattern={applyMidiPattern}
                                          onOpenPianoRoll={handleOpenPianoRoll}
                                          onChannelMuteSoloChange={handleChannelMuteSoloChange}
                                          isSelected={channel.id === selectedChannelId}
                                          onSelect={setSelectedChannelId}
                                      />
                                  ))}
                              </div>
                              <div ref={drop as any} className="mt-2 h-12 border-2 border-dashed border-border-color rounded-lg flex items-center justify-center text-secondary text-sm">
                                  Drag sample here to create a new channel
                              </div>
                          </div>
                      </div>
                  </>
              );
          case 'song':
              return (
                  <SongMode
                      patterns={patterns}
                      playlist={playlist}
                      brushPatternId={brushPatternId}
                      onBrushPatternIdChange={setBrushPatternId}
                      onPlaylistChange={setPlaylist}
                      currentStep={currentStep}
                      isPlaying={isPlaying}
                      audioClips={audioClips}
                      snapMode={snapMode}
                      onSnapModeChange={setSnapMode}
                      onAddAudioClip={handleAddAudioClip}
                      onUpdateAudioClip={handleUpdateAudioClip}
                      onDeleteAudioClip={handleDeleteAudioClip}
                      bpm={bpm}
                  />
              );
          case 'mixer':
              return (
                  <Mixer
                      channels={patterns[0].channels}
                      masterVolume={masterVolume}
                      meterLevels={meterLevels}
                      onChannelChange={handleChannelChange}
                      onMasterVolumeChange={setMasterVolume}
                      onChannelMuteSoloChange={handleChannelMuteSoloChange}
                  />
              );
          default:
              return null;
      }
  };

  return (
      <div className="flex h-screen bg-light-bg font-sans text-primary overflow-hidden">
          <div 
            className="flex shrink-0"
            style={{ 
                transition: 'margin-left 0.3s ease-in-out',
                marginLeft: isBrowserVisible ? '0' : `-${browserWidth + 6}px`
            }}
          >
              <aside 
                className="h-full flex flex-col bg-main shadow-lg"
                style={{ width: `${browserWidth}px` }}
              >
                <SamplePool 
                    userSamples={userSamples} 
                    onAddSamples={handleAddSamples} 
                    onSamplePreview={handleSamplePreview}
                    onToggleFavorite={handleToggleFavorite}
                    onClose={() => setIsBrowserVisible(false)}
                />
              </aside>
              <div
                onMouseDown={handleMouseDownOnResizeHandle}
                className="w-1.5 h-full shrink-0 cursor-ew-resize bg-border-color hover:bg-accent transition-colors"
                title="Resize Browser"
              />
          </div>
          
          <div className="flex-1 flex flex-col overflow-hidden">
              <header className="shrink-0 flex flex-col md:flex-row justify-between items-start gap-4 p-6 md:p-10 pb-4">
                <div className="flex items-center gap-4">
                  {!isBrowserVisible && (
                      <button onClick={() => setIsBrowserVisible(true)} className="p-2 bg-main rounded-md shadow-main hover:bg-gray-200 transition-colors font-semibold text-sm">
                          Browser
                      </button>
                  )}
                  <h1 className="text-3xl font-bold">FlowBeat</h1>
                  <FileMenu
                    onSave={handleSave}
                    onSaveAs={handleSaveAs}
                    onOpen={handleOpen}
                    onExportPattern={handleExportPattern}
                    onExportSong={handleExportSong}
                    onExportSongAsMp3={handleExportSongAsMp3}
                    isSaveReminderEnabled={isSaveReminderEnabled}
                    onToggleSaveReminder={() => setIsSaveReminderEnabled(prev => !prev)}
                  />
                </div>
                <div className='flex items-center gap-4'>
                    <div className="flex items-center gap-2">
                        <button onClick={undoPatterns} disabled={!canUndoPatterns} className="p-2 bg-main rounded-md shadow-main hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Undo (Ctrl+Z)">
                            <Undo size={18} />
                        </button>
                        <button onClick={redoPatterns} disabled={!canRedoPatterns} className="p-2 bg-main rounded-md shadow-main hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" title="Redo (Ctrl+Y)">
                            <Redo size={18} />
                        </button>
                    </div>
                    
                    <div className="flex items-center gap-1 bg-main p-1 rounded-lg shadow-main">
                        <button onClick={() => setView('pattern')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-semibold text-sm transition-colors ${view === 'pattern' ? 'bg-accent text-white' : 'hover:bg-gray-100'}`}>
                            <Music size={16} /> Pattern
                        </button>
                        <button onClick={() => setView('song')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-semibold text-sm transition-colors ${view === 'song' ? 'bg-accent text-white' : 'hover:bg-gray-100'}`}>
                            <ListMusic size={16} /> Song
                        </button>
                        <button onClick={() => setView('mixer')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-semibold text-sm transition-colors ${view === 'mixer' ? 'bg-accent text-white' : 'hover:bg-gray-100'}`}>
                            <SlidersHorizontal size={16} /> Mixer
                        </button>
                    </div>

                    <TransportControls
                      isPlaying={isPlaying}
                      onTogglePlay={togglePlay}
                      bpm={bpm}
                      onBpmChange={setBpm}
                      swing={swing}
                      onSwingChange={setSwing}
                      masterVolume={masterVolume}
                      onMasterVolumeChange={setMasterVolume}
                      patternLength={patternLength}
                      onPatternLengthChange={handlePatternLengthChange}
                      isMetronomeOn={isMetronomeOn}
                      onMetronomeToggle={setIsMetronomeOn}
                      isRecording={isRecording}
                      isArmedForRecording={isArmedForRecording}
                      onToggleRecord={handleToggleRecord}
                      countInBars={countInBars}
                      onCountInBarsChange={setCountInBars}
                    />
                </div>
              </header>
              
              <main className="flex-1 overflow-y-auto p-6 md:p-10 pt-2">
                  {isExporting && (
                        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                            <div className="bg-white p-6 rounded-lg shadow-xl text-center">
                                <h3 className="text-lg font-semibold">Exporting Audio...</h3>
                                <p className="text-sm text-secondary mt-2">Please wait, this may take a moment.</p>
                            </div>
                        </div>
                    )}
                  
                  {renderCurrentView()}
              </main>

            </div>
            {showSaveReminder && (
                <div className="fixed bottom-6 right-6 bg-white p-4 rounded-lg shadow-xl z-50 w-72 animate-fade-in-up border border-border-color">
                    <h3 className="font-semibold text-primary">Remember to Save!</h3>
                    <p className="text-sm text-secondary mt-1">Don't lose your masterpiece. Save your project to a file.</p>
                    <div className="mt-4 flex gap-2">
                        <button 
                            onClick={() => {
                                handleSaveAs();
                                setShowSaveReminder(false);
                            }}
                            className="flex-1 px-3 py-1.5 bg-accent text-white rounded-md text-sm font-semibold hover:bg-accent/90 transition-colors"
                        >
                            Save Project
                        </button>
                        <button 
                            onClick={() => setShowSaveReminder(false)}
                            className="flex-1 px-3 py-1.5 bg-gray-200 rounded-md text-sm font-semibold hover:bg-gray-300 transition-colors"
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            )}
            {editingChannel && activePattern && (
                <PianoRoll 
                    channel={editingChannel}
                    patternLength={activePattern.length}
                    onClose={handleClosePianoRoll}
                    onNotesChange={handleUpdateChannelNotes}
                    currentStep={currentStep}
                    isPlaying={isPlaying}
                    followPlayhead={followPlayhead}
                    onTriggerNote={(pitch) => triggerNotePreview(editingChannel.id, pitch)}
                />
            )}
      </div>
  );
};

export default App;
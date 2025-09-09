

export interface Sample {
  name: string;
  url: string;
}

export interface Note {
  id: string;
  pitch: number; // MIDI note number, e.g., 60 for C4
  start: number; // Start time in 16th note steps from the beginning of the pattern
  duration: number; // Duration in 16th note steps
  velocity: number; // 0-1
}

export interface EQState {
    low: number; // gain in dB
    mid: number; // gain in dB
    high: number; // gain in dB
    lowFrequency: number; // in Hz
    highFrequency: number; // in Hz
}

// --- Audio Effects Types ---

export enum EffectType {
    Reverb = 'Reverb',
    Delay = 'Delay',
    Chorus = 'Chorus',
    Distortion = 'Distortion',
    Filter = 'Filter',
    Compressor = 'Compressor',
}

export interface ReverbParams {
    decay: number; // seconds
    wet: number; // 0-1
}

export interface DelayParams {
    delayTime: number; // seconds
    feedback: number; // 0-1
    wet: number; // 0-1
}

export interface ChorusParams {
    frequency: number; // Hz
    delayTime: number; // ms
    depth: number; // 0-1
    wet: number; // 0-1
}

export interface DistortionParams {
    distortion: number; // 0-1
    wet: number; // 0-1
}

export interface FilterParams {
    type: 'lowpass' | 'highpass' | 'bandpass';
    frequency: number; // Hz
    Q: number;
    rolloff: -12 | -24 | -48 | -96;
}

export interface CompressorParams {
    threshold: number; // dB
    ratio: number;
    attack: number; // seconds
    release: number; // seconds
}

export type EffectParams = ReverbParams | DelayParams | ChorusParams | DistortionParams | FilterParams | CompressorParams;

export interface EffectState {
    id: string;
    type: EffectType;
    enabled: boolean;
    params: EffectParams;
}


export interface ChannelState {
  id: string;
  name: string;
  sample: Sample;
  // 0: off, 1: on, 2: 2-roll, 3: 3-roll (triplet), 4: 4-roll
  steps: number[];
  notes?: Note[];
  volume: number;
  pan: number;
  cutItself: boolean;
  eq: EQState;
  effects: (EffectState | null)[];
  isAudioClipChannel?: boolean;
  isMuted?: boolean;
  isSoloed?: boolean;
}

export enum MidiPattern {
  HiHat,
  TrapHiHat,
  Clap,
  FourOnTheFloor,
  HalfTimeClap1,
  HalfTimeClap2,
  Erase,
}

export interface Pattern {
  id: string;
  name: string;
  channels: ChannelState[];
  length: number;
}

export type Playlist = Map<string, string>; // key: "track:bar", value: patternId

// New types for Song Mode audio clips
export type SnapMode = 'bar' | 'grid' | 'none';
export type QuantizeSnapValue = '1/64' | '1/32' | '1/16' | '1/8' | '1/4' | '1/2' | 'None';


export interface AudioClip {
  id:string;
  channelId: string; // Link to the master channel for this audio clip
  sample: Sample; // Contains name and URL
  track: number;
  startBar: number;
  durationInBars: number; // Full duration of the audio file in bars
  trimStartBars: number; // Trimmed start point, as an offset from the start of the clip, in bars
  trimDurationBars: number; // Trimmed duration in bars
}

// --- Auto-Arrangement Types ---
export interface ArrangementOptions {
    introPatternId: string;
    chorusPatternId: string;
    versePatternId: string;
    numVerses: number;
    useBridge: boolean;
    bridgePatternId: string | null;
    introBars: number;
    verseBars: number;
    chorusBars: number;
    useOutro: boolean;
    outroPatternId: string | null;
}


// --- Sample Pool File System Types ---

// A file in the sample pool
export interface SampleNode {
  id: string;
  type: 'file';
  name: string;
  url: string;
  isFavorite?: boolean;
}

// A folder in the sample pool
export interface FolderNode {
  id: string;
  type: 'folder';
  name: string;
  children: (SampleNode | FolderNode)[];
}

export type SampleTreeNode = SampleNode | FolderNode;
export type SampleTree = SampleTreeNode[];


// --- Project Saving/Loading Types ---

export interface SerializedSample {
    name: string;
    dataUrl: string; // base64 representation of the audio file
}

// For project saving the sample pool tree
export interface SerializedSampleNode {
    id: string;
    type: 'file';
    name: string;
    dataUrl: string;
    isFavorite?: boolean;
}

export interface SerializedFolderNode {
    id: string;
    type: 'folder';
    name: string;
    children: (SerializedSampleNode | SerializedFolderNode)[];
}
export type SerializedSampleTreeNode = SerializedSampleNode | SerializedFolderNode;
export type SerializedSampleTree = SerializedSampleTreeNode[];


export interface ProjectState {
    version: string;
    patterns: Pattern[];
    playlist: [string, string][]; // Serializable version of the Map
    audioClips: AudioClip[];
    userSamples: SerializedSampleTree; // Updated from SerializedSample[]
    bpm: number;
    swing: number;
}

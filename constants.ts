

import { ChannelState, Sample, Pattern, EQState, EffectType, ReverbParams, DelayParams, ChorusParams, DistortionParams, FilterParams, CompressorParams } from './types';

export const DEFAULT_SAMPLES: Sample[] = [];

const createInitialSteps = (length: number) => Array(length).fill(0);

const initialSample = (name: string): Sample => ({ name, url: '' });

const defaultEQ: EQState = {
    low: 0,
    mid: 0,
    high: 0,
    lowFrequency: 250,
    highFrequency: 4000,
};

export const DEFAULT_EFFECT_PARAMS = {
    [EffectType.Reverb]: { decay: 1.5, wet: 0.5 } as ReverbParams,
    [EffectType.Delay]: { delayTime: 0.5, feedback: 0.4, wet: 0.5 } as DelayParams,
    [EffectType.Chorus]: { frequency: 1.5, delayTime: 3.5, depth: 0.7, wet: 0.5 } as ChorusParams,
    [EffectType.Distortion]: { distortion: 0.4, wet: 0.5 } as DistortionParams,
    [EffectType.Filter]: { type: 'lowpass', frequency: 8000, Q: 1, rolloff: -12 } as FilterParams,
    [EffectType.Compressor]: { threshold: -24, ratio: 12, attack: 0.003, release: 0.25 } as CompressorParams,
};

// This is the single source of truth for creating a fresh set of channels.
// It ensures that every new pattern gets a completely new set of channel objects
// with unique IDs, preventing any state from being shared.
export const createFreshChannels = (patternId: string): ChannelState[] => {
    const MAX_STEPS = 128; // 8 bars
    return [
        { id: `ch-${patternId}-1`, name: 'Channel 1', sample: initialSample('Channel 1'), steps: createInitialSteps(MAX_STEPS), notes: [], volume: 0, pan: 0, cutItself: false, eq: { ...defaultEQ }, effects: Array(6).fill(null), isMuted: false, isSoloed: false },
        { id: `ch-${patternId}-2`, name: 'Channel 2', sample: initialSample('Channel 2'), steps: createInitialSteps(MAX_STEPS), notes: [], volume: 0, pan: 0, cutItself: false, eq: { ...defaultEQ }, effects: Array(6).fill(null), isMuted: false, isSoloed: false },
        { id: `ch-${patternId}-3`, name: 'Channel 3', sample: initialSample('Channel 3'), steps: createInitialSteps(MAX_STEPS), notes: [], volume: 0, pan: 0, cutItself: false, eq: { ...defaultEQ }, effects: Array(6).fill(null), isMuted: false, isSoloed: false },
        { id: `ch-${patternId}-4`, name: 'Channel 4', sample: initialSample('Channel 4'), steps: createInitialSteps(MAX_STEPS), notes: [], volume: -10, pan: 0, cutItself: true, eq: { ...defaultEQ }, effects: Array(6).fill(null), isMuted: false, isSoloed: false },
        { id: `ch-${patternId}-5`, name: 'Channel 5', sample: initialSample('Channel 5'), steps: createInitialSteps(MAX_STEPS), notes: [], volume: 0, pan: 0, cutItself: true, eq: { ...defaultEQ }, effects: Array(6).fill(null), isMuted: false, isSoloed: false },
        { id: `ch-${patternId}-6`, name: 'Channel 6', sample: initialSample('Channel 6'), steps: createInitialSteps(MAX_STEPS), notes: [], volume: -5, pan: 0.1, cutItself: false, eq: { ...defaultEQ }, effects: Array(6).fill(null), isMuted: false, isSoloed: false },
    ];
};


export const createNewChannel = (sample: Sample, isAudioClipChannel = false): ChannelState => ({
    id: `channel-${Date.now()}-${Math.random()}`,
    name: sample.name || 'New Channel',
    sample: sample,
    steps: createInitialSteps(128), // Still needs steps array to not break logic, but won't be used for audio clips
    notes: [],
    volume: 0,
    pan: 0,
    cutItself: false,
    eq: { ...defaultEQ },
    effects: Array(6).fill(null),
    isAudioClipChannel,
    isMuted: false,
    isSoloed: false,
});


export const createNewPattern = (name: string, channelsToClone?: ChannelState[]): Pattern => {
  const patternId = `pattern-${Date.now()}-${Math.random()}`;
  
  const newChannels = channelsToClone
    ? channelsToClone.map((channel, index) => ({
        ...channel,
        id: `ch-${patternId}-${index + 1}`, // Ensure unique ID for the new channel
        steps: Array(channel.steps.length).fill(0), // Clear steps for the new pattern
        notes: [], // Clear notes for the new pattern
      }))
    : createFreshChannels(patternId);

  return {
    id: patternId,
    name,
    channels: newChannels,
    length: 16,
  };
};

const createInitialPattern = (): Pattern => {
    const patternId = `pattern-${Date.now()}`;
    return {
        id: patternId,
        name: 'Pattern 1',
        channels: createFreshChannels(patternId),
        length: 16,
    };
};


export const initialPatterns: Pattern[] = [createInitialPattern()];
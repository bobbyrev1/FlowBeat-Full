

import * as Tone from 'tone';
import type { Pattern, Playlist, AudioClip, ChannelState, Sample } from '../types';
import { bufferToWav } from './audioUtils';

// Declare lamejs which is loaded from a CDN script in index.html
declare var lamejs: any;

interface ExportSongPayload {
    patterns: Pattern[];
    playlist: Playlist;
    audioClips: AudioClip[];
    bpm: number;
    swing: number;
}

// Helper to trigger a file download
const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

export const exportPatternToWav = async (pattern: Pattern, bpm: number, swing: number): Promise<void> => {
    const secondsPer16th = (60 / bpm) / 4;
    const patternDuration = pattern.length * secondsPer16th;
    
    if (patternDuration <= 0) {
        console.warn("Cannot export an empty pattern.");
        return;
    }

    const swingDelay = swing * (secondsPer16th / 2);

    const buffer = await Tone.Offline(async () => {
        const samplers = new Map<string, { sampler: Tone.Sampler, panner: Tone.Panner }>();

        // 1. Pre-load all unique samples in the pattern
        const uniqueSamples = [...new Set(pattern.channels.map(c => c.sample))];
        await Promise.all(uniqueSamples.map(sample => {
            return new Promise<void>((resolve, reject) => {
                if (!sample.url || samplers.has(sample.name)) return resolve();
                const panner = new Tone.Panner(0).toDestination();
                const sampler = new Tone.Sampler({
                    urls: { C3: sample.url },
                    onload: () => {
                        sampler.connect(panner);
                        samplers.set(sample.name, { sampler, panner });
                        resolve();
                    },
                    onerror: (err) => reject(`Failed to load sample ${sample.name}: ${err}`)
                });
            });
        }));

        // 2. Calculate absolute times and schedule notes directly
        pattern.channels.forEach(channel => {
            const nodes = samplers.get(channel.sample.name);
            if (!nodes) return;
            
            nodes.sampler.volume.value = channel.volume;
            nodes.panner.pan.value = channel.pan;

            channel.steps.forEach((stepValue, stepIndex) => {
                if (stepIndex >= pattern.length || stepValue <= 0) return;
                
                let time = stepIndex * secondsPer16th; 
                // Apply MPC-style swing: delay only off-beat (odd-indexed) 16th notes
                if (swing > 0 && stepIndex % 2 !== 0) {
                    time += swingDelay;
                }

                if (stepValue === 1) {
                    nodes.sampler.triggerAttack("C3", time);
                } else {
                    const subdivisions = stepValue === 3 ? 3 : stepValue;
                    const subNoteDuration = secondsPer16th / subdivisions;
                    for (let i = 0; i < subdivisions; i++) {
                        nodes.sampler.triggerAttack("C3", time + i * subNoteDuration);
                    }
                }
            });
        });
        
    }, patternDuration);

    const wavBlob = bufferToWav(buffer.get());
    downloadBlob(wavBlob, `${pattern.name}.wav`);
};

// Private helper to render the entire song to a ToneAudioBuffer
const renderSongToBuffer = async (payload: ExportSongPayload): Promise<Tone.ToneAudioBuffer> => {
    const { patterns, playlist, audioClips, bpm, swing } = payload;
    
    let songEndBar = 0;
    playlist.forEach((patternId, key) => {
        const [, bar] = key.split(':').map(Number);
        const pattern = patterns.find(p => p.id === patternId);
        if (pattern) {
            songEndBar = Math.max(songEndBar, bar + (pattern.length / 16));
        }
    });
    audioClips.forEach(clip => {
        songEndBar = Math.max(songEndBar, clip.startBar + clip.trimDurationBars);
    });

    const secondsPerBar = (60 / bpm) * 4;
    const songDuration = songEndBar * secondsPerBar;

    if (songDuration <= 0) {
        // FIX: Tone.context.createBuffer returns a native AudioBuffer, which doesn't match
        // the function's return type of Tone.ToneAudioBuffer. Wrap it to satisfy TypeScript.
        const emptyBuffer = Tone.context.createBuffer(1, 1, Tone.context.sampleRate);
        return new Tone.ToneAudioBuffer(emptyBuffer);
    }

    return await Tone.Offline(async () => {
        const secondsPer16th = (60 / bpm) / 4;
        const swingDelay = swing * (secondsPer16th / 2);
        
        const samplers = new Map<string, { sampler: Tone.Sampler, panner: Tone.Panner }>();
        const players = new Map<string, { player: Tone.Player, panner: Tone.Panner }>();

        const allChannels = patterns.flatMap(p => p.channels);
        const uniqueSamplerSamples = [...new Set(allChannels.filter(c => !c.isAudioClipChannel && c.sample.url).map(c => c.sample))];
        
        const audioClipsWithChannels = audioClips.map(clip => ({
            ...clip,
            channel: allChannels.find(c => c.id === clip.channelId)
        })).filter(item => item.channel && item.sample.url);

        await Promise.all(uniqueSamplerSamples.map(sample => {
             return new Promise<void>((resolve, reject) => {
                if (samplers.has(sample.name)) return resolve();
                const panner = new Tone.Panner(0).toDestination();
                const sampler = new Tone.Sampler({ urls: { C3: sample.url }, onload: () => {
                    sampler.connect(panner);
                    samplers.set(sample.name, { sampler, panner });
                    resolve();
                }, onerror: (e) => reject(`Failed to load sampler for ${sample.name}: ${e}`) });
            });
        }));

        await Promise.all(audioClipsWithChannels.map(clip => {
            return new Promise<void>((resolve, reject) => {
                if (players.has(clip.channelId)) return resolve();
                const panner = new Tone.Panner(0).toDestination();
                const player = new Tone.Player({ url: clip.sample.url, onload: () => {
                    player.connect(panner);
                    players.set(clip.channelId, { player, panner });
                    resolve();
                }, onerror: (e) => reject(`Failed to load audio clip ${clip.sample.name}: ${e}`) });
            });
        }));
        
        playlist.forEach((patternId, key) => {
            const [, bar] = key.split(':').map(Number);
            const pattern = patterns.find(p => p.id === patternId);
            if (!pattern) return;
            
            const patternStartTimeSeconds = bar * secondsPerBar;
            
            pattern.channels.forEach(channel => {
                if (channel.isAudioClipChannel) return;
                const nodes = samplers.get(channel.sample.name);
                if (!nodes) return;

                nodes.sampler.volume.value = channel.volume;
                nodes.panner.pan.value = channel.pan;

                channel.steps.forEach((stepValue, stepIndex) => {
                    if (stepIndex >= pattern.length || stepValue <= 0) return;
                    
                    const noteTimeInPattern = stepIndex * secondsPer16th;
                    let absoluteNoteTime = patternStartTimeSeconds + noteTimeInPattern;

                    const globalStepIndex = bar * 16 + stepIndex;
                    if (swing > 0 && globalStepIndex % 2 !== 0) {
                        absoluteNoteTime += swingDelay;
                    }

                    if (stepValue === 1) {
                        nodes.sampler.triggerAttack("C3", absoluteNoteTime);
                    } else {
                        const subdivisions = stepValue === 3 ? 3 : stepValue;
                        const subNoteDuration = secondsPer16th / subdivisions;
                        for (let i = 0; i < subdivisions; i++) {
                            nodes.sampler.triggerAttack("C3", absoluteNoteTime + i * subNoteDuration);
                        }
                    }
                });
            });
        });

        audioClipsWithChannels.forEach(({ channel, ...clip }) => {
            const nodes = players.get(clip.channelId);
            if (!nodes || !nodes.player.loaded || !channel) return;

            nodes.player.volume.value = channel.volume;
            nodes.panner.pan.value = channel.pan;

            const startTimeInSeconds = clip.startBar * secondsPerBar;
            const totalDurationSeconds = nodes.player.buffer.duration;
            const offsetSeconds = (clip.trimStartBars / clip.durationInBars) * totalDurationSeconds;
            const durationSeconds = (clip.trimDurationBars / clip.durationInBars) * totalDurationSeconds;

            if (durationSeconds > 0) {
                nodes.player.start(startTimeInSeconds, offsetSeconds, durationSeconds);
            }
        });

    }, songDuration);
};

export const exportSongToWav = async (payload: ExportSongPayload): Promise<void> => {
    const buffer = await renderSongToBuffer(payload);
    if (buffer.duration <= 0) {
        console.warn("Cannot export an empty song.");
        return;
    }
    const wavBlob = bufferToWav(buffer.get());
    downloadBlob(wavBlob, 'FlowBeat_Song.wav');
};

export const exportSongToMp3 = async (payload: ExportSongPayload): Promise<void> => {
    const buffer = await renderSongToBuffer(payload);
    if (buffer.duration <= 0) {
        console.warn("Cannot export an empty song.");
        return;
    }

    const audioBuffer = buffer.get();
    const channels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const bitRate = 320; // kbps, increased for high quality

    const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, bitRate);
    const mp3Data = [];

    const pcmL = audioBuffer.getChannelData(0);
    const pcmR = channels > 1 ? audioBuffer.getChannelData(1) : pcmL;

    // Convert float PCM to 16-bit signed integer PCM
    const convert = (floatData: Float32Array): Int16Array => {
        const intData = new Int16Array(floatData.length);
        for (let i = 0; i < floatData.length; i++) {
            intData[i] = Math.max(-1, Math.min(1, floatData[i])) * 32767;
        }
        return intData;
    };
    
    const intPcmL = convert(pcmL);
    const intPcmR = convert(pcmR);

    const sampleBlockSize = 1152;
    for (let i = 0; i < intPcmL.length; i += sampleBlockSize) {
        const leftChunk = intPcmL.subarray(i, i + sampleBlockSize);
        const rightChunk = intPcmR.subarray(i, i + sampleBlockSize);
        const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
        if (mp3buf.length > 0) {
            mp3Data.push(mp3buf);
        }
    }
    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
        mp3Data.push(mp3buf);
    }
    
    const mp3Blob = new Blob(mp3Data.map(d => new Uint8Array(d)), { type: 'audio/mpeg' });
    downloadBlob(mp3Blob, 'FlowBeat_Song.mp3');
};

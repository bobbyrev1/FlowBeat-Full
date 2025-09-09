

import React from 'react';
import type { ChannelState } from '../types';
import { Knob } from './Knob';
import { Fader } from './Fader';
import { VUMeter } from './VUMeter';
import { EQGraph } from './EQGraph';
import { EffectsRack } from './effects/EffectsRack';
import { Music } from 'lucide-react';

interface MixerChannelStripProps {
    channel: ChannelState;
    meterLevel: number;
    onChannelChange: (id: string, newProps: Partial<ChannelState>) => void;
    onChannelMuteSoloChange: (channelId: string, type: 'mute' | 'solo') => void;
}

const formatFrequency = (freq: number): string => {
    if (freq >= 1000) {
        return `${(freq / 1000).toFixed(1)}k`;
    }
    return Math.round(freq).toString();
};

export const MixerChannelStrip: React.FC<MixerChannelStripProps> = ({ channel, meterLevel, onChannelChange, onChannelMuteSoloChange }) => {
    const { eq } = channel;

    const handleEqChange = (param: keyof typeof eq, value: number) => {
        onChannelChange(channel.id, { eq: { ...eq, [param]: value } });
    };

    return (
        <div className="w-40 h-full shrink-0 bg-main border-r border-border-color flex flex-col p-2 space-y-2">
            {/* EQ Section */}
            <div className="p-2 border border-border-color rounded-md bg-light-bg/80 space-y-1 shrink-0">
                <div className="flex justify-around">
                    <Knob size={30} min={-15} max={15} value={eq.low} onChange={val => handleEqChange('low', val)} label="LOW" />
                    <Knob size={30} min={-15} max={15} value={eq.mid} onChange={val => handleEqChange('mid', val)} label="MID" />
                    <Knob size={30} min={-15} max={15} value={eq.high} onChange={val => handleEqChange('high', val)} label="HIGH" />
                </div>
                <EQGraph eq={eq} />
            </div>

            {/* Effects Section */}
            <div className="p-2 border border-border-color rounded-md bg-light-bg/80 shrink-0">
                 <h4 className="text-xs font-bold text-center text-secondary mb-1">EFFECTS</h4>
                 <EffectsRack channel={channel} onChannelChange={onChannelChange} />
            </div>

            {/* Fader Section */}
            <div className="flex-grow flex items-stretch gap-2 min-h-[150px]">
                <div className="flex-grow flex flex-col">
                    <div className="flex-grow flex gap-2">
                        <div className="w-full relative">
                            <Fader 
                                min={-60}
                                max={6}
                                step={0.1}
                                value={channel.volume}
                                onChange={val => onChannelChange(channel.id, { volume: val })}
                                label={channel.name}
                            />
                        </div>
                        <VUMeter level={meterLevel} />
                    </div>
                    <span className="text-center text-xs font-medium text-secondary -mb-1">{channel.volume.toFixed(1)} dB</span>
                </div>
            </div>

            {/* Pan, Mute, Solo Section */}
            <div className="shrink-0 space-y-2">
                <div className="flex flex-col items-center">
                    <Knob size={30} min={-1} max={1} step={0.01} value={channel.pan} onChange={val => onChannelChange(channel.id, { pan: val })} label="PAN" />
                </div>
                <div className="flex justify-center gap-1">
                    <button 
                      onClick={() => onChannelMuteSoloChange(channel.id, 'mute')}
                      className={`flex-1 h-6 rounded-sm text-xs font-bold transition-colors ${channel.isMuted ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                      title="Mute"
                    >
                      M
                    </button>
                    <button 
                      onClick={() => onChannelMuteSoloChange(channel.id, 'solo')}
                      className={`flex-1 h-6 rounded-sm text-xs font-bold transition-colors ${channel.isSoloed ? 'bg-yellow-400 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}
                      title="Solo"
                    >
                      S
                    </button>
                </div>
            </div>
            
            {/* Name Section */}
            <div className="text-center py-1 border-t border-border-color shrink-0">
                <h3 className="font-semibold text-sm truncate" title={channel.name}>
                    {channel.isAudioClipChannel && <Music size={11} className="inline-block mr-1 text-secondary" />}
                    {channel.name}
                </h3>
            </div>
        </div>
    );
};

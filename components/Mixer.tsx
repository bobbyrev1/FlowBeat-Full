
import React from 'react';
import type { ChannelState } from '../types';
import { MixerChannelStrip } from './MixerChannelStrip';
import { Fader } from './Fader';
import { VUMeter } from './VUMeter';

interface MixerProps {
    channels: ChannelState[];
    masterVolume: number;
    meterLevels: Map<string, number>;
    onChannelChange: (id: string, newProps: Partial<ChannelState>) => void;
    onMasterVolumeChange: (value: number) => void;
    onChannelMuteSoloChange: (channelId: string, type: 'mute' | 'solo') => void;
}

export const Mixer: React.FC<MixerProps> = ({ channels, masterVolume, meterLevels, onChannelChange, onMasterVolumeChange, onChannelMuteSoloChange }) => {
    return (
        <div className="bg-light-bg rounded-xl shadow-main flex h-[75vh] max-h-[850px] overflow-hidden border border-border-color mt-6">
            <div className="flex-grow flex overflow-x-auto">
                {channels.map(channel => (
                    <MixerChannelStrip
                        key={channel.id}
                        channel={channel}
                        meterLevel={meterLevels.get(channel.id) ?? -Infinity}
                        onChannelChange={onChannelChange}
                        onChannelMuteSoloChange={onChannelMuteSoloChange}
                    />
                ))}
                 {/* Master Channel */}
                <div className="w-32 h-full shrink-0 bg-gray-200/50 border-l border-border-color flex flex-col p-2 space-y-2">
                    <div className="h-[238px] shrink-0" /> {/* Spacer to align with channel strips */}
                    
                    <div className="flex-grow flex items-stretch gap-2">
                        <div className="flex-grow flex flex-col">
                            <div className="flex-grow flex gap-2">
                                <div className="w-full relative">
                                    <Fader 
                                        min={-60}
                                        max={6}
                                        step={0.1}
                                        value={masterVolume}
                                        onChange={onMasterVolumeChange}
                                        label="Master"
                                    />
                                </div>
                                <VUMeter level={meterLevels.get('master') ?? -Infinity} />
                            </div>
                            <span className="text-center text-xs font-medium text-secondary -mb-1">{masterVolume.toFixed(1)} dB</span>
                        </div>
                    </div>

                     <div className="h-[76px] shrink-0" /> {/* Spacer */}
                    
                    <div className="text-center py-1 border-t border-border-color shrink-0">
                        <h3 className="font-bold text-sm truncate">Master</h3>
                    </div>
                </div>
            </div>
        </div>
    );
};

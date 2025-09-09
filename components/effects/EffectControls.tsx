
import React from 'react';
import type { EffectState, ReverbParams, DelayParams, ChorusParams, DistortionParams, FilterParams, CompressorParams } from '../../types';
import { Knob } from '../Knob';

interface EffectControlsProps {
    effect: EffectState;
    onParamChange: (param: string, value: any) => void;
}

export const EffectControls: React.FC<EffectControlsProps> = ({ effect, onParamChange }) => {
    
    const renderControls = () => {
        switch (effect.type) {
            case 'Reverb': {
                const params = effect.params as ReverbParams;
                return (
                    <div className="flex justify-around">
                        <Knob size={30} min={0.1} max={10} value={params.decay} onChange={v => onParamChange('decay', v)} label="Decay" />
                        <Knob size={30} min={0} max={1} value={params.wet} onChange={v => onParamChange('wet', v)} label="Wet" />
                    </div>
                );
            }
            case 'Delay': {
                const params = effect.params as DelayParams;
                return (
                    <div className="flex justify-around">
                        <Knob size={30} min={0} max={1} value={params.delayTime} onChange={v => onParamChange('delayTime', v)} label="Time" />
                        <Knob size={30} min={0} max={0.95} value={params.feedback} onChange={v => onParamChange('feedback', v)} label="FBack" />
                        <Knob size={30} min={0} max={1} value={params.wet} onChange={v => onParamChange('wet', v)} label="Wet" />
                    </div>
                );
            }
            case 'Chorus': {
                const params = effect.params as ChorusParams;
                return (
                    <div className="flex justify-around">
                        <Knob size={30} min={0.1} max={20} value={params.frequency} onChange={v => onParamChange('frequency', v)} label="Rate" />
                        <Knob size={30} min={0} max={1} value={params.depth} onChange={v => onParamChange('depth', v)} label="Depth" />
                        <Knob size={30} min={0} max={1} value={params.wet} onChange={v => onParamChange('wet', v)} label="Wet" />
                    </div>
                );
            }
            case 'Distortion': {
                 const params = effect.params as DistortionParams;
                 return (
                    <div className="flex justify-around">
                        <Knob size={30} min={0} max={1} value={params.distortion} onChange={v => onParamChange('distortion', v)} label="Drive" />
                        <Knob size={30} min={0} max={1} value={params.wet} onChange={v => onParamChange('wet', v)} label="Wet" />
                    </div>
                 );
            }
            case 'Filter': {
                 const params = effect.params as FilterParams;
                 return (
                     <div className="flex justify-around items-center">
                        <Knob size={30} min={20} max={18000} value={params.frequency} onChange={v => onParamChange('frequency', v)} label="Freq" />
                        <Knob size={30} min={0.1} max={18} value={params.Q} onChange={v => onParamChange('Q', v)} label="Q" />
                        <select
                            value={params.type}
                            onChange={e => onParamChange('type', e.target.value)}
                            className="text-[10px] bg-gray-200 border border-border-color rounded p-0.5"
                        >
                            <option value="lowpass">LP</option>
                            <option value="highpass">HP</option>
                            <option value="bandpass">BP</option>
                        </select>
                     </div>
                 );
            }
            case 'Compressor': {
                const params = effect.params as CompressorParams;
                return (
                    <div className="flex justify-around">
                        <Knob size={30} min={-60} max={0} value={params.threshold} onChange={v => onParamChange('threshold', v)} label="Thresh" />
                        <Knob size={30} min={1} max={20} value={params.ratio} onChange={v => onParamChange('ratio', v)} label="Ratio" />
                    </div>
                );
            }
            default:
                return <p className="text-center text-secondary text-[10px]">No controls for this effect.</p>;
        }
    };
    
    return <div>{renderControls()}</div>;
};

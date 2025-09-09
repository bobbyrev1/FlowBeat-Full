
import React from 'react';
import type { ChannelState, EffectState, EffectType } from '../../types';
import { EffectSlot } from './EffectSlot';
import { DEFAULT_EFFECT_PARAMS } from '../../constants';

interface EffectsRackProps {
    channel: ChannelState;
    onChannelChange: (id: string, newProps: Partial<ChannelState>) => void;
}

export const EffectsRack: React.FC<EffectsRackProps> = ({ channel, onChannelChange }) => {

    const handleAddEffect = (slotIndex: number, effectType: EffectType) => {
        const newEffect: EffectState = {
            id: `effect-${Date.now()}-${Math.random()}`,
            type: effectType,
            enabled: true,
            params: { ...DEFAULT_EFFECT_PARAMS[effectType] } as any,
        };
        const newEffects = [...channel.effects];
        newEffects[slotIndex] = newEffect;
        onChannelChange(channel.id, { effects: newEffects });
    };

    const handleRemoveEffect = (slotIndex: number) => {
        const newEffects = [...channel.effects];
        newEffects[slotIndex] = null;
        onChannelChange(channel.id, { effects: newEffects });
    };

    const handleUpdateEffect = (slotIndex: number, newEffectState: EffectState) => {
        const newEffects = [...channel.effects];
        newEffects[slotIndex] = newEffectState;
        onChannelChange(channel.id, { effects: newEffects });
    };
    
    return (
        <div className="space-y-2 h-48 overflow-y-auto pr-1">
            {channel.effects.map((effect, index) => (
                <EffectSlot 
                    key={index}
                    effect={effect}
                    slotIndex={index}
                    onAdd={(type) => handleAddEffect(index, type)}
                    onRemove={() => handleRemoveEffect(index)}
                    onUpdate={(newState) => handleUpdateEffect(index, newState)}
                />
            ))}
        </div>
    );
};

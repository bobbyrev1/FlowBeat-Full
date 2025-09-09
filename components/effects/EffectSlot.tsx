

import React, { useState, useRef, useEffect } from 'react';
import type { EffectState, EffectType } from '../../types';
import { EffectControls } from './EffectControls';
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { EffectType as EffectTypeEnum } from '../../types';

interface EffectSlotProps {
    effect: EffectState | null;
    slotIndex: number;
    onAdd: (type: EffectType) => void;
    onRemove: () => void;
    onUpdate: (newState: EffectState) => void;
}

export const EffectSlot: React.FC<EffectSlotProps> = ({ effect, onAdd, onRemove, onUpdate }) => {
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const [isExpanded, setIsExpanded] = useState(true);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsAddMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelectEffect = (type: EffectType) => {
        onAdd(type);
        setIsAddMenuOpen(false);
        setIsExpanded(true);
    };

    const toggleEnabled = () => {
        if (effect) {
            onUpdate({ ...effect, enabled: !effect.enabled });
        }
    };
    
    const handleParamChange = (param: string, value: any) => {
        if (effect) {
            onUpdate({ ...effect, params: { ...effect.params, [param]: value } });
        }
    };

    if (!effect) {
        return (
            <div className="relative" ref={menuRef}>
                <button 
                    onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
                    className="w-full flex items-center justify-center p-1 bg-white border border-dashed border-border-color rounded-md text-secondary hover:border-accent hover:text-accent transition-colors"
                >
                    <Plus size={14} />
                    <span className="text-xs ml-1">Add Effect</span>
                </button>
                {isAddMenuOpen && (
                    <div className="absolute z-20 top-full mt-1 w-full bg-white shadow-lg rounded-md border border-border-color py-1">
                        {Object.values(EffectTypeEnum).map((type) => (
                            <button key={type} onClick={() => handleSelectEffect(type)} className="block w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100">
                                {type}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="bg-white rounded-md border border-border-color text-xs">
            <header className="flex items-center justify-between p-1 bg-gray-100 rounded-t-md">
                <div className="flex items-center gap-1">
                     <button
                        onClick={toggleEnabled}
                        className={`w-4 h-4 rounded-full transition-colors ${effect.enabled ? 'bg-green-400' : 'bg-gray-300'}`}
                        title={effect.enabled ? 'Disable Effect' : 'Enable Effect'}
                     />
                    <strong className="font-semibold">{effect.type}</strong>
                </div>
                <div className="flex items-center">
                    <button onClick={() => setIsExpanded(!isExpanded)} className="p-0.5 hover:bg-gray-200 rounded-sm">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button onClick={onRemove} className="p-0.5 hover:bg-gray-200 rounded-sm text-secondary hover:text-red-500">
                        <X size={14} />
                    </button>
                </div>
            </header>
            {isExpanded && (
                <div className="p-1">
                    <EffectControls effect={effect} onParamChange={handleParamChange} />
                </div>
            )}
        </div>
    );
};
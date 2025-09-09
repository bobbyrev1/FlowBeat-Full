

import React, { useState } from 'react';
import type { Pattern, ArrangementOptions } from '../types';
import { X, Wand2 } from 'lucide-react';

interface AutoArrangeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onArrange: (options: ArrangementOptions) => void;
    patterns: Pattern[];
}

export const AutoArrangeModal: React.FC<AutoArrangeModalProps> = ({ isOpen, onClose, onArrange, patterns }) => {
    const [introPatternId, setIntroPatternId] = useState('');
    const [chorusPatternId, setChorusPatternId] = useState('');
    const [versePatternId, setVersePatternId] = useState('');
    const [numVerses, setNumVerses] = useState(2);
    const [useBridge, setUseBridge] = useState(false);
    const [bridgePatternId, setBridgePatternId] = useState('');
    const [introBars, setIntroBars] = useState(8);
    const [verseBars, setVerseBars] = useState(16);
    const [chorusBars, setChorusBars] = useState(8);
    const [useOutro, setUseOutro] = useState(false);
    const [outroPatternId, setOutroPatternId] = useState('');

    if (!isOpen) return null;

    const handleSubmit = () => {
        if (!introPatternId || !chorusPatternId || !versePatternId) {
            alert("Please select patterns for Intro, Chorus, and Verse.");
            return;
        }
        if (useBridge && !bridgePatternId) {
            alert("Please select a pattern for the Bridge or disable it.");
            return;
        }
        if (useOutro && !outroPatternId) {
            alert("Please select a pattern for the Outro or disable it.");
            return;
        }


        onArrange({
            introPatternId,
            chorusPatternId,
            versePatternId,
            numVerses,
            useBridge,
            bridgePatternId: useBridge ? bridgePatternId : null,
            introBars,
            verseBars,
            chorusBars,
            useOutro,
            outroPatternId: useOutro ? outroPatternId : null,
        });
    };
    
    const renderPatternOptions = () => (
        patterns.map(p => <option key={p.id} value={p.id}>{p.name}</option>)
    );

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onMouseDown={onClose}>
            <div className="bg-main w-full max-w-lg rounded-xl shadow-2xl flex flex-col overflow-hidden" onMouseDown={e => e.stopPropagation()}>
                <header className="flex items-center justify-between p-4 border-b border-border-color shrink-0">
                    <h2 className="text-lg font-bold flex items-center gap-2"><Wand2 size={20} /> Auto Arrange Song</h2>
                    <button onClick={onClose} className="p-2 rounded-md hover:bg-light-bg transition-colors">
                        <X size={20} />
                    </button>
                </header>
                
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="intro-pattern" className="block text-sm font-medium text-secondary mb-1">Intro Pattern</label>
                            <select id="intro-pattern" value={introPatternId} onChange={e => setIntroPatternId(e.target.value)} className="w-full bg-light-bg rounded-md p-2 text-sm border border-border-color">
                                <option value="">Select a pattern...</option>
                                {renderPatternOptions()}
                            </select>
                        </div>
                         <div>
                            <label htmlFor="intro-bars" className="block text-sm font-medium text-secondary mb-1">Intro Length</label>
                            <select id="intro-bars" value={introBars} onChange={e => setIntroBars(Number(e.target.value))} className="w-full bg-light-bg rounded-md p-2 text-sm border border-border-color">
                               <option value={4}>4 Bars</option>
                               <option value={8}>8 Bars</option>
                               <option value={12}>12 Bars</option>
                               <option value={16}>16 Bars</option>
                           </select>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="chorus-pattern" className="block text-sm font-medium text-secondary mb-1">Chorus (Hook) Pattern</label>
                            <select id="chorus-pattern" value={chorusPatternId} onChange={e => setChorusPatternId(e.target.value)} className="w-full bg-light-bg rounded-md p-2 text-sm border border-border-color">
                               <option value="">Select a pattern...</option>
                               {renderPatternOptions()}
                            </select>
                        </div>
                        <div>
                           <label htmlFor="chorus-bars" className="block text-sm font-medium text-secondary mb-1">Chorus Length</label>
                           <select id="chorus-bars" value={chorusBars} onChange={e => setChorusBars(Number(e.target.value))} className="w-full bg-light-bg rounded-md p-2 text-sm border border-border-color">
                               <option value={4}>4 Bars</option>
                               <option value={8}>8 Bars</option>
                               <option value={12}>12 Bars</option>
                               <option value={16}>16 Bars</option>
                           </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label htmlFor="verse-pattern" className="block text-sm font-medium text-secondary mb-1">Verse Pattern</label>
                            <select id="verse-pattern" value={versePatternId} onChange={e => setVersePatternId(e.target.value)} className="w-full bg-light-bg rounded-md p-2 text-sm border border-border-color">
                               <option value="">Select a pattern...</option>
                               {renderPatternOptions()}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="verse-bars" className="block text-sm font-medium text-secondary mb-1">Verse Length</label>
                            <select id="verse-bars" value={verseBars} onChange={e => setVerseBars(Number(e.target.value))} className="w-full bg-light-bg rounded-md p-2 text-sm border border-border-color">
                               <option value={8}>8 Bars</option>
                               <option value={12}>12 Bars</option>
                               <option value={16}>16 Bars</option>
                               <option value={24}>24 Bars</option>
                           </select>
                        </div>
                    </div>


                    <div className="flex items-center gap-4 pt-2">
                       <div className="flex-1">
                           <label htmlFor="num-verses" className="block text-sm font-medium text-secondary mb-1">Number of Verses</label>
                            <select id="num-verses" value={numVerses} onChange={e => setNumVerses(Number(e.target.value))} className="w-full bg-light-bg rounded-md p-2 text-sm border border-border-color">
                               <option value={1}>1 Verse</option>
                               <option value={2}>2 Verses</option>
                               <option value={3}>3 Verses</option>
                           </select>
                       </div>
                       <div className="pt-6 flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="use-bridge" checked={useBridge} onChange={e => setUseBridge(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"/>
                                <label htmlFor="use-bridge" className="text-sm font-medium text-primary">Use Bridge</label>
                            </div>
                            <div className="flex items-center gap-2">
                                <input type="checkbox" id="use-outro" checked={useOutro} onChange={e => setUseOutro(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-accent focus:ring-accent"/>
                                <label htmlFor="use-outro" className="text-sm font-medium text-primary">Use Outro</label>
                            </div>
                       </div>
                    </div>

                    {useBridge && (
                         <div className="animate-fade-in-up">
                            <label htmlFor="bridge-pattern" className="block text-sm font-medium text-secondary mb-1">Bridge Pattern</label>
                            <p className="text-xs text-secondary mb-2">The bridge will replace the second half of each verse.</p>
                            <select id="bridge-pattern" value={bridgePatternId} onChange={e => setBridgePatternId(e.target.value)} className="w-full bg-light-bg rounded-md p-2 text-sm border border-border-color">
                               <option value="">Select a pattern...</option>
                               {renderPatternOptions()}
                            </select>
                        </div>
                    )}

                     {useOutro && (
                         <div className="animate-fade-in-up">
                            <label htmlFor="outro-pattern" className="block text-sm font-medium text-secondary mb-1">Outro Pattern</label>
                             <p className="text-xs text-secondary mb-2">The outro will be placed at the end. Its length will match the intro.</p>
                            <select id="outro-pattern" value={outroPatternId} onChange={e => setOutroPatternId(e.target.value)} className="w-full bg-light-bg rounded-md p-2 text-sm border border-border-color">
                               <option value="">Select a pattern...</option>
                               {renderPatternOptions()}
                            </select>
                        </div>
                    )}
                </div>

                <footer className="p-4 bg-light-bg border-t border-border-color flex justify-end gap-3 shrink-0">
                    <button onClick={onClose} className="px-4 py-2 bg-main rounded-md text-sm font-semibold hover:bg-gray-200 transition-colors border border-border-color shadow-sm">
                        Cancel
                    </button>
                    <button onClick={handleSubmit} className="px-4 py-2 bg-accent text-white rounded-md text-sm font-semibold hover:bg-accent/90 transition-colors shadow-sm">
                        Arrange Song
                    </button>
                </footer>
            </div>
        </div>
    );
};
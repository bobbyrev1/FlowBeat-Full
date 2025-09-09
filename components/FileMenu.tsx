import React, { useState, useRef, useEffect } from 'react';
import { Menu, Save, FolderOpen, Download, FileAudio, BellRing } from 'lucide-react';

interface FileMenuProps {
    onSave: () => void;
    onSaveAs: () => void;
    onOpen: () => void;
    onExportPattern: () => void;
    onExportSong: () => void;
    onExportSongAsMp3: () => void;
    isSaveReminderEnabled: boolean;
    onToggleSaveReminder: () => void;
}

export const FileMenu: React.FC<FileMenuProps> = ({
    onSave,
    onSaveAs,
    onOpen,
    onExportPattern,
    onExportSong,
    onExportSongAsMp3,
    isSaveReminderEnabled,
    onToggleSaveReminder,
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleAction = (action: () => void) => {
        action();
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2 bg-main rounded-md shadow-main hover:bg-gray-200 transition-colors"
                title="File Menu"
            >
                <Menu size={18} />
            </button>
            {isOpen && (
                <div className="absolute z-30 left-0 mt-2 w-56 bg-white shadow-xl rounded-md border border-gray-300 py-1">
                    <button onClick={() => handleAction(onSave)} className="w-full flex items-center gap-3 text-left px-3 py-2 text-sm hover:bg-gray-100">
                        <Save size={16} /> Save Project
                    </button>
                     <button onClick={() => handleAction(onSaveAs)} className="w-full flex items-center gap-3 text-left px-3 py-2 text-sm hover:bg-gray-100">
                        <Save size={16} /> Save As...
                    </button>
                    <button onClick={() => handleAction(onOpen)} className="w-full flex items-center gap-3 text-left px-3 py-2 text-sm hover:bg-gray-100">
                        <FolderOpen size={16} /> Open Project...
                    </button>
                    <div className="border-t border-border-color my-1" />
                    <button onClick={() => handleAction(onExportPattern)} className="w-full flex items-center gap-3 text-left px-3 py-2 text-sm hover:bg-gray-100">
                        <FileAudio size={16} /> Export Pattern as WAV
                    </button>
                    <button onClick={() => handleAction(onExportSong)} className="w-full flex items-center gap-3 text-left px-3 py-2 text-sm hover:bg-gray-100">
                        <Download size={16} /> Export Song as WAV
                    </button>
                     <button onClick={() => handleAction(onExportSongAsMp3)} className="w-full flex items-center gap-3 text-left px-3 py-2 text-sm hover:bg-gray-100">
                        <Download size={16} /> Export Song as MP3
                    </button>
                    <div className="border-t border-border-color my-1" />
                    <div className="w-full flex items-center justify-between text-left px-3 py-2 text-sm">
                        <div className="flex items-center gap-3">
                            <BellRing size={16} />
                            <span>Save Reminder</span>
                        </div>
                        <button
                            onClick={() => handleAction(onToggleSaveReminder)}
                            className={`w-10 h-5 rounded-full p-0.5 transition-colors duration-200 ${isSaveReminderEnabled ? 'bg-accent' : 'bg-gray-300'}`}
                            aria-pressed={isSaveReminderEnabled}
                            title={isSaveReminderEnabled ? 'Disable save reminder' : 'Enable save reminder'}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full transition-transform duration-200 ${isSaveReminderEnabled ? 'translate-x-5' : 'translate-x-0'}`}></div>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
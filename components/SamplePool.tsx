import React, { useCallback, useState, useMemo } from 'react';
import { useDrag } from 'react-dnd';
import type { SampleNode, SampleTree, SampleTreeNode, FolderNode, Sample } from '../types';
import { UploadCloud, FileAudio, Star, Folder, ChevronRight, ChevronDown, X } from 'lucide-react';

// --- Helper Functions ---

const getFavorites = (nodes: SampleTree): SampleNode[] => {
    let favorites: SampleNode[] = [];
    const traverse = (currentNode: SampleTreeNode) => {
        if (currentNode.type === 'file' && currentNode.isFavorite) {
            favorites.push(currentNode);
        } else if (currentNode.type === 'folder') {
            currentNode.children.forEach(traverse);
        }
    };
    nodes.forEach(traverse);
    return favorites;
};

const findFolderContents = (folderId: string | null, tree: SampleTree): SampleTreeNode[] => {
    if (folderId === null) {
        return tree; // Root directory
    }
    const traverse = (nodes: SampleTree): SampleTreeNode[] | null => {
        for (const node of nodes) {
            if (node.type === 'folder') {
                if (node.id === folderId) {
                    return node.children;
                }
                const found = traverse(node.children);
                if (found) return found;
            }
        }
        return null;
    };
    return traverse(tree) || [];
};

// --- Child Components ---

interface SampleNodeViewProps {
  sample: SampleNode;
  onPreview: (sample: Sample) => void;
  onToggleFavorite: (id: string) => void;
}

const SampleNodeView: React.FC<SampleNodeViewProps> = ({ sample, onPreview, onToggleFavorite }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'sample',
    item: { name: sample.name, url: sample.url } as Sample,
    collect: (monitor) => ({
      isDragging: !!monitor.isDragging(),
    }),
  }), [sample.name, sample.url]);

  return (
    <div
      ref={drag as any}
      className={`relative px-2 py-1.5 flex items-center space-x-2 bg-white rounded-md cursor-grab border transition-all group ${
        isDragging ? 'opacity-50 shadow-md' : 'opacity-100 shadow-sm hover:bg-gray-100'
      }`}
      onClick={() => onPreview(sample)}
    >
      <FileAudio size={16} className="text-secondary shrink-0" />
      <span className="text-sm font-medium truncate flex-1">{sample.name}</span>
      <button
        className="p-1 text-secondary hover:text-yellow-500 transition-colors opacity-0 group-hover:opacity-100"
        onClick={(e) => {
            e.stopPropagation(); // Prevent preview from playing
            onToggleFavorite(sample.id);
        }}
        title={sample.isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        <Star size={14} fill={sample.isFavorite ? '#F59E0B' : 'none'} />
      </button>
    </div>
  );
};


interface FolderTreeViewProps {
    nodes: SampleTree;
    onSelectFolder: (folderId: string | null) => void;
    currentFolderId: string | null;
}

const FolderTreeView: React.FC<FolderTreeViewProps> = ({ nodes, onSelectFolder, currentFolderId }) => {
    const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

    const toggleFolder = (folderId: string) => {
        setExpandedFolders(prev => {
            const newSet = new Set(prev);
            if (newSet.has(folderId)) {
                newSet.delete(folderId);
            } else {
                newSet.add(folderId);
            }
            return newSet;
        });
    };

    const renderNode = (node: SampleTreeNode, level = 0) => {
        if (node.type === 'file') return null;

        const isExpanded = expandedFolders.has(node.id);
        const isSelected = currentFolderId === node.id;

        return (
            <div key={node.id}>
                <div
                    className={`flex items-center gap-2 p-1.5 rounded-md cursor-pointer ${isSelected ? 'bg-accent/10 text-accent' : 'hover:bg-gray-200'}`}
                    style={{ paddingLeft: `${level * 1 + 0.5}rem` }}
                    onClick={() => onSelectFolder(node.id)}
                >
                    <span onClick={(e) => { e.stopPropagation(); toggleFolder(node.id); }} className="p-0.5">
                       {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    <Folder size={16} />
                    <span className="text-sm font-medium truncate">{node.name}</span>
                </div>
                {isExpanded && (
                    <div>{node.children.map(child => renderNode(child, level + 1))}</div>
                )}
            </div>
        );
    };

    return <>{nodes.map(node => renderNode(node))}</>;
}


// --- Main Component ---

interface SamplePoolProps {
  userSamples: SampleTree;
  onAddSamples: (samples: SampleTree) => void;
  onSamplePreview: (sample: Sample) => void;
  onToggleFavorite: (id: string) => void;
  onClose: () => void;
}

export const SamplePool: React.FC<SamplePoolProps> = ({ userSamples, onAddSamples, onSamplePreview, onToggleFavorite, onClose }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [currentView, setCurrentView] = useState<{ type: 'folder' | 'favorites', id: string | null }>({ type: 'folder', id: null });

  const handleFileUpload = async (files: FileList | null) => {
    if (!files) return;
    const newNodes: SampleNode[] = [];
    for (const file of Array.from(files)) {
        if (file.type.startsWith('audio/')) {
            newNodes.push({
                id: `file-${Date.now()}-${Math.random()}`,
                type: 'file',
                name: file.name.replace(/\.[^/.]+$/, ""),
                url: URL.createObjectURL(file),
            });
        }
    }
    onAddSamples(newNodes);
  };

  const processEntry = async (entry: FileSystemEntry): Promise<SampleTreeNode | null> => {
      if (entry.isFile) {
          return new Promise<SampleNode | null>((resolve, reject) => {
              (entry as FileSystemFileEntry).file(file => {
                  if (file.type.startsWith('audio/')) {
                      resolve({
                          id: `file-${Date.now()}-${Math.random()}`,
                          type: 'file',
                          name: file.name.replace(/\.[^/.]+$/, ""),
                          url: URL.createObjectURL(file)
                      });
                  } else {
                      resolve(null);
                  }
              }, reject);
          });
      }
      if (entry.isDirectory) {
          const reader = (entry as FileSystemDirectoryEntry).createReader();
          const readEntries = () => new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
          
          let allEntries: FileSystemEntry[] = [];
          let currentEntries;
          do {
              currentEntries = await readEntries();
              allEntries = allEntries.concat(currentEntries);
          } while (currentEntries.length > 0);

          const children = await Promise.all(allEntries.map(processEntry));
          return {
              id: `folder-${Date.now()}-${Math.random()}`,
              type: 'folder',
              name: entry.name,
              children: children.filter((c): c is SampleTreeNode => c !== null)
          };
      }
      return null;
  };
  
  const onDrop = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const items = event.dataTransfer.items;
    if (items && items.length > 0) {
        const entries = Array.from(items).map(item => item.webkitGetAsEntry()).filter(Boolean);
        const processedTree = await Promise.all(entries.map(entry => processEntry(entry as FileSystemEntry)));
        onAddSamples(processedTree.filter((t): t is SampleTreeNode => t !== null));
    }
  }, [onAddSamples]);

  const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  };
  
  const onDragLeave = () => {
    setIsDragOver(false);
  };
  
  const displayedItems = useMemo(() => {
      if (currentView.type === 'favorites') {
          return getFavorites(userSamples);
      }
      return findFolderContents(currentView.id, userSamples);
  }, [currentView, userSamples]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border-color shrink-0 flex items-center justify-between">
        <h2 className="text-xl font-bold">Browser</h2>
         <button onClick={onClose} className="p-1 rounded-md text-secondary hover:text-primary hover:bg-gray-200 transition-colors" title="Close Browser">
            <X size={20} />
        </button>
      </div>
      <div className="flex-grow flex flex-col min-h-0">
          {/* Sidebar */}
          <div className="p-2 border-b border-border-color shrink-0 bg-light-bg/50">
          <button 
                  className={`w-full flex items-center gap-2 p-2 rounded-md font-semibold text-sm mb-2 ${currentView.type === 'favorites' ? 'bg-accent/10 text-accent' : 'hover:bg-gray-200'}`}
                  onClick={() => setCurrentView({ type: 'favorites', id: null })}>
                  <Star size={16} /> Favorites
              </button>
              <button 
                  className={`w-full flex items-center gap-2 p-2 rounded-md font-semibold text-sm mb-2 ${currentView.type === 'folder' && currentView.id === null ? 'bg-accent/10 text-accent' : 'hover:bg-gray-200'}`}
                  onClick={() => setCurrentView({ type: 'folder', id: null })}>
                  <Folder size={16} /> All Files
              </button>
              <div className="border-t border-border-color my-2"/>
              <FolderTreeView nodes={userSamples} onSelectFolder={(id) => setCurrentView({ type: 'folder', id })} currentFolderId={currentView.id} />
          </div>

          {/* Content */}
          <div 
          className="flex-1 p-2 space-y-1.5 overflow-y-auto"
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          >
          <div
              className={`absolute inset-0 z-10 transition-all pointer-events-none flex items-center justify-center bg-accent/10 border-2 border-dashed border-accent rounded-md ${isDragOver ? 'opacity-100' : 'opacity-0'}`}>
              <p className="text-accent font-semibold">Drop files or folders here</p>
          </div>

          <div className="relative border-2 border-dashed rounded-lg p-3 flex items-center justify-center text-center transition-colors border-border-color">
              <UploadCloud size={18} className="text-secondary mr-2" />
              <p className="text-xs text-secondary">Drag & drop files or folders</p>
              <input 
              type="file" 
              multiple 
              accept="audio/*"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
          </div>

          {displayedItems.map((item) => {
              if (item.type === 'file') {
                  return <SampleNodeView key={item.id} sample={item} onPreview={onSamplePreview} onToggleFavorite={onToggleFavorite} />
              }
              if (item.type === 'folder') {
                  return (
                      <div key={item.id} onClick={() => setCurrentView({ type: 'folder', id: item.id })}
                          className="px-2 py-1.5 flex items-center space-x-2 bg-gray-100 rounded-md cursor-pointer border hover:bg-gray-200 transition-colors">
                          <Folder size={16} className="text-secondary shrink-0" />
                          <span className="text-sm font-medium truncate flex-1">{item.name}</span>
                      </div>
                  );
              }
              return null;
          })}

          </div>
      </div>
    </div>
  );
};
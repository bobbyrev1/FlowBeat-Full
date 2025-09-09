

import type { Sample, SerializedSample, SampleTree, SerializedSampleTree, SampleTreeNode, SerializedSampleTreeNode } from '../types';

export const sampleToSerializedSample = async (sample: Sample): Promise<SerializedSample> => {
    // If the URL is already a data URL, return it directly
    if (sample.url.startsWith('data:')) {
        return { name: sample.name, dataUrl: sample.url };
    }
    
    // Otherwise, fetch the blob and convert it
    const response = await fetch(sample.url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            resolve({ name: sample.name, dataUrl: reader.result as string });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const dataUrlToBlobUrl = async (dataUrl: string): Promise<string> => {
    const blob = await (await fetch(dataUrl)).blob();
    return URL.createObjectURL(blob);
};

export const serializedSampleToSample = async (serializedSample: SerializedSample): Promise<Sample> => {
    const url = await dataUrlToBlobUrl(serializedSample.dataUrl);
    return { name: serializedSample.name, url };
};

// --- Tree Serialization/Deserialization ---

export const serializeTree = async (tree: SampleTree): Promise<SerializedSampleTree> => {
    const serializedTree: SerializedSampleTree = [];
    for (const node of tree) {
        if (node.type === 'file') {
            const response = await fetch(node.url);
            const blob = await response.blob();
            const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
            serializedTree.push({
                id: node.id,
                type: 'file',
                name: node.name,
                isFavorite: node.isFavorite,
                dataUrl: dataUrl,
            });
        } else if (node.type === 'folder') {
            serializedTree.push({
                id: node.id,
                type: 'folder',
                name: node.name,
                children: await serializeTree(node.children),
            });
        }
    }
    return serializedTree;
};

export const deserializeTree = async (serializedTree: SerializedSampleTree): Promise<SampleTree> => {
    const tree: SampleTree = [];
    for (const node of serializedTree) {
        if (node.type === 'file') {
            const url = await dataUrlToBlobUrl(node.dataUrl);
            tree.push({
                id: node.id,
                type: 'file',
                name: node.name,
                isFavorite: node.isFavorite,
                url: url,
            });
        } else if (node.type === 'folder') {
            tree.push({
                id: node.id,
                type: 'folder',
                name: node.name,
                children: await deserializeTree(node.children),
            });
        }
    }
    return tree;
};


// Function to convert an AudioBuffer to a WAV file (Blob)
export const bufferToWav = (buffer: AudioBuffer): Blob => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    
    let result: Float32Array;
    if (numChannels === 2) {
        result = interleave(buffer.getChannelData(0), buffer.getChannelData(1));
    } else {
        result = buffer.getChannelData(0);
    }
    
    const dataLength = result.length * (bitDepth / 8);
    const bufferLength = 44 + dataLength;
    const view = new DataView(new ArrayBuffer(bufferLength));

    let offset = 0;
    const writeString = (str: string) => {
        for (let i = 0; i < str.length; i++) {
            view.setUint8(offset + i, str.charCodeAt(i));
        }
    };

    // RIFF header
    writeString('RIFF'); offset += 4;
    view.setUint32(offset, 36 + dataLength, true); offset += 4;
    writeString('WAVE'); offset += 4;

    // "fmt " sub-chunk
    writeString('fmt '); offset += 4;
    view.setUint32(offset, 16, true); offset += 4;
    view.setUint16(offset, format, true); offset += 2;
    view.setUint16(offset, numChannels, true); offset += 2;
    view.setUint32(offset, sampleRate, true); offset += 4;
    view.setUint32(offset, sampleRate * numChannels * (bitDepth / 8), true); offset += 4;
    view.setUint16(offset, numChannels * (bitDepth / 8), true); offset += 2;
    view.setUint16(offset, bitDepth, true); offset += 2;

    // "data" sub-chunk
    writeString('data'); offset += 4;
    view.setUint32(offset, dataLength, true); offset += 4;

    // Write PCM samples
    let C = 1;
    for (let i = 0; i < result.length; i++, offset += 2) {
        C = result[i];
        if (C < 0) C = Math.max(C, -1);
        if (C > 0) C = Math.min(C, 1);
        view.setInt16(offset, C * 32767, true);
    }

    return new Blob([view], { type: 'audio/wav' });
};

function interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
    const length = inputL.length + inputR.length;
    const result = new Float32Array(length);
    let index = 0, inputIndex = 0;
    while (index < length) {
        result[index++] = inputL[inputIndex];
        result[index++] = inputR[inputIndex];
        inputIndex++;
    }
    return result;
}
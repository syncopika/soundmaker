export interface ExtendedAudioNode extends AudioNode {
	id: string;
};

export interface ExtendedAudioBufferSourceNode extends AudioBufferSourceNode {
    id: string;
}

export type AudioStoreNode = {
    'node': ExtendedAudioNode, 
    'feedsInto': ExtendedAudioNode[],
    'feedsFrom': ExtendedAudioNode[]
};

// https://stackoverflow.com/questions/57264080/typescript-array-of-specific-string-values
export type NodeTypes = "waveNode" |
                 "biquadFilterNode" |
                 "noiseNode" |
                 "gainNode" |
                 "ADSREnvelope";
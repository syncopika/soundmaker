import { ADSREnvelope } from "./ADSREnvelope";

/* export interface ExtendedAudioNode extends AudioNode {
	id: string;
}; */

export interface ExtendedAudioParam extends AudioParam {
    baseValue: number;
}

export interface ExtendedAudioBufferSourceNode extends AudioBufferSourceNode {
    id: string;
};

export interface ExtendedOscillatorNode extends OscillatorNode {
    id: string;
};

// replace the default 'gain' property (which is an AudioParam) with our extended version
export interface ExtendedGainNode extends GainNode, Omit<AudioParam, 'gain'> {
    id: string;
    gain: ExtendedAudioParam;
};

export interface ExtendedBiquadFilterNode extends BiquadFilterNode {
    id: string;
};

export interface AudioStoreNode {
    'node': any,
    'feedsInto': string[],
    'feedsFrom': string[]
};

// https://stackoverflow.com/questions/57264080/typescript-array-of-specific-string-values
export type NodeTypes = "waveNode" |
                 "biquadFilterNode" |
                 "noiseNode" |
                 "gainNode" |
                 "ADSREnvelope";
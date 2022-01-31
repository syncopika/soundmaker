import { ADSREnvelope } from "./ADSREnvelope";

export interface ExtendedAudioParam extends AudioParam {
    baseValue: number;
}

export interface ExtendedAudioBufferSourceNode extends AudioBufferSourceNode {
    id: string;
};

// added a custom property called channelData
// so we can export more easily
export interface AudioBufferParameters {
    duration: number;
    length: number;
    numberOfChannels: number;
    sampleRate: number;
    channelData: Float32Array;
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
    'node': any; // TODO: don't use any?
    'feedsInto': string[];
    'feedsFrom': string[];
};

// https://stackoverflow.com/questions/57264080/typescript-array-of-specific-string-values
export type NodeTypes = "waveNode" |
                 "biquadFilterNode" |
                 "noiseNode" |
                 "gainNode" |
                 "ADSREnvelope";
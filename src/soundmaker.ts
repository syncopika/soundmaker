import { NodeFactory } from "./NodeFactory";
import { ADSREnvelope } from "./ADSREnvelope";
import { ExtendedGainNode, AudioStoreNode } from "./types";
import {
    exportPreset,
    importPreset,
    loadDemoPreset
} from "./utils";

const NOTE_FREQ: Record<string, number> = {
    "C8": 4186.01,
    "B7": 3951.07,
    "Bb7": 3729.31,
    "A#7": 3729.31,
    "A7": 3520.00,
    "Ab7": 3322.44,
    "G#7": 3322.44,
    "G7": 3135.96,
    "Gb7": 2959.96,
    "F#7": 2959.96,
    "F7": 2793.83,
    "E7": 2637.02,
    "Eb7": 2489.02,
    "D#7": 2489.02,
    "D7": 2349.32,
    "Db7": 2217.46,
    "C#7": 2217.46,

    "C7": 2093.00,
    "B6": 1975.53,
    "Bb6": 1864.66,
    "A#6": 1864.66,
    "A6": 1760.00,
    "Ab6": 1661.22,
    "G#6": 1661.22,
    "G6": 1567.98,
    "Gb6": 1479.98,
    "F#6": 1479.98,
    "F6": 1396.91,
    "E6": 1318.51,
    "Eb6": 1244.51,
    "D#6": 1244.51,
    "D6": 1174.66,
    "Db6": 1108.73,
    "C#6": 1108.73,
    "C6": 1046.50,

    "B5": 987.77,
    "Bb5": 932.33,
    "A#5": 932.33,
    "A5": 880.00,
    "Ab5": 830.61,
    "G#5": 830.61,
    "G5": 783.99,
    "Gb5": 739.99,
    "F#5": 739.99,
    "F5": 698.46,
    "E5": 659.25,
    "Eb5": 622.25,
    "D#5": 622.25,
    "D5": 587.33,
    "Db5": 554.37,
    "C#5": 554.37,
    "C5": 523.25,

    "B4": 493.88,
    "Bb4": 466.16,
    "A#4": 466.16,
    "A4": 440.00,
    "Ab4": 415.30,
    "G#4": 415.30,
    "G4": 392.00,
    "Gb4": 369.99,
    "F#4": 369.99,
    "F4": 349.23,
    "E4": 329.63,
    "Eb4": 311.13,
    "D#4": 311.13,
    "D4": 293.66,
    "Db4": 277.18,
    "C#4": 277.18,
    "C4": 261.63,
    
    "B3": 246.94,
    "Bb3": 233.08,
    "A#3": 233.08,
    "A3": 220.00,
    "Ab3": 207.63,
    "G#3": 207.63,
    "G3": 196.00,
    "Gb3": 185.00,
    "F#3": 185.00,
    "F3": 174.61,
    "E3": 164.81,
    "Eb3": 155.56,
    "D#3": 155.56,
    "D3": 146.83,
    "Db3": 138.59,
    "C#3": 138.59,
    "C3": 130.81,
    
    "B2": 123.47,
    "Bb2": 116.54,
    "A#2": 116.54,
    "A2": 110.00,
    "Ab2": 103.83,
    "G#2": 103.83,
    "G2": 98.00,
    "Gb2": 92.50,
    "F#2": 92.50,
    "F2": 87.31,
    "E2": 82.41,
    "Eb2": 77.78,
    "D#2": 77.78,
    "D2": 73.42,
    "Db2": 69.30,
    "C#2": 69.30,
    "C2": 65.41
};

// maybe move all the UI handling stuff to another class that will be comprised of the nodefactory class?
class SoundMaker {
    nodeFactory: NodeFactory;
    
    constructor(){
        this.nodeFactory = new NodeFactory();
        this.nodeFactory.suspend(); // need to suspend audio context (which a node factory is) initially
        
        // store the audio context's destination as a node
        this.nodeFactory._storeNode(
            this.nodeFactory.destination, 
            this.nodeFactory.destination.constructor.name
        );
    }
}

function processNote(noteFreq: number, nodeFactory: NodeFactory): OscillatorNode[] {
    // this is used to create and use new nodes each time a note needs to be played
    const nodeStore = nodeFactory.nodeStore;

    // probably should look at not just osc nodes but those with 0 input.
    // i.e. OscillatorNodes, AudioBufferSourceNodes
    const oscNodes = nodeFactory.getOscNodes();
    
    const nodesToStart : OscillatorNode[] = [];
    oscNodes.forEach((osc) => {
        // create a new osc node from the template props
        const oscTemplateNode = nodeStore[osc].node;
        const templateProps: Record<string, any> = {};
        
        // TODO: do we really need to extract values for AudioParams like this?
        Object.keys(Object.getPrototypeOf(oscTemplateNode)).forEach((propName) => {
            const prop = oscTemplateNode[propName];
            templateProps[propName] = (prop.value !== undefined) ? prop.value : prop;
            
            if(propName === "frequency"){
                templateProps[propName] = noteFreq;
            }
        });
        
        // the audio node constructors are accessible via the window object
        // TODO: try solving TS2351? (don't cast window as any)
        const newOsc = new ((window as any)[oscTemplateNode.constructor.name])(nodeFactory, templateProps);
        nodesToStart.push(newOsc);
        
        // need to go down all the way to each node and make connections
        // gain nodes don't need to be touched as they're already attached to the context dest by default
        const connections = nodeStore[osc].feedsInto;
        connections.forEach((conn) => {
            // connect the new osc node to this node which will act as a sink (the new osc -> this node)
            const sinkNode = nodeStore[conn].node;
            
            newOsc.connect(sinkNode);
            
            // if sink is a gain node, no need to go further
            if(sinkNode.id.indexOf("Gain") < 0){
                let stack: string[] = nodeStore[sinkNode.id]["feedsInto"];
                let newSource = sinkNode;
                
                while(stack.length > 0){
                    const next = stack.pop() as string;
                    const currSink = nodeStore[next].node;
                    console.log("connecting: " + newSource.constructor.name + " to: " + currSink.constructor.name);
                    
                    newSource.connect(currSink);
                    newSource = currSink;
                    const nextConnections = nodeStore[next]["feedsInto"].filter((name: string) => name.indexOf("Destination") < 0);
                    stack = stack.concat(nextConnections);
                }
            }
        });
    });
    
    const time = nodeFactory.currentTime;
    const gainNodes = nodeFactory.getGainNodes();

    gainNodes.forEach((gain) => {
        // we need to understand the distinction of connecting to another node vs. connecting to an AudioParam of another node!
        // maybe use dotted lines?
        const gainNode = gain.node;
        const adsr = getADSRFeed(gain);
        if(adsr){
            // if an adsr envelope feeds into this gain node, run the adsr function on the gain
            const envelope = nodeStore[adsr].node;
            envelope.applyADSR(gainNode.gain, time);
        }else{
            gainNode.gain.setValueAtTime(gainNode.gain.value, time);
        }
    });
    
    return nodesToStart;
}

function getADSRFeed(sinkNode: AudioStoreNode): string | null {
    // check if sinkNode has an ADSR envelope
    const feedsFrom = sinkNode.feedsFrom;
    for(let i = 0; i < feedsFrom.length; i++){
        const source = feedsFrom[i];
        if(source.indexOf("ADSR") >= 0){
            return source; // return name of ADSR envelope
        }
    };
    return null;
}

function setupButtons(){
    document.getElementById('addWavNode')!.addEventListener('click', (evt: MouseEvent) => {
        soundMaker.nodeFactory.addNewNode("waveNode");
    });

    document.getElementById('addGainNode')!.addEventListener('click', (evt: MouseEvent) => {
        soundMaker.nodeFactory.addNewNode("gainNode");
    });

    document.getElementById('addNoiseNode')!.addEventListener('click', (evt: MouseEvent) => {
        soundMaker.nodeFactory.addNewNode("noiseNode");
    });

    document.getElementById('addFilterNode')!.addEventListener('click', (evt: MouseEvent) => {
        soundMaker.nodeFactory.addNewNode("biquadFilterNode");
    });

    document.getElementById('addADSRNode')!.addEventListener('click', (evt: MouseEvent) => {
        soundMaker.nodeFactory.addNewNode("ADSREnvelope");
    });

    document.getElementById('download')!.addEventListener('click', (evt: MouseEvent) => {
        exportPreset(soundMaker.nodeFactory);
    });

    document.getElementById('import')!.addEventListener('click', (evt: MouseEvent) => {
        importPreset(soundMaker.nodeFactory);
    });

    document.getElementById('demos')!.addEventListener('change', (evt: Event) => {
        const selectElement = <HTMLSelectElement>evt.target;
        const presetName = selectElement.options[selectElement.selectedIndex].value;
        if(presetName !== ""){
            loadDemoPreset(presetName, soundMaker.nodeFactory);
        }
    });

    document.getElementById('toggleViz')!.addEventListener('click', (evt: MouseEvent) => {
        //const style = window.getComputedStyle(e.target);
        //console.log(style.getPropertyValue('border'));
        const borderStyle = (<HTMLElement>evt.target).style.border;
        if(!borderStyle || borderStyle === '3px solid rgb(0, 204, 0)'){
            (<HTMLElement>evt.target).style.border = '3px solid rgb(204, 0, 0)';
            (<HTMLElement>evt.target).textContent = 'off';
            
            // stop visualization
            window.cancelAnimationFrame(doVisualization);
            
            // clear canvas
            canvasCtx!.clearRect(0, 0, canvas.width, canvas.height);
        }else{
            (<HTMLElement>evt.target).style.border = '3px solid rgb(0, 204, 0)';
            (<HTMLElement>evt.target).textContent = 'on';
            
            // start visualization
            doVisualization = requestAnimationFrame(runViz);
        }
    });
}



//////////////// SET UP  ///////////////////
const soundMaker = new SoundMaker();
const notes = [...document.getElementsByClassName("note")] as SVGElement[];
let currPlayingNodes : OscillatorNode[] = [];

setupButtons();
soundMaker.nodeFactory.createAudioContextDestinationUI(document.getElementById("nodeArea")!);


// set up the keyboard for playing notes
function setupKeyboard(notes: SVGElement[], nodeFactory: NodeFactory){
    const audioContext = nodeFactory;
    
    function stopPlay(evt: MouseEvent){
        if(evt.target){
            (<HTMLElement>evt.target).style.stroke = "#000000";
            (<HTMLElement>evt.target).style.strokeWidth = "0.264583px";
        }
        
        let maxEndTime = audioContext.currentTime;
        
        // apply adsr release, if any
        const gainNodes = nodeFactory.getGainNodes();
        gainNodes.forEach((gain) => {
            const gainNode = <ExtendedGainNode>gain.node;
            const adsr = getADSRFeed(gain);
            if(adsr){
                const envelope = <ADSREnvelope>nodeFactory.nodeStore[adsr].node;
                gainNode.gain.linearRampToValueAtTime(0.0, audioContext.currentTime + envelope.release);
                maxEndTime = Math.max(audioContext.currentTime + envelope.release, maxEndTime);
                
                // also reset gain value back to whatever it's currently set at
                gainNode.gain.setValueAtTime(gainNode.gain.baseValue, audioContext.currentTime + envelope.release + 0.01);
            }else{
                // slightly buggy: if you remove an ADSR envelope, the next time a note is played the gain value will be at
                // wherever the ADSR left off (but after that the volume will be correct as it'll use the base value)
                // maybe we should fix gain stuff on mousedown instead?
                gainNode.gain.setValueAtTime(gainNode.gain.baseValue, audioContext.currentTime);
            }
        });

        currPlayingNodes.forEach((osc) => {
            osc.stop(maxEndTime);
        });
    }
    
    notes.forEach((note) => {
        note.addEventListener('mouseleave', stopPlay);
        note.addEventListener('mouseup', stopPlay);
        note.addEventListener('mousedown', (evt) => {
            // highlight the key outline on the svg keyboard when pressed
            if(evt.buttons === 1){
                (<SVGElement>evt.target).style.stroke = "#2470FC";
                (<SVGElement>evt.target).style.strokeWidth = "0.6px";
                audioContext.resume().then(() => {
                    const noteFreq = NOTE_FREQ[note.id + (<HTMLInputElement>document.getElementById('octaveSelect')).value];
                    currPlayingNodes = processNote(noteFreq, nodeFactory);
                    currPlayingNodes.forEach((osc) => {
                        osc.start(0);
                    });
                });
            }
        });
    });
}
setupKeyboard(notes, soundMaker.nodeFactory);


// setup for audio visualization
// TODO: do something about these global variables? kinda messy
soundMaker.nodeFactory.analyserNode.fftSize = 2048;
const bufferLen: number = soundMaker.nodeFactory.analyserNode.frequencyBinCount;
const dataArray = new Uint8Array(bufferLen);

const canvas: HTMLCanvasElement = document.getElementById('vizCanvas') as HTMLCanvasElement;
const canvasCtx = canvas!.getContext('2d');
canvasCtx!.clearRect(0, 0, canvas!.width, canvas!.height);

// https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Visualizations_with_Web_Audio_API
let doVisualization: number = requestAnimationFrame(runViz); // keep the request id around to be able to cancel if needed
function runViz(){
    const width = (canvas as HTMLCanvasElement).width;
    const height = (canvas as HTMLCanvasElement).height;
    
    if(canvasCtx){
        soundMaker.nodeFactory.analyserNode.getByteTimeDomainData(dataArray);
        canvasCtx.fillStyle = 'rgb(200, 200, 200)';
        canvasCtx.fillRect(0, 0, width, height);
        canvasCtx.lineWidth = 2;
        canvasCtx.strokeStyle = 'rgb(0, 0, 0)';
        canvasCtx.beginPath();
        
        const sliceWidth = width / bufferLen;
        let xPos = 0;
        
        for(let i = 0; i < bufferLen; i++){
            const dataVal = dataArray[i] / 128.0; // why 128?
            const yPos = dataVal * (height/2);
            
            if(i === 0){
                canvasCtx!.moveTo(xPos, yPos);
            }else{
                canvasCtx!.lineTo(xPos, yPos);
            }
            
            xPos += sliceWidth;
        }
        
        canvasCtx.stroke();
        
        doVisualization = requestAnimationFrame(runViz);
    }
}


///////// TESTS
// TODO: move to separate file
function Test1(){
    let sm = new SoundMaker();
    console.log(sm.nodeFactory !== undefined);
    
    let nf = sm.nodeFactory;
    nf.addNewNode("waveNode", false); 
    console.log(Object.keys(nf.nodeStore).length === 1);
    console.log(Object.keys(nf.nodeStore)[0] === "OscillatorNode1");
    console.log(nf.nodeCounts["OscillatorNode"] === 1);
}
//Test1();

import { ADSREnvelope } from "./ADSREnvelope";
import {
    ExtendedOscillatorNode,
    ExtendedAudioBufferSourceNode,
    ExtendedBiquadFilterNode,
    ExtendedGainNode,
    ExtendedAudioParam,
    AudioStoreNode,
    NodeTypes,
} from "./types";
import {
    drawLineBetween,
    showParameterEditWindow
} from "./utils";


export class NodeFactory extends AudioContext {
    
    nodeColors: Record<string, string>;
    nodeStore: Record<string, AudioStoreNode>; // TODO: something more specific than any
    nodeCounts: Record<string, any>; // TODO: this too?
    valueRanges: Record<string, any>;
    analyserNode: any;
    
    constructor(){
        super();
        
        this.nodeColors = {}; // different background color for each kind of node element?
        this.nodeStore = {};  // store refs for nodes
        
        // create an analyser node for visualizing the sounds
        this.analyserNode = this.createAnalyser();
        this.analyserNode.connect(this.destination);
        
        // keep track of count of each unique node for id creation
        this.nodeCounts = {
            // store this function and the node count of diff node types in same object
            // use nodeName if supplied
            'addNode': function(node: (
                ExtendedOscillatorNode |
                ExtendedAudioBufferSourceNode |
                ExtendedBiquadFilterNode |
                ExtendedGainNode |
                ADSREnvelope
            )){
                const nodeType = node.constructor.name;
                
                // just keeping count here
                if(this[nodeType]){
                    this[nodeType]++;
                }else{
                    this[nodeType] = 1;
                }

                return this[nodeType];
            },
            'deleteNode': function(node: (
                ExtendedOscillatorNode |
                ExtendedAudioBufferSourceNode |
                ExtendedBiquadFilterNode |
                ExtendedGainNode |
                ADSREnvelope
            ), nodeName=null){
                const nodeType = node.constructor.name;
                this[nodeType]--;
                return this[nodeType];
            }
        };
        
        // for deciding the ranges and stuff for certain parameter values
        this.valueRanges = {
            "OscillatorNode": {
                "detune": {
                    "min": -1200, 
                    "default": 0,
                    "max": 1200,
                    "step": 1
                },
                "frequency": {
                    "min": 300,
                    "default": 440, 
                    "max": 1000, 
                    "step": 1
                }
            },
            "GainNode": {
                "gain": {
                    "min": 0, 
                    "default": 0.3,
                    "max": 2,
                    "step": 0.05
                }
            },
            "AudioBufferSourceNode": {
                "detune": {
                    "min": -1200, 
                    "default": 0,
                    "max": 1200,
                    "step": 1
                }
            },
            "BiquadFilterNode": {
                "gain": {
                    "max": 40,
                    "min": -40,
                    "default": 0,
                    "step": 1
                },
                "Q": {
                    "max": 1000,
                    "min": 0.0001,
                    "default": 1,
                    "step": .05
                },
                "detune": {
                    "min": -1200, 
                    "default": 0,
                    "max": 1200,
                    "step": 1
                },
                "frequency": {
                    "min": 300,
                    "default": 440, 
                    "max": 1000, 
                    "step": 1
                }
            },
            "ADSREnvelope": {
                "attack": {
                    "min": 0,
                    "default": 0,
                    "max": 1,
                    "step": 0.01
                },
                "sustain": {
                    "min": 0,
                    "default": 0,
                    "max": 1,
                    "step": 0.01
                },
                "sustainLevel": {
                    "min": 0,
                    "default": 0,
                    "max": 1,
                    "step": 0.01
                },
                "decay": {
                    "min": 0,
                    "default": 0,
                    "max": 1,
                    "step": 0.01
                },
                "release": {
                    "min": 0,
                    "default": 0,
                    "max": 10,
                    "step": 0.01
                },
            },
            "waveType": [
                "sine",
                "square",
                "triangle",
                "sawtooth"
            ],
            "filterType": [
                "lowpass",
                "highpass",
                "allpass",
                "bandpass",
                "notch",
                "peaking",
                "lowshelf",
                "highshelf"
            ],
        }
    } // end constructor
    
    getGainNodes(): AudioStoreNode[] {
        return [...Object.keys(this.nodeStore)]
                .filter((key) => key.indexOf("Gain") >= 0)
                .map((gainId) => this.nodeStore[gainId]);
    }
    
    getOscNodes(): string[] {
        return [...Object.keys(this.nodeStore)]
                .filter((key) => key.indexOf("Oscillator") >= 0 || key.indexOf("AudioBuffer") >= 0);
    }
    
    createAudioContextDestinationUI(parentElement: HTMLElement){
        const audioCtxDest = document.createElement('div');
        audioCtxDest.id = this.destination.constructor.name;
        audioCtxDest.style.border = "1px solid #000";
        audioCtxDest.style.borderRadius = "20px 20px 20px 20px";
        audioCtxDest.style.padding = "5px";
        audioCtxDest.style.width = "200px";
        audioCtxDest.style.height = "200px";
        audioCtxDest.style.textAlign = "center";
        audioCtxDest.style.position = "absolute";
        audioCtxDest.style.top = "20%";
        audioCtxDest.style.left = "45%";
        audioCtxDest.style.zIndex = "10";
        
        const title = document.createElement("h2");
        title.textContent = "audio context destination";
        audioCtxDest.appendChild(title);
        parentElement.appendChild(audioCtxDest);
    }
    
    // delete all nodes
    reset(){
        const nodeArea = document.getElementById("nodeArea");
        if(nodeArea){
            for(let nodeId in this.nodeStore){
                if(nodeId !== "AudioDestinationNode"){
                    this._deleteNode(this.nodeStore[nodeId].node, nodeArea);
                }
            }
        }
    }
    
    _addBaseValueProp(node: (
        ExtendedOscillatorNode |
        ExtendedAudioBufferSourceNode |
        ExtendedBiquadFilterNode |
        ExtendedGainNode
    )){
        // TODO: TS7053 - need to fix
        for(const prop in node){
            if(node[prop] && node[prop].value){
                node[prop].baseValue = node[prop].value;
            }
        }
        /*
        for(const [propName, value] of Object.entries(node)){
            const nodeProp = value;
            if(nodeProp.value){
                console.log(nodeProp.value);
                nodeProp.baseValue = nodeProp.value;
            }
        }*/
    }
    
    // store a node in this.nodeStore
    _storeNode(node: (
        ExtendedAudioBufferSourceNode | 
        ExtendedOscillatorNode | 
        ExtendedGainNode | 
        ExtendedBiquadFilterNode | 
        ADSREnvelope | 
        AudioDestinationNode
        ), 
        nodeName: string
    ){
        // feedsInto would be an array of strings, where each string is a node's name
        this.nodeStore[nodeName] = {
            'node': node, 
            'feedsInto': [],
            'feedsFrom': []
        };
    }
    
    // methods for node creation. I'm thinking of them as 'private' methods because
    // they'll be used in other methods that are more useful and should be called on a NodeFactory instance
    _createWaveNode(): ExtendedOscillatorNode {
        // REMEMBER THAT OSCILLATOR NODES CAN ONLY BE STARTED/STOPPED ONCE!
        // when a note is played multiple times, each time a new oscillator needs to 
        // be created. but we can save the properties of the oscillator and reuse that data.
        // so basically we create a dummy oscillator for the purposes of storing information (as a template)
        const osc = this.createOscillator() as ExtendedOscillatorNode; // createOscillator comes from AudioContext
        
        // default params 
        osc.frequency.value = 440; // A @ 440 Hz
        osc.detune.value = 0;
        osc.type = "sine";
        osc.id = (osc.constructor.name + this.nodeCounts.addNode(osc));
        
        this._addBaseValueProp(osc);
        return osc;
    }
    
    // audio buffer source node
    _createNoiseNode(): ExtendedAudioBufferSourceNode {
        // allow user to pass in the contents of the noise buffer as a list if they want to?
        const noise = this.createBufferSource() as ExtendedAudioBufferSourceNode;
        
        // assign random noise first, but let it be customizable
        const bufSize = this.sampleRate; // customizable?
        const buffer = this.createBuffer(1, bufSize, bufSize);
        
        const output = buffer.getChannelData(0);
        for(let i = 0; i < bufSize; i++){
            output[i] = Math.random() * 2 - 1;
        }
        
        this._addBaseValueProp(noise);
        
        noise.buffer = buffer;
        noise.loop = true;
        noise.id = (noise.constructor.name + this.nodeCounts.addNode(noise));
        return noise;
    }
    
    _createGainNode(): ExtendedGainNode {
        const gainNode = this.createGain() as ExtendedGainNode;
        
        // gain will always need to attach to analyser node (which is connected to destination)
        gainNode.connect(this.analyserNode);
        gainNode.gain.value = this.valueRanges.GainNode.gain.default;
        
        // use this property to remember the desired base volume value
        this._addBaseValueProp(gainNode);
        
        gainNode.id = gainNode.constructor.name + this.nodeCounts.addNode(gainNode);
        return gainNode;
    }
    
    // create a biquadfilter node
    _createBiquadFilterNode(): ExtendedBiquadFilterNode {
        const bqFilterNode = this.createBiquadFilter() as ExtendedBiquadFilterNode;
        
        bqFilterNode.frequency.value = 440;
        bqFilterNode.detune.value = 0;
        bqFilterNode.gain.value = 0;
        bqFilterNode.Q.value = 1;
        bqFilterNode.type = "lowpass";
        
        this._addBaseValueProp(bqFilterNode);
        
        // need to add to nodeCounts
        bqFilterNode.id = bqFilterNode.constructor.name + this.nodeCounts.addNode(bqFilterNode);
        return bqFilterNode;
    }
    
    // attack, decay, sustain, release envelope node
    // this will target the params of another node like Oscillator or BiquadFilter or Gain 
    // for now we should keep this very simple! :)
    _createADSREnvelopeNode(): ADSREnvelope {
        const envelope = new ADSREnvelope();
        envelope.id = "ADSREnvelope" + this.nodeCounts.addNode(envelope);
        return envelope;
    }
    
    _deleteNode(node: (
        ExtendedAudioBufferSourceNode | 
        ExtendedOscillatorNode | 
        ExtendedGainNode | 
        ExtendedBiquadFilterNode | 
        ADSREnvelope
    ), nodeArea: HTMLElement){
        const nodeName = node.id;
        const nodeToDelete = this.nodeStore[nodeName].node;
        
        // decrement count 
        this.nodeCounts.deleteNode(node);
        
        // unhook all connections in the UI
        const connectionsTo = this.nodeStore[nodeName].feedsInto;
        if(connectionsTo){
            connectionsTo.forEach((connection) => {
                // remove the UI representation of the connection
                const svg = document.getElementById("svgCanvas:" + nodeName + ":" + connection);
                if(svg){
                    nodeArea.removeChild(svg);
                }
                
                // also remove the reference of the node being deleted from this connected node's feedsFrom
                const targetFeedsFrom = this.nodeStore[connection].feedsFrom;
                this.nodeStore[connection].feedsFrom = targetFeedsFrom.filter(node => node !== nodeName);
            });
        }
        
        const connectionsFrom = this.nodeStore[nodeName].feedsFrom;
        if(connectionsFrom){
            connectionsFrom.forEach((connection) => {
                const svg = document.getElementById("svgCanvas:" + connection + ":" + nodeName);
                if(svg){
                    nodeArea.removeChild(svg);
                }
                
                // also remove the reference of the node being deleted from this connected node's feedsInto
                const targetFeedsInto = this.nodeStore[connection].feedsInto;
                this.nodeStore[connection].feedsInto = targetFeedsInto.filter(node => node !== nodeName);
            });
        }
        
        // remove it 
        delete this.nodeStore[nodeName];
        
        // clear UI
        const nodeElement = document.getElementById(nodeName);
        if(nodeElement){
            nodeArea.removeChild(nodeElement);
        }
    }
    
    _addNodeToInterface(node: (
            ExtendedAudioBufferSourceNode |
            ExtendedOscillatorNode |
            ExtendedGainNode |
            ExtendedBiquadFilterNode |
            ADSREnvelope
        ),
        nodeArea: HTMLElement,
        x='100px', 
        y='100px'
    ){
        // place randomly in designated area?
        const uiElement = this._createNodeUIElement(node);
        uiElement.style.top = x;
        uiElement.style.left = y;
        nodeArea.appendChild(uiElement);
    }
    
    _createNodeUIElement(node: (
        ExtendedAudioBufferSourceNode |
        ExtendedOscillatorNode |
        ExtendedGainNode |
        ExtendedBiquadFilterNode |
        ADSREnvelope
    )){
        // add event listener to allow it to be hooked up to another node if possible
        const uiElement = document.createElement('div');
        uiElement.style.backgroundColor = "#fff";
        uiElement.style.zIndex = "10";
        uiElement.style.position = 'absolute';
        uiElement.style.border = '1px solid #000';
        uiElement.style.borderRadius = '20px 20px 20px 20px';
        uiElement.style.padding = '5px';
        uiElement.style.textAlign = 'center';
        uiElement.classList.add("nodeElement");
        uiElement.id = node.id;
        
        const nodeInfo = this.nodeStore[node.id];
        
        uiElement.addEventListener("mousedown", (evt: MouseEvent) => {
            const offsetX = evt.clientX - uiElement.offsetLeft + window.pageXOffset;
            const offsetY = evt.clientY - uiElement.offsetTop + window.pageYOffset;
    
            function moveHelper(x: number, y: number){
                uiElement.style.left = (x + 'px');
                uiElement.style.top = (y + 'px');
                
                if(nodeInfo.feedsInto){
                    nodeInfo.feedsInto.forEach((connection: string) => {
                        const svg = document.getElementById("svgCanvas:" + uiElement.id + ":" + connection);
                        if(svg !== null){
                            document.getElementById("nodeArea")!.removeChild(svg);
                        }
                        const connect = document.getElementById(connection);
                        if(connect !== null){
                            if(uiElement.id.indexOf("ADSR") >= 0){
                                drawLineBetween(uiElement, connect, true);
                            }else{
                                drawLineBetween(uiElement, connect);
                            }
                        }
                    });
                }
                
                if(nodeInfo.feedsFrom){
                    nodeInfo.feedsFrom.forEach((connection: string) => {
                        const svg = document.getElementById("svgCanvas:" + connection + ":" + uiElement.id);
                        if(svg !== null){
                            document.getElementById("nodeArea")!.removeChild(svg);
                        }
                        const connect = document.getElementById(connection);
                        if(connect !== null){
                            if(connection.indexOf("ADSR") >= 0){
                                drawLineBetween(connect, uiElement, true);
                            }else{
                                drawLineBetween(connect, uiElement);
                            }
                        }
                    });
                }
            }
    
            function moveNode(evt: MouseEvent){
                evt.stopPropagation();
                if(!(<HTMLElement>evt.target)!.classList.contains("nodeElement")){
                    return;
                }
                moveHelper((evt.pageX - offsetX), (evt.pageY - offsetY));
            }
            
            document.addEventListener("mousemove", moveNode);
            
            uiElement.addEventListener("mouseup", (evt: MouseEvent) => {
                document.removeEventListener("mousemove", moveNode);
            });
        });
        
        uiElement.addEventListener('dblclick', (evt: MouseEvent) => {
            // display menu for this node to edit params 
            showParameterEditWindow(nodeInfo, this.valueRanges);
        });
        
        // add the name of the node
        const name = document.createElement('h4');
        name.textContent = node.id;
        uiElement.appendChild(name);
        
        // connect-to-other-nodes functionality 
        const connectButton = document.createElement('button');
        connectButton.textContent = "connect to another node";
        connectButton.addEventListener("click", (evt) => {
            function selectNodeToConnectHelper(
                evt: MouseEvent, 
                source: HTMLElement,
                nodeStore: Record<string, AudioStoreNode>
            ){
                let target = <HTMLElement>evt.target;
                if(target && !target.classList.contains("nodeElement") && target.parentNode){
                    target = target.parentNode as HTMLElement;
                }
                
                // if the target is still not a node element, return
                if(target && !target.classList.contains("nodeElement")){
                    return; 
                }
                
                // if the target does not accept inputs (using the built-in numberOfInputs prop),
                // also return
                if(nodeStore[target.id].node.numberOfInputs < 1){
                    return;
                }
                
                target.style.backgroundColor = "#fff";
                
                // update node's connections in nodeStore
                // store the target, or the sink for this source, html id 
                // make it a bidrectional graph -> the node that gets fed 
                // should also know the nodes that feed into it.
                const sourceConnections = nodeStore[source.id];
                sourceConnections["feedsInto"].push(target.id);
                
                const destConnections = nodeStore[target.id];
                destConnections["feedsFrom"].push(source.id);
                
                // update UI to show link between nodes
                if(source.id.indexOf("ADSR") >= 0){
                    drawLineBetween(source, target, true);
                }else{
                    drawLineBetween(source, target);
                }
                
                // remove the event listeners needed to form the new connection 
                // from all the nodes
                [...Object.keys(nodeStore)].forEach((node) => {
                    if(node !== source.id){
                        const otherNode = document.getElementById(node);
                        if(otherNode !== null){
                            otherNode.removeEventListener("mouseover", mouseoverNode);
                            otherNode.removeEventListener("mouseleave", mouseleaveNode);
                            otherNode.removeEventListener("click", selectNodeToConnectTo);
                        }
                    }
                });
            }
            
            const nodeStore = this.nodeStore;
            function selectNodeToConnectTo(evt: MouseEvent){
                selectNodeToConnectHelper(evt, uiElement, nodeStore);
            }
            
            function mouseoverNode(evt: MouseEvent){
                // highlight the node being hovered over
                if((<HTMLElement>evt.target)!.classList.contains("nodeElement")){
                    (<HTMLElement>evt.target).style.backgroundColor = "#ffcccc";
                }
            }
            
            function mouseleaveNode(evt: MouseEvent){
                if((<HTMLElement>evt.target)!.classList.contains("nodeElement")){
                    (<HTMLElement>evt.target).style.backgroundColor = "#fff";
                }
            }
            
            function cancelConnectionHelper(
                evt: Event, 
                source: HTMLElement, 
                nodeStore: Record<string, AudioStoreNode>
            ){
                evt.preventDefault();
                [...Object.keys(nodeStore)].forEach((node) => {
                    if(node !== source.id){
                        const otherNode = document.getElementById(node);
                        if(otherNode !== null){
                            otherNode.removeEventListener("mouseover", mouseoverNode);
                            otherNode.removeEventListener("mouseleave", mouseleaveNode);
                            otherNode.removeEventListener("click", selectNodeToConnectTo);
                            otherNode.style.backgroundColor = "#fff";
                        }
                    }
                });
                document.body.removeEventListener("contextmenu", cancelConnection);
            }
            
            function cancelConnection(evt: Event){
                cancelConnectionHelper(evt, uiElement, nodeStore);
            }
            document.body.addEventListener("contextmenu", cancelConnection);
            
            // TODO: set up rules to determine which kinds of nodes this one can feed into!
            // add an event listener for all node elements that this node could connect with 
            [...Object.keys(nodeStore)].forEach((node) => {
                if(node !== uiElement.id){            
                    const otherNode = document.getElementById(node);
                    if(otherNode !== null){
                        otherNode.addEventListener("mouseover", mouseoverNode);
                        otherNode.addEventListener("mouseleave", mouseleaveNode);
                        otherNode.addEventListener("click", selectNodeToConnectTo);
                    }
                }
            })
        });
        uiElement.appendChild(connectButton);
        uiElement.appendChild(document.createElement('br'));
        
        // delete node functionality
        const deleteButton = document.createElement('button');
        deleteButton.textContent = "delete";
        deleteButton.addEventListener('click', (evt) => {
            const nodeArea = document.getElementById("nodeArea");
            if(nodeArea){
                this._deleteNode(node, nodeArea);
            }
        });
        
        uiElement.appendChild(deleteButton);
        
        return uiElement;
    }
    
    // create and add a new wave node to the interface
    addNewNode(nodeType: NodeTypes, addToInterface=true){
        // create the node object
        let newNode = null;
        
        if(nodeType === "waveNode"){
            newNode = this._createWaveNode();
        }else if(nodeType === "biquadFilterNode"){
            newNode = this._createBiquadFilterNode();
        }else if(nodeType === "noiseNode"){
            newNode = this._createNoiseNode();
        }else if(nodeType === "gainNode"){
            newNode = this._createGainNode();
        }else if(nodeType === "ADSREnvelope"){
            newNode = this._createADSREnvelopeNode();
        }else{
            console.log("unknown node type!");
            return;
        }
        
        // store it 
        this._storeNode(newNode, newNode.id);
        
        // TODO: this should be a separate function?
        const nodeArea = document.getElementById('nodeArea');
        if(addToInterface && nodeArea) this._addNodeToInterface(newNode, nodeArea);
        
        if(nodeType === "gainNode"){
            // gain node is special :)
            const audioCtx = this.destination.constructor.name;
            this.nodeStore[newNode.id]["feedsInto"] = [audioCtx];
            this.nodeStore[audioCtx]["feedsFrom"].push(newNode.id);
            
            const src = document.getElementById(newNode.id);
            const dest = document.getElementById(audioCtx);
            if(src && dest){
                drawLineBetween(src, dest); // order matters! :0
            }
        }
    }
    
} // end NodeFactory
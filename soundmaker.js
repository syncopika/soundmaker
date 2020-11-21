const NOTE_FREQ = {
	"G": 783.99,
	"F": 698.46,
	"E": 659.25,
	"D": 587.33,
	"C": 523.25,
	"B": 493.88,
	"A": 440.00,
};

function processNote(noteFreq, nodeFactory){
	// this is used to create and use new nodes each time a note needs to be played
	
	let nodeStore = nodeFactory.nodeStore;

	// probably should look at not just osc nodes but those with 0 input.
	// i.e. OscillatorNodes, AudioBufferSourceNodes
	let oscNodes = nodeFactory.getOscNodes();
	
	let nodesToStart = [];
	oscNodes.forEach((osc) => {
		
		// create a new osc node from the template props
		let oscTemplateNode = nodeStore[osc].node;
		let templateProps = {};
		
		Object.keys(oscTemplateNode.__proto__).forEach((propName) => {
			let prop = oscTemplateNode[propName];
			templateProps[propName] = (prop.value !== undefined) ? prop.value : prop;
			
			if(propName === "frequency"){
				templateProps[propName] = noteFreq;
			}
		});
		
		let newOsc = new window[oscTemplateNode.constructor.name](nodeFactory, templateProps);
		nodesToStart.push(newOsc);
		
		// need to go down all the way to each node and make connections
		// gain nodes don't need to be touched as they're already attached to the context dest by default
		let connections = nodeStore[osc].feedsInto;
		connections.forEach((conn) => {
			// connect the new osc node to this connection 
			let sinkNode = nodeStore[conn].node;
			
			// make connection
			newOsc.connect(sinkNode);
			
			// if source is a gain node, no need to go further
			if(sinkNode.id.indexOf("Gain") < 0){
				let stack = nodeStore[sinkNode.id]["feedsInto"];
				let newSource = sinkNode;
				
				while(stack.length > 0){
					let next = stack.pop();
					let currSink = nodeStore[next].node;
					console.log("connecting: " + newSource.constructor.name + " to: " + currSink.constructor.name);
					
					newSource.connect(currSink);
					newSource = currSink;
					nextConnections = nodeStore[next]["feedsInto"].filter((name) => name.indexOf("Destination") < 0);
					stack = stack.concat(nextConnections);
				}
			}
		});
	});
	
	let time = nodeFactory.currentTime;
	let gainNodes = nodeFactory.getGainNodes();

	gainNodes.forEach((gain) => {
		// we need to understand the distinction of connecting to another node vs. connecting to an AudioParam of another node!
		// maybe use dotted lines?
		let gainNode = gain.node;
		let adsr = getADSRFeed(gain);
		if(adsr){
			// if an adsr envelope feeds into this gain node, run the adsr function on the gain
			let envelope = nodeStore[adsr].node;
			envelope.applyADSR(gainNode.gain, time);
		}else{
			gainNode.gain.setValueAtTime(gainNode.gain.value, time);
		}
	});
	
	return nodesToStart;
}
		
function getADSRFeed(sinkNode){
	// check if sinkNode has an ADSR envelope
	let feedsFrom = sinkNode.feedsFrom;
	for(let i = 0; i < feedsFrom.length; i++){
		let source = feedsFrom[i];
		if(source.indexOf("ADSR") >= 0){
			return source; // return name of ADSR envelope
		}
	};
	return null;
}


class ADSREnvelope {
	
	constructor(){
		this.attack = 0;
		this.sustain = 0;
		this.decay = 0;
		this.release = 0;
		this.sustainLevel = 0;
	}
	
	applyADSR(targetNodeParam, start){
		// targetNodeParam might be the gain property of a gain node, or a filter node for example
		// the targetNode just needs to have fields that make sense to be manipulated with ADSR
		// i.e. pass in gain.gain as targetNodeParam
		// https://www.redblobgames.com/x/1618-webaudio/#orgeb1ffeb
		
		// only assuming node params that are objects (and have a value field)
		let baseParamVal = targetNodeParam.baseValue; // i.e. gain.gain.value. this value will be the max value that the ADSR envelope will cover (the peak of the amplitude)

		// TODO: this needs to be looked at more closely. what does a value of 0 mean?
		// sustainLevel should be the level that the ADSR drops off to after hitting the peak, which is baseParamVal
		let sustainLevel = this.sustainLevel === 0 ? 1 : this.sustainLevel;
		targetNodeParam.cancelAndHoldAtTime(start);
		targetNodeParam.linearRampToValueAtTime(0.0, start);
		targetNodeParam.linearRampToValueAtTime(baseParamVal, start + this.attack);
		targetNodeParam.linearRampToValueAtTime(baseParamVal * sustainLevel, start + this.attack + this.decay);
		targetNodeParam.linearRampToValueAtTime(baseParamVal * sustainLevel, start + this.attack + this.decay + this.sustain);
		
		// if note is being held, don't do this.
		//targetNodeParam.linearRampToValueAtTime(baseParamVal, start + this.attack + this.decay + this.sustain + this.release);
		return targetNodeParam;
	}
}

class NodeFactory extends AudioContext {
	
	constructor(){
		super();
		
		this.nodeColors = {}; // different background color for each kind of node element?
		this.nodeStore = {};  // store refs for nodes
		this.nodeCounts = {
			// store this function and the node count of diff node types in same object
			// use nodeName if supplied
			'addNode': function(node){
				let nodeType = node.constructor.name;
				
				// just keeping count here
				if(this[nodeType]){
					this[nodeType]++;
				}else{
					this[nodeType] = 1;
				}

				return this[nodeType];
			},
			'deleteNode': function(node, nodeName=null){
				let nodeType = node.constructor.name;
				this[nodeType]--;
				return this[nodeType];
			}
		}; // keep track of count of each unique node for id creation
		
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
	
	getGainNodes(){
		return [...Object.keys(this.nodeStore)].filter((key) => key.indexOf("Gain") >= 0).map((gainId) => this.nodeStore[gainId]);
	}
	
	getOscNodes(){
		return [...Object.keys(this.nodeStore)].filter((key) => key.indexOf("Oscillator") >= 0 || key.indexOf("AudioBuffer") >= 0);
	}
	
	createAudioContextDestinationUI(){
		let audioCtxDest = document.createElement('div');
		audioCtxDest.id = this.destination.constructor.name;
		audioCtxDest.style.border = "1px solid #000";
		audioCtxDest.style.borderRadius = "20px 20px 20px 20px";
		audioCtxDest.style.padding = "5px";
		audioCtxDest.style.width = "200px";
		audioCtxDest.style.height = "200px";
		audioCtxDest.style.textAlign = "center";
		audioCtxDest.style.position = "absolute";
		audioCtxDest.style.top = "20%";
		audioCtxDest.style.left = "50%";
		audioCtxDest.style.zIndex = "10";
		let title = document.createElement("h2");
		title.textContent = "audio context destination";
		audioCtxDest.appendChild(title);
		document.getElementById("nodeArea").appendChild(audioCtxDest);
	}
	
	// store a node in this.nodeStore
	_storeNode(node, nodeName){
		// feedsInto would be an array of strings, where each string is a node's name
		this.nodeStore[nodeName] = {
			'node': node, 
			'feedsInto': [],
			'feedsFrom': []
		};
	}
	
	// methods for node creation. I'm thinking of them as 'private' methods because
	// they'll be used in other methods that are more useful and should be called on a NodeFactory instance
	_createWaveNode(){
		// REMEMBER THAT OSCILLATOR NODES CAN ONLY BE STARTED/STOPPED ONCE!
		// when a note is played multiple times, each time a new oscillator needs to 
		// be created. but we can save the properties of the oscillator and reuse that data.
		// so basically we create a dummy oscillator for the purposes of storing information (as a template)
		let osc = this.createOscillator();
		// default params 
		osc.frequency.value = 440; // A @ 440 Hz
		osc.detune.value = 0;
		osc.type = "sine";
		osc.id = (osc.constructor.name + this.nodeCounts.addNode(osc));
		return osc;
	}
	
	_createNoiseNode(){
		// allow user to pass in the contents of the noise buffer as a list if they want to?
		let noise = this.createBufferSource();
		
		// assign random noise first, but let it be customizable
		let bufSize = this.sampleRate; // customizable?
		let buffer = this.createBuffer(1, bufSize, bufSize);
		
		let output = buffer.getChannelData(0);
		for(let i = 0; i < bufSize; i++){
			output[i] = Math.random() * 2 - 1;
		}
		
		noise.buffer = buffer;
		noise.loop = true;
		noise.id = (noise.constructor.name + this.nodeCounts.addNode(noise));
		return noise;
	}
	
	_createGainNode(){
		let gainNode = this.createGain();
		// gain will alwaays need to attach to context destination
		gainNode.connect(this.destination);
		gainNode.gain.value = this.valueRanges.GainNode.gain.default;
		
		// use this property to remember the desired base volume value
		gainNode.gain.baseValue = this.valueRanges.GainNode.gain.default;
		
		gainNode.id = (gainNode.constructor.name + this.nodeCounts.addNode(gainNode));
		return gainNode;
	}
	
	// create a biquadfilter node
	_createBiquadFilterNode(){
		let bqFilterNode = this.createBiquadFilter();
		bqFilterNode.frequency.value = 440;
		bqFilterNode.detune.value = 0;
		bqFilterNode.Q.value = 1;
		bqFilterNode.gain.value = 0;
		bqFilterNode.type = "lowpass";
		
		// need to add to nodeCounts
		bqFilterNode.id = (bqFilterNode.constructor.name + this.nodeCounts.addNode(bqFilterNode));
		return bqFilterNode;
	}
	
	// attack, decay, sustain, release envelope node
	// this will target the params of another node like Oscillator or BiquadFilter or Gain 
	// for now we should keep this very simple! :)
	_createADSREnvelopeNode(){
		let envelope = new ADSREnvelope();
		envelope.id = (envelope.constructor.name + this.nodeCounts.addNode(envelope));
		return envelope;
	}
	
	_deleteNode(node){
		let nodeName = node.id;
		let nodeToDelete = this.nodeStore[nodeName].node;
		
		// decrement count 
		this.nodeCounts.deleteNode(node);
		
		// unhook all connections in the UI
		let connectionsTo = this.nodeStore[nodeName].feedsInto;
		if(connectionsTo){
			connectionsTo.forEach((connection) => {
				// remove the UI representation of the connection
				let svg = document.getElementById("svgCanvas:" + nodeName + ":" + connection);
				document.getElementById("nodeArea").removeChild(svg);
				
				// also remove the reference of the node being deleted from this connected node's feedsFrom
				let targetFeedsFrom = this.nodeStore[connection].feedsFrom;
				this.nodeStore[connection].feedsFrom = targetFeedsFrom.filter(node => node !== nodeName);
			});
		}
		
		let connectionsFrom = this.nodeStore[nodeName].feedsFrom;
		if(connectionsFrom){
			connectionsFrom.forEach((connection) => {
				let svg = document.getElementById("svgCanvas:" + connection + ":" + nodeName);
				document.getElementById("nodeArea").removeChild(svg);
				
				// also remove the reference of the node being deleted from this connected node's feedsInto
				let targetFeedsInto = this.nodeStore[connection].feedsInto;
				this.nodeStore[connection].feedsInto = targetFeedsInto.filter(node => node !== nodeName);
			});
		}
		
		// remove it 
		delete this.nodeStore[nodeName];
		
		// clear UI
		document.getElementById('nodeArea').removeChild(document.getElementById(nodeName));
	}
	
	_addNodeToInterface(node, x, y){
		// place randomly in designated area?
		let uiElement = this._createNodeUIElement(node);
		
		uiElement.style.top = x || '100px';
		uiElement.style.left = y || '100px';
		
		document.getElementById('nodeArea').appendChild(uiElement);
	}
	
	_createNodeUIElement(node){
		// add event listener to allow it to be hooked up to another node if possible
		let uiElement = document.createElement('div');
		uiElement.style.backgroundColor = "#fff";
		uiElement.style.zIndex = 10;
		uiElement.style.position = 'absolute';
		uiElement.style.border = '1px solid #000';
		uiElement.style.borderRadius = '20px 20px 20px 20px';
		uiElement.style.padding = '5px';
		uiElement.style.textAlign = 'center';
		uiElement.classList.add("nodeElement");
		uiElement.id = node.id;
		
		let nodeInfo = this.nodeStore[node.id];
		
		// on MOUSEDOWN
		uiElement.addEventListener("mousedown", (evt) => {

			let offsetX = evt.clientX - uiElement.offsetLeft + window.pageXOffset;
			let offsetY = evt.clientY - uiElement.offsetTop + window.pageYOffset;
	
			function moveHelper(x, y){
				
				uiElement.style.left = (x + 'px');
				uiElement.style.top = (y + 'px');
				
				if(nodeInfo.feedsInto){
					nodeInfo.feedsInto.forEach((connection) => {
						let svg = document.getElementById("svgCanvas:" + uiElement.id + ":" + connection);
						document.getElementById("nodeArea").removeChild(svg);
						if(uiElement.id.indexOf("ADSR") >= 0){
							drawLineBetween(uiElement, document.getElementById(connection), true);
						}else{
							drawLineBetween(uiElement, document.getElementById(connection));
						}
					});
				}
				
				if(nodeInfo.feedsFrom){
					nodeInfo.feedsFrom.forEach((connection) => {
						let svg = document.getElementById("svgCanvas:" + connection + ":" + uiElement.id);
						document.getElementById("nodeArea").removeChild(svg);
						if(connection.indexOf("ADSR") >= 0){
							drawLineBetween(document.getElementById(connection), uiElement, true);
						}else{
							drawLineBetween(document.getElementById(connection), uiElement);
						}
					});
				}
			}
	
			function moveNode(evt){
				evt.stopPropagation();
				if(!evt.target.classList.contains("nodeElement")){
					return;
				}
				moveHelper((evt.pageX - offsetX), (evt.pageY - offsetY));
			}
			
			document.addEventListener("mousemove", moveNode);
			
			uiElement.addEventListener("mouseup", (evt) => {
				document.removeEventListener("mousemove", moveNode);
			});
		});
		
		uiElement.addEventListener('dblclick', (evt) => {
			// display menu for this node to edit params 
			showParameterEditWindow(nodeInfo, this.valueRanges);
		});
		
		// add the name of the node
		let name = document.createElement('h4');
		name.textContent = node.id;
		uiElement.appendChild(name);
		
		// connect-to-other-nodes functionality 
		let connectButton = document.createElement('button');
		connectButton.textContent = "connect to another node";
		connectButton.addEventListener("click", (evt) => {
			
			function selectNodeToConnectHelper(evt, source, nodeStore){
				
				let target = evt.target;
				if(!evt.target.classList.contains("nodeElement")){
					target = evt.target.parentNode;
				}
				
				// if the target is still not a node element, return
				if(!target.classList.contains("nodeElement")){
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
				let sourceConnections = nodeStore[source.id];
				sourceConnections["feedsInto"].push(target.id);
				
				let destConnections = nodeStore[target.id];
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
						let otherNode = document.getElementById(node);
						otherNode.removeEventListener("mouseover", mouseoverNode);
						otherNode.removeEventListener("mouseleave", mouseleaveNode);
						otherNode.removeEventListener("click", selectNodeToConnectTo);
					}
				});
			}
			
			let nodeStore = this.nodeStore;
			function selectNodeToConnectTo(evt){
				selectNodeToConnectHelper(evt, uiElement, nodeStore);
			}
			
			function mouseoverNode(evt){
				// highlight the node being hovered over
				if(evt.target.classList.contains("nodeElement")){
					evt.target.style.backgroundColor = "#ffcccc";
				}
			}
			
			function mouseleaveNode(evt){
				if(evt.target.classList.contains("nodeElement")){
					evt.target.style.backgroundColor = "#fff";
				}
			}
			
			function cancelConnectionHelper(evt, source, nodeStore){
				evt.preventDefault();
				[...Object.keys(nodeStore)].forEach((node) => {
					if(node !== source.id){
						let otherNode = document.getElementById(node);
						otherNode.removeEventListener("mouseover", mouseoverNode);
						otherNode.removeEventListener("mouseleave", mouseleaveNode);
						otherNode.removeEventListener("click", selectNodeToConnectTo);
						otherNode.style.backgroundColor = "#fff";
					}
				});
				document.body.removeEventListener("contextmenu", cancelConnection);
			}
			
			function cancelConnection(evt){
				cancelConnectionHelper(evt, uiElement, nodeStore);
			}
			document.body.addEventListener("contextmenu", cancelConnection);
			
			// TODO: set up rules to determine which kinds of nodes this one can feed into!
			// add an event listener for all node elements that this node could connect with 
			[...Object.keys(nodeStore)].forEach((node) => {
				if(node !== uiElement.id){			
					let otherNode = document.getElementById(node);
					otherNode.addEventListener("mouseover", mouseoverNode);
					otherNode.addEventListener("mouseleave", mouseleaveNode);
					otherNode.addEventListener("click", selectNodeToConnectTo);
				}
			})
		});
		uiElement.appendChild(connectButton);
		uiElement.appendChild(document.createElement('br'));
		
		// delete node functionality
		let deleteButton = document.createElement('button');
		deleteButton.textContent = "delete";
		deleteButton.addEventListener('click', (evt) => {
			this._deleteNode(node);
		});
		
		uiElement.appendChild(deleteButton);
		
		return uiElement;
	}
	
	// create and add a new wave node to the interface
	addNewNode(nodeType, addToInterface=true){
		
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
		
		// this should be a separate function
		if(addToInterface){
			this._addNodeToInterface(newNode);
		}
		
		if(nodeType === "gainNode"){
			// gain node is special :)
			let audioCtx = this.destination.constructor.name;
			this.nodeStore[newNode.id]["feedsInto"] = [audioCtx];
			this.nodeStore[audioCtx]["feedsFrom"].push(newNode.id);
			drawLineBetween(document.getElementById(newNode.id), document.getElementById(audioCtx)); // order matters! :0
		}
	}
	
} // end NodeFactory

// maybe move all the UI handling stuff to another class that will be comprised of the nodefactory class?
class SoundMaker {
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



let soundMaker = new SoundMaker();
document.getElementById('addWavNode').addEventListener('click', (e) => {
	soundMaker.nodeFactory.addNewNode("waveNode");
});

document.getElementById('addGainNode').addEventListener('click', (e) => {
	soundMaker.nodeFactory.addNewNode("gainNode");
});

document.getElementById('addNoiseNode').addEventListener('click', (e) => {
	soundMaker.nodeFactory.addNewNode("noiseNode");
});

document.getElementById('addFilterNode').addEventListener('click', (e) => {
	soundMaker.nodeFactory.addNewNode("biquadFilterNode");
});

document.getElementById('addADSRNode').addEventListener('click', (e) => {
	soundMaker.nodeFactory.addNewNode("ADSREnvelope");
});

document.getElementById('download').addEventListener('click', (e) => {
	exportPreset(soundMaker.nodeFactory);
});

soundMaker.nodeFactory.createAudioContextDestinationUI();



let notes = [...document.getElementsByClassName("note")];
let currPlayingNodes = [];

// set up the keyboard for playing notes
function setupKeyboard(keyboard, nodeFactory){
	let audioContext = nodeFactory;
	notes.forEach((note) => {
		note.addEventListener('mouseup', (evt) => {
			
			let maxEndTime = audioContext.currentTime;
			
			// apply adsr release, if any
			let gainNodes = nodeFactory.getGainNodes();
			gainNodes.forEach((gain) => {
				let gainNode = gain.node;
				let adsr = getADSRFeed(gain);
				if(adsr){
					let envelope = nodeFactory.nodeStore[adsr].node;
					gainNode.gain.linearRampToValueAtTime(0.0, audioContext.currentTime + envelope.release);
					maxEndTime = Math.max(audioContext.currentTime + envelope.release, maxEndTime);
				}else{
					gainNode.gain.setValueAtTime(0.0, audioContext.currentTime);
				}
			});
			
			// maybe we don't need to shut off oscillators if setting gain to 0?
			// we're going to throw these nodes away anyway
			currPlayingNodes.forEach((osc) => {
				osc.stop(maxEndTime);
			});
		});
		
		note.addEventListener('mousedown', (evt) => {
			if(evt.buttons === 1){
				audioContext.resume().then(() => {
					let noteFreq = NOTE_FREQ[note.textContent];
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






///////// TESTS
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

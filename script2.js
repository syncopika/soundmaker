const NOTE_FREQ = {
	"B": 493.88,
	"A": 440.00,
	"G": 392.00,
	"F": 349.23,
	"E": 329.63,
	"D": 293.66,
	"C": 261.63,
};

let currPreset = {
	'presetName': 'preset1',
	'numWaveNodes': 0,
	'numNoiseNodes': 0,
	'waveNodes': [],
	'noiseNodes': [],
	"notes": ""
};

///////////////////////////////////  START

let notes = [...document.getElementsByClassName("note")];
notes.forEach((note) => {
	note.addEventListener('click', (event) => {
		audioContext.resume().then(() => {
			//processNote(event.toElement.innerHTML, audioContext, currPreset);
		});
	});
});

function processNote(note, audioContext, currPreset){
}


/////////////////////////////////////////
function getAlphaString(str){
	return str.match(/[a-zA-Z]+/g)[0];
}

// import preset 
function importInstrumentPreset(){
	let input = document.getElementById('importInstrumentPresetInput');
	input.addEventListener('change', processInstrumentPreset, false);
	input.click();
}

function processInstrumentPreset(e){
	let reader = new FileReader();
	let file = e.target.files[0];
	
	//when the image loads, put it on the canvas.
	reader.onload = (function(theFile){
	
		return function(e){
		
			// parse JSON using JSON.parse 
			let data = JSON.parse(e.target.result);
			let presetName = data['presetName'];

			// store the preset in the PianoRoll obj 
			pianoRoll.instrumentPresets[presetName] = data;
		}
	})(file);

	//read the file as a URL
	reader.readAsText(file);
}




function downloadPreset(){
	let fileName = prompt("enter filename");
	if(fileName === null || fileName === ""){
		return;
	}
	
	currPreset["presetName"] = fileName;
	currPreset["notes"] = document.getElementById('notes').value;
	
	let blob = new Blob([JSON.stringify(currPreset, null, 2)], {type: "application/json"});
	//make a url for that blob
	let url = URL.createObjectURL(blob);
	
	let link = document.createElement('a');
	link.href = url; //link the a element to the blob's url
	link.download = fileName + ".json";
	
	//then simulate a click to the blob url to initiate download
	link.click();
}


function importInstrumentPreset(){
	let input = document.getElementById('importInstrumentPresetInput');
	input.addEventListener('change', processInstrumentPreset, false);
	input.click();
}

function processInstrumentPreset(e){
	let reader = new FileReader();
	let file = e.target.files[0];
	
	//when the image loads, put it on the canvas.
	reader.onload = (function(theFile){
	
		return function(e){
			let importedPreset = JSON.parse(e.target.result);
		}
	})(file);

	//read the file as a URL
	reader.readAsText(file);
}


class NodeFactory extends AudioContext {
	// create your new nodes with these functions
	// NOTE THAT OSCILLATOR NODES CAN ONLY BE STARTED/STOPPED ONCE!
	// when a note is played multiple times, each time a new oscillator needs to 
	// be created. but we can save the properties of the oscillator and reuse that data.
	constructor(){
		super();
		
		this.audioContext = new AudioContext();
		this.audioContext.suspend();
		
		this.nodeStore = {};  // store refs for nodes
		this.nodeCounts = {
			// store this function and the node count of diff node types in same object
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
			
			'deleteNode': function(node){
				let nodeType = node.constructor.name;
				this[nodeType]--;
				return this[nodeType];
			}
		}; // keep track of count of each unique node for id creation
		
		this.nodeColors = {}; // different background color for each kind of node element
	}
	
	// store a node in this.nodeStore
	_storeNode(node, nodeName){
		// feedsInto would be an array of strings, where each string is a node's name
		this.nodeStore[nodeName] = {
			'node': node, 
			'feedsInto': null
		};
	}
	
	// methods for node creation. I'm thinking of them as 'private' methods because
	// they'll be used in other methods that are more useful and should be called on a NodeFactory instance
	_createWaveNode(){
		// should set it with default params, then let the user change them after clicking on the note in the UI
		// should have another function that creates the node in the backend, and also the corresponding UI element.
		// clicking on that element will open up a menu to allow the user to change parameters.
		let osc = this.audioContext.createOscillator();
		// default params 
		osc.frequency.value = 440; // A @ 440 Hz
		osc.detune.value = 0;
		osc.type = "sine";
		osc.id = (osc.constructor.name + this.nodeCounts.addNode(osc));
		return osc;
	}
	
	_createNoiseNode(){
		// allow user to pass in the contents of the noise buffer as a list if they want to?
		let noise = this.audioContext.createBufferSource();
		
		// assign random noise first, but let it be customizable
		let bufSize = this.audioContext.sampleRate; // customizable?
		let buffer = this.audioContext.createBuffer(1, bufSize, bufSize);
		
		let output = buffer.getChannelData(0);
		for(let i = 0; i < bufSize; i++){
			output[i] = Math.random() * 2 - 1;
		}
		
		noise.buffer = buffer;
		noise.id = (noise.constructor.name + this.nodeCounts.addNode(noise));
		return noise;
	}
	
	_createGainNode(){
		let gainNode = this.audioContext.createGain();
		// gain will alwaays need to attach to context destination
		gainNode.connect(this.audioContext.destination);
		gainNode.id = (gainNode.constructor.name + this.nodeCounts.addNode(gainNode));
		return gainNode;
	}
	
	// create a biquadfilter node
	_createBiquadFilterNode(){
		let bqFilterNode = this.audioContext.createBiquadFilter();
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
	_createADSREnvelopeNode(){
	}
	
	_deleteNode(node){
		let nodeName = node.id;
		let nodeToDelete = this.nodeStore[nodeName].node;
		
		// decrement count 
		this.nodeCounts.deleteNode(node);
		
		// unhook all connections in the UI
		let connections = this.nodeStore[nodeName].feedsInto;
		if(connections){
			connections.forEach((connection) => {
				// remove the UI representation of the connection
				// as long as we don't keep references of node sources,
				// we shouldn't have to do anything else with the feedsInto info.
				// (i.e. source-to-sink. right now we just keep references to 
				// the nodes (or sinks) a node feeds into.)
			});
		};
		
		// remove it 
		delete this.nodeStore[nodeName];
		
		// clear UI
		document.body.removeChild(document.getElementById(nodeName));
	}
	
	_addNodeToInterface(node, x, y){
		// place randomly in designated area?
		let uiElement = this._createNodeUIElement(node);
		
		uiElement.style.top = x || '300px';
		uiElement.style.left = y || '300px';
		
		document.body.appendChild(uiElement);
	}
	
	_createNodeUIElement(node){
		// add event listener to allow it to be hooked up to another node if possible
		let customizableProperties = Object.keys(node.__proto__);
		let uiElement = document.createElement('div');
		//uiElement.style.width = '300px';
		//uiElement.style.height = '210px';
		uiElement.style.backgroundColor = "#fff";
		uiElement.style.zIndex = 10;
		uiElement.style.position = 'absolute';
		uiElement.style.border = '1px solid #000';
		uiElement.style.borderRadius = '20px 20px 20px 20px';
		uiElement.style.padding = '5px';
		uiElement.style.textAlign = 'center';
		uiElement.classList.add("nodeElement");
		uiElement.id = node.id;
		
		uiElement.addEventListener("mousedown", (evt) => {
			//uiElement.setAttribute("mousedown", true);
			let offsetX = evt.clientX - uiElement.getBoundingClientRect().left;
			let offsetY = evt.clientY - uiElement.getBoundingClientRect().top;
	
			function moveHelper(x, y){
				uiElement.style.left = (x + 'px');
				uiElement.style.top = (y + 'px');
			}
	
			function moveNode(evt){
				moveHelper((evt.pageX - offsetX), (evt.pageY - offsetY));
			}
			
			document.addEventListener("mousemove", moveNode);
			
			uiElement.addEventListener("mouseup", (evt) => {
				document.removeEventListener("mousemove", moveNode);
			});
		});
		
		// add the name of the node
		let name = document.createElement('h4');
		name.textContent = node.constructor.name;
		uiElement.appendChild(name);
	
		// list customizable properties of this node 
		// and add the appropriate elements to modify those properties
		customizableProperties.forEach((prop) => {
			let property = document.createElement('p');
			property.textContent = prop;
			uiElement.appendChild(property);
		});
		
		// connect-to-other-nodes functionality 
		let connectButton = document.createElement('button');
		connectButton.textContent = "connect to another node";
		connectButton.addEventListener("click", (evt) => {
			
			function selectNodeToConnectHelper(evt, source, nodeStore){
				
				//console.log(evt.target);
				let target = evt.target;
				if(!evt.target.classList.contains("nodeElement")){
					target = evt.target.parentNode;
				}
				target.style.backgroundColor = "#fff";
				
				// update node's connections in nodeStore
				
				// update UI to show link between nodes
				
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
		}else{
			console.log("unknown node type!");
			return;
		}
		
		// store it 
		this._storeNode(newNode, newNode.id);
		
		// this should be a separate function
		if(addToInterface){
			// add it visually to the UI 
			// add event listeners to the UI
			this._addNodeToInterface(newNode);
		}
	}
	
} // end NodeFactory

// maybe move all the UI handling stuff to another class that will be comprised of the nodefactory class?
class SoundMaker {
	constructor(){
		this.nodeFactory = new NodeFactory();
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

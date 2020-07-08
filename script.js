const NOTE_FREQ = {
	"G": 783.99,
	"F": 698.46,
	"E": 659.25,
	"D": 587.33,
	"C": 523.25,
	"B": 493.88,
	"A": 440.00,
};

///////////////////////////////////  START

function processNote(noteFreq, nodeFactory){
	let nodeStore = nodeFactory.nodeStore;
	//console.log(nodeStore);
	
	// k so this is what we need to do:
	// look for all the oscillator nodes 
	// create new oscillator nodes based on the props of the ones in nodeStore (those are templates)
	// then! follow the graph -> make sure to hook up the oscillator nodes to the right feedsInto nodes 
	// lastly, grab all the gain nodes and play!
	
	// probably should look at not just osc nodes but those with 0 input.
	// i.e. OscillatorNodes, AudioBufferSourceNodes
	let oscNodes = [...Object.keys(nodeStore)].filter((key) => key.indexOf("Oscillator") >= 0 || key.indexOf("AudioBuffer") >= 0);
	//console.log(oscNodes);
	
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
	let gainNodes = [...Object.keys(nodeStore)].filter((key) => key.indexOf("Gain") >= 0).map((gainId) => nodeStore[gainId]);

	gainNodes.forEach((gain) => {
		// we need to understand the distinction of connecting to another node vs. connecting to an AudioParam of another node!
		// maybe use dotted lines?
		let gainNode = gain.node;
		let adsr = getADSRFeed(gain);
		if(adsr){
			// if an adsr envelope feeds into this gain node, run the adsr function on the gain
			let envelope = nodeStore[adsr].node;
			//console.log(envelope);
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
			
			// TODO: finish
		}
	})(file);

	//read the file as a URL
	reader.readAsText(file);
}



function exportPreset(nodeFactory){
	let fileName = prompt("enter filename");
	if(fileName === null || fileName === ""){
		return;
	}
	
	let objToExport = {};
	let currNodeStore = nodeFactory.nodeStore;
	let currNodeStoreKeys = Object.keys(currNodeStore);
	currNodeStoreKeys.forEach((node) => {
		let currNode = currNodeStore[node];
		
		let nodeProps = {};
		nodeProps.id = currNode.node.id;
		nodeProps.feedsFrom = currNode.feedsFrom;
		nodeProps.feedsInto = currNode.feedsInto;
		
		let params = Object.keys(currNode.node.__proto__);
		if(params.length === 0){
			// i.e. for ADSREnvelope, which is just a regular object
			params = Object.keys(currNode.node);
		}
		
		let nodeParams = {};
		params.forEach((param) => {
			if(typeof(currNode.node[param]) === "object" && "value" in currNode.node[param]){
				// should just test value type instead? i.e. number vs string? if num, use value property?
				nodeParams[param] = currNode.node[param].value;
			}else if(currNode.node[param].constructor.name === "AudioBuffer"){
				// handle audio buffers specially
				let buffer = currNode.node[param];
				let bufferProps = {};
				for(var prop in buffer){
					if(typeof(buffer[prop]) !== "function"){
						bufferProps[prop] = buffer[prop];
					}
					// but make sure to add buffer data! assuming 1 channel here
					bufferProps['channelData'] = buffer.getChannelData(0); 
				}
				nodeParams[param] = bufferProps;
			}else{
				// single value for this param 
				nodeParams[param] = currNode.node[param];
			}
		});
		nodeProps.node = nodeParams;
		
		objToExport[node] = nodeProps;
	});
	
	//console.log(objToExport);
	let theData = {};
	theData["name"] = fileName;
	theData["data"] = objToExport;
	
	let blob = new Blob([JSON.stringify(theData, null, 2)], {type: "application/json"});
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

function drawLineBetween(htmlElement1, htmlElement2, dash=false){
	
	// instead, we should create an individual svg per line
	let svg = document.getElementById("svgCanvas");
	
	if(!svg){
		svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.style.position = "absolute";
		svg.id = "svgCanvas:" + htmlElement1.id + ":" + htmlElement2.id;
		svg.style.zIndex = 0;
		svg.style.height = "1000px"; // calculate these after you calculate the line dimensions?
		svg.style.width = "1000px";	// calculate these after you calculate the line dimensions?
		document.getElementById('nodeArea').appendChild(svg);
	}
	
	let line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
	line.classList.add('line');
	line.setAttribute('stroke', '#000');
	line.setAttribute('stroke-width', '1px');
	
	if(dash){
		// for dotted lines
		line.setAttribute('stroke-dasharray', 10); // is this number ok?
	}
	
	let element1x = htmlElement1.offsetLeft + document.body.scrollLeft + ((htmlElement1.offsetWidth)/2);
	let element1y = htmlElement1.offsetTop + document.body.scrollTop + ((htmlElement1.offsetHeight)/2);
	let element2x = htmlElement2.offsetLeft + document.body.scrollLeft + ((htmlElement2.offsetWidth)/2);
	let element2y = htmlElement2.offsetTop + document.body.scrollTop + ((htmlElement2.offsetHeight)/2);
	
	line.setAttribute('x1', element1x);
	line.setAttribute('y1', element1y);
	line.setAttribute('x2', element2x);
	line.setAttribute('y2', element2y);
	
	let maxWidth = Math.max(element1x, element2x) + 200;
	let maxHeight = Math.max(element1y, element2y) + 200;
	svg.style.height = parseInt(svg.style.height) < maxHeight ? (maxHeight + "px") : svg.style.height;
	svg.style.width = parseInt(svg.style.width) < maxWidth ? (maxWidth + "px") : svg.style.width;
	
	svg.appendChild(line);
}

function showParameterEditWindow(nodeInfo, valueRanges){
	let editWindow = document.getElementById("editNode");
	while(editWindow.firstChild){
		editWindow.removeChild(editWindow.firstChild);
	}
	let title = document.createElement("h3");
	title.textContent = nodeInfo.node.id;
	editWindow.appendChild(title);
	//console.log(nodeInfo);
	
	let node = nodeInfo.node;
	let customizableProperties = Object.keys(nodeInfo.node.__proto__);

	if(customizableProperties.length === 0){
		// i.e. for adsr envelope 
		customizableProperties = Object.keys(nodeInfo.node).filter((prop) => typeof(nodeInfo.node[prop]) === "number");
	}
	//console.log(node);
	customizableProperties.forEach((prop) => {
		let property = document.createElement('p');
		let text = prop;
		let isNumValue = false;
		if(node[prop].value !== undefined){
			text += ".value";
			isNumValue = true;
		}else if(typeof(node[prop]) === "number"){
			isNumValue = true;
		}
		
		property.textContent = text;

		if(isNumValue){
			editWindow.appendChild(property);
			// what kind of param is it 
			// probably should refactor this. instead, make sure each NODE INSTANCE has some new field called 'nodeType' that we can use?
			let props = valueRanges[node.constructor.name] || valueRanges[node.type];
			props = props[prop];
			
			let slider = document.createElement('input');
			slider.id = text;
			slider.setAttribute('type', 'range');
			slider.setAttribute('max', props ? props['max'] : 0.5);
			slider.setAttribute('min', props ? props['min'] : 0.0);
			slider.setAttribute('step', props ? props['step'] : 0.01);
			
			// also allow value input via text edit box 
			let editBox = document.createElement('input');
			editBox.id = text + '-edit';
			editBox.setAttribute('size', 6);
			editBox.setAttribute('type', 'text');
			
			if(node[prop].value){
				slider.setAttribute('value', node[prop].value);
			}else if(typeof(node[prop]) === "number"){
				// relevant to the ADSR envelope
				slider.setAttribute('value', node[prop]);
			}else{
				slider.setAttribute('value', props['default']);
			}
			
			editBox.value = slider.getAttribute('value');
			editBox.style.fontFamily = "monospace";
			editBox.addEventListener('input', (evt) => {
				// evaluate the new value. 
				// if it's a valid value, update the param it belongs to.
				let inputtedValue = parseFloat(evt.target.value);
				if(inputtedValue >= parseFloat(slider.getAttribute('min')) &&
					inputtedValue <= parseFloat(slider.getAttribute('max'))){
						slider.setAttribute('value', inputtedValue);
						if(node[prop].value !== undefined){
							node[prop].value = inputtedValue;
						}else{
							node[prop] = inputtedValue;
						}
				}				
			});
			
			slider.addEventListener('input', function(evt){
				let newVal = parseFloat(evt.target.value);
				editBox.value = newVal;
				
				// update node
				// probably should refactor (shouldn't have to check value prop?)
				if(node[prop].value !== undefined){
					node[prop].value = newVal;
				}else{
					node[prop] = newVal;
				}
			});
			
			editWindow.appendChild(slider);
			editWindow.appendChild(editBox);
			editWindow.appendChild(document.createElement('br'));
			editWindow.appendChild(document.createElement('br'));
			
		}else{
			if(prop === "type"){
				editWindow.appendChild(property);
				// dropdown box for type
				let dropdown = document.createElement('select');
				dropdown.id = text + "Type";
				let options = [];
				if(node.constructor.name.indexOf("Oscillator") >= 0){
					// use waveType
					options = valueRanges["waveType"];
				}else{
					// use filterType
					options = valueRanges["filterType"];
				}
				options.forEach((opt) => {
					let option = document.createElement('option');
					option.textContent = opt;
					dropdown.appendChild(option);
				});
				dropdown.addEventListener('change', (evt) => {
					let val = dropdown.options[dropdown.selectedIndex].value;
					nodeInfo.node[prop] = val;
				});
				dropdown.value = node[prop];
				editWindow.appendChild(dropdown);
			}
		}
	});
		
}


class ADSREnvelope {
	
	constructor(){
		this.attack = 0;
		this.sustain = 0;
		this.decay = 0;
		this.release = 0;
		this.sustainLevel = 0;
	}
	
	applyADSR(targetNodeParam, time){
		// targetNodeParam might be the gain property of a gain node, or a filter node for example
		// the targetNode just needs to have fields that make sense to be manipulated with ADSR
		// i.e. pass in gain.gain as targetNodeParam
		// https://www.redblobgames.com/x/1618-webaudio/#orgeb1ffeb
		//let targetNodeParam = targetNode[param];
		let baseParamVal = targetNodeParam.value; // i.e. gain.gain.value
		
		targetNodeParam.linearRampToValueAtTime(0.0, time);
		targetNodeParam.linearRampToValueAtTime(baseParamVal, time + this.attack);
		targetNodeParam.linearRampToValueAtTime(baseParamVal * this.sustainLevel, this.attack + this.decay);
		targetNodeParam.linearRampToValueAtTime(baseParamVal * this.sustainLevel, this.attack + this.decay + this.sustain);
		targetNodeParam.linearRampToValueAtTime(0.0, this.attack + this.decay + this.sustain + this.release);
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
		//let customizableProperties = Object.keys(node.__proto__);
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

function setupKeyboard(keyboard, nodeFactory){
	let audioContext = nodeFactory;
	notes.forEach((note) => {
		note.addEventListener('mouseup', (evt) => {
			currPlayingNodes.forEach((osc) => {
				osc.stop(audioContext.currentTime);
			});
		});
		
		note.addEventListener('mousedown', (evt) => {
			audioContext.resume().then(() => {
				//processNote(event.toElement.innerHTML, audioContext, currPreset);
				let noteFreq = NOTE_FREQ[note.textContent];
				//console.log(noteFreq);
				currPlayingNodes = processNote(noteFreq, nodeFactory);
				currPlayingNodes.forEach((osc) => {
					osc.start(0);
				});
			});
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

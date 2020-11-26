const NOTE_FREQ = {
	"G": 783.99,
	"F": 698.46,
	"E": 659.25,
	"D": 587.33,
	"C": 523.25,
	"B": 493.88,
	"A": 440.00,
};

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


////////////////////////// SET UP
let soundMaker = new SoundMaker();
let notes = [...document.getElementsByClassName("note")];
let currPlayingNodes = [];

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

document.getElementById('import').addEventListener('click', (e) => {
	importPreset(soundMaker.nodeFactory);
});

soundMaker.nodeFactory.createAudioContextDestinationUI();


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

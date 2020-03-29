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
let audioContext = new AudioContext();
audioContext.suspend();

let notes = [...document.getElementsByClassName("note")];
notes.forEach((note) => {
	note.addEventListener('click', (event) => {
		audioContext.resume().then(() => {
			processNote(event.toElement.innerHTML, audioContext, currPreset);
		});
	});
});

function processNote(note, audioContext, currPreset){
	// play the given note based on the current synth setup
	let allNodes = [];
	let time = audioContext.currentTime;
	
	currPreset.waveNodes.forEach((node) => {
		let snap = addWaveNode(node, audioContext);
		let snapOsc = snap[0];
		let snapEnv = snap[1];
		let volume = node['waveOscVolume'];

		snapOsc.frequency.setValueAtTime(NOTE_FREQ[note], time);
		snapOsc.detune.setValueAtTime(node['waveOscDetune'], time);
		snapEnv.gain.setValueAtTime(node['waveOscVolume'], time);
		allNodes.push(snapOsc);
	});
	
	currPreset.noiseNodes.forEach((node) => {
		let noise = addNoise(node, audioContext);
		let noiseOsc = noise[0];
		let noiseEnv = noise[1];
		let volume = node['noiseOscVolume'];
		
		noiseEnv.gain.setValueAtTime(volume, time);
		allNodes.push(noiseOsc);
	});
	
	allNodes.forEach((osc) => {
		osc.start(0);
		osc.stop(audioContext.currentTime + .100);
	});
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


// you can start a buffer source like an oscillator!
function addNoise(noiseNodeParams, audioContext){

	// this stuff should be customizable
	let bufSize = audioContext.sampleRate;
	let buffer = audioContext.createBuffer(1, bufSize, bufSize);
	let output = buffer.getChannelData(0);
	for(let i = 0; i < bufSize; i++){
		output[i] = Math.random() * 2 - 1;
	}
	
	this.noiseBuffer = buffer;
	let noise = audioContext.createBufferSource();
	noise.buffer = this.noiseBuffer;
	let noiseFilter = audioContext.createBiquadFilter();
	noiseFilter.type = noiseNodeParams['noiseFilterPassType'];
	noiseFilter.frequency.value = noiseNodeParams['noiseOscFreq'];
	noise.connect(noiseFilter);

	// add gain to the noise filter 
	let noiseEnvelope = audioContext.createGain();
	noiseFilter.connect(noiseEnvelope);
	noiseEnvelope.connect(audioContext.destination);
	return [noise, noiseEnvelope];
}

function addWaveNode(waveNodeParams, audioContext){
	let snapOsc = audioContext.createOscillator();
	snapOsc.type = waveNodeParams['waveOscType'];
	
	let snapOscEnv = audioContext.createGain();
	snapOsc.connect(snapOscEnv);
	snapOscEnv.connect(audioContext.destination);
	
	return [snapOsc, snapOscEnv];
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
			
			// reset currPreset
			currPreset = importedPreset;
			// reset counts otherwise the labeling will be off 
			currPreset['numWaveNodes'] = 0;
			currPreset['numNoiseNodes'] = 0;
			
			let allWaveNodes = document.querySelectorAll('.waveNode');
			let allNoiseNodes = document.querySelectorAll('.noiseNode');
			
			allWaveNodes.forEach((node)=>{node.parentNode.removeChild(node)});
			allNoiseNodes.forEach((node)=>{node.parentNode.removeChild(node)});
			
			currPreset.waveNodes.forEach((node) => {
				createNewWavOsc('instrumentPreset');
			});
			
			currPreset.noiseNodes.forEach((node) => {
				createNewNoiseOsc('instrumentPreset');
			});
		}
	})(file);

	//read the file as a URL
	reader.readAsText(file);
}



function createNewWavOsc(parentElement){
	// create a new wave osc section in html 
	let newNodeParams = {};
	
	let newIdNum = currPreset.numWaveNodes + 1;
	let newWaveNodeDiv = document.createElement('div');
	newWaveNodeDiv.id = 'waveNode' + newIdNum;
	newWaveNodeDiv.className = 'waveNode';
	newWaveNodeDiv.style.border = "1px solid #000";
	newWaveNodeDiv.style.marginBottom = "5px";
	newWaveNodeDiv.style.padding = "5px";
	
	let h3 = document.createElement('h3');
	h3.innerHTML = 'wave node ' + newIdNum;
	
	// input for volume
	let input = document.createElement('input');
	input.setAttribute('name', 'waveOscVolume' + newIdNum);
	input.setAttribute('id', 'waveOscVolume' + newIdNum);
	input.setAttribute('type', 'range');
	input.setAttribute('max', 0.5);
	input.setAttribute('min', 0.0);
	input.setAttribute('step', 0.01);
	input.setAttribute('value', 0.08);
	
	let volumeValue = document.createElement('label');
	volumeValue.id = 'waveNodeVolValue' + newIdNum;
	volumeValue.innerHTML = input.value;
	
	let label = document.createElement('label');
	label.innerHTML = 'wav osc vol: ';
	label.setAttribute('for', 'waveOscVolume' + newIdNum);
	
	// input for detune
	let detuneInput = document.createElement('input');
	detuneInput.setAttribute('name', 'waveOscDetune' + newIdNum);
	detuneInput.setAttribute('id', 'waveOscDetune' + newIdNum);
	detuneInput.setAttribute('type', 'range');
	detuneInput.setAttribute('max', 100);
	detuneInput.setAttribute('min', -100);
	detuneInput.setAttribute('step', 1);
	detuneInput.setAttribute('value', 0);
	
	let detuneValue = document.createElement('label');
	detuneValue.id = 'waveNodeDetuneValue' + newIdNum;
	detuneValue.innerHTML = detuneInput.value;
	
	let detuneLabel = document.createElement('label');
	detuneLabel.innerHTML = 'wav osc detune: ';
	detuneLabel.setAttribute('for', 'waveOscDetune' + newIdNum);
	
	let brElement1 = document.createElement('br');
	let brElement2 = document.createElement('br');
	let brElement3 = document.createElement('br');
	
	// select for oscillator wave type 
	let select = document.createElement('select');
	select.setAttribute('name', 'waveOscType' + newIdNum);
	select.id = 'waveOscType' + newIdNum;
	
	let options = [
		'square',
		'triangle',
		'sawtooth'
	];
	
	options.forEach((opt) => {
		let newOption = document.createElement('option');
		newOption.innerHTML = opt;
		select.appendChild(newOption);
	});
	
	let selectLabel = document.createElement('label');
	selectLabel.innerHTML = 'wav osc type: ';
	selectLabel.setAttribute('for', 'waveOscType' + newIdNum);
	
	// add event listeners for input and select
	input.addEventListener('input', (evt) => {
		newNodeParams[getAlphaString(input.id)] = evt.target.valueAsNumber;
		volumeValue.innerHTML = evt.target.valueAsNumber;
	});
	
	detuneInput.addEventListener('input', (evt) => {
		newNodeParams[getAlphaString(detuneInput.id)] = evt.target.valueAsNumber;
		detuneValue.innerHTML = evt.target.valueAsNumber;		
	});

	select.addEventListener('change', (evt) => {
		newNodeParams[getAlphaString(select.id)] = evt.target.value;
	});
	
	// put it all together
	newWaveNodeDiv.appendChild(h3);
	
	newWaveNodeDiv.appendChild(label);
	newWaveNodeDiv.appendChild(input);
	newWaveNodeDiv.appendChild(volumeValue);
	newWaveNodeDiv.appendChild(brElement2);
	
	newWaveNodeDiv.appendChild(detuneLabel);
	newWaveNodeDiv.appendChild(detuneInput);
	newWaveNodeDiv.appendChild(detuneValue);
	newWaveNodeDiv.appendChild(brElement3);
	
	newWaveNodeDiv.appendChild(brElement1);
	newWaveNodeDiv.appendChild(selectLabel);
	newWaveNodeDiv.appendChild(select);
	
	// TODO: don't need this after dynamic noise node creation implemented?
	let parent = document.getElementById(parentElement);
	parent.insertBefore(newWaveNodeDiv, parent.firstChild);
	
	// add all attributes of node to object
	newNodeParams[getAlphaString(input.id)] = 0.08;
	newNodeParams[getAlphaString(detuneInput.id)] = 0;
	newNodeParams[getAlphaString(select.id)] = 'square';
	
	currPreset.numWaveNodes += 1;
	currPreset.waveNodes.push(newNodeParams);
}

function createNewNoiseOsc(parentElement){

	// create a new noise section in html 
	let newNodeParams = {};
	
	let newIdNum = currPreset.numNoiseNodes + 1;
	let newNoiseNodeDiv = document.createElement('div');
	newNoiseNodeDiv.id = 'noiseNode' + newIdNum;
	newNoiseNodeDiv.className = 'noiseNode';
	newNoiseNodeDiv.style.border = "1px solid #000";
	newNoiseNodeDiv.style.marginBottom = "5px";
	newNoiseNodeDiv.style.padding = "5px";
	
	let h3 = document.createElement('h3');
	h3.innerHTML = 'noise node ' + newIdNum;
	
	let input = document.createElement('input');
	input.setAttribute('name', 'noiseOscVolume' + newIdNum);
	input.setAttribute('id', 'noiseOscVolume' + newIdNum);
	input.setAttribute('type', 'range');
	input.setAttribute('max', 0.2);
	input.setAttribute('min', 0.0);
	input.setAttribute('step', 0.01);
	input.setAttribute('value', 0.1);
	
	let volumeValue = document.createElement('label');
	volumeValue.id = 'noiseNodeVolValue' + newIdNum;
	volumeValue.innerHTML = input.value;
	
	let label = document.createElement('label');
	label.innerHTML = 'noise osc vol: ';
	label.setAttribute('for', 'noiseOscVolume' + newIdNum);
	
	let brElement1 = document.createElement('br');
	let brElement2 = document.createElement('br');
	let brElement3 = document.createElement('br');
	
	let freqInput = document.createElement('input');
	freqInput.setAttribute('name', 'noiseOscFreq' + newIdNum);
	freqInput.setAttribute('id', 'noiseOscFreq' + newIdNum);
	freqInput.setAttribute('type', 'range');
	freqInput.setAttribute('max', 5000);
	freqInput.setAttribute('min', 500);
	freqInput.setAttribute('step', 100);
	freqInput.setAttribute('value', 1800);
	
	let freqInputLabel = document.createElement('label');
	freqInputLabel.innerHTML = 'noise osc freq: ';
	freqInputLabel.setAttribute('for', 'noiseOscFreq' + newIdNum);
	
	let freqValue = document.createElement('label');
	freqValue.id = 'noiseOscFreqValue' + newIdNum;
	freqValue.innerHTML = freqInput.value;
	
	let select = document.createElement('select');
	select.setAttribute('name', 'noiseFilterPassType' + newIdNum);
	select.id = 'noiseFilterPassType' + newIdNum;
	
	let filterOptions = [
		'highpass',
		'lowpass'
	];
	
	filterOptions.forEach((opt) => {
		let newOption = document.createElement('option');
		newOption.innerHTML = opt;
		select.appendChild(newOption);
	});
	
	let selectLabel = document.createElement('label');
	selectLabel.innerHTML = 'noise filter pass type: ';
	selectLabel.setAttribute('for', 'noiseFilterPassType' + newIdNum);
	
	// add event listeners for input and select
	input.addEventListener('input', (evt) => {
		newNodeParams[getAlphaString(input.id)] = evt.target.valueAsNumber;
		volumeValue.innerHTML = evt.target.valueAsNumber;
	});
	
	freqInput.addEventListener('input', (evt) => {
		newNodeParams[getAlphaString(freqInput.id)] = evt.target.valueAsNumber;
		freqValue.innerHTML = evt.target.valueAsNumber;
	});

	select.addEventListener('change', (evt) => {
		newNodeParams[getAlphaString(select.id)] = evt.target.value;
	});
	
	// put it all together
	newNoiseNodeDiv.appendChild(h3);
	newNoiseNodeDiv.appendChild(label);
	newNoiseNodeDiv.appendChild(input);
	newNoiseNodeDiv.appendChild(volumeValue);
	newNoiseNodeDiv.appendChild(brElement1);
	newNoiseNodeDiv.appendChild(freqInputLabel);
	newNoiseNodeDiv.appendChild(freqInput);
	newNoiseNodeDiv.appendChild(freqValue);
	newNoiseNodeDiv.appendChild(brElement2);
	newNoiseNodeDiv.appendChild(selectLabel);
	newNoiseNodeDiv.appendChild(select);
	newNoiseNodeDiv.appendChild(brElement3);
	
	// TODO: don't need this after dynamic noise node creation implemented?
	let parent = document.getElementById(parentElement);
	parent.insertBefore(newNoiseNodeDiv, parent.firstChild);
	
	newNodeParams[getAlphaString(input.id)] = 0.1;
	newNodeParams[getAlphaString(select.id)] = 'highpass';
	newNodeParams[getAlphaString(freqInput.id)] = 1800;
	
	currPreset.numNoiseNodes += 1;
	currPreset.noiseNodes.push(newNodeParams);
}

// create initial nodes
createNewWavOsc('instrumentPreset');
createNewNoiseOsc('instrumentPreset');

document.getElementById('instrumentPresetDownload').addEventListener('click', () => {
	downloadPreset();
});

document.getElementById('addNewWavNode').addEventListener('click', () => {
	createNewWavOsc('instrumentPreset');
});

document.getElementById('addNewNoiseNode').addEventListener('click', () => {
	createNewNoiseOsc('instrumentPreset');
});

document.getElementById('instrumentPresetImport').addEventListener('click', function(){
	importInstrumentPreset();
});
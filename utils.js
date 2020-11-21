/***

	ui stuff

***/

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
	editWindow.style.display = "block";
	
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
							// also add it as a desired param value in a separate property
							// this is so that if we're working with an ADSR envelope on a gain node
							// we know the desired base value. we shouldn't rely on the actual value param to know that
							// since that will be variable and subject to change.
							node[prop].baseValue = inputtedValue;
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
					node[prop].baseValue = newVal;
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
	
	// allow user to close param edit window
	let hideWindow = document.createElement('p');
	hideWindow.textContent = 'close';
	hideWindow.style.color = "#ff0000";
	hideWindow.addEventListener('click', (evt) => {
		editWindow.style.display = "none";
	});
	editWindow.appendChild(hideWindow);
}


/***

	loading/exporting presets

***/

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
				for(let prop in buffer){
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
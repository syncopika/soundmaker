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
		line.setAttribute('stroke-dasharray', 10);
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
	
	let node = nodeInfo.node;
	let customizableProperties = Object.keys(nodeInfo.node.__proto__);

	if(customizableProperties.length === 0){
		// i.e. for adsr envelope 
		customizableProperties = Object.keys(nodeInfo.node).filter((prop) => typeof(nodeInfo.node[prop]) === "number");
	}

	customizableProperties.forEach((prop) => {
		let propertyDiv = document.createElement('div');
		propertyDiv.style.display = "inline-block";
		propertyDiv.style.marginRight = "3%";
		propertyDiv.style.marginLeft = "3%";
		
		let property = document.createElement('p');
		propertyDiv.appendChild(property);
		
		let text = prop;
		let isNumValue = false;
		if(node[prop].value !== undefined){
			text += ".value";
			isNumValue = true;
		}else if(typeof(node[prop]) === "number"){
			isNumValue = true;
		}
		
		property.textContent = text; // the name of the parameter to be edited

		if(isNumValue){
			editWindow.appendChild(propertyDiv);
			
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
				// use the base value, which is the current user-desired value, 
				// not the actual current value (i.e. for gain)
				slider.setAttribute('value', node[prop].baseValue);
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
				if(node[prop].value !== undefined){
					node[prop].value = newVal;
					node[prop].baseValue = newVal;
				}else{
					node[prop] = newVal;
				}
			});
			
			propertyDiv.appendChild(slider);
			propertyDiv.appendChild(editBox);
		}else{
			if(prop === "type"){
				// dropdown box for type
				editWindow.appendChild(propertyDiv);
				
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
				propertyDiv.appendChild(dropdown);
			}
		}
	});
	
	// allow user to close param edit window
	let hideWindow = document.createElement('p');
	hideWindow.style.margin = "0 auto";
	hideWindow.style.marginTop = "2%";
	hideWindow.style.width = "3%";
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
function importPreset(nodeFactory){
	
	let input = document.getElementById('importInstrumentPresetInput');
	input.addEventListener('change', processInstrumentPreset(nodeFactory), false);
	input.click();
}

function processInstrumentPreset(nodeFactory){
	return (function(nf){
		return function(evt){
			let reader = new FileReader();
			let file = evt.target.files[0];
			
			reader.onload = (function(theFile){
				return function(e){
					let data = JSON.parse(e.target.result)['data'];
					let presetName = data['presetName'];
					
					// clear out current nodes
					nodeFactory.reset();
					
					// add new nodes
					for(let nodeId in data){
						if(nodeId.indexOf("Gain") > -1){
							// gain node
							nodeFactory.addNewNode("gainNode");
						}else if(nodeId.indexOf("Oscillator") > -1){
							// oscillator node
							nodeFactory.addNewNode("waveNode");
						}else if(nodeId.indexOf("ADSR") > -1){
							// ADSR envelope
							nodeFactory.addNewNode("ADSREnvelope");
						}else if(nodeId.indexOf("AudioBuffer") > -1){
							// audio buffer node
							nodeFactory.addNewNode("noiseNode");
						}else if(nodeId.indexOf("BiquadFilter") > -1){
							// biquad filter node
							nodeFactory.addNewNode("BiqudFilterNode");
						}
						
						if(nodeId !== "AudioDestinationNode"){
							let node = nodeFactory.nodeStore[nodeId];
							node.feedsInto = data[nodeId].feedsInto;
							node.feedsFrom = data[nodeId].feedsFrom;
							
							// update params based on saved values
							let params = data[nodeId].node;
							for(let param in params){
								if(node.node[param].value !== undefined){
									node.node[param].value = params[param];
									node.node[param].baseValue = params[param];
								}else{
									node.node[param] = params[param];
								}
							}
							
							// connect nodes in UI with svg lines
							node.feedsInto.forEach((sinkId) => {
								source = document.getElementById(nodeId);
								sink = document.getElementById(sinkId);
								if(nodeId.indexOf("ADSR") > -1){
									drawLineBetween(source, sink, dash=true);
								}else{
									drawLineBetween(source, sink, dash=false);
								}
							});
						}
					}
				}
			})(file);

			reader.readAsText(file);
		}
	})(nodeFactory);
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
	
	let theData = {};
	theData["name"] = fileName;
	theData["data"] = objToExport;
	
	let blob = new Blob([JSON.stringify(theData, null, 2)], {type: "application/json"});
	let url = URL.createObjectURL(blob);
	let link = document.createElement('a');
	link.href = url;
	link.download = fileName + ".json";
	link.click();
}
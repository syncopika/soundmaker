import { NodeFactory } from "./NodeFactory";
import { 
    AudioStoreNode, 
    AudioBufferParameters,
    ExtendedAudioBufferSourceNode
} from "./types";

/***

    ui stuff

***/
export function drawLineBetween(htmlElement1: HTMLElement, htmlElement2: HTMLElement, dash=false){
    // instead, we should create an individual svg per line
    let svg = document.getElementById("svgCanvas");
    
    if(svg === null){
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg!.style.position = "absolute";
        svg!.id = "svgCanvas:" + htmlElement1.id + ":" + htmlElement2.id;
        svg!.style.zIndex = "0";
        svg!.style.height = "1000px"; // calculate these after you calculate the line dimensions?
        svg!.style.width = "1000px";    // calculate these after you calculate the line dimensions?
        
        document.getElementById('nodeArea')!.appendChild(svg!);
    }
    
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    if(line !== null){
        line.classList.add('line');
        line.setAttribute('stroke', '#000');
        line.setAttribute('stroke-width', '1px');
    }
    
    if(dash){
        // for dotted lines
        line.setAttribute('stroke-dasharray', "10");
    }
    
    const element1x = htmlElement1.offsetLeft + document.body.scrollLeft + ((htmlElement1.offsetWidth)/2);
    const element1y = htmlElement1.offsetTop + document.body.scrollTop + ((htmlElement1.offsetHeight)/2);
    const element2x = htmlElement2.offsetLeft + document.body.scrollLeft + ((htmlElement2.offsetWidth)/2);
    const element2y = htmlElement2.offsetTop + document.body.scrollTop + ((htmlElement2.offsetHeight)/2);
    
    if(svg !== null && line !== null){
        line.setAttribute('x1', String(element1x));
        line.setAttribute('y1', String(element1y));
        line.setAttribute('x2', String(element2x));
        line.setAttribute('y2', String(element2y));
        
        const maxWidth = Math.max(element1x, element2x) + 200;
        const maxHeight = Math.max(element1y, element2y) + 200;
        svg.style.height = parseInt(svg.style.height) < maxHeight ? (maxHeight + "px") : svg.style.height;
        svg.style.width = parseInt(svg.style.width) < maxWidth ? (maxWidth + "px") : svg.style.width;
        
        svg.appendChild(line);
    }
}

export function showParameterEditWindow(nodeInfo: AudioStoreNode, valueRanges: any){
    const editWindow = document.getElementById("editNode");
    if(editWindow === null) return;
    
    editWindow.style.display = "block";
    
    while(editWindow.firstChild){
        editWindow.removeChild(editWindow.firstChild);
    }
    const title = document.createElement("h3");
    title.textContent = nodeInfo.node.id;
    editWindow.appendChild(title);
    
    const node = nodeInfo.node;
    let customizableProperties = Object.keys(Object.getPrototypeOf(nodeInfo.node));

    if(customizableProperties.length === 0){
        // i.e. for adsr envelope 
        customizableProperties = Object.keys(nodeInfo.node).filter((prop) => typeof(nodeInfo.node[prop]) === "number");
    }

    customizableProperties.forEach((prop) => {
        const propertyDiv = document.createElement('div');
        propertyDiv.style.display = "inline-block";
        propertyDiv.style.marginRight = "3%";
        propertyDiv.style.marginLeft = "3%";
        
        const property = document.createElement('p');
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
            
            const slider = document.createElement('input');
            slider.id = text;
            slider.setAttribute('type', 'range');
            slider.setAttribute('max', props ? props['max'] : 0.5);
            slider.setAttribute('min', props ? props['min'] : 0.0);
            slider.setAttribute('step', props ? props['step'] : 0.01);
            
            // also allow value input via text edit box 
            const editBox = document.createElement('input');
            editBox.id = text + '-edit';
            editBox.setAttribute('size', "6");
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
            
            editBox.value = slider.getAttribute('value') || "";
            editBox.style.fontFamily = "monospace";
            editBox.addEventListener('input', (evt) => {
                // evaluate the new value. 
                // if it's a valid value, update the param it belongs to.
                const inputtedValue = parseFloat((<HTMLInputElement>evt.target).value);
                const sliderMinVal = slider.getAttribute('min');
                const sliderMaxVal = slider.getAttribute('max');
                
                if(sliderMinVal && sliderMaxVal &&
                   inputtedValue >= parseFloat(sliderMinVal) &&
                    inputtedValue <= parseFloat(sliderMaxVal)){
                        slider.setAttribute('value', (inputtedValue).toString());
                        
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
                const newVal = parseFloat((<HTMLInputElement>evt.target).value);
                editBox.value = (newVal).toString();
                
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
                
                const dropdown = document.createElement('select');
                dropdown.id = text + "Type";
                
                let options = [];
                if(node.constructor.name.indexOf("Oscillator") >= 0){
                    // use waveType
                    options = valueRanges["waveType"];
                }else{
                    // use filterType
                    options = valueRanges["filterType"];
                }
                options.forEach((opt: string) => {
                    const option = document.createElement('option');
                    option.textContent = opt;
                    dropdown.appendChild(option);
                });
                dropdown.addEventListener('change', (evt) => {
                    const val = dropdown.options[dropdown.selectedIndex].value;
                    nodeInfo.node[prop] = val;
                });
                dropdown.value = node[prop];
                propertyDiv.appendChild(dropdown);
            }
        }
    });
    
    // allow user to close param edit window
    const hideWindow = document.createElement('p');
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
export function importPreset(nodeFactory: NodeFactory){
    const input = document.getElementById('importInstrumentPresetInput');
    if(input !== null){
        input.addEventListener('change', importInstrumentPreset(nodeFactory), false);
        input.click();
    }
}

// TODO: make an interface for data parameter?
export function processPresetImport(data: any, nodeFactory: NodeFactory){
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
            nodeFactory.addNewNode("biquadFilterNode");
        }
        
        if(nodeId !== "AudioDestinationNode"){
            let node = nodeFactory.nodeStore[nodeId];
            node.feedsInto = data[nodeId].feedsInto;
            node.feedsFrom = data[nodeId].feedsFrom;
            
            // update params based on saved values
            let params = data[nodeId].node;
            
            if("buffer" in params){
                // need to create a new audiobuffersource node instance
                if(params["buffer"].channelData){
                    // create a new audiobuffer object that will be added to the source node instance
                    const bufferData = new Float32Array([...Object.values(params["buffer"].channelData) as number[]]); 
                    delete params["buffer"]['duration']; // duration param not supported for constructor apparently
                    
                    const buffer = new AudioBuffer(params["buffer"]);
                    buffer.copyToChannel(bufferData, 0); // only one channel. does this need to be changed?
                    params["buffer"] = buffer;
                }
                
                const newAudioBuffSource = new AudioBufferSourceNode(nodeFactory, params) as ExtendedAudioBufferSourceNode;
                newAudioBuffSource.loop = true;
                newAudioBuffSource.id = nodeId;
                node.node = newAudioBuffSource;
            }else{
                for(let param in params){
                    if(node.node[param].value !== undefined){
                        node.node[param].value = params[param];
                        node.node[param].baseValue = params[param];
                    }else if(param in node.node){
                        node.node[param] = params[param];
                    }
                }
            }
        }
    }
    
    // connect nodes in UI with svg lines
    // also offset the nodes in the UI a bit so the user can see that they were all loaded
    // otherwise they're stacked perfectly on each other and it looks like there's only a single node
    for(let nodeId in data){
        const node = nodeFactory.nodeStore[nodeId];
        node.feedsInto.forEach((sinkId) => {
            const source = document.getElementById(nodeId);
            if(source !== null){
                // offset source node UI slightly
                const maxTop = parseInt(source.style.top) + 80;
                const minTop = parseInt(source.style.top) - 80;
                source.style.top = (Math.random() * (maxTop - minTop) + minTop) + "px";
                
                const maxLeft = parseInt(source.style.left) + 80;
                const minLeft = parseInt(source.style.left) - 80;
                source.style.left = (Math.random() * (maxLeft - minLeft) + minLeft) + "px";
                
                const sink = document.getElementById(sinkId);
                const line = document.getElementById("svgCanvas:" + nodeId + ":" + sinkId);
                
                // make sure line doesn't exist already
                if(line !== null && sink !== null){
                    if(nodeId.indexOf("ADSR") > -1){
                        drawLineBetween(source, sink, true);
                    }else{
                        drawLineBetween(source, sink, false);
                    }
                }
            }
        });
    }    
}

export function importInstrumentPreset(nodeFactory: NodeFactory){
    return (function(nf){
        return function(evt: Event){
            const reader = new FileReader();
            const file = (<HTMLInputElement>evt.target).files![0];
            
            reader.onload = (function(theFile){
                return function(e){
                    const json = JSON.parse(reader.result as string);
                    if(json['data']){
                        processPresetImport(json['data'], nf);
                    }
                }
            })(file);

            reader.readAsText(file);
        }
    })(nodeFactory);
}

export function exportPreset(nodeFactory: NodeFactory){
    const fileName = prompt("enter filename");
    if(fileName === null || fileName === ""){
        return;
    }
    
    const objToExport: Record<string, any> = {}; // TODO: make be not any
    const currNodeStore = nodeFactory.nodeStore;
    const currNodeStoreKeys = Object.keys(currNodeStore);
    currNodeStoreKeys.forEach((node: string) => {
        const currNode = currNodeStore[node];
        
        const nodeProps = {
            id: currNode.node.id,
            node: {},
            feedsFrom: currNode.feedsFrom,
            feedsInto: currNode.feedsInto,
        };
        
        let params = Object.keys(Object.getPrototypeOf(currNode.node));
        if(params.length === 0){
            // i.e. for ADSREnvelope, which is just a regular object
            params = Object.keys(currNode.node);
        }
        
        const nodeParams: Record<string, any> = {};
        params.forEach((param) => {
            if(typeof(currNode.node[param]) === "object" && "value" in currNode.node[param]){
                // should just test value type instead? i.e. number vs string? if num, use value property?
                nodeParams[param] = currNode.node[param].value;
            }else if(currNode.node[param].constructor.name === "AudioBuffer"){
                // handle audio buffers specially
                const buffer: AudioBuffer = currNode.node[param];
                const bufferProps: AudioBufferParameters = {
                    duration: buffer.duration,
                    length: buffer.length,
                    numberOfChannels: buffer.numberOfChannels,
                    sampleRate: buffer.sampleRate,
                    channelData: buffer.getChannelData(0)
                };
                nodeParams[param] = bufferProps;
            }else{
                // single value for this param 
                nodeParams[param] = currNode.node[param];
            }
        });
        nodeProps.node = nodeParams;
        
        objToExport[node] = nodeProps;
    });
    
    const theData = {
        "name": fileName,
        "data": objToExport
    };
    
    const blob = new Blob([JSON.stringify(theData, null, 2)], {type: "application/json"});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName + ".json";
    link.click();
}

export function loadDemoPreset(presetName: string, nodeFactory: NodeFactory){
    fetch("demo-presets/" + presetName + ".json")
        .then(response => response.json())
        .then(data => {
            let theData = data.data;
            processPresetImport(theData, nodeFactory);
        });
}
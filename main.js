
var audioCtx;
let shouldContinue = false;
var carrier = null;
var modulatorFreq = null;
var modulationIndex = null;
var osc;
var timings;
var liveCodeState = [];
var wavetypes = {0:"sine", 1:"square", 2:"sawtooth"}
const playButton = document.querySelector('button');
const pauseButton = document.querySelector('#pauseButton');
pauseButton.addEventListener('click', pauseAudio); 


function pauseAudio() {
    audioCtx.suspend(); // Pause the audio context
    playButton.disabled = false; // Enable the play button
    pauseButton.disabled = true; // Disable the pause button
    shouldContinue = false; //kill loops

    if (carrier) {
        carrier.stop();
        carrier.disconnect(); 
        carrier = null;
    }
    if (modulatorFreq) {
        modulatorFreq.stop();
        modulatorFreq.disconnect(); 
        modulatorFreq = null;
    }

}

function initAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)
    osc = audioCtx.createOscillator();
    timings = audioCtx.createGain();
    timings.gain.value = 0;
    osc.connect(timings).connect(audioCtx.destination);
    osc.start();
    scheduleAudio()

}

function scheduleAudio() {
    let timeElapsedSecs = 0;
    liveCodeState.forEach(noteData => {
        timings.gain.setTargetAtTime(1, audioCtx.currentTime + timeElapsedSecs, 0.01)
        osc.frequency.setTargetAtTime(noteData["pitch"], audioCtx.currentTime + timeElapsedSecs, 0.01)
        timeElapsedSecs += noteData["length"]/10.0;
        timings.gain.setTargetAtTime(0, audioCtx.currentTime + timeElapsedSecs, 0.01)
        timeElapsedSecs += 0.2; //rest between notes
    });
    setTimeout(scheduleAudio, timeElapsedSecs * 1000);
}

function parseCode(code) {
    //how could we allow for a repeat operation 
    //(e.g. "3@340 2[1@220 2@330]"" plays as "3@340 1@220 2@330 1@220 2@330")
    let stack = [];
    let parsedNotes = [];
    let currentNote = "";

    for (let i=0; i<code.length; i++){
        let char = code[i];

        if (char === "["){
            stack.push(parsedNotes);
            stack.push(currentNote);
            parsedNotes = [];
            currentNote = "";
        }
        else if (char === "]"){
            let times = parseInt(stack.pop());
            let prevNotes = stack.pop();

            parsedNotes.push(parseSingleNote(currentNote));
            currentNote = "";
            let tempNotes = parsedNotes;
            parsedNotes = [];

            for (let j = 0; j < times; j++) {
                parsedNotes = [].concat(parsedNotes, tempNotes);
            }
            parsedNotes = [].concat(prevNotes, parsedNotes);
        }
        else if (char === " "){
            if(currentNote !== ""){
                parsedNotes.push(parseSingleNote(currentNote));
                currentNote = "";
            }
        }
        else{
            currentNote += char;
        }
    }

    if (currentNote !== "") {
        parsedNotes.push(parseSingleNote(currentNote));
    }


    return parsedNotes;
}

function genAudio(data) {
    liveCodeState = data;
}


function parseSingleNote(note) {
    let noteData = note.split("@");
    return {
        "length": eval(noteData[0]),
        "pitch": eval(noteData[1])
    };
}

function parseFMSynth(line) {
    var startIndex = line.indexOf('(');
    var endIndex = line.indexOf(')');
    var values = line.substring(startIndex + 1, endIndex).trim().split(',');
    var modFreq = parseInt(values[0]);
    var modIndex = parseInt(values[1]);
    var waveform = parseInt(values[2]);

    // Check if carrier and modulator oscillators exist
    if (!carrier || !modulatorFreq) {
        // Create oscillators and set up FM synthesis
        carrier = audioCtx.createOscillator();
        modulatorFreq = audioCtx.createOscillator();
        modulationIndex = audioCtx.createGain();
        modulatorFreq.connect(modulationIndex);
        modulationIndex.connect(carrier.frequency);
        carrier.connect(audioCtx.destination);
        carrier.start();
        modulatorFreq.start();
    }

    // Update oscillator parameters
    modulationIndex.gain.value = modIndex;
    modulatorFreq.frequency.value = modFreq;
    carrier.type = wavetypes[waveform];

    setTimeout(function() {
        carrier.stop();
        modulatorFreq.stop();
        carrier = null;
        modulatorFreq = null;
    }, 1000);

}

function parseADDSynth(line) {
    var startIndex = line.indexOf('(');
    var endIndex = line.indexOf(')');
    var values = line.substring(startIndex + 1, endIndex).trim().split(',');
    var freq = parseInt(values[0]);
    var num_oscillators = parseInt(values[1]);
    var waveform = parseInt(values[2]);

    const oscillators = [];

    const globalGain = audioCtx.createGain();
    globalGain.gain.value = 0.0001;
    globalGain.connect(audioCtx.destination);
    
    for (let i = 0; i < num_oscillators; i++) {
        oscillators[i] = audioCtx.createOscillator();
        oscillators[i].frequency.value = ((i+1) * freq) + (i % 2 === 0 ? Math.random() * 15 : -Math.random() * 15);
        oscillators[i].type = wavetypes[waveform]
        oscillators[i].connect(globalGain);
        oscillators[i].start();
    }
    
    globalGain.gain.setTargetAtTime(0.25, audioCtx.currentTime, 0.05);
    globalGain.gain.setTargetAtTime(0.0001, audioCtx.currentTime + 0.2, 1);
    

}


function reevaluate() {
    var code = document.getElementById('code').value;
    var lines = code.split('\n'); // Split the code by newline characters
    var parsedData = [];

    // Loop through each line of code
    for (let i = 0; i < lines.length; i++)  {
        line = lines[i];
        if(line.startsWith('live_loop')){
            // find index of the 'end' that matches the 'live_loop'
            let endIndex = lines.findIndex((line, index) => index > i && line.trim() === "end");
            if (endIndex !== -1){
                let liveLoopContent = lines.slice(i+1,endIndex).join('\n');
                shouldContinue = true;
                parseLiveLoop(liveLoopContent);
                // move the loop index to the line after 'end'
                i  = endIndex;
            }
            else{
                console.log("ERROR: missing end statement")
            }
        }
        else if (line.includes("fm_synth")) {
            parseFMSynth(line);
        }
        else if (line.includes("additive_synth")) {
            parseADDSynth(line);
        }
        else{
            var data = parseCode(line); // Parse each line of code
            parsedData = parsedData.concat(data); // Concatenate the parsed data
        }
       
    }

    console.log(parsedData);
    genAudio(parsedData);
}

// parse the contents of the live_loop block
// parse the contents of the live_loop block
function parseLiveLoop(content) {
    var lines = content.split('\n'); 
    var timeElapsedSecs = 0;
    lines.forEach(function(line) {
        if (!shouldContinue) {
            return; // Exit the loop
        }
        // Check if the line contains the word "sleep" followed by a number
        var sleepMatch = line.match(/sleep\s+(\d+)/);
        if (sleepMatch) {
            // Extract the sleep duration from the match
            var sleepDuration = parseInt(sleepMatch[1], 10);
            setTimeout(() => {
                console.log("Resuming after sleep:", sleepDuration);
            }, sleepDuration * 1000); 
            timeElapsedSecs += sleepDuration;
        } else {
            // If the line does not contain "sleep", you can play the notes here
            // Example: playNotes(line);
            console.log("Playing notes:", line);
            if (line.includes("fm_synth")) {
                parseFMSynth(line);
                timeElapsedSecs += 1.5;
            }
            else if (line.includes("additive_synth")) {
                parseADDSynth(line);
                timeElapsedSecs += 1.5;
            }
        }
    });

    // Schedule the next iteration of parsing after the elapsed time
    setTimeout(function() {
        if (shouldContinue) {
            parseLiveLoop(content);
        }
    }, timeElapsedSecs * 1000);
}


playButton.addEventListener('click', function () {

    if (!audioCtx) {
        initAudio();
    }
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    pauseButton.disabled = false;
    reevaluate();


});


var audioCtx;
var osc;
var timings;
var liveCodeState = [];
const playButton = document.querySelector('button');

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


function reevaluate() {
    var code = document.getElementById('code').value;
    var data = parseCode(code);
    console.log(data);
    genAudio(data);
}

playButton.addEventListener('click', function () {

    if (!audioCtx) {
        initAudio();
    }

    reevaluate();


});

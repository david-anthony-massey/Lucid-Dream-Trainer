var remote = require('electron').remote;
var electronFs = remote.require('fs');

function createAudioMeter(audioContext, clipLevel, averaging, clipLag) {
  var processor = audioContext.createScriptProcessor(512);
  processor.onaudioprocess = volumeAudioProcess;
  processor.clipping = false;
  processor.lastClip = 0;
  processor.volume = 0;
  processor.clipLevel = clipLevel || 0.98;
  processor.averaging = averaging || 0.95;
  processor.clipLag = clipLag || 750;

  // this will have no effect, since we don't copy the input to the output,
  // but works around a current Chrome bug.
  processor.connect(audioContext.destination);

  processor.checkClipping = function() {
    if (!this.clipping) return false;
    if (this.lastClip + this.clipLag < window.performance.now())
      this.clipping = false;
    return this.clipping;
  };

  processor.shutdown = function() {
    this.disconnect();
    this.onaudioprocess = null;
  };

  return processor;
}

function volumeAudioProcess(event) {
  var buf = event.inputBuffer.getChannelData(0);
  var bufLength = buf.length;
  var sum = 0;
  var x;

  // Do a root-mean-square on the samples: sum up the squares...
  for (var i = 0; i < bufLength; i++) {
    x = buf[i];
    if (Math.abs(x) >= this.clipLevel) {
      this.clipping = true;
      this.lastClip = window.performance.now();
    }
    sum += x * x;
  }

  // ... then take the square root of the sum.
  var rms = Math.sqrt(sum / bufLength);

  // Now smooth this out with the averaging factor applied
  // to the previous sample - take the max here because we
  // want "fast attack, slow release."
  this.volume = Math.max(rms, this.volume * this.averaging).toFixed(5);
  let string = this.volume;
  let time = new Date();
  time = time.toLocaleTimeString();
  //console.log(time.length);
  if (time.length < 11) {
    time = '0' + time;
  }
  electronFs.open('signals.txt', 'a', 666, function(e, id) {
    electronFs.write(id, string + ` , ${time} ß\n`, null, 'utf8', function() {
      electronFs.close(id, function() {
        // console.log('file is updated');
      });
    });
  });
  // console.log('volume ', this.volume);
  if (this.volume > 0.4) console.log('you looked right');
}

var audioContext = null;
var meter = null;
var canvasContext = null;
var WIDTH = 500;
var HEIGHT = 50;
var rafID = null;
var questions = [];
var answers = [];
var testStarted = false;
var answerChoices = [];
var chooseLooks = 0;
var cards = [];
var isCorrect = '';
var correct = 0;
var incorrect = 0;
var tooEarly = 0;

function setSpeech() {
  return new Promise(function(resolve, reject) {
    let synth = window.speechSynthesis;
    let id;

    id = setInterval(() => {
      if (synth.getVoices().length !== 0) {
        resolve(synth.getVoices());
        clearInterval(id);
      }
    }, 10);
  });
}

var voices = setSpeech();
voices.then(voice => console.log(voice));

window.onload = function() {
  // make flashcards

  let qaaArr = electronFs.readFileSync('questions.txt', 'utf8').split('ß');

  qaaArr.forEach(qaa => {
    qaa = qaa.split(',');
    questions.push(qaa[0]);
    answers.push(qaa[1]);
  });

  for (let i = 0; i < questions.length; i++) {}

  // grab our canvas
  canvasContext = document.getElementById('meter').getContext('2d');

  // monkeypatch Web Audio
  window.AudioContext = window.AudioContext || window.webkitAudioContext;

  // grab an audio context
  audioContext = new AudioContext();

  // Attempt to get audio input
  try {
    // monkeypatch getUserMedia
    navigator.getUserMedia =
      navigator.getUserMedia ||
      navigator.webkitGetUserMedia ||
      navigator.mozGetUserMedia;

    // ask for an audio input
    navigator.getUserMedia(
      {
        audio: {
          mandatory: {
            googEchoCancellation: 'false',
            googAutoGainControl: 'false',
            googNoiseSuppression: 'false',
            googHighpassFilter: 'false',
          },
          optional: [],
        },
      },
      gotStream,
      didntGetStream,
    );
  } catch (e) {
    alert('getUserMedia threw exception :' + e);
  }
};

function didntGetStream() {
  alert('Stream generation failed.');
}

var mediaStreamSource = null;

function gotStream(stream) {
  alert('cool');
  // Create an AudioNode from the stream.

  mediaStreamSource = audioContext.createMediaStreamSource(stream);

  // Create a new volume meter and connect it.
  meter = createAudioMeter(audioContext);

  mediaStreamSource.connect(meter);

  // kick off the visual updating
  drawLoop(true);
}

function drawLoop(bool) {
  // clear the background
  canvasContext.clearRect(0, 0, WIDTH, HEIGHT);

  // check if we're currently clipping
  if (meter.checkClipping()) canvasContext.fillStyle = 'red';
  else canvasContext.fillStyle = 'green';

  // console.log(meter.volume);
  if (meter.volume > 0.07 && bool) {
    chooseLooks += 1;
    // let word = new SpeechSynthesisUtterance(
    //   `${electronFs.readFileSync('signals.txt', 'utf8').slice(-30)}`,
    // );

    if (isCorrect === 'wait') {
      tooEarly += 1;
      let wait = document.getElementById('rightWrong-audio');
      let source = document.getElementById('rightWrong-audio-source');
      source.src = 'wait.wav';
      wait.load();
      wait.volume = 0.2;
      wait.play();
    } else if (isCorrect === true) {
      correct += 1;
      let right = document.getElementById('rightWrong-audio');
      let source = document.getElementById('rightWrong-audio-source');
      source.src = 'TP_Secret.wav';
      right.load();
      right.volume = 0.2;
      right.play();
    } else if (isCorrect === false) {
      incorrect += 1;
      let right = document.getElementById('rightWrong-audio');
      let source = document.getElementById('rightWrong-audio-source');
      source.src = 'TP_Pot_Shatter2.wav';
      right.load();
      right.volume = 0.2;
      right.play();
    }

    // draw a bar based on the current volume
    canvasContext.fillRect(0, 0, meter.volume * WIDTH * 1.4, HEIGHT);

    // set up the next visual callback
    bool = false;
  } else if (meter.volume < 0.06) {
    bool = true;
  }
  // draw a bar based on the current volume
  canvasContext.fillRect(0, 0, meter.volume * WIDTH * 1.4, HEIGHT);

  rafID = resolver(bool);
  // set up the next visual callback
  // rafID = window.requestAnimationFrame(() => {
  //   drawLoop(bool);
  // });
}

function startTest() {
  let backgroundAudioElement = document.getElementById('background-song');
  let source = document.getElementById('background-audio-source');
  source.src = 'bad_apple.mp3';
  backgroundAudioElement.load();
  backgroundAudioElement.volume = 0.008;
  backgroundAudioElement.play();
  backgroundAudioElement.addEventListener(
    'ended',
    function() {
      backgroundAudioElement.currentTime = 0;
      backgroundAudioElement.play();
    },
    false,
  );
  testStarted = true;

  // should have some audio or lookout to start testing

  // shuffle the questions and answer choices with a 1/6 chance that the correct answer isn't there.
  let qAndAs = electronFs.readFileSync('questions.txt', 'utf8').split('å');
  let qs = [];
  let as = [];
  for (let i = 0; i < qAndAs.length; i++) {
    let qAndA = qAndAs[i].split('ß');
    qs.push(qAndA[0]);
    as.push(qAndA[1]);
  }
  shuffleQAndAs(qs, as);
  cards = createCards(qs, as);

  console.log(qs, as);
  console.log(cards);
  readCards(cards);
}

function askQuestion() {
  let word = new SpeechSynthesisUtterance(
    `${electronFs.readFileSync('signals.txt', 'utf8').slice(-30)}`,
  );
}

async function resolver(bool) {
  if (testStarted === false) {
    const check = await checkForREM();
    if (check === true) {
      startTest();
      return window.requestAnimationFrame(() => {
        drawLoop(bool);
      });
    } else {
      // console.log("didn't happen");
      return window.requestAnimationFrame(() => {
        drawLoop(bool);
      });
    }
  } else {
    // const answer = await f2(bool);
    return window.requestAnimationFrame(() => {
      drawLoop(bool);
    });
  }
}

function checkForREM() {
  // console.log('c4rem');
  let dataArr = electronFs
    .readFileSync('signals.txt', 'utf8')
    .slice(-1009)
    .split('ß');

  let firstVal = dataArr[0].split(',')[0];
  //console.log('dataArr', dataArr);
  // console.log('firstVal', firstVal);
  // console.log('lastVal', lastVal);
  if (dataArr.length === 43) {
    //console.log('length22');
    if (firstVal >= 0.01 && firstVal <= 0.04) {
      let avg1 = 0;
      let avg2 = 0;
      let avg3 = 0;
      let avg4 = 0;
      for (let j = 0; j < 7; j++) {
        avg1 += parseFloat(dataArr[j].split(',')[0]);
        avg2 += parseFloat(dataArr[j + 7].split(',')[0]);
        avg3 += parseFloat(dataArr[j + 14].split(',')[0]);
        avg4 += parseFloat(dataArr[j + 21].split(',')[0]);
      }

      avg1 = avg1 / 7;
      avg2 = avg2 / 7;
      avg3 = avg3 / 7;
      avg4 = avg4 / 7;

      console.log('avg1', avg1);
      console.log('avg2', avg2);
      console.log('avg3', avg3);
      console.log('avg4', avg4);

      if (avg1 - avg2 < -0.02 && avg3 - avg4 > 0.01) {
        alert('poop ');
        return true;
      }
      return false;
    }
  }
}

function shuffleQAndAs(questions, answers) {
  for (let i = questions.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i

    [questions[i], questions[j]] = [questions[j], questions[i]];
    [answers[i], answers[j]] = [answers[j], answers[i]];
  }
}

function shuffle(array) {
  for (let i = questions.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1)); // random index from 0 to i

    [array[i], array[j]] = [array[j], array[i]];
  }
}

function createCards(questions, answers) {
  console.log('answers', answers);
  for (let i = 0; i < questions.length; i++) {
    let randomAnsObj = { C: i };
    let randomAnsArr = [];
    let correctAnswerSpot = 4;
    while (randomAnsArr.length < 3) {
      let possibleWrongAnswer = Math.floor(Math.random() * questions.length);
      if (
        randomAnsObj[possibleWrongAnswer] === undefined &&
        i !== possibleWrongAnswer
      ) {
        randomAnsObj[possibleWrongAnswer] = possibleWrongAnswer;
        randomAnsArr.push(answers[possibleWrongAnswer]);
      }
    }

    if (Math.floor(Math.random() * (5 + 1)) === 1) {
      console.log('the correct answer is none');
      while (randomAnsArr.length < 4) {
        let possibleWrongAnswer = Math.floor(Math.random() * questions.length);
        if (
          randomAnsObj[possibleWrongAnswer] === undefined &&
          i !== possibleWrongAnswer
        ) {
          randomAnsObj[possibleWrongAnswer] = possibleWrongAnswer;
          randomAnsArr.push(answers[possibleWrongAnswer]);
        }
      }
    } else {
      randomAnsArr.push(answers[randomAnsObj['C']]);
      correctAnswerSpot = Math.floor(Math.random() * (3 + 1));
      console.log(
        'randomAnsArr',
        randomAnsArr,
        'correctAnswerSpot',
        correctAnswerSpot,
      );
      [randomAnsArr[correctAnswerSpot], randomAnsArr[3]] = [
        randomAnsArr[3],
        randomAnsArr[correctAnswerSpot],
      ];
    }

    randomAnsArr.push("The correct definition wasn't one of the answers");

    cards.push([questions[i], randomAnsArr, correctAnswerSpot]);
  }

  return cards;
}

async function readCards(cards) {
  console.log(cards);
  for (i = 0; i < cards.length; i++) {
    console.log(cards[i][1]);
    isCorrect = 'wait';
    await getNextAudio(cards[i][0]);
    await getSilence(2);
    await getNextAudio(cards[i][0].split('').join('. '), 0.9);
    await getSilence(2);
    await getNextAudio(cards[i][0]);
    await getSilence(2);
    await getSilence(2);
    isCorrect = false;
    if (cards[i][2] == 0) {
      console.log('look right, this is the right answer');
      isCorrect = true;
    }
    await getNextAudio(cards[i][1][0]);
    await getSilence(2);
    await getSilence(2);
    isCorrect = false;
    if (cards[i][2] == 1) {
      console.log('look right, this is the right answer');
      isCorrect = true;
    }
    await getNextAudio(cards[i][1][1]);
    await getSilence(2);
    await getSilence(2);
    isCorrect = false;
    if (cards[i][2] == 2) {
      console.log('look right, this is the right answer');
      isCorrect = true;
    }
    await getNextAudio(cards[i][1][2]);
    await getSilence(2);
    await getSilence(2);
    isCorrect = false;
    if (cards[i][2] == 3) {
      console.log('look right, this is the right answer');
      isCorrect = true;
    }
    await getNextAudio(cards[i][1][3]);
    await getSilence(2);
    await getSilence(2);
    isCorrect = false;
    if (cards[i][2] == 4) {
      console.log('look right, this is the right answer');
      isCorrect = true;
    }
    await getNextAudio(cards[i][1][4]);
    await getSilence(2);
    await getSilence(2);
    isCorrect = 'wait';
    await getNextAudio(cards[i][1][cards[i][2]]);
    await getSilence(2);
    await getSilence(2);
    await getSilence(2);
    await getSilence(2);
  }

  async function getNextAudio(sentence, rate) {
    let audioRate = rate || 1;
    console.log(sentence);
    let audio = new SpeechSynthesisUtterance(sentence);
    audio.rate = audioRate;

    var voices2 = window.speechSynthesis.getVoices();

    audio.voice = voices2.filter(function(voice) {
      return voice.name == 'Karen';
    })[0];

    window.speechSynthesis.speak(audio);

    return new Promise(resolve => {
      audio.onend = resolve;
    });
  }

  async function getSilence(seconds) {
    let silenceAudioElement = document.getElementById('silence-audio');
    let source = document.getElementById('silence-audio-source');
    source.src = `${seconds}sec.mp3`;
    silenceAudioElement.load();
    silenceAudioElement.play();

    return new Promise(resolve => {
      silenceAudioElement.onended = resolve;
    });
  }
}

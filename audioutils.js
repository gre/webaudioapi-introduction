var NOTES = (function () {
  var notes = {};
  var toneSymbols = "CcDdEFfGgAaB";
  function noteToFrequency (note) {
    return Math.pow(2, (note-69)/12)*440;
  };
  for (var octave = 0; octave <= 10; ++octave) {
    for (var t = 0; t < 12; ++t) {
      notes[octave*12+t] = notes[toneSymbols[t]+octave] = noteToFrequency(octave * 12 + t);
    }
  }
  return notes;
}());

function noteEnvelope (gainNode, time, volume, a, d, s, r) {
  var ctx = gainNode.context;
  var gain = gainNode.gain;
  gain.value = 0;
  gain.cancelScheduledValues(0);
  gain.setValueAtTime(0, time);
  gain.linearRampToValueAtTime(volume, time + a);
  gain.linearRampToValueAtTime(volume * s, time + a + d);
  return function (t) {
    gain.cancelScheduledValues(0);
    gain.setValueAtTime(gain.value, t);
    gain.linearRampToValueAtTime(0, t + r);
    return Q.delay(1000*(0.1 + (t+r) - ctx.currentTime));
  };
}


  function Noise (ctx) {
    var bufferSize = 2 * ctx.sampleRate,
    noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate),
    output = noiseBuffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    var whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    var gain = ctx.createGain();
    whiteNoise.connect(gain);

    var filter = ctx.createBiquadFilter();
    gain.connect(filter);
    filter.type = "lowpass";

    this.white = whiteNoise;
    this.gain = gain;
    this.out = this.filter = filter;
  }

var createDivHere = (function (i) {
  return function () {
    var nodeid = "div_"+(i++);
    document.write('<div id="'+nodeid+'"></div>');
    return document.getElementById(nodeid);
  };
}(1));

var hookRevealJS = function (f) {
  var div = createDivHere();
  var parents = $(div).parents("section");
  var currentSectionH = parents.last().prevAll("section").size();
  var currentSectionV = parents.size()<=1 ? 0 : $(div).parents("section").first().prevAll("section").size();
  $(function(){
    var end;
    var lastH, lastV;
    function syncIndices (h, v) {
      if (h===lastH && v===lastV) return;
      lastH = h;
      lastV = v;
      if (end) {
        end.resolve();
        end = null;
      }
      if (h === currentSectionH && v === currentSectionV) {
        end = Q.defer();
        f(div, end.promise);
        Reveal.layout();
      }
    }
    Reveal.addEventListener('slidechanged', function(event) {
      syncIndices(event.indexh, event.indexv);
    });
    Reveal.addEventListener('ready', function () {
      var indices = Reveal.getIndices();
      syncIndices(indices.h, indices.v);
    });
  });
};

function loadSound (ctx, url) {
  var d = Q.defer();
  var request = new XMLHttpRequest();
  request.open('GET', url, true);
  request.responseType = 'arraybuffer';

  request.onload = function() {
    ctx.decodeAudioData(request.response, function(b) {
      d.resolve(b);
    }, function(e){
      d.reject(e);
    });
  };
  request.onerror = function(e) {
    d.reject(e);
  };
  request.send();
  return d.promise;
}

function createVizs (ctx, container, out) {

  var div = $('<div style="margin-bottom: 20px" />').appendTo(container);

  var marginRight = 30;
  var sample = ctx.createBufferSource();
  sample.loop = true;
  var waveform = new Waveform({
  });
  var waveformView = new WaveformView({
    model: waveform
  });
  waveformView.$el.appendTo(div);
  waveformView.$el.css("margin-right", marginRight);
  waveform.setNode(out, ctx);

  var spectrum = new Spectrum({
  });
  var spectrumView = new SpectrumView({
    model: spectrum
  });
  spectrumView.$el.appendTo(div);
  spectrumView.$el.css("margin-right", marginRight);
  spectrum.setNode(out, ctx);

  var spectrogram = new Spectrogram({
  });
  var spectrogramView = new SpectrogramView({
    model: spectrogram
  });
  spectrogramView.$el.appendTo(div);
  spectrogram.setNode(out, ctx);

  return {
    update: function () {
      waveform.update();
      spectrum.update();
      spectrogram.update();
    }
  };
}

(function(){
// Play notes with the keyboard

var AZERTYconfig = {
  decrementOctaveKey: 186, // ":"
  incrementOctaveKey: 187, // "="
  keyCodeByTones: [
    87,83,88,68,67,86,71,66,72,78,74,188, // first octave (lower keyboard)
    65,50,90,222,69,82,53,84,54,89,55,85 // second octave (up keyboard)
  ]
};

var QWERTYconfig = {
  decrementOctaveKey: 190,
  incrementOctaveKey: 191,
  keyCodeByTones: [
    90,83,88,68,67,86,71,66,72,78,74,77, // first octave (lower keyboard)
    81,50,87,51,69,82,53,84,54,89,55,85 // second octave (up keyboard)
  ]
};

KeyboardController = Backbone.Model.extend({
  defaults: _.extend({
    octave: 4,
    keyCodeByTones: []
  }, AZERTYconfig),
  initialize: function () {
    $(window).on("keydown", _.bind(this.onKeydown, this));
    $(window).on("keyup", _.bind(this.onKeyup, this));
  },
  keysDown: [],
  onKeyup: function (e) {
    if (!e.which) return;
    this.keysDown = _.filter(this.keysDown, function (key) {
      return key !== e.which;
    });
    var tone = this.get("keyCodeByTones").indexOf(e.which);
    if (tone > -1) {
      e.preventDefault();
      var note = this.get("octave")*12+tone;
      if (note >= 0 && note <= 127) {
        this.trigger("noteOff", note);
      }
    }
  },
  onKeydown: function (e) {
    if (!e.which) return;
    var alreadyPressed = _.contains(this.keysDown, e.which);
    this.keysDown.push(e.which);
    if (e.altKey || e.shiftKey || e.metaKey || e.altKey) return;
    var incrX = 0, incrY = 0;

    if (e.which===this.get("incrementOctaveKey")) {
      this.set("octave", Math.min(9, this.get("octave")+1));
    }
    else if (e.which===this.get("decrementOctaveKey")) {
      this.set("octave", Math.max(0, this.get("octave")-1));
    }
    else {
      var tone = this.get("keyCodeByTones").indexOf(e.which);
      if (!alreadyPressed && tone > -1) {
        e.preventDefault();
        var note = this.get("octave")*12+tone;
        if (note >= 0 && note <= 127) {
          this.trigger("noteOn", note, 127);
        }
      }
    }
  }
}, {
  AZERTYconfig: AZERTYconfig,
  QWERTYconfig: QWERTYconfig
});

}());

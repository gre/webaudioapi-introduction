
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
        Reveal.sync();
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

function createVizs (ctx, div, out) {

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

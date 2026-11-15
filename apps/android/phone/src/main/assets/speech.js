(() => {
  if (window.__ldSpeech || !window.LivingDraftSpeech) return;
  let active = null;
  window.__ldSpeech = {
    partial: (text) => active && active._emit(text, false),
    final: (text) => active && active._emit(text, true),
    error: (code) => active && active.onerror && active.onerror({ error: code }),
    end: () => {
      const ending = active;
      active = null;
      if (ending && ending.onend) ending.onend();
    },
  };
  class Recognition {
    constructor() {
      this.continuous = false;
      this.interimResults = false;
      this.lang = navigator.language || 'en-US';
      this.onresult = null;
      this.onerror = null;
      this.onend = null;
      this.onstart = null;
      this._results = [];
    }
    start() {
      if (active && active !== this) LivingDraftSpeech.cancel();
      active = this;
      this._results = [];
      LivingDraftSpeech.start(this.lang, Boolean(this.interimResults));
      if (this.onstart) this.onstart();
    }
    stop() {
      LivingDraftSpeech.stop();
    }
    abort() {
      LivingDraftSpeech.cancel();
    }
    _emit(text, isFinal) {
      const item = Object.assign([{ transcript: text, confidence: 0.9 }], { isFinal });
      const last = this._results[this._results.length - 1];
      if (last && !last.isFinal) this._results[this._results.length - 1] = item;
      else this._results.push(item);
      if (!isFinal && !this.interimResults) return;
      if (this.onresult)
        this.onresult({ resultIndex: this._results.length - 1, results: this._results });
    }
  }
  window.SpeechRecognition = Recognition;
  window.webkitSpeechRecognition = Recognition;
})();

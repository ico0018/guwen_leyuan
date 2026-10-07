(function (root) {
  "use strict";

  // Only explicitly configured recordings are requested. A generation token
  // prevents a rejected or delayed old recording from starting new speech.
  function createSpeechController(env, onStatus = () => {}) {
    let generation = 0, audio = null, utterance = null, cancelPending = null;
    let chineseVoice = null;
    const synth = env.speechSynthesis;
    function refreshVoices() {
      const voices = synth && synth.getVoices ? synth.getVoices() : [];
      const mainland = voices.filter((v) => /^zh[-_]CN$/i.test(v.lang));
      const chinese = voices.filter((v) => /^zh/i.test(v.lang));
      const candidates = mainland.length ? mainland : chinese;
      chineseVoice = candidates.find((v) => /Xiaoxiao|Yunxi|普通话|Mandarin|Natural/i.test(v.name)) || candidates[0] || null;
    }
    refreshVoices();
    if (synth && synth.addEventListener) synth.addEventListener("voiceschanged", refreshVoices);
    else if (synth) synth.onvoiceschanged = refreshVoices;
    function disposeAudio() {
      if (!audio) return;
      audio.onended = audio.onerror = null;
      audio.pause();
      try { audio.currentTime = 0; } catch (_) { /* not loaded yet */ }
      audio = null;
    }
    function stop() {
      generation += 1;
      if (cancelPending) cancelPending();
      disposeAudio();
      utterance = null;
      if (synth) synth.cancel();
      onStatus("idle");
    }
    function finish(token, status = "idle") {
      if (token !== generation) return;
      disposeAudio();
      utterance = null;
      onStatus(status);
    }
    async function tryPlayRecordedAudio(path, token) {
      if (!path || typeof env.Audio !== "function") return false;
      try {
        audio = new env.Audio(path);
        const recording = audio;
        const played = await new Promise((resolve) => {
          let settled = false;
          const settle = (ok) => {
            if (settled) return;
            settled = true;
            env.clearTimeout(timer);
            cancelPending = null;
            resolve(ok);
          };
          const timer = env.setTimeout(() => settle(false), 1800);
          cancelPending = () => settle(false);
          recording.onerror = () => settle(false);
          // Await the promise; calling play() alone does not imply success.
          Promise.resolve(recording.play()).then(() => {
            if (token !== generation || audio !== recording) recording.pause();
            settle(token === generation && audio === recording);
          }, () => settle(false));
        });
        if (token !== generation) return false;
        if (!played) { disposeAudio(); return false; }
        recording.onended = () => finish(token);
        recording.onerror = () => {
          disposeAudio();
          speakWithSystemVoice(utteranceText, token);
        };
        onStatus("recording");
        return true;
      } catch (_) {
        if (token === generation) disposeAudio();
        return false;
      }
    }
    let utteranceText = "";
    function speakWithSystemVoice(text, token) {
      if (token !== generation) return;
      if (!synth || !env.SpeechSynthesisUtterance) { finish(token, "unavailable"); return; }
      try {
        refreshVoices();
        utterance = new env.SpeechSynthesisUtterance(text);
        utterance.lang = chineseVoice ? chineseVoice.lang : "zh-CN";
        if (chineseVoice) utterance.voice = chineseVoice;
        utterance.rate = 0.8;
        utterance.onend = () => finish(token);
        utterance.onerror = () => finish(token, "unavailable");
        onStatus("speaking");
        if (synth.resume) synth.resume();
        synth.speak(utterance);
      } catch (_) { finish(token, "unavailable"); }
    }
    async function read(text, path = "") {
      stop();
      const token = generation;
      utteranceText = text;
      onStatus("speaking");
      if (path && await tryPlayRecordedAudio(path, token)) return;
      speakWithSystemVoice(text, token);
    }
    return { stop, read, refreshVoices };
  }
  if (typeof module !== "undefined" && module.exports) module.exports = { createSpeechController };
  else root.GuwenSpeech = { createSpeechController };
})(typeof window !== "undefined" ? window : globalThis);

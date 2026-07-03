import { useCallback, useEffect, useRef, useState } from "react";

// Wraps the browser Web Speech API (SpeechSynthesis + SpeechRecognition).
// Push-to-talk: the caller starts listening, then explicitly stops. The answer
// is only finalized (and sent to the backend) when the user stops — never on a
// mid-answer pause — so long, multi-sentence answers are captured in full.
export function useSpeech() {
  const SpeechRecognition =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window && !!SpeechRecognition;

  const [speaking, setSpeaking] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");

  const voiceRef = useRef(null);
  const recognitionRef = useRef(null);
  // finalTextRef accumulates every finalized chunk across the WHOLE answer,
  // including across Chrome's automatic recognition restarts. This is the
  // single source of truth for what the candidate said.
  const finalTextRef = useRef("");
  // The latest not-yet-finalized phrase (the live "interim" tail). Kept so we
  // can salvage it if the user stops before Chrome promotes it to a final.
  const interimRef = useRef("");
  const onFinalRef = useRef(null);
  const listeningRef = useRef(false); // true while the user is holding the mic
  const restartTimerRef = useRef(null);
  const finalizedRef = useRef(true); // guards against double-finalize per answer

  // Set up a fresh recognition instance.
  useEffect(() => {
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    // ---- Transcript assembly happens HERE ----
    // Every final result is APPENDED (never overwritten) to finalTextRef, so a
    // long answer made of many phrases accumulates into one complete string.
    recognition.onresult = (event) => {
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTextRef.current += result[0].transcript + " ";
        } else {
          interimText += result[0].transcript;
        }
      }
      interimRef.current = interimText;
      setInterim(interimText);
    };

    recognition.onend = () => {
      // If the user is still holding the mic, Chrome ended on its own (a pause
      // or its ~60s session cap). Do NOT finalize — restart on a short timer so
      // capture continues and the accumulated transcript is preserved.
      if (listeningRef.current) {
        restartTimerRef.current = setTimeout(() => {
          if (!listeningRef.current) return;
          try {
            recognition.start();
          } catch {
            // start() throws if it's already running (fine) — otherwise retry.
            restartTimerRef.current = setTimeout(() => {
              if (listeningRef.current) {
                try {
                  recognition.start();
                } catch {
                  /* ignore */
                }
              }
            }, 300);
          }
        }, 120);
        return;
      }
      // User has stopped — finalize the full accumulated answer.
      finalize();
    };

    recognition.onerror = (e) => {
      const type = e?.error || "unknown";
      // "no-speech" / "aborted" are benign; onend will restart if still holding.
      if (type === "not-allowed" || type === "service-not-allowed") {
        setError(
          "Microphone access was blocked. Click the mic/camera icon in Chrome's address bar and allow the microphone, then reload."
        );
      } else if (type === "audio-capture") {
        setError("No microphone was found. Check that a mic is connected and enabled.");
      } else if (type === "network") {
        setError("Speech recognition needs an internet connection (it runs via Google).");
      }
      if (type === "not-allowed" || type === "service-not-allowed" || type === "audio-capture") {
        listeningRef.current = false;
        setListening(false);
      }
    };

    // Combine accumulated finals + any trailing interim, then hand the FULL
    // answer to the caller. Runs exactly once per answer.
    function finalize() {
      if (finalizedRef.current) return;
      finalizedRef.current = true;
      clearTimeout(restartTimerRef.current);
      setListening(false);
      setInterim("");

      let full = finalTextRef.current.trim();
      const tail = interimRef.current.trim();
      // Salvage a trailing phrase that never became a final result.
      if (tail && !full.endsWith(tail)) {
        full = (full + " " + tail).trim();
      }
      finalTextRef.current = "";
      interimRef.current = "";

      if (onFinalRef.current) onFinalRef.current(full);
    }

    recognition.finalizeNow = finalize; // exposed for the stop() fallback
    recognitionRef.current = recognition;

    return () => {
      listeningRef.current = false;
      clearTimeout(restartTimerRef.current);
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
    };
  }, [SpeechRecognition]);

  // Pick a warm, sweet female English voice for Maya. Voices load async, so we
  // listen for `voiceschanged` and re-pick once they're available.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    // Preferred female voices, best-sounding first, across Chrome/macOS/Windows.
    const PREFERRED = [
      "google uk english female",
      "samantha",
      "google us english",
      "microsoft aria",
      "microsoft jenny",
      "microsoft zira",
      "ava",
      "serena",
      "allison",
      "victoria",
      "karen",
      "tessa",
      "moira",
    ];

    function pickVoice() {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const byName = (needle) =>
        voices.find((v) => v.name.toLowerCase().includes(needle));
      let chosen = null;
      for (const name of PREFERRED) {
        chosen = byName(name);
        if (chosen) break;
      }
      // Fallbacks: any voice that self-identifies as female, then any English.
      chosen =
        chosen ||
        voices.find((v) => /female/i.test(v.name)) ||
        voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
      if (chosen) voiceRef.current = chosen;
    }

    pickVoice();
    window.speechSynthesis.onvoiceschanged = pickVoice;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, []);

  // Speak text aloud; resolves when finished. Includes a watchdog because
  // Chrome sometimes fails to fire `onend`, which would otherwise hang the UI.
  const speak = useCallback((text) => {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      const synth = window.speechSynthesis;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      // Sweet, melodic female voice — slightly higher pitch, gentle pace.
      if (voiceRef.current) utterance.voice = voiceRef.current;
      utterance.rate = 0.97;
      utterance.pitch = 1.15;

      let started = false;
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearInterval(watchdog);
        setSpeaking(false);
        resolve();
      };

      utterance.onstart = () => {
        started = true;
        setSpeaking(true);
      };
      utterance.onend = finish;
      utterance.onerror = finish;

      synth.speak(utterance);

      let ticks = 0;
      const watchdog = setInterval(() => {
        ticks++;
        if (started && !synth.speaking) finish();
        else if (ticks > 120) finish(); // ~60s absolute ceiling
      }, 500);
    });
  }, []);

  // Start capturing. onFinal receives the FULL transcript when the user stops.
  const startListening = useCallback((onFinal) => {
    if (!recognitionRef.current || listeningRef.current) return;
    setError("");
    onFinalRef.current = onFinal;
    finalTextRef.current = "";
    interimRef.current = "";
    finalizedRef.current = false;
    setInterim("");
    listeningRef.current = true;
    try {
      recognitionRef.current.start();
      setListening(true);
    } catch {
      // start() throws if already running — treat as already listening.
      setListening(true);
    }
  }, []);

  // Stop capturing; onend then finalizes with the full transcript. A fallback
  // timer covers the rare case where the user stops during a restart gap and
  // onend doesn't fire.
  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !listeningRef.current) return;
    listeningRef.current = false;
    clearTimeout(restartTimerRef.current);
    try {
      recognitionRef.current.stop();
    } catch {
      /* ignore */
    }
    setTimeout(() => recognitionRef.current?.finalizeNow?.(), 600);
  }, []);

  const cancelSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  return {
    supported,
    speaking,
    listening,
    interim,
    error,
    speak,
    startListening,
    stopListening,
    cancelSpeaking,
  };
}

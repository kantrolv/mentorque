import { useCallback, useEffect, useRef, useState } from "react";

// Wraps the browser Web Speech API (SpeechSynthesis + SpeechRecognition).
// Push-to-talk: caller toggles listening on/off explicitly.
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

  const recognitionRef = useRef(null);
  const finalTextRef = useRef("");
  const onFinalRef = useRef(null);
  const listeningRef = useRef(false);

  // Set up a fresh recognition instance.
  useEffect(() => {
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

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
      setInterim(interimText);
    };

    recognition.onend = () => {
      // If the browser ended recognition on its own (e.g. brief silence) but
      // the user hasn't clicked "stop" yet, keep listening.
      if (listeningRef.current) {
        try {
          recognition.start();
          return;
        } catch {
          /* fall through to finalize */
        }
      }
      setListening(false);
      setInterim("");
      const text = finalTextRef.current.trim();
      finalTextRef.current = "";
      if (onFinalRef.current) onFinalRef.current(text);
    };

    recognition.onerror = (e) => {
      const type = e?.error || "unknown";
      // "no-speech" / "aborted" are benign; only surface real problems.
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

    recognitionRef.current = recognition;

    return () => {
      listeningRef.current = false;
      try {
        recognition.abort();
      } catch {
        /* ignore */
      }
    };
  }, [SpeechRecognition]);

  // Speak text aloud; resolves when finished. Includes a watchdog because
  // Chrome sometimes fails to fire `onend`, which would otherwise hang the UI.
  const speak = useCallback((text) => {
    return new Promise((resolve) => {
      if (!("speechSynthesis" in window)) return resolve();
      const synth = window.speechSynthesis;
      synth.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1;
      utterance.pitch = 1;

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

      // Poll: once speech has started and the queue drains, finish. Also a
      // hard cap so a totally silent failure can't wedge the interview.
      let ticks = 0;
      const watchdog = setInterval(() => {
        ticks++;
        if (started && !synth.speaking) finish();
        else if (ticks > 120) finish(); // ~60s absolute ceiling
      }, 500);
    });
  }, []);

  // Start capturing speech. onFinal receives the transcript when stopped.
  const startListening = useCallback((onFinal) => {
    if (!recognitionRef.current || listeningRef.current) return;
    setError("");
    onFinalRef.current = onFinal;
    finalTextRef.current = "";
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

  // Stop capturing; triggers recognition.onend -> onFinal.
  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !listeningRef.current) return;
    listeningRef.current = false;
    try {
      recognitionRef.current.stop();
    } catch {
      /* ignore */
    }
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

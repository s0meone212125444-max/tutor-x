// Voice engine — the teacher actually TALKS. Uses the browser's built-in
// SpeechSynthesis (free, no API key). Later this can be swapped for a premium
// voice (ElevenLabs) behind the same speak() interface.

export type Speaker = {
  speak: (text: string) => Promise<void>; // resolves when finished speaking
  stop: () => void;
  pause: () => void;
  resume: () => void;
  isSupported: boolean;
};

// Pick the most natural-sounding English voice available on the device.
export function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const prefer = [
    "Google UK English Male",
    "Google US English",
    "Microsoft Guy Online",
    "Microsoft Aria Online",
    "Daniel",
    "Samantha",
  ];
  for (const name of prefer) {
    const v = voices.find((x) => x.name === name);
    if (v) return v;
  }
  return voices.find((v) => v.lang.startsWith("en")) || voices[0];
}

export function createSpeaker(opts?: { rate?: number; voiceName?: string }): Speaker {
  const isSupported = typeof window !== "undefined" && !!window.speechSynthesis;

  function speak(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (!isSupported || !text.trim()) return resolve();
      const synth = window.speechSynthesis;
      const u = new SpeechSynthesisUtterance(text);
      const voices = synth.getVoices();
      const chosen =
        (opts?.voiceName && voices.find((v) => v.name === opts.voiceName)) || pickVoice();
      if (chosen) u.voice = chosen;
      u.rate = opts?.rate ?? 1;
      u.pitch = 1;
      u.onend = () => resolve();
      u.onerror = () => resolve();
      synth.speak(u);
    });
  }

  return {
    speak,
    stop: () => isSupported && window.speechSynthesis.cancel(),
    pause: () => isSupported && window.speechSynthesis.pause(),
    resume: () => isSupported && window.speechSynthesis.resume(),
    isSupported,
  };
}

// --- Listening (raise hand by voice) ---
// Minimal typing for the non-standard SpeechRecognition API.
/* eslint-disable @typescript-eslint/no-explicit-any */
export function createListener(onResult: (text: string) => void): { start: () => void; stop: () => void; isSupported: boolean } {
  const SR =
    typeof window !== "undefined"
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;
  if (!SR) return { start: () => {}, stop: () => {}, isSupported: false };

  const rec = new SR();
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.onresult = (e: any) => {
    const text = e.results?.[0]?.[0]?.transcript || "";
    if (text) onResult(text);
  };
  return { start: () => rec.start(), stop: () => rec.stop(), isSupported: true };
}

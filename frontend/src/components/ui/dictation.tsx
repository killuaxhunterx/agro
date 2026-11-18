import {
  type ReactNode,
  type RefObject,
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { Button } from "#app/components/ui/button";
import { toast } from "#app/components/ui/toast";

/**
 * Ditado por voz em todo campo de texto livre — "ninguém quer escrever". Dois motores:
 *
 * - "servidor": grava no navegador e manda para POST /api/transcricoes (o mesmo do CSF,
 *   OpenAI). Funciona em qualquer navegador moderno; exige OPENAI_API_KEY no servidor.
 * - "navegador": o reconhecimento de voz do próprio navegador (Chrome, Edge, Safari), sem
 *   custo e sem chave. É o que a demonstração usa quando o servidor não tem transcrição.
 */
export type Transcribe = (audio: Blob, durationSeconds: number) => Promise<string>;
type Engine = { kind: "servidor"; transcribe: Transcribe } | { kind: "navegador" } | null;

const DictationContext = createContext<Engine>(null);

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function browserRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionLike)
    | null;
}

const canRecord = () =>
  typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

export function DictationProvider({
  transcribe,
  children,
}: {
  transcribe: Transcribe | null;
  children: ReactNode;
}) {
  const engine: Engine =
    transcribe && canRecord()
      ? { kind: "servidor", transcribe }
      : browserRecognition()
        ? { kind: "navegador" }
        : null;
  return <DictationContext value={engine}>{children}</DictationContext>;
}

const MAX_SECONDS = 120;
type Field = HTMLInputElement | HTMLTextAreaElement;

/** Escreve no campo como se fosse digitado, para o onChange do React disparar. */
function insertText(el: Field, transcript: string) {
  const text = transcript.trim();
  if (!text) return;
  const before = el.value;
  const sep = before && !/\s$/.test(before) ? " " : "";
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(proto.prototype, "value")?.set;
  const value = (before + sep + text).slice(0, el.maxLength > 0 ? el.maxLength : undefined);
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function useDictation({
  target,
  label,
  enabled,
  className,
}: {
  target: RefObject<Field | null>;
  label: string;
  enabled: boolean;
  className: string;
}): { offered: boolean; button: ReactNode } {
  const engine = useContext(DictationContext);
  const [phase, setPhase] = useState<"idle" | "recording" | "transcribing">("idle");
  const [elapsed, setElapsed] = useState(0);
  const stopRef = useRef<(() => void) | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopRef.current?.();
    };
  }, []);

  if (!engine || !enabled) return { offered: false, button: null };

  async function startServer(transcribe: Transcribe) {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error("Sem acesso ao microfone. Libere nas configurações do navegador.");
      return;
    }
    const rec = new MediaRecorder(stream);
    const chunks: Blob[] = [];
    const t0 = performance.now();
    const timer = setInterval(() => {
      const s = (performance.now() - t0) / 1000;
      setElapsed(s);
      if (s >= MAX_SECONDS && rec.state === "recording") rec.stop();
    }, 250);
    rec.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
    rec.onstop = async () => {
      clearInterval(timer);
      stream.getTracks().forEach((t) => t.stop());
      stopRef.current = null;
      if (!mounted.current) return;
      setPhase("transcribing");
      try {
        const dur = Math.min(Math.round((performance.now() - t0) / 1000), MAX_SECONDS);
        const text = await transcribe(new Blob(chunks, { type: rec.mimeType || "audio/webm" }), dur);
        if (mounted.current && target.current) insertText(target.current, text);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível transcrever.");
      } finally {
        if (mounted.current) {
          setPhase("idle");
          setElapsed(0);
        }
      }
    };
    stopRef.current = () => rec.state === "recording" && rec.stop();
    rec.start();
    setPhase("recording");
  }

  function startBrowser() {
    const SR = browserRecognition();
    if (!SR) return;
    const rec = new SR();
    rec.lang = "pt-BR";
    rec.continuous = true;
    rec.interimResults = false;
    const t0 = performance.now();
    const timer = setInterval(() => setElapsed((performance.now() - t0) / 1000), 250);
    rec.onresult = (e) => {
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r?.isFinal && target.current) insertText(target.current, r[0].transcript);
      }
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed") toast.error("Sem acesso ao microfone. Libere nas configurações do navegador.");
      else if (e.error !== "no-speech" && e.error !== "aborted") toast.error("O reconhecimento de voz falhou. Tente de novo.");
    };
    rec.onend = () => {
      clearInterval(timer);
      stopRef.current = null;
      if (mounted.current) {
        setPhase("idle");
        setElapsed(0);
      }
    };
    stopRef.current = () => rec.stop();
    rec.start();
    setPhase("recording");
  }

  const recording = phase === "recording";
  const word = recording ? "Parar" : phase === "transcribing" ? "Transcrevendo…" : "🎤 Falar";

  return {
    offered: true,
    button: (
      <Button
        size="xs"
        variant={recording ? "primary" : "outline"}
        disabled={phase === "transcribing"}
        aria-label={recording ? `Parar a gravação de ${label}` : `Falar em ${label}`}
        className={className}
        onClick={() => {
          if (recording) stopRef.current?.();
          else if (engine.kind === "servidor") void startServer(engine.transcribe);
          else startBrowser();
        }}
      >
        {recording ? <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-white" /> : null}
        {word}
        {recording ? <span className="tabular-nums">{fmt(elapsed)}</span> : null}
      </Button>
    ),
  };
}

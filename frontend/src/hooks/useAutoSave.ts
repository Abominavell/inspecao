import { useEffect, useRef, useState } from "react";
import { enqueueOrRun, isNetworkError } from "@/lib/offlineQueue";

export type AutoSaveStatus = "idle" | "saving" | "saved" | "error";

type Options = {
  /** Aguarda carregamento inicial antes de salvar */
  ready?: boolean;
  /** Atraso em ms (padrão 700) */
  delay?: number;
  /** Rótulo para fila offline */
  label?: string;
  /** Callback após salvar com sucesso */
  onSaved?: () => void;
  /** Callback em erro */
  onError?: (message: string) => void;
};

export function useAutoSave(
  dataKey: string,
  saveFn: () => Promise<void>,
  { ready = true, delay = 700, label = "Salvar alterações", onSaved, onError }: Options = {}
) {
  const [status, setStatus] = useState<AutoSaveStatus>("idle");
  const [error, setError] = useState("");
  const saveFnRef = useRef(saveFn);
  const hydratedRef = useRef(false);

  saveFnRef.current = saveFn;

  async function executeSave() {
    await enqueueOrRun(label, () => saveFnRef.current());
    onSaved?.();
  }

  useEffect(() => {
    if (!ready) return;

    if (!hydratedRef.current) {
      hydratedRef.current = true;
      return;
    }

    const timer = window.setTimeout(async () => {
      setStatus("saving");
      setError("");
      try {
        await executeSave();
        setStatus("saved");
        window.setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 2000);
      } catch (err) {
        setStatus("error");
        const msg = isNetworkError(err)
          ? "Sem conexão — alteração enfileirada"
          : err instanceof Error
            ? err.message
            : "Erro ao salvar";
        setError(msg);
        onError?.(msg);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [dataKey, ready, delay]);

  function resetHydration() {
    hydratedRef.current = false;
    setStatus("idle");
    setError("");
  }

  async function saveNow() {
    setStatus("saving");
    setError("");
    try {
      await executeSave();
      setStatus("saved");
      window.setTimeout(() => setStatus((s) => (s === "saved" ? "idle" : s)), 2000);
    } catch (err) {
      setStatus("error");
      const msg = isNetworkError(err)
        ? "Sem conexão — alteração enfileirada"
        : err instanceof Error
          ? err.message
          : "Erro ao salvar";
      setError(msg);
      onError?.(msg);
      throw err;
    }
  }

  return { status, error, saveNow, resetHydration };
}

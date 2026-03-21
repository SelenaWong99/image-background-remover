"use client";

import { useState, useCallback, useRef } from "react";

type Status = "idle" | "uploading" | "done" | "error" | "rate_limited";

interface ResultState {
  originalUrl: string;
  resultUrl: string;
  remaining: number;
  total: number;
}

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ResultState | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [dragging, setDragging] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please upload an image file (PNG, JPG, WEBP).");
      setStatus("error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("File too large. Maximum size is 10MB.");
      setStatus("error");
      return;
    }

    const originalUrl = URL.createObjectURL(file);
    setResult(null);
    setErrorMsg("");
    setStatus("uploading");

    try {
      const form = new FormData();
      form.append("image", file);

      const res = await fetch("/api/remove-bg", { method: "POST", body: form });

      const remainingHeader = res.headers.get("X-RateLimit-Remaining");
      const totalHeader = res.headers.get("X-RateLimit-Limit");
      const rem = remainingHeader !== null ? parseInt(remainingHeader) : null;
      if (rem !== null) setRemaining(rem);

      if (res.status === 429) {
        const data = await res.json();
        setErrorMsg(data.message ?? "Daily limit reached. Come back tomorrow!");
        setStatus("rate_limited");
        return;
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Something went wrong.");
      }

      const blob = await res.blob();
      const resultUrl = URL.createObjectURL(blob);
      setResult({
        originalUrl,
        resultUrl,
        remaining: rem ?? 0,
        total: totalHeader ? parseInt(totalHeader) : 3,
      });
      setStatus("done");
    } catch (e: any) {
      setErrorMsg(e.message ?? "Something went wrong.");
      setStatus("error");
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const reset = () => {
    setStatus("idle");
    setResult(null);
    setErrorMsg("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 flex flex-col items-center px-4 py-16">

      {/* Header */}
      <div className="mb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full px-4 py-1.5 mb-4">
          <span className="w-2 h-2 bg-indigo-400 rounded-full animate-pulse" />
          <span className="text-indigo-300 text-xs font-medium">Powered by remove.bg</span>
        </div>
        <h1 className="text-5xl font-bold text-white mb-3 tracking-tight">
          Background Remover
        </h1>
        <p className="text-slate-400 text-lg max-w-md">
          Remove image backgrounds instantly — no signup, no storage, results in seconds.
        </p>
        {remaining !== null && status !== "rate_limited" && (
          <p className="mt-3 text-sm text-slate-500">
            <span className={remaining === 0 ? "text-red-400" : "text-emerald-400"}>
              {remaining}
            </span>
            {" "}free uses remaining today
          </p>
        )}
      </div>

      {/* Drop Zone */}
      {status === "idle" && (
        <div
          component="div"
          onDragOver={(e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`w-full max-w-xl border-2 border-dashed rounded-3xl p-20 flex flex-col items-center justify-center cursor-pointer transition-all duration-200
            ${dragging
              ? "border-indigo-400 bg-indigo-500/10 scale-[1.01]"
              : "border-slate-700 hover:border-slate-500 bg-slate-800/30 hover:bg-slate-800/50"
            }`}
        >
          <div className="w-16 h-16 rounded-2xl bg-slate-700/60 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
          </div>
          <p className="text-white font-semibold text-lg mb-1">Drop your image here</p>
          <p className="text-slate-500 text-sm text-center">
            or <span className="text-indigo-400">click to browse</span>
            <br />PNG, JPG, WEBP · max 10MB · {3} free uses/day
          </p>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      )}

      {/* Uploading */}
      {status === "uploading" && (
        <div className="flex flex-col items-center gap-6 w-full max-w-xl">
          <div className="w-full bg-slate-800/50 rounded-3xl p-12 flex flex-col items-center gap-4 border border-slate-700">
            <div className="relative">
              <div className="w-14 h-14 border-4 border-slate-700 border-t-indigo-500 rounded-full animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-3 h-3 bg-indigo-500 rounded-full" />
              </div>
            </div>
            <div className="text-center">
              <p className="text-white font-medium">Removing background...</p>
              <p className="text-slate-500 text-sm mt-1">This usually takes 2–5 seconds</p>
            </div>
          </div>
        </div>
      )}

      {/* Done */}
      {status === "done" && result && (
        <div className="flex flex-col items-center gap-6 w-full max-w-4xl">
          {/* Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            {/* Original */}
            <div className="bg-slate-800/50 rounded-2xl overflow-hidden border border-slate-700">
              <div className="px-4 py-2.5 border-b border-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span className="text-slate-400 text-sm font-medium">Original</span>
              </div>
              <div className="p-3">
                <img src={result.originalUrl} alt="original" className="w-full max-h-72 object-contain rounded-xl" />
              </div>
            </div>
            {/* Result */}
            <div className="bg-slate-800/50 rounded-2xl overflow-hidden border border-indigo-500/30">
              <div className="px-4 py-2.5 border-b border-slate-700 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-indigo-400" />
                <span className="text-indigo-300 text-sm font-medium">Background Removed</span>
              </div>
              <div className="p-3">
                <div
                  className="rounded-xl overflow-hidden"
                  style={{
                    backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16'%3E%3Crect width='8' height='8' fill='%23374151'/%3E%3Crect x='8' y='8' width='8' height='8' fill='%23374151'/%3E%3Crect x='8' y='0' width='8' height='8' fill='%234B5563'/%3E%3Crect x='0' y='8' width='8' height='8' fill='%234B5563'/%3E%3C/svg%3E\")",
                  }}
                >
                  <img src={result.resultUrl} alt="result" className="w-full max-h-72 object-contain" />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
            <a
              href={result.resultUrl}
              download="removed-bg.png"
              className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download PNG
            </a>
            <button
              onClick={reset}
              className="w-full sm:w-auto flex-1 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors text-sm"
            >
              Try another image
            </button>
          </div>

          {/* Remaining hint */}
          {result.remaining !== null && (
            <p className="text-sm text-slate-500">
              {result.remaining > 0
                ? <><span className="text-emerald-400">{result.remaining}</span> free uses remaining today</>
                : <span className="text-amber-400">You've used all free uses for today. Come back tomorrow!</span>
              }
            </p>
          )}
        </div>
      )}

      {/* Rate Limited */}
      {status === "rate_limited" && (
        <div className="flex flex-col items-center gap-5 max-w-md w-full">
          <div className="w-full bg-amber-500/10 border border-amber-500/30 rounded-2xl px-6 py-6 text-center">
            <div className="text-3xl mb-3">⏰</div>
            <p className="text-amber-300 font-semibold mb-1">Daily limit reached</p>
            <p className="text-slate-400 text-sm">{errorMsg}</p>
          </div>
          <button onClick={reset} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium text-sm transition-colors">
            Go back
          </button>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="flex flex-col items-center gap-5 max-w-md w-full">
          <div className="w-full bg-red-500/10 border border-red-500/30 rounded-2xl px-6 py-6 text-center">
            <div className="text-3xl mb-3">⚠️</div>
            <p className="text-red-300 font-semibold mb-1">Something went wrong</p>
            <p className="text-slate-400 text-sm">{errorMsg}</p>
          </div>
          <button onClick={reset} className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium text-sm transition-colors">
            Try again
          </button>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-16 text-slate-600 text-xs text-center">
        Images are processed in memory and never stored · {new Date().getFullYear()}
      </footer>
    </main>
  );
}

"use client";

import { useState, useCallback, useRef } from "react";

type Status = "idle" | "uploading" | "done" | "error";

export default function Home() {
  const [status, setStatus] = useState<Status>("idle");
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please upload an image file.");
      setStatus("error");
      return;
    }

    // 显示原图预览
    const objectUrl = URL.createObjectURL(file);
    setOriginalUrl(objectUrl);
    setResultUrl(null);
    setErrorMsg("");
    setStatus("uploading");

    try {
      const form = new FormData();
      form.append("image", file);

      const res = await fetch("/api/remove-bg", { method: "POST", body: form });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to remove background");
      }

      const blob = await res.blob();
      setResultUrl(URL.createObjectURL(blob));
      setStatus("done");
    } catch (e: any) {
      setErrorMsg(e.message ?? "Something went wrong");
      setStatus("error");
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const reset = () => {
    setStatus("idle");
    setOriginalUrl(null);
    setResultUrl(null);
    setErrorMsg("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex flex-col items-center justify-start px-4 py-16">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-4xl font-bold text-white mb-2">Background Remover</h1>
        <p className="text-slate-400 text-lg">Remove image backgrounds instantly — powered by remove.bg</p>
      </div>

      {/* Drop Zone */}
      {status === "idle" && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-16 flex flex-col items-center justify-center cursor-pointer transition-colors
            ${dragging ? "border-indigo-400 bg-indigo-500/10" : "border-slate-600 hover:border-slate-400 bg-slate-800/50"}`}
        >
          <svg className="w-12 h-12 text-slate-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-slate-300 font-medium mb-1">Drop your image here</p>
          <p className="text-slate-500 text-sm">or click to browse · PNG, JPG, WEBP · max 10MB</p>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onInputChange} />
        </div>
      )}

      {/* Uploading */}
      {status === "uploading" && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-300">Removing background...</p>
          {originalUrl && (
            <img src={originalUrl} alt="original" className="mt-4 max-h-64 rounded-xl opacity-50" />
          )}
        </div>
      )}

      {/* Result */}
      {status === "done" && resultUrl && (
        <div className="flex flex-col items-center gap-6 w-full max-w-3xl">
          <div className="grid grid-cols-2 gap-4 w-full">
            <div className="flex flex-col items-center gap-2">
              <p className="text-slate-400 text-sm">Original</p>
              {originalUrl && <img src={originalUrl} alt="original" className="rounded-xl w-full object-contain max-h-80" />}
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-slate-400 text-sm">Result</p>
              <div className="rounded-xl overflow-hidden w-full max-h-80 bg-[url('data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22%3E%3Crect width=%228%22 height=%228%22 fill=%22%23ddd%22/%3E%3Crect x=%228%22 y=%228%22 width=%228%22 height=%228%22 fill=%22%23ddd%22/%3E%3C/svg%3E')]">
                <img src={resultUrl} alt="result" className="w-full object-contain max-h-80" />
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <a
              href={resultUrl}
              download="removed-bg.png"
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors"
            >
              Download PNG
            </a>
            <button
              onClick={reset}
              className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
            >
              Try another
            </button>
          </div>
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div className="flex flex-col items-center gap-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-6 py-4 text-red-400 text-center max-w-md">
            {errorMsg}
          </div>
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-medium transition-colors"
          >
            Try again
          </button>
        </div>
      )}
    </main>
  );
}

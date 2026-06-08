"use client";

import { useRef, useState } from "react";
import imageCompression from "browser-image-compression";

interface PhotoCaptureProps {
  label: string;
  onChange: (file: File | null) => void;
  required?: boolean;
}

export default function PhotoCapture({ label, onChange, required }: PhotoCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.files?.[0];
    if (!raw) return;

    setCompressing(true);
    try {
      const compressed = await imageCompression(raw, {
        maxSizeMB: 0.9,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
      });
      const previewUrl = URL.createObjectURL(compressed);
      setPreview(previewUrl);
      onChange(compressed as File);
    } catch {
      // fallback to original if compression fails
      setPreview(URL.createObjectURL(raw));
      onChange(raw);
    } finally {
      setCompressing(false);
    }
  }

  function remove() {
    setPreview(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-2">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {preview ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={label}
            className="w-full rounded-xl object-cover max-h-56 border border-gray-200"
          />
          <button
            type="button"
            onClick={remove}
            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg font-bold shadow"
            aria-label="Remove photo"
          >
            ×
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={compressing}
          className="w-full border-2 border-dashed border-blue-300 rounded-xl py-8 flex flex-col items-center gap-2 text-blue-500 bg-blue-50 active:bg-blue-100 transition-colors"
        >
          {compressing ? (
            <span className="text-sm">Compressing…</span>
          ) : (
            <>
              <span className="text-4xl">📷</span>
              <span className="text-sm font-medium">Tap to take photo or upload</span>
            </>
          )}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
        required={required && !preview}
      />
    </div>
  );
}

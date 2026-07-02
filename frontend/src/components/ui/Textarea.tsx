import { TextareaHTMLAttributes } from "react";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label?: string;
  hint?: string;
  error?: string;
};

export default function Textarea({ label, hint, error, className = "", id, ...props }: Props) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <textarea
        id={inputId}
        className={`w-full rounded-lg border px-3 py-2 text-sm transition-colors focus:border-emserh-green focus:outline-none focus:ring-2 focus:ring-emserh-green/20 ${
          error ? "border-red-400" : "border-border"
        } ${className}`}
        {...props}
      />
      {hint && !error && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

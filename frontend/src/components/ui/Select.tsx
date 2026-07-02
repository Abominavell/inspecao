import { SelectHTMLAttributes } from "react";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label?: string;
};

export default function Select({ label, className = "", id, children, ...props }: Props) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");
  return (
    <label className="block" htmlFor={inputId}>
      {label && <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>}
      <select
        id={inputId}
        className={`w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus:border-emserh-green focus:outline-none focus:ring-2 focus:ring-emserh-green/20 ${className}`}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

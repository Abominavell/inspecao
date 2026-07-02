type Props = {
  children: React.ReactNode;
  className?: string;
  title?: string;
  description?: string;
};

export default function Card({ children, className = "", title, description }: Props) {
  return (
    <section className={`rounded-xl border border-border bg-card p-5 shadow-sm ${className}`}>
      {title && <h2 className="mb-1 font-semibold text-slate-800">{title}</h2>}
      {description && <p className="mb-4 text-sm text-slate-500">{description}</p>}
      {children}
    </section>
  );
}

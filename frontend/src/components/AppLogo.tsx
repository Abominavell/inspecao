type Props = {
  className?: string;
  priority?: boolean;
  variant?: "header" | "login" | "empty";
};

const sizes = {
  header: "h-11 w-auto max-w-[220px]",
  login: "mx-auto mb-4 h-20 w-auto max-w-[340px]",
  empty: "mx-auto mb-4 h-16 w-auto max-w-[260px] opacity-50",
};

export default function AppLogo({ className = "", variant = "header" }: Props) {
  return (
    // img nativo preserva canal alpha (next/image pode achatar transparência)
    <img
      src="/iadvh-logo.png?v=2"
      alt="IADVH — Instituto de Apoio ao Desenvolvimento da Vida Humana"
      className={`bg-transparent ${sizes[variant]} ${className}`.trim()}
      decoding="async"
      fetchPriority={variant === "header" ? "high" : "auto"}
    />
  );
}

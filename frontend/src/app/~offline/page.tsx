import AppLogo from "@/components/AppLogo";
import Button from "@/components/ui/Button";

export default function OfflinePage() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <AppLogo variant="empty" />
      <h1 className="mb-2 text-xl font-bold text-slate-800">Você está offline</h1>
      <p className="mb-6 max-w-md text-sm text-slate-600">
        O aplicativo continua funcionando. Suas alterações são salvas localmente e serão
        sincronizadas quando a internet voltar.
      </p>
      <a href="/">
        <Button>Ir para o início</Button>
      </a>
    </div>
  );
}

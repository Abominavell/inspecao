"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ToastProvider";
import { downloadInspectionPhotosZip } from "@/lib/downloadInspectionPhotos";

type Props = {
  clientId: string;
  serverId?: number;
  unitName?: string;
};

export default function DownloadInspectionPhotosButton({ clientId, serverId, unitName }: Props) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  async function handleDownload() {
    if (!clientId) return;
    setLoading(true);
    try {
      const count = await downloadInspectionPhotosZip({ clientId, serverId, unitName });
      toast(`${count} foto(s) baixadas em ZIP`, "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Falha ao baixar fotos", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="secondary" size="lg" onClick={handleDownload} disabled={loading}>
      {loading ? "Preparando ZIP..." : "📷 Baixar todas as fotos (ZIP)"}
    </Button>
  );
}

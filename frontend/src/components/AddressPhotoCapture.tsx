"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ToastProvider";
import { compressImage } from "@/lib/imageCompress";
import { api, getToken } from "@/lib/api";
import { getAddressPhoto, saveLocalPhoto, deleteLocalPhoto } from "@/lib/db/repositories/photoRepo";
import { syncEngine } from "@/lib/sync/SyncEngine";

type Props = {
  inspectionId: number;
  inspectionClientId?: string;
  serverId?: number;
  hasPhoto: boolean;
  onPhotoChange: (hasPhoto: boolean) => void;
  disabled?: boolean;
};

export default function AddressPhotoCapture({
  inspectionId,
  inspectionClientId,
  serverId,
  hasPhoto,
  onPhotoChange,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [lastFile, setLastFile] = useState<File | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let objectUrl: string | null = null;
    async function load() {
      if (inspectionClientId) {
        const local = await getAddressPhoto(inspectionClientId);
        if (local) {
          objectUrl = URL.createObjectURL(local.blob);
          setPreview(objectUrl);
          return;
        }
      }
      if (!hasPhoto) {
        setPreview(null);
        return;
      }
      const token = getToken();
      if (!token || !inspectionId) return;
      const res = await fetch(api.addressPhotoUrl(inspectionId), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setPreview(objectUrl);
      }
    }
    load();
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [inspectionId, inspectionClientId, hasPhoto]);

  async function uploadFile(file: File) {
    setUploading(true);
    setError("");
    try {
      const compressed = await compressImage(file);
      if (inspectionClientId) {
        await saveLocalPhoto({
          inspectionClientId,
          checklistItemId: 0,
          blob: compressed,
          originalFilename: file.name,
          photoType: "address",
        });
        setPreview(URL.createObjectURL(compressed));
        onPhotoChange(true);
        if (navigator.onLine && serverId) {
          try {
            const uploadFile = new File([compressed], file.name, {
              type: compressed.type || "image/jpeg",
            });
            await api.uploadAddressPhoto(serverId, uploadFile);
            toast("Foto do local enviada ao servidor", "success");
          } catch {
            void syncEngine.syncNow();
            toast("Foto salva localmente — sincronizando…", "success");
          }
        } else if (navigator.onLine) {
          void syncEngine.syncNow();
          toast("Foto salva localmente", "success");
        } else {
          toast("Foto salva localmente", "success");
        }
        setLastFile(null);
        return;
      }
      await api.uploadAddressPhoto(inspectionId, compressed);
      onPhotoChange(true);
      toast("Foto do local enviada", "success");
      setLastFile(null);
    } catch (e) {
      setLastFile(file);
      const msg = e instanceof Error ? e.message : "Falha ao enviar foto";
      setError(msg);
      toast(msg, "error");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete() {
    if (disabled) return;
    setUploading(true);
    try {
      if (inspectionClientId) {
        const local = await getAddressPhoto(inspectionClientId);
        if (local) await deleteLocalPhoto(local.client_photo_id);
        setPreview(null);
        onPhotoChange(false);
        return;
      }
      await api.deleteAddressPhoto(inspectionId);
      onPhotoChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao remover foto");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-emserh-green/25 bg-emserh-green-light/40 p-3">
      <p className="mb-2 text-sm font-medium text-emserh-green-dark">
        Foto do local <span className="text-red-600">*</span>
      </p>
      {preview && (
        <div className="relative mb-3 inline-block">
          <img
            src={preview}
            alt="Foto do endereço"
            className="max-h-48 rounded-lg border border-border object-cover shadow-sm"
          />
          {!disabled && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={uploading}
              className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-lg text-white shadow"
              aria-label="Remover foto"
            >
              ×
            </button>
          )}
        </div>
      )}
      {!disabled && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={uploading}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadFile(file);
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="lg"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="w-full sm:w-auto"
          >
            {uploading ? "Enviando..." : preview ? "📷 Trocar foto do local" : "📷 Tirar foto do local"}
          </Button>
          {lastFile && !uploading && (
            <button
              type="button"
              onClick={() => uploadFile(lastFile)}
              className="mt-2 text-sm font-medium text-emserh-green underline"
            >
              Tentar novamente
            </button>
          )}
        </>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}

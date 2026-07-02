"use client";

import { useRef, useState } from "react";
import AuthImage from "@/components/AuthImage";
import { useToast } from "@/components/ToastProvider";
import { compressImage } from "@/lib/imageCompress";
import { api, Photo } from "@/lib/api";
import { saveLocalPhoto, getLocalPhotos, deleteLocalPhoto } from "@/lib/db/repositories/photoRepo";
import { syncEngine } from "@/lib/sync/SyncEngine";

type Props = {
  inspectionId: number;
  inspectionClientId?: string;
  checklistItemId: number;
  answerId?: number;
  photos: Photo[];
  localPreviewUrls?: Record<number, string>;
  onPhotosChange: (photos: Photo[], answerId?: number) => void;
  onLocalPhotoAdded?: (checklistItemId: number, previewUrl: string) => void;
  onLocalPhotoRemoved?: (checklistItemId: number) => void;
  disabled?: boolean;
};

export default function NcPhotoCapture({
  inspectionId,
  inspectionClientId,
  checklistItemId,
  answerId,
  photos,
  localPreviewUrls = {},
  onPhotosChange,
  onLocalPhotoAdded,
  onLocalPhotoRemoved,
  disabled,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [lastFile, setLastFile] = useState<File | null>(null);
  const { toast } = useToast();

  async function uploadFile(file: File) {
    setUploading(true);
    setError("");
    setProgress(20);
    try {
      const compressed = await compressImage(file);
      setProgress(55);

      if (inspectionClientId) {
        const localPhoto = await saveLocalPhoto({
          inspectionClientId,
          checklistItemId,
          blob: compressed,
          originalFilename: file.name,
          photoType: "nc",
        });
        const previewUrl = URL.createObjectURL(compressed);
        onLocalPhotoAdded?.(checklistItemId, previewUrl);
        if (navigator.onLine) void syncEngine.syncNow();
        toast("Foto salva localmente", "success");
        setLastFile(null);
        return;
      }

      const photo = await api.uploadPhoto(inspectionId, compressed, {
        answerId,
        checklistItemId,
      });
      setProgress(100);
      onPhotosChange([...photos, photo], photo.answer_id);
      toast("Foto enviada com sucesso", "success");
      setLastFile(null);
    } catch (e) {
      setLastFile(file);
      const msg = e instanceof Error ? e.message : "Falha ao enviar foto";
      setError(msg);
      toast(msg, "error");
    } finally {
      setUploading(false);
      setProgress(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleDelete(photoId: number) {
    if (disabled) return;
    if (inspectionClientId && localPreview) {
      const localPhotos = await getLocalPhotos(inspectionClientId, checklistItemId);
      for (const p of localPhotos) {
        await deleteLocalPhoto(p.client_photo_id);
      }
      onLocalPhotoRemoved?.(checklistItemId);
      toast("Foto removida", "info");
      return;
    }
    await api.deletePhoto(inspectionId, photoId);
    onPhotosChange(
      photos.filter((p) => p.id !== photoId),
      answerId
    );
    toast("Foto removida", "info");
  }

  const localPreview = localPreviewUrls[checklistItemId];

  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 sm:col-span-2">
      <p className="mb-2 text-sm font-medium text-amber-900">
        Registro fotográfico da NC <span className="text-red-600">*</span>
      </p>

      {(photos.length > 0 || localPreview) && (
        <div className="mb-3 flex flex-wrap gap-3">
          {localPreview && (
            <div className="relative">
              <img
                src={localPreview}
                alt="Foto NC local"
                className="h-28 w-28 rounded-lg border-2 border-white object-cover shadow sm:h-32 sm:w-32"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleDelete(0)}
                  className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-lg text-white shadow"
                  aria-label="Remover foto"
                >
                  ×
                </button>
              )}
            </div>
          )}
          {photos.map((photo) => (
            <div key={photo.id} className="relative">
              <AuthImage
                inspectionId={inspectionId}
                photoId={photo.id}
                alt={photo.original_filename}
                className="h-28 w-28 rounded-lg border-2 border-white object-cover shadow sm:h-32 sm:w-32"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleDelete(photo.id)}
                  className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full bg-red-600 text-lg text-white shadow"
                  aria-label="Remover foto"
                >
                  ×
                </button>
              )}
            </div>
          ))}
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
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-700 px-6 py-4 text-base font-semibold text-white shadow active:bg-blue-800 disabled:opacity-50 sm:w-auto sm:min-w-[220px]"
          >
            {uploading ? `Enviando ${progress}%...` : "📷 Tirar foto (câmera)"}
          </button>
          {lastFile && !uploading && (
            <button
              type="button"
              onClick={() => uploadFile(lastFile)}
              className="mt-2 text-sm font-medium text-blue-700 underline"
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

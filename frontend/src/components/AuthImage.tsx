"use client";

import { useEffect, useState } from "react";
import { api, getToken } from "@/lib/api";

export default function AuthImage({
  inspectionId,
  photoId,
  alt,
  className,
}: {
  inspectionId: number;
  photoId: number;
  alt: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch(api.photoUrl(inspectionId, photoId), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.blob())
      .then((blob) => setSrc(URL.createObjectURL(blob)))
      .catch(() => setSrc(null));
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId, photoId]);

  if (!src) return <div className={`bg-slate-100 ${className}`} />;
  return <img src={src} alt={alt} className={className} />;
}

"use client";

import Image from "next/image";
import { useState } from "react";
import { ImageOff } from "lucide-react";

export function PosterImage({
  src,
  alt,
  className,
}: {
  src?: string;
  alt: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`flex items-center justify-center bg-[#F8F8F5] ${className ?? ""}`}
      >
        <ImageOff className="h-8 w-8 text-[#687386]" aria-hidden />
      </div>
    );
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      className={`object-cover ${className ?? ""}`}
      onError={() => setFailed(true)}
    />
  );
}

"use client";

import { QRCodeCanvas } from "qrcode.react";

interface QRCodeProps {
  value: string;
  size?: number;
}

export function QRCodeBadge({ value, size = 160 }: QRCodeProps) {
  return (
    <div className="flex flex-col items-center gap-2 p-4 border border-[#E7E7E2] rounded-xl bg-white">
      <QRCodeCanvas value={value} size={size} />
      <p className="text-xs font-mono text-[#687386] truncate max-w-[180px]">{value}</p>
    </div>
  );
}

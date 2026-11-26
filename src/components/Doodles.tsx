import React from "react";

export function BrandMascot({ className = "w-9 h-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Crisp white document card + teal ready badge */}
      <rect
        x="7"
        y="9"
        width="30"
        height="33"
        rx="5"
        fill="#F4F4F5"
        stroke="#18181B"
        strokeWidth="2.2"
      />
      <rect
        x="11"
        y="5"
        width="28"
        height="33"
        rx="5"
        fill="#FFFFFF"
        stroke="#18181B"
        strokeWidth="2.2"
      />
      <path
        d="M17 15H33M17 21H30M17 27H25"
        stroke="#18181B"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      {/* Ready checkmark seal */}
      <circle
        cx="35"
        cy="34"
        r="9"
        fill="#0D9488"
        stroke="#18181B"
        strokeWidth="2.2"
      />
      <path
        d="M31.3 34.2L33.8 36.7L38.8 31.5"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NotebookDoodle({ className = "w-14 h-14" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <rect
        x="14"
        y="10"
        width="38"
        height="46"
        rx="5"
        fill="#FFFFFF"
        stroke="#18181B"
        strokeWidth="2.2"
      />
      <path
        d="M10 19H17M10 29H17M10 39H17M10 49H17"
        stroke="#18181B"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M23 22H43M23 30H43M23 38H35"
        stroke="#9CA3AF"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle
        cx="46"
        cy="46"
        r="10"
        fill="#0D9488"
        stroke="#18181B"
        strokeWidth="2.2"
      />
      <path
        d="M46 41.5V50.5M41.5 46H50.5"
        stroke="#FFFFFF"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WindowChromeBar({
  filename,
  rightSlot,
}: {
  filename: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E4E4E7]">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-1.5 h-3.5 rounded-full bg-[#0D9488] shrink-0"
          aria-hidden="true"
        />
        <span className="font-mono-label text-[11px] font-semibold text-[#4B5563] truncate">
          {filename}
        </span>
      </div>
      {rightSlot && <div className="shrink-0">{rightSlot}</div>}
    </div>
  );
}

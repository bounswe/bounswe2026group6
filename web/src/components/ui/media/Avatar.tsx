import * as React from "react";
import { cn } from "@/lib/cn";

type AvatarProps = {
  src?: string;
  alt?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export function Avatar({
  src,
  alt = "avatar",
  size = "md",
  className,
}: AvatarProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-20 h-20",
  };

  return (
    <div
      className={cn(
        "rounded-full bg-[color:var(--surface-soft)] overflow-hidden flex items-center justify-center",
        sizeClasses[size],
        className
      )}
    >
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <span className="text-[color:var(--text-secondary)] text-sm">👤</span>
      )}
    </div>
  );
}
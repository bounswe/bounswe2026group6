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
        "rounded-full bg-gray-200 overflow-hidden flex items-center justify-center",
        sizeClasses[size],
        className
      )}
    >
      {src ? (
        <img src={src} alt={alt} className="w-full h-full object-cover" />
      ) : (
        <span className="text-gray-500 text-sm">👤</span>
      )}
    </div>
  );
}
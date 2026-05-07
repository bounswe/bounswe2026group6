"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type ToggleSwitchProps = {
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    "aria-label"?: string;
};

export function ToggleSwitch({
    checked,
    onCheckedChange,
    disabled = false,
    "aria-label": ariaLabel,
}: ToggleSwitchProps) {
    return (
        <button
            type="button"
            aria-pressed={checked}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => onCheckedChange(!checked)}
            className={cn(
                "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                checked ? "bg-[color:var(--primary-500)]" : "bg-[color:var(--border-muted)]",
                disabled && "cursor-not-allowed opacity-60"
            )}
        >
            <span
                className={cn(
                    "inline-block h-5 w-5 transform rounded-full bg-[color:var(--surface-card)] transition-transform",
                    checked ? "translate-x-5" : "translate-x-1"
                )}
            />
        </button>
    );
}

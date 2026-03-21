"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type CheckboxProps = {
    id?: string;
    label: React.ReactNode;
    checked: boolean;
    onCheckedChange: (checked: boolean) => void;
    disabled?: boolean;
    error?: string;
};

export function Checkbox({
    id,
    label,
    checked,
    onCheckedChange,
    disabled = false,
    error,
}: CheckboxProps) {
    return (
        <div className="flex flex-col gap-2">
            <label
                htmlFor={id}
                className={cn(
                    "flex items-start gap-3 text-sm text-[#2B2B33]",
                    disabled && "cursor-not-allowed opacity-60"
                )}
            >
                <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => onCheckedChange(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-[#E7E7EA] accent-[#D84A4A]"
                />
                <span>{label}</span>
            </label>

            {error ? <p className="text-xs text-[#D84A4A]">{error}</p> : null}
        </div>
    );
}
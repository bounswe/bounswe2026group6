"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type CheckboxProps = {
    id?: string;
    label: string;
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
                    "flex items-center gap-3 text-sm text-gray-800",
                    disabled && "cursor-not-allowed opacity-60"
                )}
            >
                <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={(e) => onCheckedChange(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-200 accent-red-500"
                />
                <span>{label}</span>
            </label>

            {error ? (
                <p className="text-xs text-red-500">{error}</p>
            ) : null}
        </div>
    );
}
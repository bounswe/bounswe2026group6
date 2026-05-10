"use client";

import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/cn";

type ThemeToggleVariant = "corner" | "navbar";

type ThemeToggleProps = {
    className?: string;
    variant?: ThemeToggleVariant;
};

export function ThemeToggle({ className, variant = "corner" }: ThemeToggleProps) {
    const { isDarkTheme, setTheme } = useTheme();
    const nextTheme = isDarkTheme ? "light" : "dark";

    const baseClass = variant === "navbar" ? "theme-toggle-navbar" : "theme-toggle-corner";

    return (
        <button
            type="button"
            className={cn(baseClass, className)}
            aria-label={isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
            title={isDarkTheme ? "Switch to light theme" : "Switch to dark theme"}
            onClick={() => setTheme(nextTheme)}
        >
            {isDarkTheme ? <MoonIcon /> : <SunIcon />}
        </button>
    );
}

function SunIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
            <path
                d="M12 2.75V5M12 19v2.25M4.75 4.75l1.6 1.6M17.65 17.65l1.6 1.6M2.75 12H5M19 12h2.25M4.75 19.25l1.6-1.6M17.65 6.35l1.6-1.6"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
            />
        </svg>
    );
}

function MoonIcon() {
    return (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M20.2 14.25A7.8 7.8 0 0 1 9.75 3.8 8.6 8.6 0 1 0 20.2 14.25Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
        </svg>
    );
}

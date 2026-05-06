"use client";

import { ToggleSwitch } from "@/components/ui/selection/ToggleSwitch";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/cn";

type ThemeToggleProps = {
    className?: string;
    compact?: boolean;
};

export function ThemeToggle({ className, compact = false }: ThemeToggleProps) {
    const { isDarkTheme, setTheme } = useTheme();

    return (
        <div className={cn("theme-toggle-row", compact && "is-compact", className)}>
            <div className="theme-toggle-copy">
                <span className="theme-toggle-label">Dark theme</span>
                {compact ? null : (
                    <span className="theme-toggle-description">
                        Use darker colors throughout NEPH.
                    </span>
                )}
            </div>
            <ToggleSwitch
                aria-label="Use dark theme"
                checked={isDarkTheme}
                onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
            />
        </div>
    );
}

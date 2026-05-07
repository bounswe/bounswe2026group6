"use client";

import * as React from "react";
import {
    applyThemeToDocument,
    getStoredTheme,
    setStoredTheme,
    THEME_CHANGED_EVENT,
    THEME_STORAGE_KEY,
    type ThemeMode,
} from "@/lib/theme";

type ThemeContextValue = {
    theme: ThemeMode;
    isDarkTheme: boolean;
    setTheme: (theme: ThemeMode) => void;
    toggleTheme: () => void;
};

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = React.useState<ThemeMode>("light");

    React.useEffect(() => {
        setThemeState(getStoredTheme());
    }, []);

    React.useEffect(() => {
        applyThemeToDocument(theme);
    }, [theme]);

    React.useEffect(() => {
        const syncStoredTheme = () => {
            setThemeState(getStoredTheme());
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key === null || event.key === THEME_STORAGE_KEY) {
                syncStoredTheme();
            }
        };

        window.addEventListener("storage", handleStorage);
        window.addEventListener(THEME_CHANGED_EVENT, syncStoredTheme);

        return () => {
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener(THEME_CHANGED_EVENT, syncStoredTheme);
        };
    }, []);

    const setTheme = React.useCallback((nextTheme: ThemeMode) => {
        setThemeState(nextTheme);
        setStoredTheme(nextTheme);
    }, []);

    const toggleTheme = React.useCallback(() => {
        setTheme(theme === "dark" ? "light" : "dark");
    }, [setTheme, theme]);

    const value = React.useMemo<ThemeContextValue>(
        () => ({
            theme,
            isDarkTheme: theme === "dark",
            setTheme,
            toggleTheme,
        }),
        [setTheme, theme, toggleTheme]
    );

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
    const value = React.useContext(ThemeContext);

    if (!value) {
        throw new Error("useTheme must be used inside ThemeProvider");
    }

    return value;
}

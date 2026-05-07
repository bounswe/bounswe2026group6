export const THEME_STORAGE_KEY = "neph_theme";
export const THEME_CHANGED_EVENT = "neph-theme-changed";

export type ThemeMode = "light" | "dark";

function isBrowser() {
    return typeof window !== "undefined" && typeof document !== "undefined";
}

export function isThemeMode(value: string | null): value is ThemeMode {
    return value === "light" || value === "dark";
}

export function getStoredTheme(): ThemeMode {
    if (!isBrowser()) {
        return "light";
    }

    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeMode(stored) ? stored : "light";
}

export function applyThemeToDocument(theme: ThemeMode) {
    if (!isBrowser()) {
        return;
    }

    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
}

export function setStoredTheme(theme: ThemeMode) {
    if (!isBrowser()) {
        return;
    }

    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    applyThemeToDocument(theme);
    window.dispatchEvent(
        new CustomEvent(THEME_CHANGED_EVENT, {
            detail: { theme },
        })
    );
}

export function getThemeInitScript() {
    return `(function(){try{var key=${JSON.stringify(THEME_STORAGE_KEY)};var stored=window.localStorage.getItem(key);var theme=(stored==='dark'||stored==='light')?stored:'light';document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;}catch(error){document.documentElement.dataset.theme='light';document.documentElement.style.colorScheme='light';}})();`;
}

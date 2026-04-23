import * as React from "react";
import { ApiError } from "@/lib/api";
import { clearAccessToken, fetchCurrentUser, getAccessToken, type AuthUser } from "@/lib/auth";

type AuthSessionPhase = "loading" | "guest" | "authenticated" | "error";

type AuthSessionSnapshot = {
    phase: AuthSessionPhase;
    tokenPresent: boolean;
    user: AuthUser | null;
    isStale: boolean;
    errorMessage: string | null;
};

type AuthSessionListener = (snapshot: AuthSessionSnapshot) => void;

let snapshot: AuthSessionSnapshot = {
    phase: "loading",
    tokenPresent: false,
    user: null,
    isStale: false,
    errorMessage: null,
};

let inFlightRefresh: Promise<AuthSessionSnapshot> | null = null;
const listeners = new Set<AuthSessionListener>();

function emitSnapshot() {
    listeners.forEach((listener) => listener(snapshot));
}

function setSnapshot(next: AuthSessionSnapshot) {
    snapshot = next;
    emitSnapshot();
}

export function getAuthSessionSnapshot() {
    return snapshot;
}

export function subscribeAuthSession(listener: AuthSessionListener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export async function refreshAuthSession(options: { force?: boolean } = {}) {
    if (inFlightRefresh && !options.force) {
        return inFlightRefresh;
    }

    inFlightRefresh = (async () => {
        const token = getAccessToken();
        if (!token || !token.trim()) {
            setSnapshot({
                phase: "guest",
                tokenPresent: false,
                user: null,
                isStale: false,
                errorMessage: null,
            });
            return snapshot;
        }

        setSnapshot({
            ...snapshot,
            phase: "loading",
            tokenPresent: true,
            errorMessage: null,
        });

        try {
            const currentUser = await fetchCurrentUser(token);
            setSnapshot({
                phase: "authenticated",
                tokenPresent: true,
                user: currentUser,
                isStale: false,
                errorMessage: null,
            });
            return snapshot;
        } catch (error) {
            if (error instanceof ApiError && error.status === 401) {
                clearAccessToken();
                setSnapshot({
                    phase: "guest",
                    tokenPresent: false,
                    user: null,
                    isStale: false,
                    errorMessage: null,
                });
                return snapshot;
            }

            if (snapshot.user) {
                setSnapshot({
                    ...snapshot,
                    phase: "authenticated",
                    tokenPresent: true,
                    isStale: true,
                    errorMessage: error instanceof Error ? error.message : "Could not refresh session.",
                });
                return snapshot;
            }

            setSnapshot({
                phase: "error",
                tokenPresent: true,
                user: null,
                isStale: true,
                errorMessage: error instanceof Error ? error.message : "Could not resolve session.",
            });
            return snapshot;
        }
    })().finally(() => {
        inFlightRefresh = null;
    });

    return inFlightRefresh;
}

export function useAuthSession(options: { resolveOnMount?: boolean } = {}) {
    const { resolveOnMount = true } = options;
    const [state, setState] = React.useState<AuthSessionSnapshot>(() => getAuthSessionSnapshot());

    React.useEffect(() => {
        const unsubscribe = subscribeAuthSession(setState);
        return unsubscribe;
    }, []);

    React.useEffect(() => {
        if (!resolveOnMount) {
            return;
        }

        void refreshAuthSession();
    }, [resolveOnMount]);

    return {
        state,
        refresh: refreshAuthSession,
    };
}

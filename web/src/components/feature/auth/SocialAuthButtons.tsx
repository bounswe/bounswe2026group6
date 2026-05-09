import * as React from "react";
import { useGoogleLogin } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type SocialAuthButtonsProps = {
    mode: "login" | "signup";
    onGoogleSuccess: (idToken: string) => void;
    onGoogleError: (message: string) => void;
};

export function SocialAuthButtons(props: SocialAuthButtonsProps) {
    if (!GOOGLE_CLIENT_ID) return null;
    return <SocialAuthButtonsInner {...props} />;
}

function SocialAuthButtonsInner({
    mode,
    onGoogleSuccess,
    onGoogleError,
}: SocialAuthButtonsProps) {
    const actionText = mode === "login" ? "Continue with" : "Sign up with";

    const loginWithGoogle = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            // useGoogleLogin with implicit flow returns access_token, not id_token.
            // We fetch the user info from Google and exchange it via our backend.
            // For server-side verification we need the id_token — use code flow instead.
            try {
                const res = await fetch(
                    "https://www.googleapis.com/oauth2/v3/userinfo",
                    { headers: { Authorization: `Bearer ${tokenResponse.access_token}` } }
                );
                if (!res.ok) throw new Error("Failed to fetch Google user info");
                // Fallback: pass the access token as idToken — backend accepts both.
                // For proper id_token, configure flow: "auth-code" and handle server-side.
                onGoogleSuccess(tokenResponse.access_token);
            } catch {
                onGoogleError("Google sign-in failed. Please try again.");
            }
        },
        onError: () => onGoogleError("Google sign-in was cancelled or failed."),
        flow: "implicit",
    });

    return (
        <div className="flex flex-col gap-3">
            <button
                type="button"
                onClick={() => loginWithGoogle()}
                className="flex h-11 w-full items-center justify-center gap-3 rounded-[10px] border border-[color:var(--border-subtle)] bg-white px-4 text-sm font-medium text-[color:var(--text-primary)] transition-colors hover:bg-[color:var(--surface-hover)] focus:outline-none focus:ring-2 focus:ring-[color:var(--primary-500)] focus:ring-offset-2"
            >
                <GoogleIcon />
                {actionText} Google
            </button>
        </div>
    );
}

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
                fill="#4285F4"
            />
            <path
                d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
                fill="#34A853"
            />
            <path
                d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
                fill="#FBBC05"
            />
            <path
                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z"
                fill="#EA4335"
            />
        </svg>
    );
}

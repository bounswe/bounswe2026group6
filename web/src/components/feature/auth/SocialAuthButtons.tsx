import * as React from "react";
import { GoogleLogin } from "@react-oauth/google";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type SocialAuthButtonsProps = {
    mode: "login" | "signup";
    onGoogleSuccess: (idToken: string) => void;
    onGoogleError: (message: string) => void;
    disabled?: boolean;
    disabledMessage?: string;
};

export function SocialAuthButtons(props: SocialAuthButtonsProps) {
    const { disabled = false, disabledMessage } = props;

    if (!GOOGLE_CLIENT_ID) {
        return (
            <div className="rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-raised)] px-4 py-3 text-sm text-[color:var(--text-muted)]">
                Google sign-in is currently unavailable. Please continue with email.
            </div>
        );
    }

    if (disabled) {
        return (
            <div className="flex flex-col gap-2">
                <button
                    type="button"
                    disabled
                    className="w-full rounded-xl border border-[color:var(--border-subtle)] bg-[color:var(--surface-raised)] px-4 py-3 text-sm font-semibold text-[color:var(--text-muted)] opacity-70"
                >
                    {props.mode === "signup" ? "Sign up with Google" : "Sign in with Google"}
                </button>
                {disabledMessage ? (
                    <p className="text-xs text-[color:var(--text-muted)]">{disabledMessage}</p>
                ) : null}
            </div>
        );
    }

    return <SocialAuthButtonsInner {...props} />;
}

function SocialAuthButtonsInner({
    mode,
    onGoogleSuccess,
    onGoogleError,
}: SocialAuthButtonsProps) {
    return (
        <div className="flex flex-col gap-3">
            <GoogleLogin
                onSuccess={(credentialResponse) => {
                    const idToken = credentialResponse.credential;
                    if (!idToken) {
                        onGoogleError("Google sign-in failed. Please try again.");
                        return;
                    }
                    onGoogleSuccess(idToken);
                }}
                onError={() => onGoogleError("Google sign-in was cancelled or failed.")}
                width="100%"
                text={mode === "signup" ? "signup_with" : "signin_with"}
                shape="rectangular"
                logo_alignment="left"
            />
        </div>
    );
}


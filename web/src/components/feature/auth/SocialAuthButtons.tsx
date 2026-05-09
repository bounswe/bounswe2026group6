import * as React from "react";
import { GoogleLogin } from "@react-oauth/google";

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


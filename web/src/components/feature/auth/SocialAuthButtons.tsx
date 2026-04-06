import * as React from "react";
import { SecondaryButton } from "@/components/ui/buttons/SecondaryButton";

type SocialAuthButtonsProps = {
    mode: "login" | "signup";
    onProviderClick: (provider: "Google" | "Facebook" | "Apple") => void;
};

export function SocialAuthButtons({
    mode,
    onProviderClick,
}: SocialAuthButtonsProps) {
    const actionText =
        mode === "login" ? "Continue with" : "Sign up with";

    return (
        <div className="flex flex-col gap-3">
            <SecondaryButton
                type="button"
                onClick={() => onProviderClick("Google")}
            >
                {actionText} Google
            </SecondaryButton>

            <SecondaryButton
                type="button"
                onClick={() => onProviderClick("Facebook")}
            >
                {actionText} Facebook
            </SecondaryButton>

            <SecondaryButton
                type="button"
                onClick={() => onProviderClick("Apple")}
            >
                {actionText} Apple
            </SecondaryButton>
        </div>
    );
}
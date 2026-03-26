"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/ui/buttons/SecondaryButton";
import { HelperText } from "@/components/ui/display/HelperText";

export default function WelcomePage() {
    const router = useRouter();
    const [guestInfo, setGuestInfo] = React.useState("");

    const handleGuestMode = () => {
        setGuestInfo(
            "Guest mode will be available in a later version. Please log in or create an account for now."
        );
    };

    return (
        <AuthLayout
            title="Welcome"
            subtitle="Prepare, connect, and stay ready with your neighborhood emergency hub."
        >
            <div className="flex flex-col gap-3">
                <PrimaryButton
                    onClick={() => {
                        setGuestInfo("");
                        router.push("/login");
                    }}
                >
                    Log In
                </PrimaryButton>

                <SecondaryButton
                    onClick={() => {
                        setGuestInfo("");
                        router.push("/signup");
                    }}
                >
                    Create Account
                </SecondaryButton>

                <button
                    type="button"
                    onClick={handleGuestMode}
                    className="rounded-[10px] border border-dashed border-[#E7E7EA] px-4 py-3 text-sm font-medium text-[#737380] transition-colors hover:bg-white"
                >
                    Continue as Guest
                </button>
            </div>

            <div className="mt-5 text-center">
                <HelperText>
                    {guestInfo ||
                        "Guest mode is currently a placeholder in this MVP."}
                </HelperText>
            </div>
        </AuthLayout>
    );
}
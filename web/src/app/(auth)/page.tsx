"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AuthRouteGate } from "@/components/auth/AuthRouteGate";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/ui/buttons/SecondaryButton";
import { HelperText } from "@/components/ui/display/HelperText";

export default function WelcomePage() {
    const router = useRouter();

    return (
        <AuthRouteGate mode="guest-only">
            <AuthLayout
                title="Welcome"
                subtitle="Prepare, connect, and stay ready with your neighborhood emergency hub."
            >
                <div className="flex flex-col gap-3">
                    <PrimaryButton
                        onClick={() => {
                            router.push("/login");
                        }}
                    >
                        Log In
                    </PrimaryButton>

                    <SecondaryButton
                        onClick={() => {
                            router.push("/signup");
                        }}
                    >
                        Create Account
                    </SecondaryButton>

                    <button
                        type="button"
                        onClick={() => router.push("/home")}
                        className="rounded-[10px] border border-[color:var(--border-subtle)] px-4 py-3 text-sm font-medium text-[color:var(--text-secondary)] transition-colors hover:bg-white"
                    >
                        Continue as Guest
                    </button>
                </div>

          
            </AuthLayout>
        </AuthRouteGate>
    );
}
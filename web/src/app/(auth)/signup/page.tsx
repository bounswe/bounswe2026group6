import { Suspense } from "react";
import { AuthLayout } from "@/components/layout/AuthLayout";
import { AuthRouteGate } from "@/components/auth/AuthRouteGate";
import { SignupForm } from "@/components/feature/auth/SignupForm";

export default function SignupPage() {
    return (
        <Suspense>
            <AuthRouteGate mode="guest-only">
                <AuthLayout
                    title="Create Account"
                    subtitle="Set up your account and get ready before emergencies happen."
                >
                    <SignupForm />
                </AuthLayout>
            </AuthRouteGate>
        </Suspense>
    );
}

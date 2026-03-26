import { AuthLayout } from "@/components/layout/AuthLayout";
import { VerifyEmailForm } from "@/components/feature/auth/VerifyEmailForm";

export default function VerifyEmailPage() {
    return (
        <AuthLayout
            title="Verify Email"
            subtitle="Enter the 6-digit verification code sent to your email address."
        >
            <VerifyEmailForm />
        </AuthLayout>
    );
}
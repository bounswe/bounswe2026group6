import { AuthLayout } from "@/components/layout/AuthLayout";
import { VerifyEmailForm } from "@/components/feature/auth/VerifyEmailForm";

export default function VerifyEmailPage() {
    return (
        <AuthLayout
            title="Verify Email"
            subtitle="Use the verification link sent to your email, or resend it from this page."
        >
            <VerifyEmailForm />
        </AuthLayout>
    );
}

import { AuthLayout } from "@/components/layout/AuthLayout";
import { SignupForm } from "@/components/feature/auth/SignupForm";

export default function SignupPage() {
    return (
        <AuthLayout
            title="Create Account"
            subtitle="Set up your account and get ready before emergencies happen."
        >
            <SignupForm />
        </AuthLayout>
    );
}
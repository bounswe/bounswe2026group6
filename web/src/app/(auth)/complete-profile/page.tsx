import { AuthLayout } from "@/components/layout/AuthLayout";
import CompleteProfileForm from "@/components/feature/auth/CompleteProfileForm";

export default function CompleteProfilePage() {
  return (
    <AuthLayout
      title="Complete Your Profile"
      subtitle="Set up your account details"
    >
      <CompleteProfileForm />
    </AuthLayout>
  );
}
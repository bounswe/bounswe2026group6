import { AppShell } from "@/components/layout/AppShell";
import ProfileView from "@/components/feature/profile/ProfileView";

export default function ProfilePage() {
  return (
    <AppShell title="Profile">
      <ProfileView />
    </AppShell>
  );
}
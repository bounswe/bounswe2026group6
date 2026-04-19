"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { HelperText } from "@/components/ui/display/HelperText";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { ToggleSwitch } from "@/components/ui/selection/ToggleSwitch";
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import { ApiError } from "@/lib/api";
import { fetchMyProfile, patchMyPrivacy } from "@/lib/profile";

export default function PrivacySecurityView() {
    const router = useRouter();
    const pathname = usePathname();

    const [loading, setLoading] = React.useState(true);
    const [saving, setSaving] = React.useState(false);
    const [shareLocation, setShareLocation] = React.useState(false);
    const [error, setError] = React.useState("");
    const [info, setInfo] = React.useState("");

    const redirectToLoginAfterAuthExpiry = React.useCallback(() => {
        clearAccessToken();
        const returnTo = pathname || "/privacy-security";
        router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }, [pathname, router]);

    React.useEffect(() => {
        async function loadPrivacySettings() {
            const token = getAccessToken();

            if (!token) {
                router.replace(`/login?returnTo=${encodeURIComponent(pathname || "/privacy-security")}`);
                return;
            }

            try {
                const profile = await fetchMyProfile(token);
                setShareLocation(profile.privacySettings.locationSharingEnabled);
            } catch (err) {
                if (err instanceof ApiError && err.status === 401) {
                    redirectToLoginAfterAuthExpiry();
                    return;
                }

                setError(
                    err instanceof Error
                        ? err.message
                        : "Could not load privacy settings."
                );
            } finally {
                setLoading(false);
            }
        }

        void loadPrivacySettings();
    }, [pathname, redirectToLoginAfterAuthExpiry, router]);

    const handleSave = async () => {
        const token = getAccessToken();

        if (!token) {
            router.replace(`/login?returnTo=${encodeURIComponent(pathname || "/privacy-security")}`);
            return;
        }

        try {
            setSaving(true);
            setError("");
            setInfo("");

            await patchMyPrivacy(token, {
                locationSharingEnabled: shareLocation,
            });

            setInfo("Privacy settings updated successfully.");
        } catch (err) {
            if (err instanceof ApiError && err.status === 401) {
                redirectToLoginAfterAuthExpiry();
                return;
            }

            setError(
                err instanceof Error
                    ? err.message
                    : "Could not save your privacy settings."
            );
        } finally {
            setSaving(false);
        }
    };

    const handleResetPassword = () => {
        clearAccessToken();
        window.location.assign("/forgot-password");
    };

    if (loading) {
        return <p className="text-sm text-gray-500">Loading...</p>;
    }

    return (
        <div className="flex max-w-3xl flex-col gap-6">
            <SectionCard>
                <SectionHeader
                    title="Privacy"
                    subtitle="Control the account settings the backend currently supports."
                />

                <div className="mt-4 flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium text-[color:var(--text-primary)]">
                            Share Current Location
                        </p>
                        <p className="mt-1 text-sm text-[color:var(--text-secondary)]">
                            Allow your profile to expose live location-sharing status for
                            emergency coordination.
                        </p>
                    </div>

                    <ToggleSwitch
                        aria-label="Share Current Location"
                        checked={shareLocation}
                        onCheckedChange={setShareLocation}
                    />
                </div>

                <div className="mt-5 flex justify-end">
                    <PrimaryButton onClick={handleSave} loading={saving}>
                        Save Privacy Settings
                    </PrimaryButton>
                </div>
            </SectionCard>

            <SectionCard>
                <SectionHeader
                    title="Security"
                    subtitle="Use the currently available account-protection actions."
                />

                <div className="flex flex-col gap-3 text-sm text-[color:var(--text-secondary)]">
                    <p>
                        Password management is handled through the real forgot-password flow.
                    </p>
                    <p>
                        Email verification remains part of the existing auth flow and does not
                        expose additional settings here yet.
                    </p>
                    <div>
                        <button
                            type="button"
                            onClick={handleResetPassword}
                            className="font-semibold text-[color:var(--primary-500)] hover:underline"
                        >
                            Reset your password
                        </button>
                    </div>
                </div>
            </SectionCard>

            {error ? <HelperText className="text-red-500">{error}</HelperText> : null}
            {info ? <HelperText>{info}</HelperText> : null}
        </div>
    );
}

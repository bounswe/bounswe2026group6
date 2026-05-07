"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import {
    createAdminAnnouncement,
    deleteAdminAnnouncement,
    fetchAdminAnnouncements,
    updateAdminAnnouncement,
    type AdminAnnouncement,
} from "@/lib/admin";
import { formatAnnouncementDate, summarizeAnnouncementContent } from "@/lib/news";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { TextInput } from "@/components/ui/inputs/TextInput";
import { TextArea } from "@/components/ui/inputs/TextArea";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/ui/buttons/SecondaryButton";

type AnnouncementFormState = {
    title: string;
    content: string;
};

const EMPTY_FORM: AnnouncementFormState = {
    title: "",
    content: "",
};

function sortAnnouncements(items: AdminAnnouncement[]) {
    return [...items].sort((a, b) => {
        const aDate = new Date(a.createdAt).getTime();
        const bDate = new Date(b.createdAt).getTime();
        return (Number.isNaN(bDate) ? 0 : bDate) - (Number.isNaN(aDate) ? 0 : aDate);
    });
}

export default function AdminAnnouncementsView() {
    const router = useRouter();
    const pathname = usePathname();
    const [announcements, setAnnouncements] = React.useState<AdminAnnouncement[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [saving, setSaving] = React.useState(false);
    const [deletingId, setDeletingId] = React.useState<string | null>(null);
    const [editingId, setEditingId] = React.useState<string | null>(null);
    const [form, setForm] = React.useState<AnnouncementFormState>(EMPTY_FORM);
    const [error, setError] = React.useState("");
    const [formError, setFormError] = React.useState("");
    const [statusMessage, setStatusMessage] = React.useState("");

    const redirectToLogin = React.useCallback(() => {
        clearAccessToken();
        const returnTo = pathname || "/admin";
        router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }, [pathname, router]);

    const handleAdminApiError = React.useCallback(
        (err: unknown, fallback: string) => {
            if (err instanceof ApiError && err.status === 401) {
                redirectToLogin();
                return null;
            }

            if (err instanceof ApiError && err.status === 403) {
                router.replace("/home");
                return null;
            }

            return err instanceof Error ? err.message : fallback;
        },
        [redirectToLogin, router]
    );

    const loadAnnouncements = React.useCallback(
        async (mode: "initial" | "refresh" = "refresh") => {
            const token = getAccessToken();
            if (!token) {
                setLoading(false);
                setRefreshing(false);
                redirectToLogin();
                return;
            }

            if (mode === "initial") {
                setLoading(true);
            } else {
                setRefreshing(true);
            }
            setError("");

            try {
                const result = await fetchAdminAnnouncements(token, { limit: 100 });
                setAnnouncements(sortAnnouncements(result));
            } catch (err) {
                const message = handleAdminApiError(err, "Could not load announcements.");
                if (message) {
                    setError(message);
                }
            } finally {
                setLoading(false);
                setRefreshing(false);
            }
        },
        [handleAdminApiError, redirectToLogin]
    );

    React.useEffect(() => {
        void loadAnnouncements("initial");
    }, [loadAnnouncements]);

    const resetForm = () => {
        setForm(EMPTY_FORM);
        setEditingId(null);
        setFormError("");
    };

    const handleEdit = (announcement: AdminAnnouncement) => {
        setEditingId(announcement.id);
        setForm({
            title: announcement.title,
            content: announcement.content,
        });
        setFormError("");
        setStatusMessage("");
    };

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setFormError("");
        setStatusMessage("");

        const title = form.title.trim();
        const content = form.content.trim();

        if (!title || !content) {
            setFormError("Title and content are required.");
            return;
        }

        const token = getAccessToken();
        if (!token) {
            redirectToLogin();
            return;
        }

        try {
            setSaving(true);
            if (editingId) {
                const updated = await updateAdminAnnouncement(token, editingId, { title, content });
                setAnnouncements((current) => sortAnnouncements(
                    current.map((item) => (item.id === updated.id ? updated : item))
                ));
                setStatusMessage("Announcement updated.");
            } else {
                const created = await createAdminAnnouncement(token, { title, content });
                setAnnouncements((current) => sortAnnouncements([created, ...current]));
                setStatusMessage("Announcement created.");
            }
            resetForm();
        } catch (err) {
            const message = handleAdminApiError(
                err,
                editingId ? "Could not update announcement." : "Could not create announcement."
            );
            if (message) {
                setFormError(message);
            }
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (announcement: AdminAnnouncement) => {
        const confirmed = window.confirm(`Delete announcement "${announcement.title}"?`);
        if (!confirmed) {
            return;
        }

        const token = getAccessToken();
        if (!token) {
            redirectToLogin();
            return;
        }

        setDeletingId(announcement.id);
        setStatusMessage("");
        setError("");

        try {
            await deleteAdminAnnouncement(token, announcement.id);
            setAnnouncements((current) => current.filter((item) => item.id !== announcement.id));
            if (editingId === announcement.id) {
                resetForm();
            }
            setStatusMessage("Announcement deleted.");
        } catch (err) {
            const message = handleAdminApiError(err, "Could not delete announcement.");
            if (message) {
                setError(message);
            }
        } finally {
            setDeletingId(null);
        }
    };

    if (loading) {
        return (
            <SectionCard>
                <SectionHeader
                    title="Announcements"
                    subtitle="Loading announcement management..."
                />
                <div className="admin-empty-state">
                    <p className="admin-subtle">Checking the latest announcement data.</p>
                </div>
            </SectionCard>
        );
    }

    return (
        <div className="admin-overview-grid">
            <SectionCard>
                <SectionHeader
                    title={editingId ? "Edit Announcement" : "Create Announcement"}
                    subtitle="Publish emergency notices, preparedness updates, and community announcements."
                />

                <form className="admin-announcements-form" onSubmit={handleSubmit}>
                    <TextInput
                        id="announcement-title"
                        label="Title"
                        value={form.title}
                        maxLength={500}
                        placeholder="Preparedness workshop schedule"
                        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                    />
                    <TextArea
                        id="announcement-content"
                        label="Content"
                        value={form.content}
                        maxLength={10000}
                        placeholder="Share the update users should see in the news feed."
                        onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
                    />

                    {formError ? <p className="admin-error-text">{formError}</p> : null}
                    {statusMessage ? <p className="admin-subtle">{statusMessage}</p> : null}

                    <div className="admin-history-actions">
                        <PrimaryButton className="w-auto" type="submit" loading={saving}>
                            {editingId ? "Save Changes" : "Create Announcement"}
                        </PrimaryButton>
                        {editingId ? (
                            <SecondaryButton className="w-auto" type="button" onClick={resetForm} disabled={saving}>
                                Cancel Edit
                            </SecondaryButton>
                        ) : null}
                    </div>
                </form>
            </SectionCard>

            <SectionCard>
                <SectionHeader
                    title="Published Announcements"
                    subtitle="Manage live announcements shown on the public news page."
                />

                <div className="admin-region-actions">
                    <SecondaryButton className="w-auto" onClick={() => void loadAnnouncements("refresh")} disabled={refreshing}>
                        {refreshing ? "Refreshing..." : "Refresh"}
                    </SecondaryButton>
                </div>

                {error ? <p className="admin-error-text">{error}</p> : null}

                {announcements.length === 0 ? (
                    <div className="admin-empty-state">
                        <p>No announcements have been published yet.</p>
                    </div>
                ) : (
                    <div className="admin-announcements-list">
                        {announcements.map((announcement) => (
                            <article key={announcement.id} className="admin-announcements-card">
                                <div className="admin-announcements-card-header">
                                    <div>
                                        <p className="admin-metric-label">
                                            {formatAnnouncementDate(announcement.createdAt)}
                                        </p>
                                        <h3 className="admin-recent-title">{announcement.title}</h3>
                                    </div>
                                    <div className="admin-announcements-actions">
                                        <SecondaryButton
                                            className="w-auto"
                                            type="button"
                                            onClick={() => handleEdit(announcement)}
                                            disabled={saving || deletingId === announcement.id}
                                        >
                                            Edit
                                        </SecondaryButton>
                                        <SecondaryButton
                                            className="w-auto"
                                            type="button"
                                            onClick={() => void handleDelete(announcement)}
                                            disabled={saving || deletingId === announcement.id}
                                        >
                                            {deletingId === announcement.id ? "Deleting..." : "Delete"}
                                        </SecondaryButton>
                                    </div>
                                </div>
                                <p className="admin-recent-line">
                                    {summarizeAnnouncementContent(announcement.content, 260)}
                                </p>
                            </article>
                        ))}
                    </div>
                )}
            </SectionCard>
        </div>
    );
}

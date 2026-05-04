"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import {
    banAdminUser,
    fetchAdminUsers,
    type AdminUserListItem,
    type AdminUserListOptions,
    unbanAdminUser,
} from "@/lib/admin";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/ui/buttons/SecondaryButton";
import { TextArea } from "@/components/ui/inputs/TextArea";

type VerifiedFilter = "ALL" | "VERIFIED" | "UNVERIFIED";
type BannedFilter = "ALL" | "BANNED" | "ACTIVE";

type UsersFilters = {
    email: string;
    verified: VerifiedFilter;
    banned: BannedFilter;
};

const DEFAULT_FILTERS: UsersFilters = {
    email: "",
    verified: "ALL",
    banned: "ALL",
};

const PAGE_SIZE = 25;

function decodeTokenUserId(token: string | null): string | null {
    if (!token) {
        return null;
    }

    const parts = token.split(".");
    if (parts.length < 2) {
        return null;
    }

    try {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
        return typeof payload.userId === "string" && payload.userId.trim() !== ""
            ? payload.userId
            : null;
    } catch {
        return null;
    }
}

function formatDateTime(value: string | null) {
    if (!value) {
        return "-";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    return date.toLocaleString();
}

function StatusBadge({
    label,
    tone,
}: {
    label: string;
    tone: "success" | "danger" | "default" | "warning";
}) {
    return <span className={`admin-status-badge tone-${tone}`}>{label}</span>;
}

function buildFetchOptions(filters: UsersFilters, offset: number): AdminUserListOptions {
    const options: AdminUserListOptions = {
        limit: PAGE_SIZE,
        offset,
    };
    const trimmedEmail = filters.email.trim();
    if (trimmedEmail !== "") {
        options.email = trimmedEmail;
    }
    if (filters.verified === "VERIFIED") {
        options.isEmailVerified = true;
    } else if (filters.verified === "UNVERIFIED") {
        options.isEmailVerified = false;
    }
    if (filters.banned === "BANNED") {
        options.isBanned = true;
    } else if (filters.banned === "ACTIVE") {
        options.isBanned = false;
    }
    return options;
}

export default function AdminUsersView() {
    const router = useRouter();
    const pathname = usePathname();

    const [items, setItems] = React.useState<AdminUserListItem[]>([]);
    const [total, setTotal] = React.useState(0);
    const [offset, setOffset] = React.useState(0);
    const [filters, setFilters] = React.useState<UsersFilters>(DEFAULT_FILTERS);
    const [pendingFilters, setPendingFilters] = React.useState<UsersFilters>(DEFAULT_FILTERS);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [error, setError] = React.useState("");
    const [actionError, setActionError] = React.useState("");
    const [actionInfo, setActionInfo] = React.useState("");
    const [actionUserId, setActionUserId] = React.useState<string | null>(null);
    const [banModalUser, setBanModalUser] = React.useState<AdminUserListItem | null>(null);
    const [banReasonInput, setBanReasonInput] = React.useState("");
    const [loadedOnce, setLoadedOnce] = React.useState(false);
    const [currentUserId, setCurrentUserId] = React.useState<string | null>(null);
    const latestRequestIdRef = React.useRef(0);

    React.useEffect(() => {
        setCurrentUserId(decodeTokenUserId(getAccessToken()));
    }, []);

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
        [redirectToLogin, router],
    );

    const loadUsers = React.useCallback(
        async (
            nextFilters: UsersFilters,
            { offset: nextOffset, mode }: { offset: number; mode: "initial" | "refresh" },
        ) => {
            const token = getAccessToken();
            if (!token) {
                setLoading(false);
                setRefreshing(false);
                redirectToLogin();
                return;
            }

            const requestId = latestRequestIdRef.current + 1;
            latestRequestIdRef.current = requestId;

            if (mode === "initial") {
                setLoading(true);
            } else {
                setRefreshing(true);
            }
            setError("");
            setActionError("");

            try {
                const result = await fetchAdminUsers(token, buildFetchOptions(nextFilters, nextOffset));
                if (requestId !== latestRequestIdRef.current) {
                    return;
                }
                setItems(result.users);
                setTotal(result.total);
                setOffset(nextOffset);
                setLoadedOnce(true);
            } catch (err) {
                if (requestId !== latestRequestIdRef.current) {
                    return;
                }
                const message = handleAdminApiError(err, "Could not load users.");
                if (message) {
                    setError(message);
                }
            } finally {
                if (requestId === latestRequestIdRef.current) {
                    setLoading(false);
                    setRefreshing(false);
                }
            }
        },
        [handleAdminApiError, redirectToLogin],
    );

    React.useEffect(() => {
        void loadUsers(DEFAULT_FILTERS, { offset: 0, mode: "initial" });
    }, [loadUsers]);

    const applyFilters = () => {
        setActionInfo("");
        setFilters(pendingFilters);
        void loadUsers(pendingFilters, { offset: 0, mode: "refresh" });
    };

    const clearFilters = () => {
        setActionInfo("");
        setPendingFilters(DEFAULT_FILTERS);
        setFilters(DEFAULT_FILTERS);
        void loadUsers(DEFAULT_FILTERS, { offset: 0, mode: "refresh" });
    };

    const closeBanModal = () => {
        setBanModalUser(null);
        setBanReasonInput("");
    };

    const openBanModal = (user: AdminUserListItem) => {
        setActionError("");
        setActionInfo("");
        setBanModalUser(user);
        setBanReasonInput("");
    };

    const runModerationAction = async (
        user: AdminUserListItem,
        mode: "ban" | "unban",
        reason?: string,
    ) => {
        const token = getAccessToken();
        if (!token) {
            redirectToLogin();
            return;
        }

        setActionError("");
        setActionInfo("");
        setActionUserId(user.userId);

        try {
            if (mode === "ban") {
                await banAdminUser(token, user.userId, reason ?? null);
                closeBanModal();
                setActionInfo(`User ${user.email} was banned successfully.`);
            } else {
                await unbanAdminUser(token, user.userId);
                setActionInfo(`User ${user.email} was unbanned successfully.`);
            }

            await loadUsers(filters, { offset, mode: "refresh" });
        } catch (err) {
            const message = handleAdminApiError(
                err,
                mode === "ban" ? "Could not ban user." : "Could not unban user.",
            );
            if (message) {
                setActionError(message);
            }
        } finally {
            setActionUserId(null);
        }
    };

    const confirmBan = () => {
        if (!banModalUser) {
            return;
        }

        const reason = banReasonInput.trim();
        const targetUser = banModalUser;
        void runModerationAction(targetUser, "ban", reason);
    };

    const goToPreviousPage = () => {
        const nextOffset = Math.max(0, offset - PAGE_SIZE);
        if (nextOffset === offset) {
            return;
        }
        void loadUsers(filters, { offset: nextOffset, mode: "refresh" });
    };

    const goToNextPage = () => {
        const nextOffset = offset + PAGE_SIZE;
        if (nextOffset >= total) {
            return;
        }
        void loadUsers(filters, { offset: nextOffset, mode: "refresh" });
    };

    if (loading && !loadedOnce) {
        return (
            <SectionCard>
                <SectionHeader title="Users" subtitle="Loading registered users..." />
                <p className="admin-subtle">Fetching the latest users from the platform.</p>
            </SectionCard>
        );
    }

    if (error && !loadedOnce) {
        return (
            <SectionCard>
                <SectionHeader title="Users" subtitle="Could not load users." />
                <div className="admin-empty-state">
                    <p>{error}</p>
                    <PrimaryButton
                        onClick={() => void loadUsers(filters, { offset: 0, mode: "initial" })}
                    >
                        Retry Users Load
                    </PrimaryButton>
                </div>
            </SectionCard>
        );
    }

    const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
    const totalPages = total === 0 ? 1 : Math.ceil(total / PAGE_SIZE);
    const showingFrom = total === 0 ? 0 : offset + 1;
    const showingTo = Math.min(offset + items.length, total);
    const hasPrevious = offset > 0;
    const hasNext = offset + PAGE_SIZE < total;

    return (
        <SectionCard>
            <SectionHeader
                title="Users"
                subtitle="All registered platform users with basic account metadata."
            />

            <div className="admin-history-filter-grid">
                <label className="admin-history-filter-label" htmlFor="users-email">
                    Email contains
                    <input
                        id="users-email"
                        type="search"
                        className="admin-history-filter-input"
                        value={pendingFilters.email}
                        onChange={(event) =>
                            setPendingFilters((current) => ({
                                ...current,
                                email: event.target.value,
                            }))
                        }
                        placeholder="e.g. alice@"
                    />
                </label>

                <label className="admin-history-filter-label" htmlFor="users-verified">
                    Email verification
                    <select
                        id="users-verified"
                        className="admin-history-filter-input"
                        value={pendingFilters.verified}
                        onChange={(event) =>
                            setPendingFilters((current) => ({
                                ...current,
                                verified: event.target.value as VerifiedFilter,
                            }))
                        }
                    >
                        <option value="ALL">All</option>
                        <option value="VERIFIED">Verified</option>
                        <option value="UNVERIFIED">Unverified</option>
                    </select>
                </label>

                <label className="admin-history-filter-label" htmlFor="users-banned">
                    Ban status
                    <select
                        id="users-banned"
                        className="admin-history-filter-input"
                        value={pendingFilters.banned}
                        onChange={(event) =>
                            setPendingFilters((current) => ({
                                ...current,
                                banned: event.target.value as BannedFilter,
                            }))
                        }
                    >
                        <option value="ALL">All</option>
                        <option value="ACTIVE">Active</option>
                        <option value="BANNED">Banned</option>
                    </select>
                </label>
            </div>

            <div className="admin-history-actions">
                <PrimaryButton onClick={applyFilters} disabled={refreshing}>
                    Apply Filters
                </PrimaryButton>
                <SecondaryButton onClick={clearFilters} disabled={refreshing}>
                    Clear Filters
                </SecondaryButton>
                {refreshing ? <p className="admin-subtle">Refreshing users...</p> : null}
            </div>

            <p className="admin-subtle">
                {total === 0
                    ? "No users match the current filters."
                    : `Showing ${showingFrom}-${showingTo} of ${total} users.`}
            </p>

            {error ? <p className="admin-error-text">Latest refresh failed: {error}</p> : null}
            {actionError ? <p className="admin-error-text">Moderation action failed: {actionError}</p> : null}
            {actionInfo ? <p className="admin-subtle">{actionInfo}</p> : null}

            {items.length === 0 ? (
                <div className="admin-empty-state">
                    <p>No users found for the current filters.</p>
                </div>
            ) : (
                <div className="admin-region-table-wrap">
                    <table className="admin-region-table admin-history-table">
                        <thead>
                            <tr>
                                <th scope="col">Username</th>
                                <th scope="col">User ID</th>
                                <th scope="col">Email</th>
                                <th scope="col">Email Verified</th>
                                <th scope="col">Banned</th>
                                <th scope="col">Ban Reason</th>
                                <th scope="col">Created At</th>
                                <th scope="col">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((user) => (
                                <tr key={user.userId}>
                                    <td>{user.username || "-"}</td>
                                    <td>{user.userId}</td>
                                    <td>{user.email}</td>
                                    <td>
                                        {user.isEmailVerified ? (
                                            <StatusBadge label="Verified" tone="success" />
                                        ) : (
                                            <StatusBadge label="Unverified" tone="warning" />
                                        )}
                                    </td>
                                    <td>
                                        {user.isBanned ? (
                                            <StatusBadge label="Banned" tone="danger" />
                                        ) : (
                                            <StatusBadge label="Active" tone="default" />
                                        )}
                                    </td>
                                    <td>{user.banReason || "-"}</td>
                                    <td>{formatDateTime(user.createdAt)}</td>
                                    <td>
                                        {currentUserId && user.userId === currentUserId ? (
                                            <span className="admin-subtle">Your account</span>
                                        ) : user.isAdmin ? (
                                            <span className="admin-subtle">Admin account</span>
                                        ) : user.isBanned ? (
                                            <SecondaryButton
                                                className="h-9 w-auto px-3"
                                                onClick={() => void runModerationAction(user, "unban")}
                                                disabled={refreshing || actionUserId === user.userId}
                                            >
                                                {actionUserId === user.userId ? "Working..." : "Unban"}
                                            </SecondaryButton>
                                        ) : (
                                            <PrimaryButton
                                                className="h-9 w-auto px-3"
                                                onClick={() => openBanModal(user)}
                                                disabled={refreshing || actionUserId === user.userId}
                                            >
                                                Ban
                                            </PrimaryButton>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <div className="admin-history-actions">
                <SecondaryButton onClick={goToPreviousPage} disabled={!hasPrevious || refreshing}>
                    Previous
                </SecondaryButton>
                <p className="admin-subtle">
                    Page {currentPage} of {totalPages}
                </p>
                <SecondaryButton onClick={goToNextPage} disabled={!hasNext || refreshing}>
                    Next
                </SecondaryButton>
            </div>

            {banModalUser ? (
                <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4">
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="ban-confirmation-title"
                        className="w-full max-w-[520px] rounded-[14px] border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)] p-5 shadow-xl"
                    >
                        <h3 id="ban-confirmation-title" className="text-base font-semibold text-[color:var(--text-primary)]">
                            Confirm ban for {banModalUser.email}
                        </h3>
                        <p className="mt-2 text-sm text-[color:var(--text-secondary)]">
                            This user will be blocked from login and protected routes until unbanned.
                        </p>
                        <div className="mt-4">
                            <TextArea
                                id="ban-reason"
                                label="Reason (optional)"
                                placeholder="Add moderation reason (optional)"
                                value={banReasonInput}
                                onChange={(event) => setBanReasonInput(event.target.value)}
                                maxLength={1000}
                            />
                        </div>
                        <div className="admin-history-actions mt-4">
                            <SecondaryButton className="h-10 w-auto px-4" onClick={closeBanModal}>
                                Cancel
                            </SecondaryButton>
                            <PrimaryButton
                                className="h-10 w-auto px-4"
                                onClick={confirmBan}
                                disabled={actionUserId === banModalUser.userId}
                            >
                                {actionUserId === banModalUser.userId ? "Working..." : "Confirm Ban"}
                            </PrimaryButton>
                        </div>
                    </div>
                </div>
            ) : null}
        </SectionCard>
    );
}

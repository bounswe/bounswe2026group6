"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { clearAccessToken, getAccessToken } from "@/lib/auth";
import {
    fetchAdminEmergencyHistory,
    type EmergencyHistoryItem,
} from "@/lib/admin";
import { formatOperationalLabel } from "@/lib/formatters";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/ui/buttons/SecondaryButton";

type HistoryFilters = {
    status: "ALL" | "RESOLVED" | "CANCELLED";
    urgency: "ALL" | "LOW" | "MEDIUM" | "HIGH";
    city: string;
    type: string;
};

const DEFAULT_FILTERS: HistoryFilters = {
    status: "ALL",
    urgency: "ALL",
    city: "",
    type: "",
};
const HISTORY_PAGE_SIZE = 100;

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

export default function AdminEmergencyHistoryView() {
    const router = useRouter();
    const pathname = usePathname();
    const [items, setItems] = React.useState<EmergencyHistoryItem[]>([]);
    const [total, setTotal] = React.useState(0);
    const [filters, setFilters] = React.useState<HistoryFilters>(DEFAULT_FILTERS);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [loadingMore, setLoadingMore] = React.useState(false);
    const [error, setError] = React.useState("");
    const [loadedOnce, setLoadedOnce] = React.useState(false);
    const latestRequestIdRef = React.useRef(0);

    const redirectToLogin = React.useCallback(() => {
        clearAccessToken();
        const returnTo = pathname || "/admin";
        router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }, [pathname, router]);

    const loadHistory = React.useCallback(
        async (
            nextFilters: HistoryFilters,
            options: {
                mode?: "initial" | "refresh";
                offset?: number;
                append?: boolean;
            } = {}
        ) => {
            const mode = options.mode || "refresh";
            const offset = options.offset ?? 0;
            const append = options.append ?? false;
            const token = getAccessToken();
            if (!token) {
                setLoading(false);
                setRefreshing(false);
                setLoadingMore(false);
                redirectToLogin();
                return;
            }

            if (mode === "initial") {
                setLoading(true);
            } else if (append) {
                setLoadingMore(true);
            } else {
                setRefreshing(true);
            }
            const requestId = latestRequestIdRef.current + 1;
            latestRequestIdRef.current = requestId;
            setError("");

            try {
                const response = await fetchAdminEmergencyHistory(token, {
                    status: nextFilters.status === "ALL" ? "" : nextFilters.status,
                    urgency: nextFilters.urgency === "ALL" ? "" : nextFilters.urgency,
                    city: nextFilters.city,
                    type: nextFilters.type,
                    limit: HISTORY_PAGE_SIZE,
                    offset,
                });
                if (requestId !== latestRequestIdRef.current) {
                    return;
                }

                setItems((current) => (append ? [...current, ...response.history] : response.history));
                setTotal(response.total);
                setLoadedOnce(true);
            } catch (err) {
                if (requestId !== latestRequestIdRef.current) {
                    return;
                }
                if (err instanceof ApiError && err.status === 401) {
                    redirectToLogin();
                    return;
                }

                if (err instanceof ApiError && err.status === 403) {
                    router.replace("/home");
                    return;
                }

                setError(
                    err instanceof Error
                        ? err.message
                        : "Could not load emergency history."
                );
            } finally {
                if (requestId !== latestRequestIdRef.current) {
                    return;
                }
                setLoading(false);
                setRefreshing(false);
                setLoadingMore(false);
            }
        },
        [redirectToLogin, router]
    );

    React.useEffect(() => {
        void loadHistory(DEFAULT_FILTERS, { mode: "initial", offset: 0 });
    }, [loadHistory]);

    const applyFilters = async () => {
        await loadHistory(filters, {
            mode: loadedOnce ? "refresh" : "initial",
            offset: 0,
        });
    };

    const clearFilters = async () => {
        setFilters(DEFAULT_FILTERS);
        await loadHistory(DEFAULT_FILTERS, {
            mode: loadedOnce ? "refresh" : "initial",
            offset: 0,
        });
    };

    if (loading) {
        return (
            <SectionCard>
                <SectionHeader
                    title="Emergency History"
                    subtitle="Loading resolved and closed emergencies..."
                />
            </SectionCard>
        );
    }

    if (error && items.length === 0) {
        return (
            <SectionCard>
                <SectionHeader
                    title="Emergency History"
                    subtitle="Could not load emergency history."
                />
                <div className="admin-empty-state">
                    <p>{error}</p>
                    <PrimaryButton onClick={() => void loadHistory(filters, { mode: "initial", offset: 0 })}>
                        Retry History Load
                    </PrimaryButton>
                </div>
            </SectionCard>
        );
    }

    return (
        <SectionCard>
            <SectionHeader
                title="Emergency History"
                subtitle="Resolved and cancelled emergencies for operational review."
            />

            <div className="admin-history-filter-grid">
                <label className="admin-history-filter-label" htmlFor="history-status">
                    Status
                    <select
                        id="history-status"
                        className="admin-history-filter-input"
                        value={filters.status}
                        onChange={(event) =>
                            setFilters((current) => ({
                                ...current,
                                status: event.target.value as HistoryFilters["status"],
                            }))
                        }
                    >
                        <option value="ALL">All Closed</option>
                        <option value="RESOLVED">Resolved</option>
                        <option value="CANCELLED">Cancelled</option>
                    </select>
                </label>

                <label className="admin-history-filter-label" htmlFor="history-urgency">
                    Urgency
                    <select
                        id="history-urgency"
                        className="admin-history-filter-input"
                        value={filters.urgency}
                        onChange={(event) =>
                            setFilters((current) => ({
                                ...current,
                                urgency: event.target.value as HistoryFilters["urgency"],
                            }))
                        }
                    >
                        <option value="ALL">All Urgency Levels</option>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                    </select>
                </label>

                <label className="admin-history-filter-label" htmlFor="history-city">
                    Region (City)
                    <input
                        id="history-city"
                        className="admin-history-filter-input"
                        value={filters.city}
                        onChange={(event) =>
                            setFilters((current) => ({
                                ...current,
                                city: event.target.value,
                            }))
                        }
                        placeholder="e.g. Ankara"
                    />
                </label>

                <label className="admin-history-filter-label" htmlFor="history-type">
                    Type
                    <input
                        id="history-type"
                        className="admin-history-filter-input"
                        value={filters.type}
                        onChange={(event) =>
                            setFilters((current) => ({
                                ...current,
                                type: event.target.value,
                            }))
                        }
                        placeholder="e.g. Water"
                    />
                </label>
            </div>

            <div className="admin-history-actions">
                <PrimaryButton onClick={applyFilters} disabled={refreshing || loadingMore}>
                    Apply Filters
                </PrimaryButton>
                <SecondaryButton onClick={clearFilters} disabled={refreshing || loadingMore}>
                    Clear Filters
                </SecondaryButton>
                {refreshing ? <p className="admin-subtle">Refreshing history...</p> : null}
                {loadingMore ? <p className="admin-subtle">Loading more history...</p> : null}
            </div>

            <p className="admin-subtle">Showing {items.length} of {total} closed emergencies.</p>

            {error ? (
                <p className="admin-error-text">Latest refresh failed: {error}</p>
            ) : null}

            {items.length === 0 ? (
                <div className="admin-empty-state">
                    <p>No past emergencies matched the current filters.</p>
                </div>
            ) : (
                <div>
                    <div className="admin-region-table-wrap">
                        <table className="admin-region-table admin-history-table">
                            <thead>
                                <tr>
                                    <th>Opened At</th>
                                    <th>Closed At</th>
                                    <th>Closed State</th>
                                    <th>Type</th>
                                    <th>Urgency</th>
                                    <th>Priority</th>
                                    <th>Open (min)</th>
                                    <th>Region</th>
                                    <th>Description</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <tr key={item.requestId}>
                                        <td>{formatDateTime(item.openedAt)}</td>
                                        <td>{formatDateTime(item.closedAt)}</td>
                                        <td>{formatOperationalLabel(item.closedState || item.status)}</td>
                                        <td>{formatOperationalLabel(item.needType)}</td>
                                        <td>{formatOperationalLabel(item.urgencyLevel)}</td>
                                        <td>{formatOperationalLabel(item.priorityLevel)}</td>
                                        <td>{item.openDurationMinutes}</td>
                                        <td>{formatOperationalLabel(item.location.city)}</td>
                                        <td>{item.description}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    {items.length < total ? (
                        <div className="admin-history-actions">
                            <SecondaryButton
                                onClick={() =>
                                    void loadHistory(filters, {
                                        mode: "refresh",
                                        offset: items.length,
                                        append: true,
                                    })
                                }
                                disabled={refreshing || loadingMore}
                            >
                                Load More
                            </SecondaryButton>
                        </div>
                    ) : null}
                </div>
            )}
        </SectionCard>
    );
}

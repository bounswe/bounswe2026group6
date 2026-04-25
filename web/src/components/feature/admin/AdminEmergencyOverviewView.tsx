"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ApiError } from "@/lib/api";
import { getAccessToken, clearAccessToken } from "@/lib/auth";
import { fetchAdminEmergencyOverview, type EmergencyOverview } from "@/lib/admin";
import { formatOperationalLabel } from "@/lib/formatters";
import { SectionCard } from "@/components/ui/display/SectionCard";
import { SectionHeader } from "@/components/ui/display/SectionHeader";
import { PrimaryButton } from "@/components/ui/buttons/PrimaryButton";
import { SecondaryButton } from "@/components/ui/buttons/SecondaryButton";

function MetricTile({
    label,
    value,
    tone = "default",
}: {
    label: string;
    value: number;
    tone?: "default" | "success" | "warning" | "danger";
}) {
    return (
        <article className={`admin-metric-tile tone-${tone}`}>
            <p className="admin-metric-label">{label}</p>
            <p className="admin-metric-value">{value}</p>
        </article>
    );
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

export default function AdminEmergencyOverviewView() {
    const router = useRouter();
    const pathname = usePathname();
    const [overview, setOverview] = React.useState<EmergencyOverview | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [initialError, setInitialError] = React.useState("");
    const [refreshError, setRefreshError] = React.useState("");
    const [regionError, setRegionError] = React.useState("");
    const [includeRegionSummary, setIncludeRegionSummary] = React.useState(false);
    const isFirstLoadRef = React.useRef(true);
    const latestRequestIdRef = React.useRef(0);

    const redirectToLogin = React.useCallback(() => {
        clearAccessToken();
        const returnTo = pathname || "/admin";
        router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    }, [pathname, router]);

    const loadOverview = React.useCallback(
        async (includeRegion: boolean, mode: "initial" | "refresh" = "refresh") => {
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
            const requestId = latestRequestIdRef.current + 1;
            latestRequestIdRef.current = requestId;

            if (mode === "initial") {
                setInitialError("");
            } else {
                setRefreshError("");
                if (includeRegion) {
                    setRegionError("");
                }
            }

            try {
                const result = await fetchAdminEmergencyOverview(token, {
                    includeRegionSummary: includeRegion,
                });
                if (requestId !== latestRequestIdRef.current) {
                    return;
                }
                setOverview(result);
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

                const message =
                    err instanceof Error
                        ? err.message
                        : "Could not load admin emergency overview.";

                if (mode === "initial") {
                    setInitialError(message);
                } else if (includeRegion) {
                    setRegionError(message);
                } else {
                    setRefreshError(message);
                }
            } finally {
                if (requestId !== latestRequestIdRef.current) {
                    return;
                }
                setLoading(false);
                setRefreshing(false);
            }
        },
        [redirectToLogin, router]
    );

    React.useEffect(() => {
        if (!loading) {
            return;
        }

        const timeoutId = window.setTimeout(() => {
            setLoading(false);
            setInitialError((currentError) =>
                currentError || "Request timed out. Please try again."
            );
        }, 16_000);

        return () => {
            window.clearTimeout(timeoutId);
        };
    }, [loading]);

    React.useEffect(() => {
        const mode = isFirstLoadRef.current ? "initial" : "refresh";
        isFirstLoadRef.current = false;
        void loadOverview(includeRegionSummary, mode);
    }, [includeRegionSummary, loadOverview]);

    React.useEffect(() => {
        if (!includeRegionSummary && regionError) {
            setRegionError("");
        }
    }, [includeRegionSummary, regionError]);

    if (loading) {
        return (
            <SectionCard>
                <SectionHeader
                    title="Emergency Overview"
                    subtitle="Loading aggregate emergency metrics..."
                />
                <div className="admin-empty-state">
                    <p className="admin-subtle">
                        If this takes too long, retry the overview request.
                    </p>
                    <PrimaryButton onClick={() => void loadOverview(includeRegionSummary, "initial")}>
                        Retry Overview
                    </PrimaryButton>
                </div>
            </SectionCard>
        );
    }

    if (!overview) {
        return (
            <SectionCard>
                <SectionHeader
                    title="Emergency Overview"
                    subtitle="Could not load overview data."
                />
                <div className="admin-empty-state">
                    <p>{initialError || "No overview data available right now."}</p>
                    <PrimaryButton onClick={() => void loadOverview(includeRegionSummary, "initial")}>
                        Retry Overview
                    </PrimaryButton>
                </div>
            </SectionCard>
        );
    }

    const regionSummary = overview.regionSummary || [];
    const hasNoEmergencyData =
        overview.totals.totalEmergencies === 0
        && overview.statusBreakdown.pending === 0
        && overview.statusBreakdown.inProgress === 0
        && overview.statusBreakdown.resolved === 0
        && overview.statusBreakdown.cancelled === 0;

    return (
        <div className="admin-overview-grid">
            {hasNoEmergencyData ? (
                <SectionCard>
                    <p className="admin-subtle">
                        There are currently no emergency records. This is a valid empty system state.
                    </p>
                </SectionCard>
            ) : null}

            {refreshError ? (
                <SectionCard>
                    <p className="admin-subtle">
                        Showing previous data. Latest refresh failed: {refreshError}
                    </p>
                </SectionCard>
            ) : null}

            <SectionCard>
                <SectionHeader
                    title="Headline Metrics"
                    subtitle="Current aggregate emergency snapshot."
                />
                <div className="admin-metric-grid">
                    <MetricTile label="Total Emergencies" value={overview.totals.totalEmergencies} />
                    <MetricTile label="Active" value={overview.totals.activeEmergencies} tone="warning" />
                    <MetricTile label="Resolved" value={overview.totals.resolvedEmergencies} tone="success" />
                    <MetricTile label="Closed" value={overview.totals.closedEmergencies} tone="default" />
                </div>
            </SectionCard>

            <SectionCard>
                <SectionHeader
                    title="Status Breakdown"
                    subtitle="Pending and handled request distribution."
                />
                <div className="admin-metric-grid">
                    <MetricTile label="Pending" value={overview.statusBreakdown.pending} tone="warning" />
                    <MetricTile label="In Progress" value={overview.statusBreakdown.inProgress} />
                    <MetricTile label="Resolved" value={overview.statusBreakdown.resolved} tone="success" />
                    <MetricTile label="Cancelled" value={overview.statusBreakdown.cancelled} tone="danger" />
                </div>
            </SectionCard>

            <SectionCard>
                <SectionHeader
                    title="Urgency Breakdown"
                    subtitle="Priority distribution based on aggregate urgency mapping."
                />
                <div className="admin-metric-grid">
                    <MetricTile label="Low" value={overview.urgencyBreakdown.low} />
                    <MetricTile label="Medium" value={overview.urgencyBreakdown.medium} tone="warning" />
                    <MetricTile label="High" value={overview.urgencyBreakdown.high} tone="danger" />
                </div>
            </SectionCard>

            <SectionCard>
                <SectionHeader
                    title="Recent Activity"
                    subtitle="24-hour and 7-day activity overview."
                />
                <div className="admin-recent-grid">
                    <div>
                        <h3 className="admin-recent-title">Created</h3>
                        <p className="admin-recent-line">Last 24h: {overview.recentActivity.createdLast24Hours}</p>
                        <p className="admin-recent-line">Last 7d: {overview.recentActivity.createdLast7Days}</p>
                    </div>
                    <div>
                        <h3 className="admin-recent-title">Resolved</h3>
                        <p className="admin-recent-line">Last 24h: {overview.recentActivity.resolvedLast24Hours}</p>
                        <p className="admin-recent-line">Last 7d: {overview.recentActivity.resolvedLast7Days}</p>
                    </div>
                    <div>
                        <h3 className="admin-recent-title">Cancelled</h3>
                        <p className="admin-recent-line">Last 24h: {overview.recentActivity.cancelledLast24Hours}</p>
                        <p className="admin-recent-line">Last 7d: {overview.recentActivity.cancelledLast7Days}</p>
                    </div>
                </div>
            </SectionCard>

            <SectionCard>
                <SectionHeader
                    title="Active Operational Snapshot"
                    subtitle="Live operational details for active emergencies."
                />
                {overview.activeOperational.length > 0 ? (
                    <div className="admin-region-table-wrap">
                        <table className="admin-region-table admin-history-table">
                            <thead>
                                <tr>
                                    <th>Opened At</th>
                                    <th>Status</th>
                                    <th>Type</th>
                                    <th>Urgency</th>
                                    <th>Priority</th>
                                    <th>Open (min)</th>
                                    <th>Region</th>
                                </tr>
                            </thead>
                            <tbody>
                                {overview.activeOperational.map((item) => (
                                    <tr key={item.requestId}>
                                        <td>{formatDateTime(item.openedAt)}</td>
                                        <td>{formatOperationalLabel(item.status)}</td>
                                        <td>{formatOperationalLabel(item.needType)}</td>
                                        <td>{formatOperationalLabel(item.urgencyLevel)}</td>
                                        <td>{formatOperationalLabel(item.priorityLevel)}</td>
                                        <td>{item.openDurationMinutes}</td>
                                        <td>{formatOperationalLabel(item.location.city)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <p className="admin-subtle">No active emergencies to display.</p>
                )}
            </SectionCard>

            <SectionCard>
                <SectionHeader
                    title="Region Summary"
                    subtitle="Optional city-based aggregate breakdown."
                />
                <div className="admin-region-actions">
                    <SecondaryButton
                        onClick={() => setIncludeRegionSummary((prev) => !prev)}
                        disabled={refreshing}
                    >
                        {includeRegionSummary ? "Hide Region Summary" : "Load Region Summary"}
                    </SecondaryButton>
                    {refreshing ? <p className="admin-subtle">Refreshing...</p> : null}
                </div>

                {includeRegionSummary ? (
                    regionError ? (
                        <p className="admin-error-text">Region summary refresh failed: {regionError}</p>
                    ) : regionSummary.length > 0 ? (
                        <div className="admin-region-table-wrap">
                            <table className="admin-region-table">
                                <thead>
                                    <tr>
                                        <th>City</th>
                                        <th>Total</th>
                                        <th>Active</th>
                                        <th>Pending</th>
                                        <th>In Progress</th>
                                        <th>Resolved</th>
                                        <th>Cancelled</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {regionSummary.map((item) => (
                                        <tr key={item.city}>
                                            <td>{item.city}</td>
                                            <td>{item.total}</td>
                                            <td>{item.active}</td>
                                            <td>{item.pending}</td>
                                            <td>{item.inProgress}</td>
                                            <td>{item.resolved}</td>
                                            <td>{item.cancelled}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="admin-subtle">No regional records available.</p>
                    )
                ) : (
                    <p className="admin-subtle">
                        Region summary is optional. Load it when you need city-level details.
                    </p>
                )}
            </SectionCard>
        </div>
    );
}

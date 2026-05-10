export const DISCOVERY_VIEWPORT_MAX_KM = 50;

export type ViewportBounds = {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
};

export type ViewportMetrics = {
    centerLat: number;
    centerLon: number;
    widthKm: number;
    heightKm: number;
    widestVisibleDimensionKm: number;
};

function toRadians(value: number) {
    return (value * Math.PI) / 180;
}

function calculateDistanceKm(fromLat: number, fromLon: number, toLat: number, toLon: number) {
    const earthRadiusKm = 6371;
    const dLat = toRadians(toLat - fromLat);
    const dLon = toRadians(toLon - fromLon);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(fromLat)) * Math.cos(toRadians(toLat)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateViewportMetrics(bounds: ViewportBounds): ViewportMetrics | null {
    if (
        !Number.isFinite(bounds.minLat) ||
        !Number.isFinite(bounds.maxLat) ||
        !Number.isFinite(bounds.minLon) ||
        !Number.isFinite(bounds.maxLon)
    ) {
        return null;
    }

    if (
        bounds.minLat < -90 ||
        bounds.maxLat > 90 ||
        bounds.minLon < -180 ||
        bounds.maxLon > 180 ||
        bounds.minLat > bounds.maxLat ||
        bounds.minLon > bounds.maxLon
    ) {
        return null;
    }

    const centerLat = (bounds.minLat + bounds.maxLat) / 2;
    const centerLon = (bounds.minLon + bounds.maxLon) / 2;
    const widthKm = calculateDistanceKm(centerLat, bounds.minLon, centerLat, bounds.maxLon);
    const heightKm = calculateDistanceKm(bounds.minLat, centerLon, bounds.maxLat, centerLon);
    const widestVisibleDimensionKm = Math.max(widthKm, heightKm);

    if (
        !Number.isFinite(centerLat) ||
        !Number.isFinite(centerLon) ||
        !Number.isFinite(widthKm) ||
        !Number.isFinite(heightKm) ||
        !Number.isFinite(widestVisibleDimensionKm)
    ) {
        return null;
    }

    return {
        centerLat,
        centerLon,
        widthKm,
        heightKm,
        widestVisibleDimensionKm,
    };
}

export function isViewportDiscoverable(bounds: ViewportBounds | null | undefined) {
    if (!bounds) {
        return false;
    }

    const metrics = calculateViewportMetrics(bounds);
    if (!metrics) {
        return false;
    }

    return metrics.widestVisibleDimensionKm <= DISCOVERY_VIEWPORT_MAX_KM;
}

export function effectiveViewportKey(bounds: ViewportBounds | null | undefined): string | null {
    if (!bounds || !isViewportDiscoverable(bounds)) {
        return null;
    }

    return [
        bounds.minLon.toFixed(3),
        bounds.minLat.toFixed(3),
        bounds.maxLon.toFixed(3),
        bounds.maxLat.toFixed(3),
    ].join(",");
}

export function viewportBoundsToBbox(bounds: ViewportBounds) {
    return [
        bounds.minLon.toFixed(6),
        bounds.minLat.toFixed(6),
        bounds.maxLon.toFixed(6),
        bounds.maxLat.toFixed(6),
    ].join(",");
}

export function isValidDestinationCoordinates(
    latitude: number,
    longitude: number
): boolean {
    return Number.isFinite(latitude) &&
        Number.isFinite(longitude) &&
        latitude >= -90 &&
        latitude <= 90 &&
        longitude >= -180 &&
        longitude <= 180;
}

export function buildDirectionsUrl(
    latitude: number,
    longitude: number,
    label?: string
): string | null {
    // Directions are coordinate-based; label is reserved for future destination UI integrations.
    if (!isValidDestinationCoordinates(latitude, longitude)) {
        return null;
    }

    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export function openDirections(
    latitude: number,
    longitude: number,
    label?: string
): boolean {
    const directionsUrl = buildDirectionsUrl(latitude, longitude, label);
    if (!directionsUrl || typeof window === "undefined") {
        return false;
    }

    const openedWindow = window.open(directionsUrl, "_blank");
    if (!openedWindow) {
        return false;
    }

    openedWindow.opener = null;
    return true;
}

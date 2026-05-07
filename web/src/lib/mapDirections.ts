export function isValidDestinationCoordinates(
    latitude: number,
    longitude: number
) {
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
) {
    if (!isValidDestinationCoordinates(latitude, longitude)) {
        return null;
    }

    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
}

export function openDirections(
    latitude: number,
    longitude: number,
    label?: string
) {
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

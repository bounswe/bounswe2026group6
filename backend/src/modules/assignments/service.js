const {
  findRouteContextByAssignmentId,
  findAdminByUserId,
} = require('./repository');

const EARTH_RADIUS_KM = 6371;
const DEFAULT_SPEED_KMH = 35;

function toFiniteNumber(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function calculateHaversineDistanceKm(from, to) {
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);

  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(from.latitude))
      * Math.cos(toRadians(to.latitude))
      * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function roundDistanceKm(distanceKm) {
  return Math.round(distanceKm * 100) / 100;
}

function estimateFallbackMinutes(distanceKm) {
  if (!Number.isFinite(distanceKm)) {
    return null;
  }

  return Math.max(1, Math.round((distanceKm / DEFAULT_SPEED_KMH) * 60));
}

function buildFallbackRoute(from, to) {
  const distanceKm = calculateHaversineDistanceKm(from, to);
  return {
    distance_km: roundDistanceKm(distanceKm),
    estimated_time_min: estimateFallbackMinutes(distanceKm),
    route: null,
    source: 'fallback',
  };
}

function getRoutingProviderUrl() {
  return (process.env.ASSIGNMENT_ROUTING_URL || '').trim();
}

function buildRoutingProviderUrl(baseUrl, from, to) {
  const url = new URL(baseUrl);
  url.searchParams.set('fromLat', String(from.latitude));
  url.searchParams.set('fromLon', String(from.longitude));
  url.searchParams.set('toLat', String(to.latitude));
  url.searchParams.set('toLon', String(to.longitude));
  return url;
}

function parseRoutingProviderPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const distanceKm = toFiniteNumber(payload.distance_km ?? payload.distanceKm);
  if (distanceKm === null || distanceKm < 0) {
    return null;
  }

  const estimatedTimeMin = toFiniteNumber(payload.estimated_time_min ?? payload.estimatedTimeMin);
  const route = Array.isArray(payload.route) ? payload.route : null;

  return {
    distance_km: roundDistanceKm(distanceKm),
    estimated_time_min: estimatedTimeMin === null ? null : Math.max(1, Math.round(estimatedTimeMin)),
    route,
    source: 'routing',
  };
}

async function tryRoutingProvider(from, to) {
  const providerUrl = getRoutingProviderUrl();
  if (!providerUrl) {
    return null;
  }

  const response = await fetch(buildRoutingProviderUrl(providerUrl, from, to), {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    return null;
  }

  return parseRoutingProviderPayload(await response.json());
}

function readCoordinates(context) {
  const responderLatitude = toFiniteNumber(context.responder_latitude);
  const responderLongitude = toFiniteNumber(context.responder_longitude);
  const requestLatitude = toFiniteNumber(context.request_latitude);
  const requestLongitude = toFiniteNumber(context.request_longitude);

  if (
    responderLatitude === null
    || responderLongitude === null
    || requestLatitude === null
    || requestLongitude === null
  ) {
    return null;
  }

  return {
    responder: {
      latitude: responderLatitude,
      longitude: responderLongitude,
    },
    request: {
      latitude: requestLatitude,
      longitude: requestLongitude,
    },
  };
}

async function getAssignmentRoute({ assignmentId, userId }) {
  const context = await findRouteContextByAssignmentId(assignmentId);
  if (!context) {
    const error = new Error('Assignment not found');
    error.code = 'ASSIGNMENT_NOT_FOUND';
    throw error;
  }

  const isAssignedResponder = context.volunteer_user_id === userId;
  const isAdmin = Boolean(await findAdminByUserId(userId));
  if (!isAssignedResponder && !isAdmin) {
    const error = new Error('Forbidden');
    error.code = 'FORBIDDEN';
    throw error;
  }

  const coordinates = readCoordinates(context);
  if (!coordinates) {
    const error = new Error('Location unavailable');
    error.code = 'LOCATION_UNAVAILABLE';
    throw error;
  }

  try {
    const routed = await tryRoutingProvider(coordinates.responder, coordinates.request);
    if (routed) {
      return routed;
    }
  } catch (_error) {
    // Provider failures must not block responders from seeing approximate distance.
  }

  return buildFallbackRoute(coordinates.responder, coordinates.request);
}

module.exports = {
  calculateHaversineDistanceKm,
  getAssignmentRoute,
};

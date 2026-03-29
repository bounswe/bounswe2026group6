import { apiRequest } from "@/lib/api";
import { countryCodeOptions } from "@/lib/countryCodes";

export type BackendProfileResponse = {
    profile: {
        profileId: string;
        userId: string;
        firstName: string;
        lastName: string;
        phoneNumber: string | null;
    };
    privacySettings: {
        profileVisibility: string;
        healthInfoVisibility: string;
        locationVisibility: string;
        locationSharingEnabled: boolean;
    };
    healthInfo: {
        medicalConditions: string[];
        chronicDiseases: string[];
        allergies: string[];
        medications: string[];
        bloodType: string | null;
    };
    physicalInfo: {
        age: number | null;
        gender: string | null;
        height: number | null;
        weight: number | null;
    };
    locationProfile: {
        address: string | null;
        city: string | null;
        country: string | null;
        latitude: number | null;
        longitude: number | null;
        lastUpdated: string | null;
    };
};

export type EditableProfileData = {
    fullName: string;
    email: string;
    phone: string;
    countryCode: string;
    height: string;
    weight: string;
    bloodType: string;
    gender: string;
    birthDate: string;
    medicalHistory: string;
    chronicDiseases: string;
    allergies: string;
    country: string;
    city: string;
    district: string;
    neighborhood: string;
    extraAddress: string;
    shareLocation: boolean;
};

const availableCountryCodes = countryCodeOptions
    .map((option) => option.value)
    .filter((value): value is string => typeof value === "string" && value.startsWith("+"))
    .sort((a, b) => b.length - a.length);

function normalizePhoneParts(phoneNumber?: string | null) {
    if (!phoneNumber) {
        return {
            countryCode: "",
            phone: "",
        };
    }

    const normalized = phoneNumber.trim().replace(/[\s()-]/g, "");

    if (!normalized.startsWith("+")) {
        return {
            countryCode: "",
            phone: normalized,
        };
    }

    const matchedCountryCode = availableCountryCodes.find((code) =>
        normalized.startsWith(code)
    );

    if (!matchedCountryCode) {
        return {
            countryCode: "",
            phone: normalized,
        };
    }

    return {
        countryCode: matchedCountryCode,
        phone: normalized.slice(matchedCountryCode.length),
    };
}

export function joinFullName(firstName?: string | null, lastName?: string | null) {
    return [firstName, lastName].filter(Boolean).join(" ").trim();
}

export function splitFullName(fullName: string) {
    const normalized = fullName.trim().replace(/\s+/g, " ");

    if (!normalized) {
        return {
            firstName: "",
            lastName: "",
        };
    }

    const parts = normalized.split(" ");
    const firstName = parts.shift() || "";

    return {
        firstName,
        lastName: parts.join(" "),
    };
}

export function parseListField(value: string) {
    return value
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
}

export function serializeListField(values?: string[] | null) {
    return (values || []).join(", ");
}

export function buildAddress(parts: {
    district: string;
    neighborhood: string;
    extraAddress: string;
}) {
    return [parts.neighborhood, parts.district, parts.extraAddress]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(", ");
}

export function mapBackendProfileToEditableProfile(
    profile: BackendProfileResponse,
    email: string
): EditableProfileData {
    const phoneParts = normalizePhoneParts(profile.profile.phoneNumber);

    return {
        fullName: joinFullName(profile.profile.firstName, profile.profile.lastName),
        email,
        phone: phoneParts.phone,
        countryCode: phoneParts.countryCode,
        height:
            profile.physicalInfo.height !== null && profile.physicalInfo.height !== undefined
                ? String(profile.physicalInfo.height)
                : "",
        weight:
            profile.physicalInfo.weight !== null && profile.physicalInfo.weight !== undefined
                ? String(profile.physicalInfo.weight)
                : "",
        bloodType: profile.healthInfo.bloodType || "",
        gender: profile.physicalInfo.gender || "",
        birthDate: "",
        medicalHistory: serializeListField(profile.healthInfo.medicalConditions),
        chronicDiseases: serializeListField(profile.healthInfo.chronicDiseases),
        allergies: serializeListField(profile.healthInfo.allergies),
        country: profile.locationProfile.country || "",
        city: profile.locationProfile.city || "",
        district: "",
        neighborhood: "",
        extraAddress: profile.locationProfile.address || "",
        shareLocation: profile.privacySettings.locationSharingEnabled,
    };
}

export async function fetchMyProfile(token: string) {
    return apiRequest<BackendProfileResponse>("/profiles/me", {
        token,
    });
}

export async function patchMyProfile(
    token: string,
    payload: { firstName: string; lastName: string; phoneNumber: string | null }
) {
    return apiRequest<BackendProfileResponse>("/profiles/me", {
        method: "PATCH",
        token,
        body: payload,
    });
}

export async function patchMyPhysical(
    token: string,
    payload: { gender?: string | null; height?: number | null; weight?: number | null }
) {
    return apiRequest<BackendProfileResponse>("/profiles/me/physical", {
        method: "PATCH",
        token,
        body: payload,
    });
}

export async function patchMyHealth(
    token: string,
    payload: {
        medicalConditions?: string[];
        chronicDiseases?: string[];
        allergies?: string[];
        bloodType?: string | null;
    }
) {
    return apiRequest<BackendProfileResponse>("/profiles/me/health", {
        method: "PATCH",
        token,
        body: payload,
    });
}

export async function patchMyLocation(
    token: string,
    payload: { address?: string | null; city?: string | null; country?: string | null }
) {
    return apiRequest<BackendProfileResponse>("/profiles/me/location", {
        method: "PATCH",
        token,
        body: payload,
    });
}

export async function patchMyPrivacy(
    token: string,
    payload: { locationSharingEnabled?: boolean }
) {
    return apiRequest<BackendProfileResponse>("/profiles/me/privacy", {
        method: "PATCH",
        token,
        body: payload,
    });
}
function normalizeRiskFlags(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item) => typeof item === 'string' && item.trim() !== '');
}

function deriveUrgencyLevel({ affectedPeopleCount, riskFlags }) {
  const normalizedRiskFlags = normalizeRiskFlags(riskFlags);
  const safeAffectedPeople = Number.isInteger(affectedPeopleCount) ? affectedPeopleCount : 0;

  if (normalizedRiskFlags.length >= 2 || safeAffectedPeople >= 5) {
    return 'HIGH';
  }

  if (normalizedRiskFlags.length === 1 || (safeAffectedPeople >= 3 && safeAffectedPeople <= 4)) {
    return 'MEDIUM';
  }

  return 'LOW';
}

function derivePriorityLevel({ urgencyLevel }) {
  if (urgencyLevel === 'HIGH' || urgencyLevel === 'MEDIUM') {
    return urgencyLevel;
  }

  return 'LOW';
}

function deriveOperationalLevels(input) {
  const urgencyLevel = deriveUrgencyLevel(input);
  const priorityLevel = derivePriorityLevel({ urgencyLevel });

  return {
    urgencyLevel,
    priorityLevel,
  };
}

module.exports = {
  deriveOperationalLevels,
};

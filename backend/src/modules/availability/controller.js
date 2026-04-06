const {
  setAvailability,
  syncAvailability,
  getMyAssignment,
  cancelMyAssignment,
  resolveMyAssignment,
  getAvailabilityStatus,
} = require('./service');
const {
  validate,
  setAvailabilitySchema,
  syncAvailabilitySchema,
  resolveRequestSchema,
} = require('./validators');

async function handleSetAvailability(req, res) {
  const errors = validate(req.body, setAvailabilitySchema);
  if (errors.length > 0) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', errors });
  }

  try {
    const result = await setAvailability(req.user.userId, req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in setAvailability:', error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'An internal server error occurred' });
  }
}

async function handleSyncAvailability(req, res) {
  const errors = validate(req.body, syncAvailabilitySchema);
  if (errors.length > 0) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', errors });
  }

  try {
    const result = await syncAvailability(req.user.userId, req.body);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in syncAvailability:', error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'An internal server error occurred' });
  }
}

async function handleGetMyAssignment(req, res) {
  try {
    const result = await getMyAssignment(req.user.userId);
    return res.status(200).json(result);
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ code: 'NOT_FOUND', message: error.message });
    }
    console.error('Error in getMyAssignment:', error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'An internal server error occurred' });
  }
}

async function handleCancelAssignment(req, res) {
  const { assignmentId } = req.params;
  if (!assignmentId) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'assignmentId is required' });
  }

  try {
    const result = await cancelMyAssignment(req.user.userId, { assignmentId });
    return res.status(200).json(result);
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ code: 'NOT_FOUND', message: error.message });
    }
    console.error('Error in cancelAssignment:', error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'An internal server error occurred' });
  }
}

async function handleResolveAssignment(req, res) {
  const errors = validate(req.body, resolveRequestSchema);
  if (errors.length > 0) {
    return res.status(400).json({ code: 'VALIDATION_ERROR', errors });
  }

  try {
    const result = await resolveMyAssignment(req.user.userId, req.body);
    return res.status(200).json(result);
  } catch (error) {
    if (error.code === 'NOT_FOUND') {
      return res.status(404).json({ code: 'NOT_FOUND', message: error.message });
    }
    console.error('Error in resolveAssignment:', error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'An internal server error occurred' });
  }
}

async function handleGetAvailabilityStatus(req, res) {
  try {
    const result = await getAvailabilityStatus(req.user.userId);
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error in getAvailabilityStatus:', error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'An internal server error occurred' });
  }
}

module.exports = {
  handleSetAvailability,
  handleSyncAvailability,
  handleGetMyAssignment,
  handleCancelAssignment,
  handleResolveAssignment,
  handleGetAvailabilityStatus,
};

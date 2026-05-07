const {
  createAnnouncement,
  deleteAnnouncement,
  getAnnouncement,
  getAnnouncements,
  updateAnnouncement,
} = require('./service');
const {
  validateAnnouncementIdParam,
  validateCreateAnnouncementPayload,
  validateListAnnouncementsQuery,
  validateUpdateAnnouncementPayload,
} = require('./validators');

function sendError(response, status, code, message, details) {
  const payload = { code, message };

  if (details) {
    payload.details = details;
  }

  return response.status(status).json(payload);
}

function readValidatedAnnouncementId(request, response) {
  const validation = validateAnnouncementIdParam(request.params.announcementId);
  if (validation.errors.length > 0) {
    sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', validation.errors);
    return null;
  }

  return validation.value;
}

async function listPublicAnnouncements(request, response) {
  const validation = validateListAnnouncementsQuery(request.query || {});
  if (validation.errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', validation.errors);
  }

  try {
    const announcements = await getAnnouncements(validation.value);
    return response.status(200).json({ announcements });
  } catch (error) {
    console.error('announcements.listPublicAnnouncements failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function getPublicAnnouncement(request, response) {
  const announcementId = readValidatedAnnouncementId(request, response);
  if (!announcementId) {
    return response;
  }

  try {
    const announcement = await getAnnouncement(announcementId);
    if (!announcement) {
      return sendError(response, 404, 'NOT_FOUND', 'Announcement not found');
    }

    return response.status(200).json({ announcement });
  } catch (error) {
    console.error('announcements.getPublicAnnouncement failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function listAdminAnnouncements(request, response) {
  return listPublicAnnouncements(request, response);
}

async function postAdminAnnouncement(request, response) {
  const validation = validateCreateAnnouncementPayload(request.body || {});
  if (validation.errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', validation.errors);
  }

  try {
    const announcement = await createAnnouncement(request.user, validation.value);
    return response.status(201).json({ announcement });
  } catch (error) {
    if (error.code === 'FORBIDDEN') {
      return sendError(response, 403, 'FORBIDDEN', error.message);
    }

    console.error('announcements.postAdminAnnouncement failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function patchAdminAnnouncement(request, response) {
  const announcementId = readValidatedAnnouncementId(request, response);
  if (!announcementId) {
    return response;
  }

  const validation = validateUpdateAnnouncementPayload(request.body || {});
  if (validation.errors.length > 0) {
    return sendError(response, 400, 'VALIDATION_FAILED', 'Validation failed', validation.errors);
  }

  try {
    const announcement = await updateAnnouncement(announcementId, validation.value);
    if (!announcement) {
      return sendError(response, 404, 'NOT_FOUND', 'Announcement not found');
    }

    return response.status(200).json({ announcement });
  } catch (error) {
    console.error('announcements.patchAdminAnnouncement failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

async function deleteAdminAnnouncement(request, response) {
  const announcementId = readValidatedAnnouncementId(request, response);
  if (!announcementId) {
    return response;
  }

  try {
    const deleted = await deleteAnnouncement(announcementId);
    if (!deleted) {
      return sendError(response, 404, 'NOT_FOUND', 'Announcement not found');
    }

    return response.status(204).send();
  } catch (error) {
    console.error('announcements.deleteAdminAnnouncement failed', error);
    return sendError(response, 500, 'INTERNAL_ERROR', 'Unexpected server error');
  }
}

module.exports = {
  deleteAdminAnnouncement,
  getPublicAnnouncement,
  listAdminAnnouncements,
  listPublicAnnouncements,
  patchAdminAnnouncement,
  postAdminAnnouncement,
};

const {
  signupUser,
  loginUser,
  verifyUserEmail,
  getCurrentUser,
  getUsersForAdmin,
  getHelpRequestsForAdmin,
  getAnnouncementsForAdmin,
  getStatsForAdmin,
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  logoutUser,
} = require('./service');
const {
  validateSignupInput,
  validateLoginInput,
  validateVerificationInput,
  validateResetPasswordInput,
} = require('./validators');

function getAuthInfo(_request, response) {
  response.status(200).json({
    module: 'auth',
    scope: ['signup', 'login', 'email verification', 'basic access control'],
    status: 'ready for implementation',
  });
}

async function signup(req, res) {
  try {
    const validationError = validateSignupInput(req.body);

    if (validationError) {
      return res.status(400).json(validationError);
    }

    const result = await signupUser(req.body);

    return res.status(201).json(result);
  } catch (error) {
    if (error.code === 'EMAIL_ALREADY_EXISTS') {
      return res.status(409).json({
        code: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function login(req, res) {
  try {
    const validationError = validateLoginInput(req.body);

    if (validationError) {
      return res.status(400).json(validationError);
    }

    const result = await loginUser(req.body);

    return res.status(200).json(result);
  } catch (error) {
    if (
      error.code === 'INVALID_CREDENTIALS' ||
      error.code === 'EMAIL_NOT_VERIFIED'
    ) {
      return res.status(401).json({
        code: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function verifyEmail(req, res) {
  try {
    const validationError = validateVerificationInput(req.query);

    if (validationError) {
      return res.status(400).json(validationError);
    }

    const result = await verifyUserEmail(req.query.token);

    return res.status(200).json(result);
  } catch (error) {
    if (error.code === 'INVALID_VERIFICATION_TOKEN') {
      return res.status(400).json({
        code: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function getMe(req, res) {
  try {
    const result = await getCurrentUser(req.user.userId);

    return res.status(200).json(result);
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({
        code: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function getAdminUsers(_req, res) {
  try {
    const users = await getUsersForAdmin();

    return res.status(200).json({ users });
  } catch (_error) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function getAdminHelpRequests(_req, res) {
  try {
    const helpRequests = await getHelpRequestsForAdmin();

    return res.status(200).json({ helpRequests });
  } catch (_error) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function getAdminAnnouncements(_req, res) {
  try {
    const announcements = await getAnnouncementsForAdmin();

    return res.status(200).json({ announcements });
  } catch (_error) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function getAdminStats(_req, res) {
  try {
    const stats = await getStatsForAdmin();

    return res.status(200).json({ stats });
  } catch (_error) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function resendVerification(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Email is required',
      });
    }

    const result = await resendVerificationEmail(email);

    return res.status(200).json(result);
  } catch (error) {
    if (
      error.code === 'USER_NOT_FOUND' ||
      error.code === 'EMAIL_ALREADY_VERIFIED'
    ) {
      return res.status(400).json({
        code: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Email is required',
      });
    }

    const result = await requestPasswordReset(email);
    return res.status(200).json(result);
  } catch (error) {
    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({
        code: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function resetPasswordHandler(req, res) {
  try {
    const validationError = validateResetPasswordInput(req.body);

    if (validationError) {
      return res.status(400).json(validationError);
    }

    const result = await resetPassword(req.body);

    return res.status(200).json(result);
  } catch (error) {
    if (error.code === 'INVALID_RESET_TOKEN') {
      return res.status(400).json({
        code: error.code,
        message: error.message,
      });
    }

    if (error.code === 'USER_NOT_FOUND') {
      return res.status(404).json({
        code: error.code,
        message: error.message,
      });
    }

    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

async function logout(req, res) {
  try {
    const result = await logoutUser();

    return res.status(200).json(result);
  } catch (_error) {
    return res.status(500).json({
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    });
  }
}

module.exports = {
  getAuthInfo,
  signup,
  login,
  verifyEmail,
  getMe,
  getAdminUsers,
  getAdminHelpRequests,
  getAdminAnnouncements,
  getAdminStats,
  resendVerification,
  forgotPassword,
  resetPasswordHandler,
  logout,
};
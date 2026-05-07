'use strict';

jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
}));

jest.mock('../../../../src/modules/auth/repository', () => ({
  findAdminByUserId: jest.fn(),
  findUserAuthStateById: jest.fn(),
}));

const jwt = require('jsonwebtoken');
const {
  findAdminByUserId,
  findUserAuthStateById,
} = require('../../../../src/modules/auth/repository');
const { optionalAuth } = require('../../../../src/modules/auth/middleware');

beforeEach(() => {
  jest.clearAllMocks();
});

describe('auth middleware optionalAuth', () => {
  test('continues as guest without authorization header', async () => {
    const req = { headers: {} };
    const next = jest.fn();

    await optionalAuth(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toBeUndefined();
    expect(jwt.verify).not.toHaveBeenCalled();
    expect(findUserAuthStateById).not.toHaveBeenCalled();
    expect(findAdminByUserId).not.toHaveBeenCalled();
  });

  test('continues as guest for banned user tokens', async () => {
    const req = {
      headers: {
        authorization: 'Bearer banned-token',
      },
    };
    const next = jest.fn();

    jwt.verify.mockReturnValue({ userId: 'u_banned', email: 'banned@example.com' });
    findUserAuthStateById.mockResolvedValue({
      user_id: 'u_banned',
      email: 'banned@example.com',
      is_deleted: false,
      is_banned: true,
    });

    await optionalAuth(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(findUserAuthStateById).toHaveBeenCalledWith('u_banned');
    expect(findAdminByUserId).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  test('continues as guest for deleted user tokens', async () => {
    const req = {
      headers: {
        authorization: 'Bearer deleted-token',
      },
    };
    const next = jest.fn();

    jwt.verify.mockReturnValue({ userId: 'u_deleted', email: 'deleted@example.com' });
    findUserAuthStateById.mockResolvedValue({
      user_id: 'u_deleted',
      email: 'deleted@example.com',
      is_deleted: true,
      is_banned: false,
    });

    await optionalAuth(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(findUserAuthStateById).toHaveBeenCalledWith('u_deleted');
    expect(findAdminByUserId).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
  });

  test('derives admin role from DB instead of JWT claims', async () => {
    const req = {
      headers: {
        authorization: 'Bearer claim-only-admin-token',
      },
    };
    const next = jest.fn();

    jwt.verify.mockReturnValue({
      userId: 'u_regular',
      email: 'regular@example.com',
      isAdmin: true,
      adminRole: 'SUPER_ADMIN',
    });
    findUserAuthStateById.mockResolvedValue({
      user_id: 'u_regular',
      email: 'regular@example.com',
      is_deleted: false,
      is_banned: false,
    });
    findAdminByUserId.mockResolvedValue(null);

    await optionalAuth(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(findUserAuthStateById).toHaveBeenCalledWith('u_regular');
    expect(findAdminByUserId).toHaveBeenCalledWith('u_regular');
    expect(req.user).toEqual({
      userId: 'u_regular',
      email: 'regular@example.com',
      isAdmin: false,
      adminRole: null,
    });
  });

  test('sets admin details from current DB admin record', async () => {
    const req = {
      headers: {
        authorization: 'Bearer valid-admin-token',
      },
    };
    const next = jest.fn();

    jwt.verify.mockReturnValue({
      userId: 'u_admin',
      email: 'admin@example.com',
      isAdmin: false,
      adminRole: null,
    });
    findUserAuthStateById.mockResolvedValue({
      user_id: 'u_admin',
      email: 'admin@example.com',
      is_deleted: false,
      is_banned: false,
    });
    findAdminByUserId.mockResolvedValue({
      admin_id: 'admin_1',
      user_id: 'u_admin',
      role: 'COORDINATOR',
    });

    await optionalAuth(req, {}, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user).toEqual({
      userId: 'u_admin',
      email: 'admin@example.com',
      isAdmin: true,
      adminRole: 'COORDINATOR',
      adminId: 'admin_1',
    });
  });
});

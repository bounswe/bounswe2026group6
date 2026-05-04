'use strict';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

jest.mock('../../../../src/modules/auth/repository', () => ({
  findAdminByUserId: jest.fn(),
  findUserAuthStateById: jest.fn(),
}));

jest.mock('../../../../src/modules/announcements/service', () => ({
  createAnnouncement: jest.fn(),
  deleteAnnouncement: jest.fn(),
  getAnnouncement: jest.fn(),
  getAnnouncements: jest.fn(),
  updateAnnouncement: jest.fn(),
}));

const { env } = require('../../../../src/config/env');
const { findAdminByUserId, findUserAuthStateById } = require('../../../../src/modules/auth/repository');
const announcementService = require('../../../../src/modules/announcements/service');
const {
  adminAnnouncementsRouter,
  announcementsRouter,
} = require('../../../../src/modules/announcements/routes');

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/announcements', announcementsRouter);
  app.use('/api/admin/announcements', adminAnnouncementsRouter);
  return app;
}

function signToken(payload = {}) {
  return jwt.sign(
    {
      userId: 'user-1',
      email: 'user@example.com',
      isAdmin: false,
      adminRole: null,
      ...payload,
    },
    env.jwt.secret,
    { expiresIn: '1h' },
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  findUserAuthStateById.mockImplementation(async (userId) => ({
    user_id: userId,
    email: `${userId}@example.com`,
    is_deleted: false,
    is_banned: false,
  }));
});

describe('announcements routes', () => {
  test('GET /api/announcements lists public announcements without auth', async () => {
    announcementService.getAnnouncements.mockResolvedValue([
      {
        id: 'ann-1',
        adminId: 'admin-1',
        title: 'Preparedness update',
        content: 'Public body',
        createdAt: '2026-04-01T10:00:00.000Z',
      },
    ]);

    const response = await request(createTestApp()).get('/api/announcements?limit=10');

    expect(response.status).toBe(200);
    expect(announcementService.getAnnouncements).toHaveBeenCalledWith({ limit: 10 });
    expect(response.body.announcements).toHaveLength(1);
  });

  test('POST /api/admin/announcements rejects missing token', async () => {
    const response = await request(createTestApp())
      .post('/api/admin/announcements')
      .send({ title: 'Blocked', content: 'Missing token' });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
    expect(announcementService.createAnnouncement).not.toHaveBeenCalled();
  });

  test('POST /api/admin/announcements rejects authenticated non-admin', async () => {
    findAdminByUserId.mockResolvedValue(null);

    const response = await request(createTestApp())
      .post('/api/admin/announcements')
      .set('Authorization', `Bearer ${signToken()}`)
      .send({ title: 'Blocked', content: 'Not admin' });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
    expect(findAdminByUserId).toHaveBeenCalledWith('user-1');
    expect(announcementService.createAnnouncement).not.toHaveBeenCalled();
  });

  test('POST /api/admin/announcements allows admins to create', async () => {
    findAdminByUserId.mockResolvedValue({
      admin_id: 'admin-1',
      user_id: 'admin-user',
      role: 'COORDINATOR',
    });
    announcementService.createAnnouncement.mockResolvedValue({
      id: 'ann-1',
      adminId: 'admin-1',
      title: 'Shelter update',
      content: 'Shelter capacity changed.',
      createdAt: '2026-04-01T10:00:00.000Z',
    });

    const response = await request(createTestApp())
      .post('/api/admin/announcements')
      .set('Authorization', `Bearer ${signToken({ userId: 'admin-user', isAdmin: true, adminRole: 'COORDINATOR' })}`)
      .send({ title: ' Shelter update ', content: ' Shelter capacity changed. ' });

    expect(response.status).toBe(201);
    expect(announcementService.createAnnouncement).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-user',
        adminId: 'admin-1',
        isAdmin: true,
        adminRole: 'COORDINATOR',
      }),
      {
        title: 'Shelter update',
        content: 'Shelter capacity changed.',
      },
    );
    expect(response.body.announcement.id).toBe('ann-1');
  });

  test('PATCH and DELETE /api/admin/announcements/:id handle not found', async () => {
    findAdminByUserId.mockResolvedValue({
      admin_id: 'admin-1',
      user_id: 'admin-user',
      role: 'COORDINATOR',
    });
    announcementService.updateAnnouncement.mockResolvedValue(null);
    announcementService.deleteAnnouncement.mockResolvedValue(false);
    const token = signToken({ userId: 'admin-user', isAdmin: true, adminRole: 'COORDINATOR' });

    const patchResponse = await request(createTestApp())
      .patch('/api/admin/announcements/missing')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated' });

    expect(patchResponse.status).toBe(404);
    expect(patchResponse.body.code).toBe('NOT_FOUND');

    const deleteResponse = await request(createTestApp())
      .delete('/api/admin/announcements/missing')
      .set('Authorization', `Bearer ${token}`);

    expect(deleteResponse.status).toBe(404);
    expect(deleteResponse.body.code).toBe('NOT_FOUND');
  });
});

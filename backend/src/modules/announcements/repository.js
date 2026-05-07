const { query } = require('../../db/pool');

function mapAnnouncement(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.announcement_id,
    adminId: row.admin_id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
  };
}

async function listAnnouncements({ limit = 50 } = {}) {
  const result = await query(
    `
      SELECT
        announcement_id,
        admin_id,
        title,
        content,
        created_at
      FROM news_announcements
      ORDER BY created_at DESC, announcement_id DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map(mapAnnouncement);
}

async function findAnnouncementById(announcementId) {
  const result = await query(
    `
      SELECT
        announcement_id,
        admin_id,
        title,
        content,
        created_at
      FROM news_announcements
      WHERE announcement_id = $1
    `,
    [announcementId],
  );

  return mapAnnouncement(result.rows[0]);
}

async function insertAnnouncement({ id, adminId, title, content }) {
  const result = await query(
    `
      INSERT INTO news_announcements (announcement_id, admin_id, title, content)
      VALUES ($1, $2, $3, $4)
      RETURNING announcement_id, admin_id, title, content, created_at
    `,
    [id, adminId, title, content],
  );

  return mapAnnouncement(result.rows[0]);
}

async function updateAnnouncementById(announcementId, patch) {
  const assignments = [];
  const values = [announcementId];

  if (Object.prototype.hasOwnProperty.call(patch, 'title')) {
    values.push(patch.title);
    assignments.push(`title = $${values.length}`);
  }

  if (Object.prototype.hasOwnProperty.call(patch, 'content')) {
    values.push(patch.content);
    assignments.push(`content = $${values.length}`);
  }

  if (assignments.length === 0) {
    return findAnnouncementById(announcementId);
  }

  const result = await query(
    `
      UPDATE news_announcements
      SET ${assignments.join(', ')}
      WHERE announcement_id = $1
      RETURNING announcement_id, admin_id, title, content, created_at
    `,
    values,
  );

  return mapAnnouncement(result.rows[0]);
}

async function deleteAnnouncementById(announcementId) {
  const result = await query(
    `
      DELETE FROM news_announcements
      WHERE announcement_id = $1
      RETURNING announcement_id
    `,
    [announcementId],
  );

  return result.rowCount > 0;
}

module.exports = {
  deleteAnnouncementById,
  findAnnouncementById,
  insertAnnouncement,
  listAnnouncements,
  updateAnnouncementById,
};

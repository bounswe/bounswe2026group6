const bcrypt = require('bcrypt');

const { pool, query } = require('../src/db/pool');

const DEMO_PASSWORD = 'DemoPass123!';
const PASSWORD_SALT_ROUNDS = 10;

const users = [
  {
    id: 'demo_user_admin',
    email: 'admin_demo@neph.test',
    firstName: 'Deniz',
    lastName: 'Yilmaz',
    phone: '5321112233',
    location: {
      district: 'Beşiktaş',
      neighborhood: 'Levazim',
      extraAddress: 'Levazim Mahallesi, Koru Sokak No: 8',
      latitude: 41.06482,
      longitude: 29.00818,
    },
    adminId: 'demo_admin_ops',
  },
  {
    id: 'demo_user_requester_1',
    email: 'requester_ayse@neph.test',
    firstName: 'Ayse',
    lastName: 'Kara',
    phone: '5332223344',
    location: {
      district: 'Kadıköy',
      neighborhood: 'Moda',
      extraAddress: 'Caferaga Mahallesi, Moda Caddesi No: 42',
      latitude: 40.98466,
      longitude: 29.0273,
    },
  },
  {
    id: 'demo_user_requester_2',
    email: 'requester_mert@neph.test',
    firstName: 'Mert',
    lastName: 'Demir',
    phone: '5343334455',
    location: {
      district: 'Şişli',
      neighborhood: 'Mecidiyeköy',
      extraAddress: 'Mecidiyekoy Mahallesi, Buyukdere Caddesi No: 95',
      latitude: 41.06726,
      longitude: 28.99042,
    },
  },
  {
    id: 'demo_user_volunteer_1',
    email: 'volunteer_elif@neph.test',
    firstName: 'Elif',
    lastName: 'Aydin',
    phone: '5354445566',
    location: {
      district: 'Beşiktaş',
      neighborhood: 'Levazim',
      extraAddress: 'Levazim Mahallesi, Barbaros Bulvari yakinlari',
      latitude: 41.0639,
      longitude: 29.0069,
    },
    volunteerId: 'demo_volunteer_elif',
    skills: ['first_aid', 'medical_support'],
    needTypes: ['medical', 'mobility'],
  },
  {
    id: 'demo_user_volunteer_2',
    email: 'volunteer_can@neph.test',
    firstName: 'Can',
    lastName: 'Ozturk',
    phone: '5365556677',
    location: {
      district: 'Kadıköy',
      neighborhood: 'Moda',
      extraAddress: 'Moda Sahili gonullu bulusma noktasi',
      latitude: 40.98612,
      longitude: 29.02562,
    },
    volunteerId: 'demo_volunteer_can',
    skills: ['supplies', 'mobility_support'],
    needTypes: ['food', 'water', 'mobility'],
  },
];

const requests = [
  {
    id: 'demo_request_active_medical',
    userId: 'demo_user_requester_1',
    helpTypes: ['medical'],
    needType: 'medical',
    description: '[DEMO] Elderly resident needs urgent blood pressure medication and a basic health check.',
    affectedPeopleCount: 1,
    riskFlags: ['elderly', 'urgent_medication'],
    vulnerableGroups: ['elderly'],
    bloodType: 'A+',
    contactFullName: 'Ayse Kara',
    contactPhone: 5332223344,
    status: 'PENDING',
    urgencyLevel: 'HIGH',
    priorityLevel: 'HIGH',
    createdAtSql: "CURRENT_TIMESTAMP - INTERVAL '45 minutes'",
    location: {
      id: 'demo_location_request_active_medical',
      country: 'Türkiye',
      city: 'Istanbul',
      district: 'Kadıköy',
      neighborhood: 'Moda',
      extraAddress: 'Caferaga Mahallesi, Moda Caddesi No: 42',
      latitude: 40.98466,
      longitude: 29.0273,
    },
  },
  {
    id: 'demo_request_assigned_food_water',
    userId: 'demo_user_requester_2',
    helpTypes: ['food', 'water'],
    needType: 'food/water',
    description: '[DEMO] Family of four needs drinking water and ready-to-eat food supplies.',
    affectedPeopleCount: 4,
    riskFlags: ['children'],
    vulnerableGroups: ['children'],
    bloodType: null,
    contactFullName: 'Mert Demir',
    contactPhone: 5343334455,
    status: 'ASSIGNED',
    urgencyLevel: 'MEDIUM',
    priorityLevel: 'MEDIUM',
    assignedVolunteerId: 'demo_volunteer_can',
    assignmentId: 'demo_assignment_food_water_can',
    createdAtSql: "CURRENT_TIMESTAMP - INTERVAL '1 hour'",
    location: {
      id: 'demo_location_request_assigned_food',
      country: 'Türkiye',
      city: 'Istanbul',
      district: 'Şişli',
      neighborhood: 'Mecidiyeköy',
      extraAddress: 'Mecidiyeköy Meydanı yakınları',
      latitude: 41.06726,
      longitude: 28.99042,
    },
  },
  {
    id: 'demo_request_active_search_rescue',
    userId: 'demo_user_requester_2',
    helpTypes: ['search_and_rescue'],
    needType: 'search_and_rescue',
    description: '[DEMO] Residents report a damaged stairwell and possible trapped neighbor near an apartment entrance.',
    affectedPeopleCount: 2,
    riskFlags: ['injury', 'structural_damage'],
    vulnerableGroups: [],
    bloodType: null,
    contactFullName: 'Mert Demir',
    contactPhone: 5343334455,
    status: 'PENDING',
    urgencyLevel: 'HIGH',
    priorityLevel: 'HIGH',
    createdAtSql: "CURRENT_TIMESTAMP - INTERVAL '30 minutes'",
    location: {
      id: 'demo_location_request_search_rescue',
      country: 'Türkiye',
      city: 'Istanbul',
      district: 'Şişli',
      neighborhood: 'Mecidiyeköy',
      extraAddress: 'Mecidiyeköy Mahallesi, damaged side street near Büyükdere Caddesi',
      latitude: 41.0681,
      longitude: 28.99115,
    },
  },
  {
    id: 'demo_request_resolved_mobility',
    userId: 'demo_user_requester_1',
    helpTypes: ['mobility'],
    needType: 'mobility',
    description: '[DEMO] Wheelchair user needed help reaching a temporary gathering area.',
    affectedPeopleCount: 1,
    riskFlags: ['mobility_impairment'],
    vulnerableGroups: ['disabled'],
    bloodType: null,
    contactFullName: 'Ayse Kara',
    contactPhone: 5332223344,
    status: 'RESOLVED',
    urgencyLevel: 'LOW',
    priorityLevel: 'LOW',
    createdAtSql: "CURRENT_TIMESTAMP - INTERVAL '3 hours'",
    resolvedAtSql: "CURRENT_TIMESTAMP - INTERVAL '2 hours'",
    location: {
      id: 'demo_location_request_resolved_mobility',
      country: 'Türkiye',
      city: 'Istanbul',
      district: 'Beşiktaş',
      neighborhood: 'Levazim',
      extraAddress: 'Levazim Mahallesi, Nispetiye Caddesi cikisi',
      latitude: 41.06482,
      longitude: 29.00818,
    },
  },
];

const announcements = [
  {
    id: 'demo_announcement_water_kadikoy',
    title: 'Water distribution in Kadıköy',
    content: '[DEMO] Bottled water distribution is available near Moda Sahili between 10:00 and 18:00 today.',
  },
  {
    id: 'demo_announcement_gathering_besiktas',
    title: 'Temporary gathering area in Beşiktaş',
    content: '[DEMO] A temporary gathering area is active at Levazim neighborhood park with basic first-aid support.',
  },
];

const notifications = [
  {
    id: 'demo_notification_assignment_can',
    recipientUserId: 'demo_user_volunteer_2',
    actorUserId: 'demo_user_admin',
    type: 'TASK_ASSIGNED',
    title: 'New supply delivery assigned',
    body: '[DEMO] You have been assigned to the food and water request in Mecidiyekoy.',
    entityType: 'HELP_REQUEST',
    entityId: 'demo_request_assigned_food_water',
    payload: { screen: 'assignment', requestId: 'demo_request_assigned_food_water' },
  },
  {
    id: 'demo_notification_status_ayse',
    recipientUserId: 'demo_user_requester_1',
    actorUserId: 'demo_user_admin',
    type: 'HELP_REQUEST_STATUS_CHANGED',
    title: 'Mobility request resolved',
    body: '[DEMO] Your mobility support request has been marked as resolved.',
    entityType: 'HELP_REQUEST',
    entityId: 'demo_request_resolved_mobility',
    payload: { screen: 'helpRequestDetails', requestId: 'demo_request_resolved_mobility' },
  },
];

function logInserted(stats, label, id) {
  stats.inserted += 1;
  console.log(`inserted ${label}: ${id}`);
}

function logSkipped(stats, label, id) {
  stats.skipped += 1;
  console.log(`skipped ${label}: ${id}`);
}

async function exists(sql, params) {
  const result = await query(sql, params);
  return result.rowCount > 0;
}

async function seedUsers() {
  const stats = { inserted: 0, skipped: 0 };
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, PASSWORD_SALT_ROUNDS);

  for (const user of users) {
    const userExists = await exists('SELECT 1 FROM users WHERE user_id = $1 OR email = $2 LIMIT 1', [
      user.id,
      user.email,
    ]);

    if (userExists) {
      logSkipped(stats, 'user', user.email);
    } else {
      await query(
        `
          INSERT INTO users (
            user_id,
            email,
            password_hash,
            is_email_verified,
            accepted_terms
          )
          VALUES ($1, $2, $3, TRUE, TRUE)
        `,
        [user.id, user.email, passwordHash],
      );
      logInserted(stats, 'user', user.email);
    }

    const profileId = `demo_profile_${user.id.replace('demo_user_', '')}`;
    const profileExists = await exists('SELECT 1 FROM user_profiles WHERE user_id = $1 LIMIT 1', [user.id]);

    if (profileExists) {
      logSkipped(stats, 'profile', user.email);
    } else {
      await query(
        `
          INSERT INTO user_profiles (
            profile_id,
            user_id,
            first_name,
            last_name,
            phone_number
          )
          VALUES ($1, $2, $3, $4, $5)
        `,
        [profileId, user.id, user.firstName, user.lastName, user.phone],
      );
      logInserted(stats, 'profile', user.email);
    }

    const locationExists = await exists('SELECT 1 FROM location_profiles WHERE profile_id = $1 LIMIT 1', [
      profileId,
    ]);

    if (locationExists) {
      logSkipped(stats, 'location profile', user.email);
    } else {
      await query(
        `
          INSERT INTO location_profiles (
            location_profile_id,
            profile_id,
            address,
            display_address,
            city,
            country,
            country_code,
            district,
            neighborhood,
            extra_address,
            latitude,
            longitude,
            coordinate_accuracy_meters,
            coordinate_source,
            coordinate_captured_at
          )
          VALUES ($1, $2, $3, $3, 'Istanbul', 'Türkiye', 'TR', $4, $5, $6, $7, $8, 25, 'DEMO', CURRENT_TIMESTAMP)
        `,
        [
          `demo_location_profile_${user.id.replace('demo_user_', '')}`,
          profileId,
          `${user.location.neighborhood}, ${user.location.district} - ${user.location.extraAddress}`,
          user.location.district,
          user.location.neighborhood,
          user.location.extraAddress,
          user.location.latitude,
          user.location.longitude,
        ],
      );
      logInserted(stats, 'location profile', user.email);
    }

    if (user.adminId) {
      const adminExists = await exists('SELECT 1 FROM admins WHERE admin_id = $1 OR user_id = $2 LIMIT 1', [
        user.adminId,
        user.id,
      ]);

      if (adminExists) {
        logSkipped(stats, 'admin', user.email);
      } else {
        await query(
          'INSERT INTO admins (admin_id, user_id, role) VALUES ($1, $2, $3)',
          [user.adminId, user.id, 'SUPER_ADMIN'],
        );
        logInserted(stats, 'admin', user.email);
      }
    }
  }

  return stats;
}

async function seedVolunteers() {
  const stats = { inserted: 0, skipped: 0 };
  const volunteerUsers = users.filter((user) => user.volunteerId);

  for (const user of volunteerUsers) {
    const volunteerExists = await exists('SELECT 1 FROM volunteers WHERE volunteer_id = $1 OR user_id = $2 LIMIT 1', [
      user.volunteerId,
      user.id,
    ]);

    if (volunteerExists) {
      logSkipped(stats, 'volunteer', user.email);
    } else {
      await query(
        `
          INSERT INTO volunteers (
            volunteer_id,
            user_id,
            is_available,
            skills,
            need_types,
            last_known_latitude,
            last_known_longitude,
            location_updated_at
          )
          VALUES ($1, $2, TRUE, $3, $4, $5, $6, CURRENT_TIMESTAMP)
        `,
        [
          user.volunteerId,
          user.id,
          user.skills,
          user.needTypes,
          user.location.latitude,
          user.location.longitude,
        ],
      );
      logInserted(stats, 'volunteer', user.email);
    }

    const profileId = `demo_profile_${user.id.replace('demo_user_', '')}`;
    const expertiseId = `demo_expertise_${user.id.replace('demo_user_', '')}`;
    const expertiseExists = await exists('SELECT 1 FROM expertise WHERE expertise_id = $1 LIMIT 1', [expertiseId]);

    if (expertiseExists) {
      logSkipped(stats, 'expertise', user.email);
    } else {
      await query(
        `
          INSERT INTO expertise (
            expertise_id,
            profile_id,
            profession,
            expertise_area,
            is_verified
          )
          VALUES ($1, $2, $3, $4, TRUE)
        `,
        [
          expertiseId,
          profileId,
          user.volunteerId === 'demo_volunteer_elif' ? 'Paramedic volunteer' : 'Logistics volunteer',
          user.volunteerId === 'demo_volunteer_elif' ? 'medical' : 'food/water',
        ],
      );
      logInserted(stats, 'expertise', user.email);
    }
  }

  return stats;
}

async function seedRequests() {
  const stats = { inserted: 0, skipped: 0 };

  for (const request of requests) {
    const requestExists = await exists('SELECT 1 FROM help_requests WHERE request_id = $1 LIMIT 1', [request.id]);

    if (requestExists) {
      logSkipped(stats, 'help request', request.id);
    } else {
      await query(
        `
          INSERT INTO help_requests (
            request_id,
            user_id,
            help_types,
            affected_people_count,
            risk_flags,
            vulnerable_groups,
            need_type,
            description,
            blood_type,
            contact_full_name,
            contact_phone,
            consent_given,
            status,
            urgency_level,
            priority_level,
            created_at,
            resolved_at
          )
          VALUES (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            TRUE,
            $12::request_status,
            $13,
            $14,
            ${request.createdAtSql},
            ${request.resolvedAtSql || 'NULL'}
          )
        `,
        [
          request.id,
          request.userId,
          request.helpTypes,
          request.affectedPeopleCount,
          request.riskFlags,
          request.vulnerableGroups,
          request.needType,
          request.description,
          request.bloodType,
          request.contactFullName,
          request.contactPhone,
          request.status,
          request.urgencyLevel,
          request.priorityLevel,
        ],
      );
      logInserted(stats, 'help request', request.id);
    }

    const locationExists = await exists('SELECT 1 FROM request_locations WHERE request_id = $1 LIMIT 1', [request.id]);

    if (locationExists) {
      logSkipped(stats, 'request location', request.location.id);
    } else {
      await query(
        `
          INSERT INTO request_locations (
            location_id,
            request_id,
            country,
            city,
            district,
            neighborhood,
            extra_address,
            latitude,
            longitude,
            is_gps_location,
            is_last_known
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, FALSE)
        `,
        [
          request.location.id,
          request.id,
          request.location.country,
          request.location.city,
          request.location.district,
          request.location.neighborhood,
          request.location.extraAddress,
          request.location.latitude,
          request.location.longitude,
        ],
      );
      logInserted(stats, 'request location', request.location.id);
    }

    if (request.assignmentId) {
      const assignmentExists = await exists('SELECT 1 FROM assignments WHERE assignment_id = $1 LIMIT 1', [
        request.assignmentId,
      ]);

      if (assignmentExists) {
        logSkipped(stats, 'assignment', request.assignmentId);
      } else {
        await query(
          `
            INSERT INTO assignments (
              assignment_id,
              volunteer_id,
              request_id,
              assigned_at,
              is_cancelled
            )
            VALUES ($1, $2, $3, CURRENT_TIMESTAMP - INTERVAL '20 minutes', FALSE)
          `,
          [request.assignmentId, request.assignedVolunteerId, request.id],
        );
        logInserted(stats, 'assignment', request.assignmentId);
      }
    }
  }

  return stats;
}

async function seedAnnouncements() {
  const stats = { inserted: 0, skipped: 0 };
  const adminId = users.find((user) => user.adminId).adminId;

  for (const announcement of announcements) {
    const announcementExists = await exists('SELECT 1 FROM news_announcements WHERE announcement_id = $1 LIMIT 1', [
      announcement.id,
    ]);

    if (announcementExists) {
      logSkipped(stats, 'announcement', announcement.title);
    } else {
      await query(
        `
          INSERT INTO news_announcements (
            announcement_id,
            admin_id,
            title,
            content
          )
          VALUES ($1, $2, $3, $4)
        `,
        [announcement.id, adminId, announcement.title, announcement.content],
      );
      logInserted(stats, 'announcement', announcement.title);
    }
  }

  return stats;
}

async function seedNotifications() {
  const stats = { inserted: 0, skipped: 0 };

  for (const notification of notifications) {
    const notificationExists = await exists('SELECT 1 FROM notifications WHERE notification_id = $1 LIMIT 1', [
      notification.id,
    ]);

    if (notificationExists) {
      logSkipped(stats, 'notification', notification.title);
    } else {
      await query(
        `
          INSERT INTO notifications (
            notification_id,
            recipient_user_id,
            actor_user_id,
            type,
            title,
            body,
            entity_type,
            entity_id,
            payload
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
        `,
        [
          notification.id,
          notification.recipientUserId,
          notification.actorUserId,
          notification.type,
          notification.title,
          notification.body,
          notification.entityType,
          notification.entityId,
          JSON.stringify(notification.payload),
        ],
      );
      logInserted(stats, 'notification', notification.title);
    }
  }

  return stats;
}

async function run() {
  if (process.env.ENABLE_DEMO_SEED !== 'true') {
    console.log('Demo seed skipped. Set ENABLE_DEMO_SEED=true to insert demo data.');
    return;
  }

  console.log('Seeding NEPH demo data...');
  console.log(`Demo login password for *@neph.test users: ${DEMO_PASSWORD}`);

  const results = [
    ['users', await seedUsers()],
    ['volunteers', await seedVolunteers()],
    ['requests', await seedRequests()],
    ['announcements', await seedAnnouncements()],
    ['notifications', await seedNotifications()],
  ];

  const totals = results.reduce(
    (accumulator, [, stats]) => ({
      inserted: accumulator.inserted + stats.inserted,
      skipped: accumulator.skipped + stats.skipped,
    }),
    { inserted: 0, skipped: 0 },
  );

  console.log('Demo seed complete.');

  for (const [label, stats] of results) {
    console.log(`${label}: inserted ${stats.inserted}, skipped ${stats.skipped}`);
  }

  console.log(`total: inserted ${totals.inserted}, skipped ${totals.skipped}`);
}

run()
  .catch((error) => {
    console.error('Demo seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

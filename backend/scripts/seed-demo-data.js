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
    physical: { age: 38, gender: 'male', height: 178, weight: 76 },
    health: {
      medicalConditions: [],
      chronicDiseases: [],
      allergies: [],
      medications: [],
      bloodType: '0+',
    },
    privacy: {
      profileVisibility: 'EMERGENCY_ONLY',
      healthInfoVisibility: 'EMERGENCY_ONLY',
      locationVisibility: 'EMERGENCY_ONLY',
      locationSharingEnabled: true,
    },
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
    physical: { age: 71, gender: 'female', height: 162, weight: 68 },
    health: {
      medicalConditions: ['hypertension'],
      chronicDiseases: ['high blood pressure'],
      allergies: ['penicillin'],
      medications: ['blood pressure medication'],
      bloodType: 'A+',
    },
    privacy: {
      profileVisibility: 'EMERGENCY_ONLY',
      healthInfoVisibility: 'EMERGENCY_ONLY',
      locationVisibility: 'EMERGENCY_ONLY',
      locationSharingEnabled: true,
    },
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
    physical: { age: 34, gender: 'male', height: 181, weight: 82 },
    health: {
      medicalConditions: [],
      chronicDiseases: [],
      allergies: [],
      medications: [],
      bloodType: 'B+',
    },
    privacy: {
      profileVisibility: 'EMERGENCY_ONLY',
      healthInfoVisibility: 'PRIVATE',
      locationVisibility: 'EMERGENCY_ONLY',
      locationSharingEnabled: true,
    },
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
    physical: { age: 29, gender: 'female', height: 168, weight: 61 },
    health: {
      medicalConditions: [],
      chronicDiseases: [],
      allergies: [],
      medications: [],
      bloodType: 'A-',
    },
    privacy: {
      profileVisibility: 'PUBLIC',
      healthInfoVisibility: 'EMERGENCY_ONLY',
      locationVisibility: 'EMERGENCY_ONLY',
      locationSharingEnabled: true,
    },
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
    physical: { age: 42, gender: 'male', height: 176, weight: 79 },
    health: {
      medicalConditions: [],
      chronicDiseases: [],
      allergies: ['dust'],
      medications: [],
      bloodType: '0-',
    },
    privacy: {
      profileVisibility: 'PUBLIC',
      healthInfoVisibility: 'EMERGENCY_ONLY',
      locationVisibility: 'EMERGENCY_ONLY',
      locationSharingEnabled: true,
    },
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

const seededIds = {
  usersByDemoId: new Map(),
  profilesByDemoUserId: new Map(),
  volunteersByDemoVolunteerId: new Map(),
  adminId: null,
};

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

async function findOne(sql, params) {
  const result = await query(sql, params);
  return result.rows[0] || null;
}

function makeProfileId(user) {
  return `demo_profile_${user.id.replace('demo_user_', '')}`;
}

function makeProfileChildId(prefix, user) {
  return `${prefix}_${user.id.replace('demo_user_', '')}`;
}

function getSeededUserId(demoUserId) {
  const userId = seededIds.usersByDemoId.get(demoUserId);

  if (!userId) {
    throw new Error(`Missing seeded user id for ${demoUserId}.`);
  }

  return userId;
}

function getSeededProfileId(demoUserId) {
  const profileId = seededIds.profilesByDemoUserId.get(demoUserId);

  if (!profileId) {
    throw new Error(`Missing seeded profile id for ${demoUserId}.`);
  }

  return profileId;
}

function getSeededVolunteerId(demoVolunteerId) {
  const volunteerId = seededIds.volunteersByDemoVolunteerId.get(demoVolunteerId);

  if (!volunteerId) {
    throw new Error(`Missing seeded volunteer id for ${demoVolunteerId}.`);
  }

  return volunteerId;
}

async function seedUsers() {
  const stats = { inserted: 0, skipped: 0 };
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, PASSWORD_SALT_ROUNDS);

  for (const user of users) {
    let userRow = await findOne('SELECT user_id, email FROM users WHERE email = $1 LIMIT 1', [user.email]);

    if (!userRow) {
      const userIdConflict = await findOne('SELECT user_id, email FROM users WHERE user_id = $1 LIMIT 1', [user.id]);

      if (userIdConflict) {
        throw new Error(
          `Cannot seed ${user.email}: demo user id ${user.id} is already used by ${userIdConflict.email}.`,
        );
      }
    }

    if (userRow) {
      seededIds.usersByDemoId.set(user.id, userRow.user_id);
      logSkipped(stats, 'user', `${user.email} (${userRow.user_id})`);
    } else {
      const insertedUser = await query(
        `
          INSERT INTO users (
            user_id,
            email,
            password_hash,
            is_email_verified,
            accepted_terms
          )
          VALUES ($1, $2, $3, TRUE, TRUE)
          RETURNING user_id, email
        `,
        [user.id, user.email, passwordHash],
      );
      userRow = insertedUser.rows[0];
      seededIds.usersByDemoId.set(user.id, userRow.user_id);
      logInserted(stats, 'user', user.email);
    }

    const actualUserId = seededIds.usersByDemoId.get(user.id);
    const deterministicProfileId = makeProfileId(user);
    let profileRow = await findOne(
      'SELECT profile_id, user_id FROM user_profiles WHERE user_id = $1 LIMIT 1',
      [actualUserId],
    );

    if (!profileRow) {
      const profileIdConflict = await findOne(
        'SELECT profile_id, user_id FROM user_profiles WHERE profile_id = $1 LIMIT 1',
        [deterministicProfileId],
      );

      if (profileIdConflict) {
        throw new Error(
          `Cannot seed ${user.email}: demo profile id ${deterministicProfileId} is already used by user ${profileIdConflict.user_id}.`,
        );
      }
    }

    if (profileRow) {
      seededIds.profilesByDemoUserId.set(user.id, profileRow.profile_id);
      logSkipped(stats, 'profile', `${user.email} (${profileRow.profile_id})`);
    } else {
      const insertedProfile = await query(
        `
          INSERT INTO user_profiles (
            profile_id,
            user_id,
            first_name,
            last_name,
            phone_number
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING profile_id, user_id
        `,
        [deterministicProfileId, actualUserId, user.firstName, user.lastName, user.phone],
      );
      profileRow = insertedProfile.rows[0];
      seededIds.profilesByDemoUserId.set(user.id, profileRow.profile_id);
      logInserted(stats, 'profile', user.email);
    }

    const actualProfileId = seededIds.profilesByDemoUserId.get(user.id);
    const locationExists = await exists('SELECT 1 FROM location_profiles WHERE profile_id = $1 LIMIT 1', [
      actualProfileId,
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
          makeProfileChildId('demo_location_profile', user),
          actualProfileId,
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

    const physicalExists = await exists('SELECT 1 FROM physical_info WHERE profile_id = $1 LIMIT 1', [
      actualProfileId,
    ]);

    if (physicalExists) {
      logSkipped(stats, 'physical info', user.email);
    } else {
      await query(
        `
          INSERT INTO physical_info (
            physical_id,
            profile_id,
            age,
            gender,
            height,
            weight
          )
          VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          makeProfileChildId('demo_physical', user),
          actualProfileId,
          user.physical.age,
          user.physical.gender,
          user.physical.height,
          user.physical.weight,
        ],
      );
      logInserted(stats, 'physical info', user.email);
    }

    const healthExists = await exists('SELECT 1 FROM health_info WHERE profile_id = $1 LIMIT 1', [
      actualProfileId,
    ]);

    if (healthExists) {
      logSkipped(stats, 'health info', user.email);
    } else {
      await query(
        `
          INSERT INTO health_info (
            health_id,
            profile_id,
            medical_conditions,
            chronic_diseases,
            allergies,
            medications,
            blood_type
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [
          makeProfileChildId('demo_health', user),
          actualProfileId,
          user.health.medicalConditions,
          user.health.chronicDiseases,
          user.health.allergies,
          user.health.medications,
          user.health.bloodType,
        ],
      );
      logInserted(stats, 'health info', user.email);
    }

    const privacyExists = await exists('SELECT 1 FROM privacy_settings WHERE profile_id = $1 LIMIT 1', [
      actualProfileId,
    ]);

    if (privacyExists) {
      logSkipped(stats, 'privacy settings', user.email);
    } else {
      await query(
        `
          INSERT INTO privacy_settings (
            settings_id,
            profile_id,
            profile_visibility,
            health_info_visibility,
            location_visibility,
            location_sharing_enabled
          )
          VALUES ($1, $2, $3::visibility_level, $4::visibility_level, $5::visibility_level, $6)
        `,
        [
          makeProfileChildId('demo_privacy', user),
          actualProfileId,
          user.privacy.profileVisibility,
          user.privacy.healthInfoVisibility,
          user.privacy.locationVisibility,
          user.privacy.locationSharingEnabled,
        ],
      );
      logInserted(stats, 'privacy settings', user.email);
    }

    if (user.adminId) {
      let adminRow = await findOne('SELECT admin_id, user_id FROM admins WHERE user_id = $1 LIMIT 1', [
        actualUserId,
      ]);

      if (!adminRow) {
        const adminIdConflict = await findOne('SELECT admin_id, user_id FROM admins WHERE admin_id = $1 LIMIT 1', [
          user.adminId,
        ]);

        if (adminIdConflict) {
          throw new Error(
            `Cannot seed ${user.email}: demo admin id ${user.adminId} is already used by user ${adminIdConflict.user_id}.`,
          );
        }
      }

      if (adminRow) {
        seededIds.adminId = adminRow.admin_id;
        logSkipped(stats, 'admin', `${user.email} (${adminRow.admin_id})`);
      } else {
        const insertedAdmin = await query(
          'INSERT INTO admins (admin_id, user_id, role) VALUES ($1, $2, $3) RETURNING admin_id',
          [user.adminId, actualUserId, 'SUPER_ADMIN'],
        );
        adminRow = insertedAdmin.rows[0];
        seededIds.adminId = adminRow.admin_id;
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
    const actualUserId = getSeededUserId(user.id);
    const actualProfileId = getSeededProfileId(user.id);
    let volunteerRow = await findOne('SELECT volunteer_id, user_id FROM volunteers WHERE user_id = $1 LIMIT 1', [
      actualUserId,
    ]);

    if (!volunteerRow) {
      const volunteerIdConflict = await findOne(
        'SELECT volunteer_id, user_id FROM volunteers WHERE volunteer_id = $1 LIMIT 1',
        [user.volunteerId],
      );

      if (volunteerIdConflict) {
        throw new Error(
          `Cannot seed ${user.email}: demo volunteer id ${user.volunteerId} is already used by user ${volunteerIdConflict.user_id}.`,
        );
      }
    }

    if (volunteerRow) {
      seededIds.volunteersByDemoVolunteerId.set(user.volunteerId, volunteerRow.volunteer_id);
      logSkipped(stats, 'volunteer', `${user.email} (${volunteerRow.volunteer_id})`);
    } else {
      const insertedVolunteer = await query(
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
          RETURNING volunteer_id, user_id
        `,
        [
          user.volunteerId,
          actualUserId,
          user.skills,
          user.needTypes,
          user.location.latitude,
          user.location.longitude,
        ],
      );
      volunteerRow = insertedVolunteer.rows[0];
      seededIds.volunteersByDemoVolunteerId.set(user.volunteerId, volunteerRow.volunteer_id);
      logInserted(stats, 'volunteer', user.email);
    }

    const expertiseId = `demo_expertise_${user.id.replace('demo_user_', '')}`;
    const expertiseRow = await findOne('SELECT expertise_id, profile_id FROM expertise WHERE expertise_id = $1 LIMIT 1', [
      expertiseId,
    ]);

    if (expertiseRow && expertiseRow.profile_id !== actualProfileId) {
      throw new Error(
        `Cannot seed ${user.email}: demo expertise id ${expertiseId} is already used by profile ${expertiseRow.profile_id}.`,
      );
    }

    if (expertiseRow) {
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
          actualProfileId,
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
          getSeededUserId(request.userId),
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
          [request.assignmentId, getSeededVolunteerId(request.assignedVolunteerId), request.id],
        );
        logInserted(stats, 'assignment', request.assignmentId);
      }
    }
  }

  return stats;
}

async function seedAnnouncements() {
  const stats = { inserted: 0, skipped: 0 };

  if (!seededIds.adminId) {
    throw new Error('Missing seeded admin id for demo announcements.');
  }

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
        [announcement.id, seededIds.adminId, announcement.title, announcement.content],
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
          getSeededUserId(notification.recipientUserId),
          getSeededUserId(notification.actorUserId),
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

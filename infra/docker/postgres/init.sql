BEGIN;


DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS assignments CASCADE;
DROP TABLE IF EXISTS availability_records CASCADE;
DROP TABLE IF EXISTS resources CASCADE;
DROP TABLE IF EXISTS volunteers CASCADE;
DROP TABLE IF EXISTS request_locations CASCADE;
DROP TABLE IF EXISTS help_requests CASCADE;
DROP TABLE IF EXISTS news_announcements CASCADE;
DROP TABLE IF EXISTS reports CASCADE;
DROP TABLE IF EXISTS expertise CASCADE;
DROP TABLE IF EXISTS privacy_settings CASCADE;
DROP TABLE IF EXISTS location_profiles CASCADE;
DROP TABLE IF EXISTS health_info CASCADE;
DROP TABLE IF EXISTS physical_info CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS admins CASCADE;
DROP TABLE IF EXISTS users CASCADE;

DROP TYPE IF EXISTS request_status CASCADE;
DROP TYPE IF EXISTS visibility_level CASCADE;



CREATE TYPE visibility_level AS ENUM (
    'PUBLIC',
    'EMERGENCY_ONLY',
    'PRIVATE'
);

CREATE TYPE request_status AS ENUM (
    'PENDING',
    'ASSIGNED',
    'IN_PROGRESS',
    'RESOLVED',
    'CANCELLED'
);



CREATE TABLE users (
    user_id              VARCHAR(64) PRIMARY KEY,
    email                VARCHAR(255) NOT NULL UNIQUE,
    password_hash        VARCHAR(255) NOT NULL,
    is_email_verified    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted           BOOLEAN NOT NULL DEFAULT FALSE,
    accepted_terms       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE admins (
    admin_id             VARCHAR(64) PRIMARY KEY,
    user_id              VARCHAR(64) NOT NULL UNIQUE,
    role                 VARCHAR(100) NOT NULL,

    CONSTRAINT fk_admin_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE user_profiles (
    profile_id           VARCHAR(64) PRIMARY KEY,
    user_id              VARCHAR(64) NOT NULL UNIQUE,
    first_name           VARCHAR(100) NOT NULL,
    last_name            VARCHAR(100) NOT NULL,
    phone_number         VARCHAR(30),

    CONSTRAINT fk_user_profile_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE physical_info (
    physical_id          VARCHAR(64) PRIMARY KEY,
    profile_id           VARCHAR(64) NOT NULL UNIQUE,
    age                  INTEGER,
    gender               VARCHAR(20),
    height               DOUBLE PRECISION,
    weight               DOUBLE PRECISION,

    CONSTRAINT fk_physical_info_profile
        FOREIGN KEY (profile_id)
        REFERENCES user_profiles(profile_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_physical_age
        CHECK (age IS NULL OR age >= 0),

    CONSTRAINT chk_physical_height
        CHECK (height IS NULL OR height > 0),

    CONSTRAINT chk_physical_weight
        CHECK (weight IS NULL OR weight > 0)
);

CREATE TABLE health_info (
    health_id              VARCHAR(64) PRIMARY KEY,
    profile_id             VARCHAR(64) NOT NULL UNIQUE,
    medical_conditions     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    chronic_diseases       TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    allergies              TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    medications            TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    blood_type             VARCHAR(10),

    CONSTRAINT fk_health_info_profile
        FOREIGN KEY (profile_id)
        REFERENCES user_profiles(profile_id)
        ON DELETE CASCADE
);

CREATE TABLE location_profiles (
    location_profile_id    VARCHAR(64) PRIMARY KEY,
    profile_id             VARCHAR(64) NOT NULL UNIQUE,
    address                VARCHAR(500),
    city                   VARCHAR(100),
    country                VARCHAR(100),
    latitude               DOUBLE PRECISION,
    longitude              DOUBLE PRECISION,
    last_updated           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_location_profile_profile
        FOREIGN KEY (profile_id)
        REFERENCES user_profiles(profile_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_location_profile_coordinates
        CHECK (
            (latitude IS NULL AND longitude IS NULL)
            OR
            (
                latitude IS NOT NULL
                AND longitude IS NOT NULL
                AND latitude BETWEEN -90 AND 90
                AND longitude BETWEEN -180 AND 180
            )
        )
);

CREATE TABLE privacy_settings (
    settings_id                VARCHAR(64) PRIMARY KEY,
    profile_id                 VARCHAR(64) NOT NULL UNIQUE,
    profile_visibility         visibility_level NOT NULL DEFAULT 'PRIVATE',
    health_info_visibility     visibility_level NOT NULL DEFAULT 'PRIVATE',
    location_visibility        visibility_level NOT NULL DEFAULT 'PRIVATE',
    location_sharing_enabled   BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_privacy_settings_profile
        FOREIGN KEY (profile_id)
        REFERENCES user_profiles(profile_id)
        ON DELETE CASCADE
);

CREATE TABLE expertise (
    expertise_id           VARCHAR(64) PRIMARY KEY,
    profile_id             VARCHAR(64) NOT NULL,
    profession             VARCHAR(200),
    expertise_area         VARCHAR(200),
    is_verified            BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_expertise_profile
        FOREIGN KEY (profile_id)
        REFERENCES user_profiles(profile_id)
        ON DELETE CASCADE
);

CREATE TABLE reports (
    report_id              VARCHAR(64) PRIMARY KEY,
    submitted_by           VARCHAR(64) NOT NULL,
    reported_user          VARCHAR(64) NOT NULL,
    reason                 VARCHAR(500) NOT NULL,
    description            TEXT,
    created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status                 VARCHAR(50) NOT NULL DEFAULT 'PENDING',

    CONSTRAINT fk_report_submitted_by
        FOREIGN KEY (submitted_by)
        REFERENCES users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_report_reported_user
        FOREIGN KEY (reported_user)
        REFERENCES users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_no_self_report
        CHECK (submitted_by <> reported_user)
);



CREATE TABLE news_announcements (
    announcement_id        VARCHAR(64) PRIMARY KEY,
    admin_id               VARCHAR(64) NOT NULL,
    title                  VARCHAR(500) NOT NULL,
    content                TEXT NOT NULL,
    created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_news_announcement_admin
        FOREIGN KEY (admin_id)
        REFERENCES admins(admin_id)
        ON DELETE RESTRICT
);

CREATE TABLE help_requests (
    request_id             VARCHAR(64) PRIMARY KEY,
    user_id                VARCHAR(64) NOT NULL,
    help_types             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    other_help_text        TEXT NOT NULL DEFAULT '',
    affected_people_count  INTEGER NOT NULL DEFAULT 1,
    risk_flags             TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    vulnerable_groups      TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    need_type              VARCHAR(200) NOT NULL,
    description            TEXT,
    blood_type             VARCHAR(10),
    contact_full_name      VARCHAR(200) NOT NULL,
    contact_phone          BIGINT NOT NULL,
    contact_alternative_phone BIGINT,
    consent_given          BOOLEAN NOT NULL DEFAULT FALSE,
    status                 request_status NOT NULL DEFAULT 'PENDING',
    created_at             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at            TIMESTAMP,
    is_saved_locally       BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_help_request_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE RESTRICT,

    CONSTRAINT chk_help_request_resolved_at
        CHECK (
            resolved_at IS NULL
            OR resolved_at >= created_at
        ),

    CONSTRAINT chk_help_request_affected_people_count
        CHECK (affected_people_count >= 1),

    CONSTRAINT chk_help_request_contact_phone
        CHECK (contact_phone BETWEEN 5000000000 AND 5999999999),

    CONSTRAINT chk_help_request_contact_alternative_phone
        CHECK (
            contact_alternative_phone IS NULL
            OR contact_alternative_phone BETWEEN 5000000000 AND 5999999999
        )
);

CREATE TABLE request_locations (
    location_id            VARCHAR(64) PRIMARY KEY,
    request_id             VARCHAR(64) NOT NULL UNIQUE,
    country                VARCHAR(100) NOT NULL,
    city                   VARCHAR(100) NOT NULL,
    district               VARCHAR(100) NOT NULL,
    neighborhood           VARCHAR(100) NOT NULL,
    extra_address          VARCHAR(500),
    latitude               DOUBLE PRECISION,
    longitude              DOUBLE PRECISION,
    is_gps_location        BOOLEAN NOT NULL DEFAULT FALSE,
    is_last_known          BOOLEAN NOT NULL DEFAULT FALSE,
    captured_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_request_location_request
        FOREIGN KEY (request_id)
        REFERENCES help_requests(request_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_request_location_coordinates
        CHECK (
            (latitude IS NULL AND longitude IS NULL)
            OR
            (
                latitude IS NOT NULL
                AND longitude IS NOT NULL
                AND latitude BETWEEN -90 AND 90
                AND longitude BETWEEN -180 AND 180
            )
        )
);



CREATE TABLE volunteers (
    volunteer_id             VARCHAR(64) PRIMARY KEY,
    user_id                  VARCHAR(64) NOT NULL UNIQUE,
    is_available             BOOLEAN NOT NULL DEFAULT FALSE,
    skills                   TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    need_types               TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    last_known_latitude      DOUBLE PRECISION,
    last_known_longitude     DOUBLE PRECISION,
    location_updated_at      TIMESTAMP,

    CONSTRAINT fk_volunteer_user
        FOREIGN KEY (user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_volunteer_coordinates
        CHECK (
            (last_known_latitude IS NULL AND last_known_longitude IS NULL)
            OR
            (
                last_known_latitude IS NOT NULL
                AND last_known_longitude IS NOT NULL
                AND last_known_latitude BETWEEN -90 AND 90
                AND last_known_longitude BETWEEN -180 AND 180
            )
        )
);

CREATE TABLE resources (
    resource_id            VARCHAR(64) PRIMARY KEY,
    volunteer_id           VARCHAR(64) NOT NULL,
    resource_name          VARCHAR(200) NOT NULL,
    description            TEXT,
    quantity               INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT fk_resource_volunteer
        FOREIGN KEY (volunteer_id)
        REFERENCES volunteers(volunteer_id)
        ON DELETE CASCADE,

    CONSTRAINT chk_resource_quantity
        CHECK (quantity >= 0)
);

CREATE TABLE availability_records (
    availability_id        VARCHAR(64) PRIMARY KEY,
    volunteer_id           VARCHAR(64) NOT NULL,
    is_available           BOOLEAN NOT NULL DEFAULT FALSE,
    stored_locally         BOOLEAN NOT NULL DEFAULT FALSE,
    synced_at              TIMESTAMP,

    CONSTRAINT fk_availability_record_volunteer
        FOREIGN KEY (volunteer_id)
        REFERENCES volunteers(volunteer_id)
        ON DELETE CASCADE
);

CREATE TABLE assignments (
    assignment_id          VARCHAR(64) PRIMARY KEY,
    volunteer_id           VARCHAR(64) NOT NULL,
    request_id             VARCHAR(64) NOT NULL UNIQUE,
    assigned_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_cancelled           BOOLEAN NOT NULL DEFAULT FALSE,

    CONSTRAINT fk_assignment_volunteer
        FOREIGN KEY (volunteer_id)
        REFERENCES volunteers(volunteer_id)
        ON DELETE RESTRICT,

    CONSTRAINT fk_assignment_request
        FOREIGN KEY (request_id)
        REFERENCES help_requests(request_id)
        ON DELETE RESTRICT
);

CREATE TABLE messages (
    message_id             VARCHAR(64) PRIMARY KEY,
    assignment_id          VARCHAR(64) NOT NULL,
    sender_id              VARCHAR(64) NOT NULL,
    content                TEXT NOT NULL,
    sent_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_message_assignment
        FOREIGN KEY (assignment_id)
        REFERENCES assignments(assignment_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_message_sender
        FOREIGN KEY (sender_id)
        REFERENCES users(user_id)
        ON DELETE RESTRICT
);



CREATE INDEX idx_users_is_deleted
    ON users(is_deleted);

CREATE INDEX idx_admins_user_id
    ON admins(user_id);

CREATE INDEX idx_user_profiles_user_id
    ON user_profiles(user_id);

CREATE INDEX idx_expertise_profile_id
    ON expertise(profile_id);

CREATE INDEX idx_reports_submitted_by
    ON reports(submitted_by);

CREATE INDEX idx_reports_reported_user
    ON reports(reported_user);

CREATE INDEX idx_reports_status
    ON reports(status);

CREATE INDEX idx_news_announcements_admin_id
    ON news_announcements(admin_id);

CREATE INDEX idx_news_announcements_created_at
    ON news_announcements(created_at DESC);

CREATE INDEX idx_help_requests_user_id
    ON help_requests(user_id);

CREATE INDEX idx_help_requests_status
    ON help_requests(status);

CREATE INDEX idx_help_requests_created_at
    ON help_requests(created_at DESC);

CREATE INDEX idx_help_requests_need_type
    ON help_requests(need_type);

CREATE INDEX idx_request_locations_request_id
    ON request_locations(request_id);

CREATE INDEX idx_request_locations_coordinates
    ON request_locations(latitude, longitude);

CREATE INDEX idx_volunteers_user_id
    ON volunteers(user_id);

CREATE INDEX idx_volunteers_is_available
    ON volunteers(is_available);

CREATE INDEX idx_volunteers_coordinates
    ON volunteers(last_known_latitude, last_known_longitude);

CREATE INDEX idx_resources_volunteer_id
    ON resources(volunteer_id);

CREATE INDEX idx_availability_records_volunteer_id
    ON availability_records(volunteer_id);

CREATE INDEX idx_availability_records_synced_at
    ON availability_records(synced_at);

CREATE INDEX idx_assignments_volunteer_id
    ON assignments(volunteer_id);

CREATE INDEX idx_assignments_request_id
    ON assignments(request_id);

CREATE INDEX idx_assignments_is_cancelled
    ON assignments(is_cancelled);

CREATE INDEX idx_messages_assignment_id
    ON messages(assignment_id);

CREATE INDEX idx_messages_sender_id
    ON messages(sender_id);

CREATE INDEX idx_messages_sent_at
    ON messages(sent_at DESC);

COMMIT;

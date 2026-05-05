BEGIN;

CREATE TABLE IF NOT EXISTS safety_circles (
  circle_id VARCHAR(64) PRIMARY KEY,
  owner_user_id VARCHAR(64) NOT NULL,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_safety_circles_owner
    FOREIGN KEY (owner_user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE,

  CONSTRAINT chk_safety_circles_name_not_blank
    CHECK (LENGTH(TRIM(name)) > 0)
);

CREATE TABLE IF NOT EXISTS safety_circle_members (
  circle_id VARCHAR(64) NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (circle_id, user_id),

  CONSTRAINT fk_safety_circle_members_circle
    FOREIGN KEY (circle_id)
    REFERENCES safety_circles(circle_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_safety_circle_members_user
    FOREIGN KEY (user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE,

  CONSTRAINT chk_safety_circle_members_role
    CHECK (role IN ('owner', 'member'))
);

CREATE TABLE IF NOT EXISTS safety_circle_invites (
  invite_id VARCHAR(64) PRIMARY KEY,
  circle_id VARCHAR(64) NOT NULL,
  inviter_user_id VARCHAR(64) NOT NULL,
  invitee_user_id VARCHAR(64) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP,

  CONSTRAINT fk_safety_circle_invites_circle
    FOREIGN KEY (circle_id)
    REFERENCES safety_circles(circle_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_safety_circle_invites_inviter
    FOREIGN KEY (inviter_user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE,

  CONSTRAINT fk_safety_circle_invites_invitee
    FOREIGN KEY (invitee_user_id)
    REFERENCES users(user_id)
    ON DELETE CASCADE,

  CONSTRAINT chk_safety_circle_invites_status
    CHECK (status IN ('pending', 'accepted', 'rejected')),

  CONSTRAINT chk_safety_circle_invites_not_self
    CHECK (inviter_user_id <> invitee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_safety_circles_owner
  ON safety_circles (owner_user_id);

CREATE INDEX IF NOT EXISTS idx_safety_circle_members_user
  ON safety_circle_members (user_id);

CREATE INDEX IF NOT EXISTS idx_safety_circle_invites_invitee_status
  ON safety_circle_invites (invitee_user_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_safety_circle_invites_one_open
  ON safety_circle_invites (circle_id, invitee_user_id)
  WHERE status = 'pending';

COMMIT;

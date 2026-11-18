CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('manager', 'telecaller')),
  deleted_at timestamptz
);

CREATE TABLE IF NOT EXISTS import_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  filename text NOT NULL,
  client text NOT NULL,
  created_at timestamptz DEFAULT now(),
  author_id uuid REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text DEFAULT '',
  course text DEFAULT '',
  client text DEFAULT '',
  status text NOT NULL DEFAULT 'Pending / Not connected',
  owner_id uuid REFERENCES users (id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS students_owner ON students (owner_id);

CREATE INDEX IF NOT EXISTS students_phone ON students (phone);

CREATE TABLE IF NOT EXISTS activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students (id),
  author_id uuid NOT NULL REFERENCES users (id),
  kind text NOT NULL,
  outcome text,
  note text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students (id),
  author_id uuid NOT NULL REFERENCES users (id),
  due_at timestamptz NOT NULL,
  note text NOT NULL,
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS followups_student ON followups (student_id);

CREATE TABLE IF NOT EXISTS source_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES import_batches (id),
  student_id uuid REFERENCES students (id),
  raw jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS duplicate_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES import_batches (id),
  candidate_id uuid REFERENCES students (id),
  raw jsonb NOT NULL,
  resolved_at timestamptz,
  decision text
);

CREATE TABLE IF NOT EXISTS login_limits (
  email text PRIMARY KEY,
  attempts integer NOT NULL,
  reset_at timestamptz NOT NULL
);

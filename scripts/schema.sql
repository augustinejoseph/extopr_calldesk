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

-- Additive migration for existing installations.
ALTER TABLE students
ADD COLUMN IF NOT EXISTS district text NOT NULL DEFAULT '';

ALTER TABLE students
ADD COLUMN IF NOT EXISTS sub_district text NOT NULL DEFAULT '';

ALTER TABLE students
ADD COLUMN IF NOT EXISTS father_name text NOT NULL DEFAULT '';

ALTER TABLE students
ADD COLUMN IF NOT EXISTS gender text NOT NULL DEFAULT '';

ALTER TABLE students
ADD COLUMN IF NOT EXISTS community text NOT NULL DEFAULT '';

ALTER TABLE students
ADD COLUMN IF NOT EXISTS student_group text NOT NULL DEFAULT '';

ALTER TABLE students
ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';

ALTER TABLE students
ADD COLUMN IF NOT EXISTS pincode text NOT NULL DEFAULT '';

ALTER TABLE students
ADD COLUMN IF NOT EXISTS school_name text NOT NULL DEFAULT '';

ALTER TABLE students
ADD COLUMN IF NOT EXISTS extra_fields jsonb NOT NULL DEFAULT '{}';

ALTER TABLE students
ADD COLUMN IF NOT EXISTS created_by_import_id uuid REFERENCES import_batches (id);

CREATE INDEX IF NOT EXISTS students_import ON students (created_by_import_id);

ALTER TABLE import_batches
ADD COLUMN IF NOT EXISTS mapping jsonb NOT NULL DEFAULT '{}';

ALTER TABLE import_batches
ADD COLUMN IF NOT EXISTS total_rows integer NOT NULL DEFAULT 0;

ALTER TABLE import_batches
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'legacy';

ALTER TABLE import_batches
ADD COLUMN IF NOT EXISTS finished_at timestamptz;

CREATE TABLE IF NOT EXISTS import_chunks (
  batch_id uuid NOT NULL REFERENCES import_batches (id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  row_count integer NOT NULL,
  imported integer NOT NULL,
  review_count integer NOT NULL,
  errors jsonb NOT NULL,
  PRIMARY KEY (batch_id, chunk_index)
);

ALTER TABLE source_records
ADD COLUMN IF NOT EXISTS row_number integer;

ALTER TABLE duplicate_reviews
ADD COLUMN IF NOT EXISTS source_id uuid REFERENCES source_records (id);

ALTER TABLE activities
ADD COLUMN IF NOT EXISTS import_batch_id uuid REFERENCES import_batches (id);

CREATE INDEX IF NOT EXISTS source_records_batch ON source_records (batch_id);

CREATE INDEX IF NOT EXISTS source_records_student ON source_records (student_id);

CREATE INDEX IF NOT EXISTS duplicate_reviews_batch ON duplicate_reviews (batch_id);

CREATE INDEX IF NOT EXISTS duplicate_reviews_candidate ON duplicate_reviews (candidate_id);

CREATE INDEX IF NOT EXISTS duplicate_reviews_source ON duplicate_reviews (source_id);

CREATE INDEX IF NOT EXISTS activities_student ON activities (student_id);

CREATE INDEX IF NOT EXISTS activities_import ON activities (import_batch_id);

-- Imported profile details are optional; workflow fields keep their defaults.
ALTER TABLE students
ALTER COLUMN district
DROP NOT NULL,
ALTER COLUMN sub_district
DROP NOT NULL,
ALTER COLUMN father_name
DROP NOT NULL,
ALTER COLUMN gender
DROP NOT NULL,
ALTER COLUMN community
DROP NOT NULL,
ALTER COLUMN student_group
DROP NOT NULL,
ALTER COLUMN address
DROP NOT NULL,
ALTER COLUMN pincode
DROP NOT NULL,
ALTER COLUMN school_name
DROP NOT NULL;

CREATE INDEX IF NOT EXISTS students_created_page ON students (created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS students_owner_page ON students (owner_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS activities_history_page ON activities (student_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS followups_pending_due ON followups (due_at, id)
WHERE
  completed_at IS NULL;

CREATE INDEX IF NOT EXISTS followups_pending_student ON followups (student_id, due_at, id)
WHERE
  completed_at IS NULL;

CREATE INDEX IF NOT EXISTS duplicates_pending_page ON duplicate_reviews (id)
WHERE
  resolved_at IS NULL;

CREATE INDEX IF NOT EXISTS imports_created_page ON import_batches (created_at DESC, id DESC);

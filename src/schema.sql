-- Bethel Hostel booking system schema (idempotent: safe to run on every start)

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE IF NOT EXISTS settings (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS images (
  id         serial PRIMARY KEY,
  mime       text NOT NULL,
  data       bytea NOT NULL,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- A room type is what guests book (e.g. "Private room", "Bed in men's dormitory")
CREATE TABLE IF NOT EXISTS room_types (
  id          serial PRIMARY KEY,
  slug        text UNIQUE,
  name        jsonb NOT NULL DEFAULT '{}',   -- {"en":..,"he":..,"de":..}
  description jsonb NOT NULL DEFAULT '{}',
  note        jsonb NOT NULL DEFAULT '{}',   -- shown before booking (rules for this room type)
  sold_as     text  NOT NULL DEFAULT 'room' CHECK (sold_as IN ('room', 'bed')),
  capacity    int   NOT NULL DEFAULT 2 CHECK (capacity BETWEEN 1 AND 30),
  prices      jsonb NOT NULL DEFAULT '[]',   -- price per night by number of guests: [1 guest, 2 guests, ...]
  gender      text  NOT NULL DEFAULT 'any' CHECK (gender IN ('any', 'male', 'female')),
  photos      jsonb NOT NULL DEFAULT '[]',   -- ["/img/12", "https://..."]
  sort        int   NOT NULL DEFAULT 0,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- A unit is one physical bookable thing: a room ("Room 3") or a bed ("Room 4 - Bed 2")
CREATE TABLE IF NOT EXISTS units (
  id           serial PRIMARY KEY,
  room_type_id int  NOT NULL REFERENCES room_types(id) ON DELETE CASCADE,
  name         text NOT NULL,
  sort         int  NOT NULL DEFAULT 0,
  active       boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS bookings (
  id              serial PRIMARY KEY,
  code            text UNIQUE NOT NULL,
  token           text UNIQUE NOT NULL,
  kind            text NOT NULL DEFAULT 'guest' CHECK (kind IN ('guest', 'block')),
  source          text NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'admin')),
  status          text NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'expired')),
  check_in        date NOT NULL,
  check_out       date NOT NULL,
  lang            text NOT NULL DEFAULT 'en',
  guest_name      text,
  email           text,
  phone           text,
  country         text,
  travelers       jsonb NOT NULL DEFAULT '[]',   -- [{"name":..,"gender":"male"|"female"}]
  guests_count    int NOT NULL DEFAULT 0,
  notes           text,
  admin_notes     text,
  currency        text NOT NULL DEFAULT 'ILS',
  total           numeric(10,2) NOT NULL DEFAULT 0,
  paid            numeric(10,2) NOT NULL DEFAULT 0,
  pay_method      text,                           -- paypal | arrival | manual
  paypal_order_id text,
  expires_at      timestamptz,                    -- payment hold deadline for pending bookings
  cancelled_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CHECK (check_out > check_in)
);

CREATE TABLE IF NOT EXISTS booking_units (
  id           serial PRIMARY KEY,
  booking_id   int NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  room_type_id int NOT NULL REFERENCES room_types(id),
  unit_id      int NOT NULL REFERENCES units(id),
  guests       int NOT NULL DEFAULT 1,
  nightly      numeric(10,2) NOT NULL DEFAULT 0,
  amount       numeric(10,2) NOT NULL DEFAULT 0,
  stay         daterange NOT NULL,
  active       boolean NOT NULL DEFAULT true
);

-- The database itself guarantees that a unit can never be double-booked
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'booking_units_no_overlap') THEN
    ALTER TABLE booking_units
      ADD CONSTRAINT booking_units_no_overlap
      EXCLUDE USING gist (unit_id WITH =, stay WITH &&) WHERE (active);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS payments (
  id                serial PRIMARY KEY,
  booking_id        int NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  method            text NOT NULL,                -- paypal | cash | card | transfer | bit | demo
  amount            numeric(10,2) NOT NULL,       -- negative = refund
  currency          text NOT NULL DEFAULT 'ILS',
  status            text NOT NULL DEFAULT 'completed',
  paypal_order_id   text UNIQUE,
  paypal_capture_id text,
  paypal_refund_id  text,
  payer_email       text,
  refund_of         int REFERENCES payments(id),
  doc_id            text,
  doc_number        text,
  doc_url           text,
  doc_error         text,
  note              text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         serial PRIMARY KEY,
  booking_id int REFERENCES bookings(id) ON DELETE CASCADE,
  action     text NOT NULL,
  detail     jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_units_type ON units(room_type_id);
CREATE INDEX IF NOT EXISTS idx_bu_booking ON booking_units(booking_id);
CREATE INDEX IF NOT EXISTS idx_bu_unit ON booking_units(unit_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status, check_in);
CREATE INDEX IF NOT EXISTS idx_bookings_dates ON bookings(check_in, check_out);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_audit_booking ON audit_log(booking_id);

CREATE TABLE IF NOT EXISTS group_requests (
  id           serial PRIMARY KEY,
  code         text NOT NULL UNIQUE,
  lang         text NOT NULL DEFAULT 'en',
  group_name   text NOT NULL,
  contact_name text NOT NULL,
  email        text NOT NULL,
  phone        text NOT NULL,
  arrival      date NOT NULL,
  departure    date NOT NULL,
  group_size   int NOT NULL,
  adults       int,
  children     int,
  needs        text,
  message      text,
  status       text NOT NULL DEFAULT 'new',   -- new | answered | closed
  admin_notes  text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_group_requests_created ON group_requests(created_at DESC);

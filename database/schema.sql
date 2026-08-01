CREATE TABLE users (
id uuid PRIMARY KEY,
name text,
email text,
photo text,
created_at timestamp default now()
);


CREATE TABLE locations (
id uuid PRIMARY KEY,
town text,
county text,
latitude float,
longitude float
);


CREATE TABLE businesses (
id uuid PRIMARY KEY,
location_id uuid,
name text,
category text,
description text,
address text,
website text,
latitude float,
longitude float
);


CREATE TABLE properties (
id uuid PRIMARY KEY,
location_id uuid,
name text,
host text,
booking_url text,
description text,
latitude float,
longitude float,
qr_code text
);


CREATE TABLE reviews (
id uuid PRIMARY KEY,
user_id uuid,
business_id uuid,
property_id uuid,
rating integer,
comment text,
created_at timestamp default now()
);
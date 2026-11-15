ALTER TABLE profile ADD full_name TEXT;
ALTER TABLE profile ADD sex TEXT;
ALTER TABLE profile ADD birth_place TEXT;
ALTER TABLE auth ADD two_step INTEGER NOT NULL DEFAULT 1;

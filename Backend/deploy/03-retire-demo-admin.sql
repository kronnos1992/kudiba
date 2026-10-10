BEGIN;

DELETE FROM kudiba_core.refresh_tokens
WHERE user_id IN (
    SELECT id FROM kudiba_core.users WHERE email = 'admin@kudiba.ao'
);

DELETE FROM kudiba_core.user_roles
WHERE user_id IN (
    SELECT id FROM kudiba_core.users WHERE email = 'admin@kudiba.ao'
);

UPDATE kudiba_core.users
SET is_active = FALSE,
    failed_login_attempts = 0,
    locked_until = NULL,
    updated_at = NOW()
WHERE email = 'admin@kudiba.ao';

COMMIT;

/** Contact for privacy and account-deletion requests (shown on the public pages; Google Play asks for it). */
export const CONTACT_EMAIL = 'lucian.m91@gmail.com';

/** Date the privacy policy text was last changed. */
export const POLICY_DATE = '10 noiembrie 2026';

/**
 * Version of the terms of use. Must equal `current_terms_version()` in the database: `accept_terms` refuses any
 * other value. Bump both (a new migration) whenever the terms change, so every student accepts the new text.
 */
export const TERMS_VERSION = '2026-11-10';

/** Date the terms of use text was last changed (shown on the terms page). */
export const TERMS_DATE = '10 noiembrie 2026';

/** Operator (data controller) details, shown in the terms and the privacy policy. Placeholders until the owner fills them. */
export const OPERATOR_NAME = '[DENUMIRE OPERATOR]';
export const OPERATOR_CUI = '[CUI]';
export const OPERATOR_ADDRESS = '[SEDIU]';

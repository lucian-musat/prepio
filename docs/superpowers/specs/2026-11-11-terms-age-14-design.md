# Minimum age 14 and parental consent in the terms checkbox

Owner decision (2026-11-11), approved in chat. Replaces section 7 (16+) of `2026-11-10-launch-readiness-design.md`.

## Intent

Prepio should be open to high-school students from 14, not only 12th graders aged 16+. A student under 18 must
declare a parent's or guardian's consent both for using the app and for payments. It stays simple and
non-intrusive: no date of birth, no parent email, no extra step at payment.

## What changes

- **Checkbox** (Welcome and the terms gate), still one required tick, links still outside the checkbox:
  „Am cel puțin 14 ani și accept Termenii de utilizare și Politica de confidențialitate. Dacă am sub 18 ani, am
  acordul părintelui sau al tutorelui pentru a folosi Prepio și pentru plăți.”
- **Terms** („Cine poate folosi aplicația”): 14+; under 18 needs a parent's or guardian's consent to use Prepio and to
  buy credits or full access; the sign-up confirmation; a parent can ask to close the account at the contact address;
  an account of someone under 14, or of a minor without consent, is deleted and unused paid credits or access are
  refunded. „Credite și acces” repeats the purchase rule.
- **Privacy** („Vârsta minimă” and the stored data): the same 14+ and parental-consent wording; a parent can ask about
  or delete the account's data.
- **Version:** `TERMS_VERSION` and `current_terms_version()` → `2026-11-11` (new migration). Every existing account
  goes through the terms gate again. `age_confirmed_at` keeps its name and now records the 14+ confirmation and, for a
  minor, the parental consent.

## Calls made by Claude

- The audience line changes from „elevii de clasa a XII-a” to „elevii de liceu”, since 14+ includes grades 9–11.
- The refund promise only applies once payments exist (the terms already say no money is collected yet).
- The wording is a draft for the owner's lawyer, like the rest of the terms.

## Non-goals

Age verification, a parent account or parent email, a consent step at checkout.

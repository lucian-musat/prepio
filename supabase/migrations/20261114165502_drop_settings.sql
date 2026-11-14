-- The legacy single-row `settings` table held only `welcome_message`; the welcome text now lives in the
-- `ui_texts` row `home.hero.welcome`. Its policies are dropped with it.
drop table public.settings;

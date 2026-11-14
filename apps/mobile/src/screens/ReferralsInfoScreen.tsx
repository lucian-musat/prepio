import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { color, space } from '@prepio/shared';
import { AppText, Icon, ScreenLayout, Spinner, Surface, goBackOrHome } from '../ui';
import { fetchReferralPublicSettings, monthsText, type ReferralPublicSettings } from '../lib/referrals';
import { Item, Section, legalStyles } from './legal/LegalSection';
import EmailLink from '../components/EmailLink';
import { t, tPlural } from '../texts/store';

type State = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; settings: ReferralPublicSettings };

const colleagueCount = (n: number) => tPlural(n, 'invite.colleague.one', 'invite.colleague.many');
const creditCount = (n: number) => tPlural(n, 'credits.count.one', 'credits.count.many');

/** The programme's numbers as phrases; without the live settings they read "stabilit de Prepio" (never invented). */
function phrases(s: ReferralPublicSettings | null) {
  return {
    colleagues: s ? colleagueCount(s.threshold) : t('pages.referrals.fallback.colleagues'),
    credits: s ? creditCount(s.creditsPerInvitee) : t('pages.referrals.fallback.credits'),
    duration: s ? monthsText(s.durationMonths) : t('pages.referrals.fallback.duration'),
    cap: s ? colleagueCount(s.maxRewarded) : t('pages.referrals.fallback.colleagues'),
    /** Owner decision 2026-11-12: the free access includes the bonus credits of a purchase. */
    bonusIncluded:
      s == null
        ? t('pages.referrals.bonus.unknown')
        : s.bonusCredits > 0
          ? t('pages.referrals.bonus.included', { credite: creditCount(s.bonusCredits) })
          : t('pages.referrals.bonus.none'),
    /** "100 de credite" when a purchase includes bonus credits; empty without a bonus or without the numbers. */
    bonus: s && s.bonusCredits > 0 ? creditCount(s.bonusCredits) : '',
  };
}

/** A section that starts closed: its title is a button that opens it (the page is long; „Pe scurt” stays open). */
function Fold({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.fold}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.foldHead}
      >
        <AppText role="section" accessibilityRole="header" style={styles.foldTitle}>
          {title}
        </AppText>
        <Icon name={open ? 'up' : 'down'} tint={color.textMuted} />
      </Pressable>
      {open ? <View style={styles.foldBody}>{children}</View> : null}
    </View>
  );
}

function Question({ q, children }: { q: string; children: string }) {
  return (
    <View style={styles.faq}>
      <AppText role="bodyStrong">{q}</AppText>
      <AppText role="body">{children}</AppText>
    </View>
  );
}

/**
 * „Cum funcționează recomandările”: public (reachable signed out), static explanation with the live numbers of the
 * programme. Without readable settings the numbers are replaced by "stabilit de Prepio"; the page never crashes.
 * Describes what the database does (migrations 20261112*); the copy lives in the `pages` text group.
 */
export default function ReferralsInfoScreen() {
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let live = true;
    fetchReferralPublicSettings()
      .then((settings) => live && setState({ status: 'ready', settings }))
      .catch((e: unknown) => {
        console.warn('[referrals] the explainer could not read the settings:', e);
        if (live) setState({ status: 'failed' });
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <ScreenLayout title={t('pages.referrals.title')} onBack={goBackOrHome}>
      {state.status === 'loading' ? (
        <View style={styles.center}>
          <Spinner accessibilityLabel={t('common.loading')} />
        </View>
      ) : (
        <Page settings={state.status === 'ready' ? state.settings : null} />
      )}
    </ScreenLayout>
  );
}

function Page({ settings }: { settings: ReferralPublicSettings | null }) {
  const p = phrases(settings);
  const off = settings != null && !settings.enabled;
  const two = settings ? creditCount(2 * settings.creditsPerInvitee) : '';
  const free = { colegi: p.colleagues, durata: p.duration };

  return (
    <View style={legalStyles.stack}>
      {off ? (
        <Surface>
          <AppText role="bodyStrong" accessibilityRole="alert">
            {t('pages.referrals.off.title')}
          </AppText>
          <AppText role="small" color="textMuted">
            {t('pages.referrals.off.body')}
          </AppText>
        </Surface>
      ) : null}

      <Section title={t('pages.referrals.short.title')}>
        <AppText role="body">{t('pages.referrals.short.intro')}</AppText>
        <Item>
          {p.bonus
            ? t('pages.referrals.short.noAccessWithBonus', { ...free, credite: p.bonus })
            : t('pages.referrals.short.noAccess', free)}
        </Item>
        <Item>{t('pages.referrals.short.active', { credite: p.credits })}</Item>
      </Section>

      <Fold title={t('pages.referrals.paid.title')}>
        <Item>{t('pages.referrals.paid.firstPurchase')}</Item>
        <Item>{t('pages.referrals.paid.adminAccess')}</Item>
        <Item>{t('pages.referrals.paid.notYet')}</Item>
      </Fold>

      <Fold title={t('pages.referrals.noAccess.title')}>
        <Item>{t('pages.referrals.noAccess.counted', free)}</Item>
        <Item>{p.bonusIncluded}</Item>
        <Item>{t('pages.referrals.noAccess.waiting')}</Item>
        <Item>{t('pages.referrals.noAccess.usedOnce')}</Item>
        <Item>{t('pages.referrals.noAccess.onePeriod')}</Item>
      </Fold>

      <Fold title={t('pages.referrals.active.title')}>
        <Item>{t('pages.referrals.active.credits', { credite: p.credits })}</Item>
        <Item>{t('pages.referrals.active.meaning')}</Item>
        <Item>{t('pages.referrals.active.moment')}</Item>
      </Fold>

      <Fold title={t('pages.referrals.buy.title')}>
        <Item>{t('pages.referrals.buy.converted', { credite: p.credits })}</Item>
        <Item>{t('pages.referrals.buy.notBoth')}</Item>
        <Item>{t('pages.referrals.buy.adminAccess')}</Item>
      </Fold>

      <Fold title={t('pages.referrals.examples.title')}>
        {settings ? (
          <>
            <Question q={t('pages.referrals.examples.anaQ')}>
              {p.bonus
                ? t('pages.referrals.examples.anaAWithBonus', { ...free, credite: p.bonus })
                : t('pages.referrals.examples.anaA', free)}
            </Question>
            <Question q={t('pages.referrals.examples.mihaiQ')}>
              {t('pages.referrals.examples.mihaiA', { credite: p.credits, total: two })}
            </Question>
            <Question q={t('pages.referrals.examples.ioanaQ')}>
              {t('pages.referrals.examples.ioanaA', { credite: p.credits })}
            </Question>
          </>
        ) : (
          <AppText role="body">{t('pages.referrals.examples.unavailable')}</AppText>
        )}
      </Fold>

      <Fold title={t('pages.referrals.code.title')}>
        <Item>{t('pages.referrals.code.signUpOnly')}</Item>
        <Item>{t('pages.referrals.code.newAccount')}</Item>
        <Item>{t('pages.referrals.code.olderInviter')}</Item>
        <Item>{t('pages.referrals.code.oneInviter')}</Item>
        <Item>{t('pages.referrals.code.whenOff')}</Item>
      </Fold>

      <Fold title={t('pages.referrals.rules.title')}>
        <Item>{t('pages.referrals.rules.keepReward')}</Item>
        <Item>{t('pages.referrals.rules.cap', { colegi: p.cap })}</Item>
        <Item>{t('pages.referrals.rules.once')}</Item>
        <Item>{t('pages.referrals.rules.valuesChange')}</Item>
      </Fold>

      <Fold title={t('pages.referrals.inviter.title')}>
        <Item>{t('pages.referrals.inviter.sees')}</Item>
        <Item>{t('pages.referrals.inviter.youSee')}</Item>
        <Item>{t('pages.referrals.inviter.deleted')}</Item>
      </Fold>

      <Fold title={t('pages.referrals.where.title')}>
        <Item>{t('pages.referrals.where.invite')}</Item>
        <Item>{t('pages.referrals.where.credits')}</Item>
        <Item>{t('pages.referrals.where.access')}</Item>
        <Item>{t('pages.referrals.where.noNotifications')}</Item>
      </Fold>

      <Fold title={t('pages.referrals.stopped.title')}>
        <Item>{t('pages.referrals.stopped.noRewards')}</Item>
        <Item>{t('pages.referrals.stopped.kept')}</Item>
        <Item>{t('pages.referrals.stopped.paidWhileOff')}</Item>
        <Item>{t('pages.referrals.stopped.buyWhileOff')}</Item>
      </Fold>

      <Fold title={t('pages.referrals.faq.title')}>
        <Question q={t('pages.referrals.faq.paidAfterQ')}>{t('pages.referrals.faq.paidAfterA', { credite: p.credits })}</Question>
        <Question q={t('pages.referrals.faq.expiredQ')}>{t('pages.referrals.faq.expiredA', free)}</Question>
        <Question q={t('pages.referrals.faq.deletedQ')}>{t('pages.referrals.faq.deletedA')}</Question>
        <Question q={t('pages.referrals.faq.codeLaterQ')}>{t('pages.referrals.faq.codeLaterA')}</Question>
        <Question q={t('pages.referrals.faq.missingQ')}>{t('pages.referrals.faq.missingA')}</Question>
        <Question q={t('pages.referrals.faq.refundQ')}>{t('pages.referrals.faq.refundA')}</Question>
      </Fold>

      <Section title={t('pages.referrals.contact.title')}>
        <AppText role="body">
          {t('pages.referrals.contact.prefix')} <EmailLink />
          {t('pages.referrals.contact.suffix')}
        </AppText>
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', marginTop: space[12] },
  faq: { gap: space[1], borderBottomWidth: 1, borderBottomColor: color.border, paddingBottom: space[3] },
  fold: { borderBottomWidth: 1, borderBottomColor: color.border },
  foldHead: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 48, paddingVertical: space[2] },
  foldTitle: { flex: 1 },
  foldBody: { gap: space[3], paddingBottom: space[4] },
});

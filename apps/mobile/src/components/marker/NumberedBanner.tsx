import { Pressable, StyleSheet, Text, View } from 'react-native';
import { border, color, feedbackText, radius, space } from '@prepio/shared';
import { fontFamily } from '../../theme/fonts';
import { t } from '../../texts/store';
import { AppText } from '../../ui';
import type { MarkerAction, MarkerConfig, MarkerState, Pen } from './markerReducer';
import { ordinal, slotNoun, slotPill, slotTone } from './numbered';

/** The copy once every slot is filled (spec 2026-11-11). */
const numDone = () => t('consolidation.marker.numbered.done');

const penOf = (cfg: MarkerConfig): Pen => cfg.pens[0] ?? 'info';
const countOf = (cfg: MarkerConfig) => Math.max(1, cfg.limits[penOf(cfg)] ?? 1);
const filled = (s: MarkerState, k: number) => s.marks.some((m) => m.slot === k);
const current = (s: MarkerState) => (s.slot === undefined ? null : s.slot);

function Pill({ pen, slot }: { pen: Pen; slot: number }) {
  const p = slotPill(pen, slot);
  return (
    <View style={[styles.pill, { backgroundColor: p.ink }]}>
      <Text style={styles.pillText}>{p.label}</Text>
    </View>
  );
}

/** „Informația 2 din 3 · o refaci”, „Marchezi a doua informație”. */
function Step({ cfg, state, slot }: { cfg: MarkerConfig; state: MarkerState; slot: number }) {
  const pen = penOf(cfg);
  const noun = slotNoun(pen === 'support' ? 'support' : 'info');
  const nth = ordinal(slot);
  const step = { nume: noun, n: slot + 1, total: countOf(cfg) };
  return (
    <>
      <AppText role="eyebrow" style={{ color: slotTone(slot).ink }} accessibilityLiveRegion="polite">
        {t(filled(state, slot) ? 'consolidation.marker.numbered.stepRedo' : 'consolidation.marker.numbered.step', step)}
      </AppText>
      <View style={styles.headline}>
        <Pill pen={pen} slot={slot} />
        <AppText role="bar">{nth ? t('consolidation.marker.numbered.marking', { ordinal: nth }) : t('consolidation.marker.numbered.markingN', { n: slot + 1 })}</AppText>
      </View>
    </>
  );
}

/**
 * The numbered step banner under the prompt (mockup 2026-11-11): which information the student marks now, in its
 * slot's colour, with one progress segment per slot; „✓ Gata” once every slot is filled.
 */
export default function NumberedBanner({ cfg, state }: { cfg: MarkerConfig; state: MarkerState }) {
  const slot = current(state);
  const tone = slot === null ? styles.done : { borderColor: slotTone(slot).ink, backgroundColor: slotTone(slot).tint };
  return (
    <View testID="num-banner" style={[styles.banner, tone]}>
      {slot === null ? (
        <>
          <AppText role="eyebrow" style={styles.doneText} accessibilityLiveRegion="polite">
            {numDone()}
          </AppText>
          <AppText role="caption" color="textMuted">
            {t('consolidation.marker.numbered.doneHint')}
          </AppText>
        </>
      ) : (
        <Step cfg={cfg} state={state} slot={slot} />
      )}
      <View style={styles.progress}>
        {Array.from({ length: countOf(cfg) }, (_, k) => (
          <View
            key={k}
            testID={`num-progress-${k}`}
            accessibilityLabel={t('consolidation.marker.numbered.progressLabel', { n: k + 1 })}
            accessibilityValue={{ text: t(filled(state, k) ? 'consolidation.marker.marked' : 'consolidation.marker.unmarked') }}
            style={[styles.segment, filled(state, k) && { backgroundColor: slotTone(k).ink }]}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * The reader tray's compact step: the current information (or „✓ Gata”), then one mini pill per slot; pressing
 * one makes that slot the one a new selection fills.
 */
export function NumberedTrayStep({ cfg, state, dispatch }: { cfg: MarkerConfig; state: MarkerState; dispatch: (a: MarkerAction) => void }) {
  const slot = current(state);
  const pen = penOf(cfg);
  return (
    <View testID="num-tray" style={styles.tray}>
      <View style={[styles.line, slot === null ? styles.done : { borderColor: slotTone(slot).ink, backgroundColor: slotTone(slot).tint }]}>
        {slot === null ? (
          <AppText role="eyebrow" style={styles.doneText} accessibilityLiveRegion="polite">
            {numDone()}
          </AppText>
        ) : (
          <Step cfg={cfg} state={state} slot={slot} />
        )}
      </View>
      <View style={styles.minis}>
        {Array.from({ length: countOf(cfg) }, (_, k) => {
          const on = slot === k;
          return (
            <Pressable
              key={k}
              testID={`num-mini-${k}`}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityHint={t('consolidation.marker.numbered.miniHint', { n: k + 1 })}
              onPress={() => dispatch({ type: 'setSlot', slot: k })}
              style={[
                styles.mini,
                { borderColor: slotTone(k).ink },
                filled(state, k) ? { backgroundColor: slotTone(k).tint } : styles.miniEmpty,
                on && styles.miniOn,
              ]}
            >
              <Pill pen={pen} slot={k} />
              <AppText role="caption" color={filled(state, k) ? 'text' : 'textMuted'}>
                {filled(state, k) ? '✓' : t('consolidation.marker.unmarked')}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { gap: space[1], padding: space[3], borderWidth: border.thick, borderRadius: radius.lg },
  done: { borderColor: color.success, backgroundColor: color.surface },
  doneText: { color: feedbackText.good },
  headline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[2] },
  pill: { borderRadius: 6, paddingHorizontal: 5 },
  pillText: { fontFamily: fontFamily.bodyBold, fontSize: 10, lineHeight: 16, letterSpacing: 0.6, color: color.surface },
  progress: { flexDirection: 'row', gap: space[1.5], marginTop: space[1.5] },
  segment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: color.border },
  tray: { gap: space[2] },
  line: { gap: 2, paddingVertical: space[1.5], paddingHorizontal: space[2.5], borderWidth: border.thick, borderRadius: radius.sm },
  minis: { flexDirection: 'row', gap: space[1.5] },
  mini: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1.5],
    borderWidth: border.thick,
    borderRadius: radius.sm,
    paddingVertical: space[1],
    paddingHorizontal: space[2],
  },
  miniEmpty: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  miniOn: { boxShadow: `0px 0px 0px 3px ${color.primarySubtle}` },
});

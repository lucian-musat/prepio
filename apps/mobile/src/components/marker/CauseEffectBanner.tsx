import { Pressable, StyleSheet, View } from 'react-native';
import { border, color, feedbackText, markerInk, markerTint, radius, space, type Source } from '@prepio/shared';
import { AppText } from '../../ui';
import { useMarkText } from '../consolidation/inputKit';
import { DONE, ROLE, type Role } from './causeEffect';
import type { MarkerAction, MarkerState } from './markerReducer';

const ROLES: Role[] = ['cause', 'effect'];
/** The role being marked, or null once both are marked (the marker is idle). */
const currentRole = (s: MarkerState): Role | null => (s.pen === 'cause' || s.pen === 'effect' ? s.pen : null);
const marked = (s: MarkerState, r: Role) => s.marks.some((m) => m.pen === r);

/**
 * The cause-effect step banner (mockup „★ Recomandat”): which role the student marks now, as a question, with the
 * signal words in consolidation (`clues`), and a two-step progress; „✓ Gata” once both are marked.
 */
export default function CauseEffectBanner({ state, clues }: { state: MarkerState; clues: boolean }) {
  const role = currentRole(state);
  const tone = role ? { borderColor: markerInk[role], backgroundColor: markerTint[role] } : styles.done;
  return (
    <View testID="ce-banner" style={[styles.banner, tone]}>
      {role ? (
        <>
          <AppText role="eyebrow" style={{ color: markerInk[role] }} accessibilityLiveRegion="polite">
            {ROLE[role].eyebrow}
          </AppText>
          <AppText role="bar">{ROLE[role].question}</AppText>
          {clues ? (
            <View style={styles.clues}>
              <AppText role="caption" color="textMuted">
                {ROLE[role].help}
              </AppText>
              {ROLE[role].clues.map((c) => (
                <View key={c} style={styles.clue}>
                  <AppText role="chip">{c}</AppText>
                </View>
              ))}
            </View>
          ) : null}
        </>
      ) : (
        <AppText role="eyebrow" style={styles.doneText} accessibilityLiveRegion="polite">
          {DONE}
        </AppText>
      )}
      <View style={styles.progress}>
        {ROLES.map((r) => (
          <View
            key={r}
            testID={`ce-progress-${r}`}
            accessibilityLabel={ROLE[r].name}
            accessibilityValue={{ text: marked(state, r) ? 'marcat' : 'nemarcat' }}
            style={[styles.segment, marked(state, r) && { backgroundColor: markerInk[r] }]}
          />
        ))}
      </View>
    </View>
  );
}

type TrayProps = { state: MarkerState; sources: Source[]; dispatch: (a: MarkerAction) => void };

/**
 * The reader tray's compact step (mockup „★ Telefon · sursă lungă”): the role question (never the signal words:
 * no room), then two mini gaps „Cauza → Efectul”; pressing one makes that role current.
 */
export function CauseEffectTrayStep({ state, sources, dispatch }: TrayProps) {
  const textOf = useMarkText(sources);
  const role = currentRole(state);
  return (
    <View testID="ce-tray" style={styles.tray}>
      <View style={[styles.line, role ? { borderColor: markerInk[role], backgroundColor: markerTint[role] } : styles.done]}>
        {role ? (
          <>
            <AppText role="eyebrow" style={{ color: markerInk[role] }} accessibilityLiveRegion="polite">
              {ROLE[role].eyebrow}
            </AppText>
            <AppText role="bodyStrong">{ROLE[role].question}</AppText>
          </>
        ) : (
          <>
            <AppText role="eyebrow" style={styles.doneText} accessibilityLiveRegion="polite">
              {DONE}
            </AppText>
            <AppText role="bodyStrong">Apasă „Gata” și citește relația.</AppText>
          </>
        )}
      </View>
      <View style={styles.minis}>
        {ROLES.map((r, k) => {
          const mark = state.marks.find((m) => m.pen === r);
          const on = role === r;
          return (
            <View key={r} style={styles.miniCell}>
              {k > 0 ? (
                <AppText role="label" color="primary">
                  →
                </AppText>
              ) : null}
              <Pressable
                testID={`ce-mini-${r}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityHint={`Marchează ${ROLE[r].name.toLowerCase()}`}
                onPress={() => dispatch({ type: 'setPen', pen: r })}
                style={[
                  styles.mini,
                  { borderColor: markerInk[r] },
                  mark ? { backgroundColor: markerTint[r] } : styles.miniEmpty,
                  on && styles.miniOn,
                ]}
              >
                <AppText role="badge" style={{ color: markerInk[r] }}>
                  {ROLE[r].name.toUpperCase()}
                </AppText>
                <AppText testID={`ce-mini-${r}-text`} role="caption" color={mark ? 'text' : 'textMuted'} numberOfLines={1}>
                  {mark ? `„${textOf(mark)}”` : 'nemarcat'}
                </AppText>
              </Pressable>
            </View>
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
  clues: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[1], marginTop: 2 },
  clue: {
    borderWidth: border.hairline,
    borderColor: color.border,
    backgroundColor: color.surface,
    borderRadius: radius.sm,
    paddingHorizontal: space[1.5],
    paddingVertical: 1,
  },
  progress: { flexDirection: 'row', gap: space[1.5], marginTop: space[1.5] },
  segment: { flex: 1, height: 5, borderRadius: 3, backgroundColor: color.border },
  tray: { gap: space[2] },
  line: { gap: 2, paddingVertical: space[1.5], paddingHorizontal: space[2.5], borderWidth: border.thick, borderRadius: radius.sm },
  minis: { flexDirection: 'row', gap: space[1.5] },
  miniCell: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  mini: { flex: 1, minWidth: 0, borderWidth: border.thick, borderRadius: radius.sm, paddingVertical: space[1], paddingHorizontal: space[2] },
  miniEmpty: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  miniOn: { boxShadow: `0px 0px 0px 3px ${color.primarySubtle}` },
});

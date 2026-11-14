import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type Animated from 'react-native-reanimated';
import {
  AI_TYPES,
  checkCost,
  checkExercise,
  color,
  feedbackText,
  isShortSource,
  markerPen,
  radius,
  space,
  spanToWords,
  tokenizeSource,
  type ConsolidationExercise,
  type ExerciseAnswer,
  type ExerciseFeedback,
  type SolutionTemplate,
  type Source,
} from '@prepio/shared';
import CostTag from '../../credits/CostTag';
import HeaderPills from '../../streak/HeaderPills';
import { useCreditGate } from '../../credits/useCreditGate';
import { useMarkActive } from '../../streak/StreakProvider';
import ExerciseInput from '../../components/consolidation/ExerciseInput';
import { initialMarker, markerReducer, type MarkerConfig } from '../../components/marker/markerReducer';
import SourcePanel, { SPLIT_MIN_WIDTH } from '../../components/marker/SourcePanel';
import { NO_MARKS, noop, type PanelMarker, type PanelSource } from '../../components/marker/SourceReader';
import { evaluateConsolidation } from '../../lib/api';
import type { Attempt } from '../../lib/consolidation';
import { t } from '../../texts/store';
import { AppText, Button, ScreenLayout, TextButton } from '../../ui';
import { aiBlocked, combineVerdict, emptyAnswer, isComplete, markerConfig, markerMarks, mergeAiFeedback, restorable } from './checking';
import FeedbackView, { Analyzing, CheckError } from './FeedbackView';
import { requirementCount, typeLabel } from './status';
import TemplateSheet from './TemplateSheet';

type Props = {
  exercise: ConsolidationExercise;
  sources: Map<string, Source>;
  templates: Map<string, SolutionTemplate>;
  /** Position in the run (0-based) and the run's length; the exercise map shows them, the screen no longer does. */
  index?: number;
  total?: number;
  onBack: () => void;
  /** A check finished: the attempt to save (the screen saves it; a failure is only logged). */
  onChecked: (attempt: Attempt) => void;
  onContinue: () => void;
  /** „Încearcă din nou”: the run screen remounts this exercise with empty inputs. */
  onRetry: () => void;
  /** Leaves without checking: the next exercise, or the end screen after the last. */
  onSkip: () => void;
  /** The previous exercise; absent on the first. */
  onPrev?: () => void;
  /** What the exercise opens with (coming back to it): a stored answer, checked when it has feedback. */
  initial?: Draft | null;
  /** The answer and feedback as they change, so coming back within the session shows them again. */
  onDraft?: (draft: Draft) => void;
  /** The exercise map under the header; `busy` while a check runs (nothing can be left then). */
  map?: (busy: boolean) => ReactNode;
};

export type Draft = { answer: ExerciseAnswer; feedback: ExerciseFeedback | null };

const NO_PENS: MarkerConfig = { pens: [], limits: {} };

/** The chip's name for the exercise (comparison: its variant; essay: the requirement count). */
function chipLabel(ex: ConsolidationExercise): string {
  if (ex.type === 'comparison') return t(ex.variant === 'difference' ? 'consolidation.exercise.difference' : 'consolidation.exercise.similarity');
  if (ex.type === 'essay') return t('consolidation.exercise.essayChip', { cerinte: requirementCount(ex.requirements.length) });
  return typeLabel(ex.type);
}

/** After checking a letter exercise, its evidence is underlined green in the source. */
function evidenceVerdicts(ex: ConsolidationExercise, sources: Map<string, Source>): ExerciseFeedback['marks'] {
  if (ex.type !== 'source_letter' || !ex.evidence) return undefined;
  const body = sources.get(ex.evidence.sourceId)?.body;
  const words = body ? spanToWords(tokenizeSource(body), ex.evidence) : null;
  return words ? [{ sourceId: ex.evidence.sourceId, from: words[0], to: words[1], verdict: 'ok' }] : undefined;
}

/**
 * One consolidation exercise (types mockup): progress, the type chip and „💡 Cum rezolv”, the prompt and the
 * sources (SourcePanel), the type's input, then „Verifică” → the inline feedback with „Continuă” / „Încearcă din nou”.
 * AI types ask `/api/consolidation/evaluate` unless the instant check already found an empty / short / repeated field.
 * The action bar's last row always moves through the run: „‹” (previous) and „Sari peste” / „Continuă”.
 * With `initial` it opens on a stored answer (its marks back in the source), checked when that has feedback.
 */
export default function ExerciseScreen({
  exercise,
  sources,
  templates,
  onBack,
  onChecked,
  onContinue,
  onRetry,
  onSkip,
  onPrev,
  initial,
  onDraft,
  map,
}: Props) {
  const { width } = useWindowDimensions();
  const markActive = useMarkActive();
  const sourceList = useMemo(() => [...sources.values()], [sources]);
  const panelSources: PanelSource[] = useMemo(
    () => exercise.sources.flatMap((r) => (sources.has(r.sourceId) ? [{ source: sources.get(r.sourceId)!, label: r.label }] : [])),
    [exercise, sources],
  );
  const cfg = useMemo(() => markerConfig(exercise), [exercise]);
  const reducer = useMemo(() => markerReducer(cfg ?? NO_PENS), [cfg]);
  // A stored answer that no longer fits the exercise (edited in the admin since) opens empty.
  const [restored] = useState(() => (initial && restorable(exercise, initial.answer) ? initial : null));
  const [markState, dispatch] = useReducer(reducer, undefined, () =>
    initialMarker(cfg ?? NO_PENS, restored ? markerMarks(restored.answer) : []),
  );
  const [answer, setAnswer] = useState<ExerciseAnswer>(() => restored?.answer ?? emptyAnswer(exercise));
  const [feedback, setFeedbackState] = useState<ExerciseFeedback | null>(restored?.feedback ?? null);
  // The latest feedback, for results that arrive after an await (an essay's checks merge into each other).
  const feedbackRef = useRef<ExerciseFeedback | null>(restored?.feedback ?? null);
  const setFeedback = (fb: ExerciseFeedback | null) => {
    feedbackRef.current = fb;
    setFeedbackState(fb);
  };
  const [partBusy, setPartBusy] = useState(false);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<string | null>(null);
  const scrollRef = useRef<Animated.ScrollView>(null);
  const busy = useRef(false);
  const gate = useCreditGate({ onSkip, skipDisabled: status === 'loading' || partBusy });

  const essay = exercise.type === 'essay';
  // The essay is checked requirement by requirement and never locks: its inputs stay editable.
  const checked = essay ? false : feedback !== null;
  const reqIds = essay ? exercise.requirements.map((r) => r.id) : [];
  const reqItems = (feedback?.items ?? []).filter((i) => reqIds.includes(i.key));
  const allVerdicts = essay && reqIds.every((id) => reqItems.some((i) => i.key === id));
  const loading = status === 'loading';
  const disabled = loading || checked;

  // Bring the new feedback (or the loading / error row) into view: it sits at the end of the content.
  // A restored check opens at the top, on the prompt.
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current && (checked || status !== 'idle')) scrollRef.current?.scrollToEnd?.({ animated: true });
    opened.current = true;
  }, [checked, status]);

  useEffect(() => {
    onDraft?.({ answer, feedback });
    // Only the answer and the feedback matter; the callback is the run screen's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer, feedback]);

  const finish = (fb: ExerciseFeedback, a: ExerciseAnswer) => {
    setFeedback(fb);
    setStatus('idle');
    markActive();
    onChecked({ exerciseId: exercise.id, answer: a, verdict: fb.verdict, feedback: fb });
  };

  const check = async () => {
    // The essay is checked per requirement, inside EssayInput.
    if (essay || busy.current || !isComplete(exercise, answer)) return;
    const a = answer;
    const det = checkExercise(exercise, sourceList, a, t);
    if (!AI_TYPES.has(exercise.type)) return finish(det, a);
    if (aiBlocked(exercise, det, a)) return finish({ ...det, verdict: det.verdict ?? combineVerdict(det.items) }, a);
    if (!gate.allow(checkCost(exercise, 'exercise'), check)) return;
    busy.current = true;
    setStatus('loading');
    setError('');
    try {
      const res = await evaluateConsolidation({ exerciseId: exercise.id, target: 'exercise', answer: a });
      if (res.credits) gate.settle(res.credits.balance);
      finish(mergeAiFeedback(exercise, det, res.items), a);
    } catch (e) {
      // Not enough credits: the buy sheet opens instead of an error row.
      if (gate.onError(e, check)) {
        setStatus('idle');
        return;
      }
      setStatus('error');
      setError(e instanceof Error && e.message ? e.message : t('errors.api.evaluate.aiFailed'));
    } finally {
      busy.current = false;
    }
  };

  const swap = () => {
    dispatch({ type: 'swapRoles' });
    setFeedback(null);
  };

  const marker: PanelMarker | undefined = cfg
    ? { cfg, state: markState, dispatch, verdicts: feedback?.marks, readOnly: disabled, clues: true }
    : feedback && exercise.type === 'source_letter'
      ? { cfg: NO_PENS, state: NO_MARKS, dispatch: noop, verdicts: evidenceVerdicts(exercise, sources), readOnly: true }
      : undefined;

  const ai = AI_TYPES.has(exercise.type);
  const exerciseCost = checkCost(exercise, 'exercise');
  const template = exercise.templateId ? templates.get(exercise.templateId) ?? null : null;
  const tag = ai ? <CostTag cost={essay ? exercise.creditCost : exerciseCost} perRequirement={essay} /> : null;
  const header = (
    <View style={styles.headerBlock}>
    <View style={styles.header}>
      <View style={styles.chip}>
        <AppText role="eyebrow" color="primary" numberOfLines={1}>
          {chipLabel(exercise)}
        </AppText>
      </View>
      {template ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('consolidation.exercise.howTo')} onPress={() => setSheet(template.id)} style={styles.hint}>
          <AppText role="label" style={styles.hintText}>
            {t('consolidation.exercise.howTo')}
          </AppText>
        </Pressable>
      ) : null}
    </View>
    {tag}
    </View>
  );

  const input = (
    <ExerciseInput
      exercise={exercise}
      sources={panelSources.map((s) => s.source)}
      value={answer}
      onChange={(v: ExerciseAnswer) => setAnswer(v)}
      feedback={feedback}
      disabled={disabled}
      marker={marker}
      templateIds={new Set(templates.keys())}
      onOpenTemplate={setSheet}
      essayChecks={{
        onFeedback: (merged) => {
          // The essay's verdict: all requirements judged, combined (an old `whole` item is ignored).
          const items = merged.items.filter((i) => reqIds.includes(i.key));
          const fb = { ...merged, verdict: reqIds.every((id) => items.some((i) => i.key === id)) ? combineVerdict(items) : null };
          setFeedback(fb);
          onChecked({ exerciseId: exercise.id, answer, verdict: fb.verdict, feedback: fb });
        },
        onBusyChange: setPartBusy,
        gate,
      }}
    />
  );

  const complete = isComplete(exercise, answer);
  // Nothing is left while a check runs: its result belongs to this exercise.
  const moving = loading || partBusy;
  const prev = (
    <Button icon="back" accessibilityLabel={t('consolidation.exercise.prevLabel')} variant="secondary" disabled={!onPrev || moving} onPress={() => onPrev?.()} />
  );
  const skip = (flex: boolean) => (
    <Button flex={flex} compact={!flex} label={t('consolidation.exercise.skip')} accessibilityLabel={t('consolidation.exercise.skipLabel')} variant="secondary" disabled={moving} onPress={onSkip} />
  );
  // A retry pays again on an AI exercise; after „Corect” it is only a quiet link.
  const retry =
    feedback?.verdict === 'ok' ? (
      <View testID="retry-link" style={styles.retryLink}>
        <TextButton label={ai && exerciseCost ? t('consolidation.exercise.retryWithCost', { credite: exerciseCost }) : t('common.retry')} onPress={onRetry} />
      </View>
    ) : (
      <View testID="retry-button">
        <Button label={t('common.retry')} variant="secondary" cost={ai && exerciseCost ? exerciseCost : undefined} onPress={onRetry} />
      </View>
    );
  const actions = checked ? (
    <View style={styles.stack}>
      {feedback?.verdict === 'ok' ? null : retry}
      <View style={styles.row}>
        {prev}
        <Button flex label={t('common.continue')} onPress={onContinue} />
      </View>
      {feedback?.verdict === 'ok' ? retry : null}
    </View>
  ) : essay ? (
    <View style={styles.stack}>
      <View style={styles.row}>
        {prev}
        {reqItems.length ? (
          <Button flex label={t('common.continue')} variant={allVerdicts ? 'primary' : 'secondary'} disabled={moving} onPress={onContinue} />
        ) : (
          skip(true)
        )}
      </View>
    </View>
  ) : (
    <View style={[styles.row, styles.fill]}>
      {prev}
      <Button flex label={t('consolidation.exercise.check')} cost={exerciseCost || undefined} disabled={!complete} loading={loading} onPress={check} />
      {skip(false)}
    </View>
  );

  const wide = width >= SPLIT_MIN_WIDTH && panelSources.some((s) => !isShortSource(s.source.body));
  const sheetTemplate = sheet ? templates.get(sheet) ?? null : null;
  return (
    <View style={styles.fill}>
      <ScreenLayout
        title={t('consolidation.screenTitle')}
        trailing={<HeaderPills need={ai ? exercise.creditCost : undefined} />}
        subheader={map?.(moving)}
        onBack={onBack}
        actions={actions}
        scrollRef={scrollRef}
        wide={wide}
      >
        <SourcePanel sources={panelSources} prompt={exercise.prompt} marker={marker} header={header}>
          <View style={styles.answer}>
            {input}
            {feedback && checked ? <FeedbackView exercise={exercise} feedback={feedback} onSwap={feedback.swapped ? swap : undefined} /> : null}
            {loading ? <Analyzing /> : null}
            {status === 'error' ? <CheckError message={error} onRetry={check} /> : null}
          </View>
        </SourcePanel>
      </ScreenLayout>
      <TemplateSheet
        template={sheetTemplate}
        typeLabel={typeLabel(sheetTemplate?.exerciseType ?? exercise.type)}
        onClose={() => setSheet(null)}
      />
      {gate.sheet}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  stack: { flex: 1, gap: space[2.5] },
  retryLink: { alignSelf: 'center' },
  row: { flexDirection: 'row', gap: space[2.5] },
  answer: { gap: space[3] },
  trailing: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  headerBlock: { gap: space[2] },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2] },
  chip: { flexShrink: 1, backgroundColor: color.primarySubtle, borderRadius: radius.pill, paddingVertical: space[1], paddingHorizontal: space[2.5] },
  hint: {
    flexShrink: 0,
    backgroundColor: color.accentSubtle,
    borderWidth: 1.5,
    borderColor: markerPen.info, // mockup `.hintbtn` border, the same yellow as the info pen
    borderRadius: radius.pill,
    paddingVertical: space[1.5],
    paddingHorizontal: space[3],
  },
  hintText: { color: feedbackText.almost },
});

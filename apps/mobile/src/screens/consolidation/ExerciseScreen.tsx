import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import type Animated from 'react-native-reanimated';
import {
  AI_TYPES,
  CONSOLIDATION_TYPE_LABELS,
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
import ArgumentInput from '../../components/consolidation/ArgumentInput';
import CauseEffectInput from '../../components/consolidation/CauseEffectInput';
import ComparisonInput from '../../components/consolidation/ComparisonInput';
import EssayInput from '../../components/consolidation/EssayInput';
import FactsInput from '../../components/consolidation/FactsInput';
import LetterInput from '../../components/consolidation/LetterInput';
import MultiAnswerInput from '../../components/consolidation/MultiAnswerInput';
import ShortAnswerInput from '../../components/consolidation/ShortAnswerInput';
import SourceInfoInput from '../../components/consolidation/SourceInfoInput';
import ViewpointInput from '../../components/consolidation/ViewpointInput';
import { initialMarker, markerReducer, type MarkerConfig } from '../../components/marker/markerReducer';
import SourcePanel, { SPLIT_MIN_WIDTH } from '../../components/marker/SourcePanel';
import { NO_MARKS, noop, type PanelMarker, type PanelSource } from '../../components/marker/SourceReader';
import { evaluateConsolidation } from '../../lib/api';
import type { Attempt } from '../../lib/consolidation';
import { AppText, Button, ScreenLayout } from '../../ui';
import { aiBlocked, combineVerdict, emptyAnswer, isComplete, markerConfig, markerMarks, mergeAiFeedback, mergeItems, restorable } from './checking';
import FeedbackView, { Analyzing, CheckError } from './FeedbackView';
import TemplateSheet from './TemplateSheet';

type Props = {
  exercise: ConsolidationExercise;
  sources: Map<string, Source>;
  templates: Map<string, SolutionTemplate>;
  /** Position in the run (0-based) and the run's length. */
  index: number;
  total: number;
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
const AI_FAILED = 'Evaluarea nu a reușit. Încearcă din nou.';

/** The chip's name for the exercise (comparison: its variant; essay: the requirement count). */
function chipLabel(ex: ConsolidationExercise): string {
  if (ex.type === 'comparison') return ex.variant === 'difference' ? 'Deosebire' : 'Asemănare';
  if (ex.type === 'essay') return `Eseu · ${ex.requirements.length} ${ex.requirements.length === 1 ? 'cerință' : 'cerințe'}`;
  return CONSOLIDATION_TYPE_LABELS[ex.type];
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
  index,
  total,
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

  const essay = exercise.type === 'essay';
  const wholeChecked = essay && !!feedback?.items.some((i) => i.key === 'whole');
  const checked = essay ? wholeChecked : feedback !== null;
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
    onChecked({ exerciseId: exercise.id, answer: a, verdict: fb.verdict, feedback: fb });
  };

  const check = async () => {
    if (busy.current || !isComplete(exercise, answer)) return;
    const a = answer;
    const det = checkExercise(exercise, sourceList, a);
    if (!AI_TYPES.has(exercise.type)) return finish(det, a);
    if (aiBlocked(exercise, det, a)) return finish({ ...det, verdict: det.verdict ?? combineVerdict(det.items) }, a);
    busy.current = true;
    setStatus('loading');
    setError('');
    try {
      const res = await evaluateConsolidation({ exerciseId: exercise.id, target: essay ? 'whole' : 'exercise', answer: a });
      if (essay) {
        // The essay's verdict is the whole-essay verdict; without one it stays null („n din N” in the summary).
        const merged = mergeItems(feedbackRef.current, res.items);
        finish({ ...merged, verdict: res.items.find((i) => i.key === 'whole')?.verdict ?? null }, a);
      } else {
        finish(mergeAiFeedback(exercise, det, res.items), a);
      }
    } catch (e) {
      setStatus('error');
      setError(e instanceof Error && e.message ? e.message : AI_FAILED);
    } finally {
      busy.current = false;
    }
  };

  // „Încearcă din nou”: an essay keeps its texts and drops only the feedback; other types start empty again.
  const retry = essay
    ? () => {
        setFeedback(null);
        setStatus('idle');
        setError('');
      }
    : onRetry;

  const swap = () => {
    dispatch({ type: 'swapRoles' });
    setFeedback(null);
  };

  const marker: PanelMarker | undefined = cfg
    ? { cfg, state: markState, dispatch, verdicts: feedback?.marks, readOnly: disabled }
    : feedback && exercise.type === 'source_letter'
      ? { cfg: NO_PENS, state: NO_MARKS, dispatch: noop, verdicts: evidenceVerdicts(exercise, sources), readOnly: true }
      : undefined;

  const template = exercise.templateId ? templates.get(exercise.templateId) ?? null : null;
  const header = (
    <View style={styles.header}>
      <View style={styles.chip}>
        <AppText role="eyebrow" color="primary" numberOfLines={1}>
          {chipLabel(exercise)}
        </AppText>
      </View>
      {template ? (
        <Pressable accessibilityRole="button" accessibilityLabel="💡 Cum rezolv" onPress={() => setSheet(template.id)} style={styles.hint}>
          <AppText role="label" style={styles.hintText}>
            💡 Cum rezolv
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );

  const common = { sources: panelSources.map((s) => s.source), feedback, disabled };
  const input = (() => {
    const set = (v: ExerciseAnswer) => setAnswer(v);
    switch (exercise.type) {
      case 'short_answer':
        return <ShortAnswerInput {...common} exercise={exercise} value={answer as never} onChange={set} />;
      case 'multi_answer':
        return <MultiAnswerInput {...common} exercise={exercise} value={answer as never} onChange={set} />;
      case 'source_info':
        return <SourceInfoInput {...common} exercise={exercise} value={answer as never} onChange={set} marker={marker!} />;
      case 'source_letter':
        return <LetterInput {...common} exercise={exercise} value={answer as never} onChange={set} />;
      case 'cause_effect':
        return <CauseEffectInput {...common} exercise={exercise} value={answer as never} onChange={set} marker={marker!} />;
      case 'facts':
        return <FactsInput {...common} exercise={exercise} value={answer as never} onChange={set} />;
      case 'comparison':
        return <ComparisonInput {...common} exercise={exercise} value={answer as never} onChange={set} />;
      case 'viewpoint':
        return <ViewpointInput {...common} exercise={exercise} value={answer as never} onChange={set} marker={marker!} />;
      case 'argument':
        return <ArgumentInput {...common} exercise={exercise} value={answer as never} onChange={set} />;
      case 'essay':
        return (
          <EssayInput
            {...common}
            exercise={exercise}
            value={answer as never}
            onChange={set}
            onFeedback={(fb) => {
              setFeedback(fb);
              onChecked({ exerciseId: exercise.id, answer, verdict: fb.verdict, feedback: fb });
            }}
            templateIds={new Set(templates.keys())}
            onOpenTemplate={setSheet}
            onBusyChange={setPartBusy}
          />
        );
    }
  })();

  const complete = isComplete(exercise, answer);
  // Nothing is left while a check runs: its result belongs to this exercise.
  const moving = loading || partBusy;
  const prev = (
    <Button icon="back" accessibilityLabel="Exercițiul anterior" variant="secondary" disabled={!onPrev || moving} onPress={() => onPrev?.()} />
  );
  const skip = (flex: boolean) => (
    <Button flex={flex} compact={!flex} label="Sari peste" accessibilityLabel="Sari peste, exercițiul următor" variant="secondary" disabled={moving} onPress={onSkip} />
  );
  const actions = checked ? (
    <View style={styles.stack}>
      <Button label="Încearcă din nou" variant="secondary" onPress={retry} />
      <View style={styles.row}>
        {prev}
        <Button flex label="Continuă" onPress={onContinue} />
      </View>
    </View>
  ) : essay ? (
    <View style={styles.stack}>
      {/* Waits for requirement checks in flight, so their results are never overwritten. */}
      <Button label="Verifică eseul întreg" disabled={!complete || partBusy} loading={loading} onPress={check} />
      <View style={styles.row}>
        {prev}
        {feedback?.items.length ? <Button flex label="Continuă" variant="secondary" disabled={moving} onPress={onContinue} /> : skip(true)}
      </View>
    </View>
  ) : (
    <View style={[styles.row, styles.fill]}>
      {prev}
      <Button flex label="Verifică" disabled={!complete} loading={loading} onPress={check} />
      {skip(false)}
    </View>
  );

  const wide = width >= SPLIT_MIN_WIDTH && panelSources.some((s) => !isShortSource(s.source.body));
  const sheetTemplate = sheet ? templates.get(sheet) ?? null : null;
  return (
    <View style={styles.fill}>
      <ScreenLayout
        title="Consolidare"
        progress={(index + 1) / total}
        progressLabel="Progres consolidare"
        trailing={
          <AppText role="label" color="textMuted">
            {index + 1}/{total}
          </AppText>
        }
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
        typeLabel={CONSOLIDATION_TYPE_LABELS[sheetTemplate?.exerciseType ?? exercise.type]}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  stack: { flex: 1, gap: space[2.5] },
  row: { flexDirection: 'row', gap: space[2.5] },
  answer: { gap: space[3] },
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

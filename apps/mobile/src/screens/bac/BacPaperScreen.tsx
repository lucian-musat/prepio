import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  CONSOLIDATION_TYPE_LABELS,
  color,
  feedbackText,
  isShortSource,
  layout,
  radius,
  space,
  type BacItemResult,
  type BacSection,
  type SourceLabel,
} from '@prepio/shared';
import { SPLIT_MIN_WIDTH } from '../../components/marker/SourcePanel';
import type { PanelSource } from '../../components/marker/SourceReader';
import CreditChip from '../../credits/CreditChip';
import { useCredits } from '../../credits/CreditsProvider';
import { useCreditGate } from '../../credits/useCreditGate';
import { OFFLINE } from '../../lib/api';
import {
  answeredCount,
  BacApiError,
  fetchBacPaper,
  fetchLatestGraded,
  fetchOpenAttempt,
  submitBac,
  type BacPaper,
} from '../../lib/bac';
import { AppText, Button, ScreenLayout, Spinner, Surface } from '../../ui';
import TemplateSheet from '../consolidation/TemplateSheet';
import BacGradingView from './BacGradingView';
import BacItemView from './BacItemView';
import { BacResultView, backToSubjects } from './BacResultScreen';
import BacSubmitView, { ROMAN } from './BacSubmitView';
import { useBacDraft } from './useBacDraft';

/** While a paper is being graded elsewhere (reopened, or already submitted), its state is read this often. */
export const GRADING_POLL_MS = 5000;
const GRADING_FAILED = 'Corectarea nu a reușit. Nu ți-am luat niciun credit. Încearcă din nou.';
const SECTIONS: BacSection[] = [1, 2, 3];

type Mode = 'paper' | 'submit' | 'grading' | 'result';
type Result = { grade: number; results: BacItemResult[] };

/**
 * A full BAC paper (mockup screens 2–4): Subiectul I / II / III as tabs, each item with the section's sources,
 * „💡 Cum rezolv” open and its input — no checks along the way, autosaved. „Predă lucrarea” (header) opens the submit
 * view; submitting grades the whole paper once (credits) and shows the result. A paper already in grading shows
 * „Corectăm lucrarea…” and polls until it is graded or failed (refunded; the paper is editable again).
 */
export default function BacPaperScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const credits = useCredits();
  const draft = useBacDraft(id);
  const gate = useCreditGate({ variant: 'bac' });

  const [paper, setPaper] = useState<BacPaper | null>(null);
  const [paperState, setPaperState] = useState<'loading' | 'error' | 'missing' | 'ready'>('loading');
  const [paperKey, setPaperKey] = useState(0);
  const [mode, setMode] = useState<Mode>('paper');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const busy = useRef(false);

  useEffect(() => {
    let live = true;
    setPaperState('loading');
    fetchBacPaper(id).then(
      (p) => {
        if (!live) return;
        setPaper(p);
        setPaperState(p ? 'ready' : 'missing');
      },
      (e) => {
        console.warn('[bac] the paper could not be read:', e);
        if (live) setPaperState('error');
      },
    );
    return () => {
      live = false;
    };
  }, [id, paperKey]);

  // The open attempt decides where the paper opens: being graded, or failed (refunded, editable again).
  const { status: draftStatus, attempt } = draft;
  useEffect(() => {
    if (draftStatus !== 'ready' || !attempt) return;
    if (attempt.status === 'grading') setMode('grading');
    if (attempt.status === 'failed') setFailed(true);
  }, [draftStatus, attempt]);

  // Polls a paper graded outside this screen (reopened while grading, or `already_grading`).
  useEffect(() => {
    if (mode !== 'grading' || submitting) return;
    let live = true;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const open = await fetchOpenAttempt(id);
        if (!live) return;
        if (!open) {
          const graded = await fetchLatestGraded(id);
          if (!live) return;
          void credits.refresh();
          if (graded && graded.grade != null) {
            setResult({ grade: graded.grade, results: graded.results ?? [] });
            setMode('result');
          } else setMode('paper');
          return;
        }
        if (open.status === 'failed') {
          void credits.refresh();
          setFailed(true);
          setMode('paper');
          return;
        }
        if (open.status === 'draft') {
          setMode('paper');
          return;
        }
      } catch (e) {
        console.warn('[bac] the grading state could not be read:', e);
      }
      if (live) timer = setTimeout(tick, GRADING_POLL_MS);
    };
    timer = setTimeout(tick, GRADING_POLL_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // `credits.refresh` is stable; only the mode matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, submitting, id]);

  // Leaving the screen (another route on top, the app in the background) saves what is pending.
  const { flush } = draft;
  useFocusEffect(useCallback(() => () => void flush(), [flush]));
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s !== 'active') void flush();
    });
    return () => sub.remove();
  }, [flush]);

  const items = paper?.items ?? [];
  const { position } = draft;
  const sectionItems = useMemo(() => items.filter((i) => i.section === position.section), [items, position.section]);
  const index = Math.min(position.index, Math.max(sectionItems.length - 1, 0));
  const item = sectionItems[index];
  const flat = items.findIndex((i) => i.id === item?.id);
  const sources: PanelSource[] = useMemo(
    () =>
      (paper?.sources ?? [])
        .filter((s) => s.section === position.section)
        .map((s, i) => ({ source: s, label: String.fromCharCode(65 + i) as SourceLabel })),
    [paper, position.section],
  );
  const emptyIds = useMemo(() => new Set(answeredCount(items, draft.answers).empty.map((i) => i.id)), [items, draft.answers]);
  const templateIds = useMemo(() => new Set(Object.keys(paper?.templates ?? {})), [paper]);

  const go = (section: BacSection, idx: number) => {
    const sectionChanged = section !== position.section;
    draft.setPosition({ section, index: idx });
    // A tab switch saves at once.
    if (sectionChanged) void draft.flush();
  };
  const step = (delta: 1 | -1) => {
    const target = items[flat + delta];
    if (!target) return;
    go(target.section, items.filter((i) => i.section === target.section).indexOf(target));
  };

  const send = async () => {
    if (busy.current || !paper) return;
    const cost = paper.subject.creditCost;
    if (!gate.allow(cost, () => void send())) return;
    busy.current = true;
    setSubmitError(null);
    setSubmitting(true);
    setMode('grading');
    try {
      // The pending edit is saved first, so nothing lands after the submission (it would reopen a draft) and a
      // submission that fails without storing the answers loses nothing.
      await draft.flush();
      const res = await submitBac({ subjectId: id, answers: draft.answers });
      gate.settle(res.credits.balance);
      setFailed(false);
      setResult({ grade: res.grade, results: res.results });
      setMode('result');
    } catch (e) {
      if (e instanceof BacApiError && e.code === 'already_grading') {
        setMode('grading');
        return;
      }
      // A lost connection or a timeout (mapped to grading_failed) may leave the server grading: follow it if so.
      if (!(e instanceof BacApiError) || e.code === 'grading_failed') {
        const open = await fetchOpenAttempt(id).catch(() => null);
        if (open?.status === 'grading') {
          setMode('grading');
          return;
        }
        // Refunded and stored as failed: the paper keeps the refund message after „Mai lucrez”, as on reopening.
        if (open?.status === 'failed') setFailed(true);
      }
      setMode('submit');
      if (gate.onError(e, () => void send())) return;
      setSubmitError(e instanceof BacApiError ? e.message || GRADING_FAILED : e instanceof Error && e.message ? e.message : OFFLINE);
    } finally {
      busy.current = false;
      setSubmitting(false);
    }
  };

  const redo = () => {
    draft.reset();
    setResult(null);
    setFailed(false);
    setSubmitError(null);
    setMode('paper');
  };

  const title = paper?.subject.title ?? 'Subiect BAC';

  if (paperState === 'error' || draftStatus === 'error' || paperState === 'missing') {
    const missing = paperState === 'missing';
    return (
      <ScreenLayout title={title} onBack={backToSubjects}>
        <Surface style={styles.gap}>
          <AppText role="section">{missing ? 'Subiectul nu este disponibil' : 'Nu am putut încărca subiectul'}</AppText>
          {missing ? null : (
            <>
              <AppText role="small" color="textMuted">
                Verifică conexiunea la internet și încearcă din nou.
              </AppText>
              <Button
                label="Reîncearcă"
                onPress={() => {
                  setPaperKey((k) => k + 1);
                  draft.reload();
                }}
              />
            </>
          )}
        </Surface>
      </ScreenLayout>
    );
  }

  if (paperState === 'loading' || draftStatus === 'loading' || !paper) {
    return (
      <ScreenLayout title={title} onBack={backToSubjects}>
        <View style={styles.loader}>
          <Spinner />
        </View>
      </ScreenLayout>
    );
  }

  if (mode === 'result' && result) {
    return <BacResultView grade={result.grade} results={result.results} onRedo={redo} onDone={backToSubjects} />;
  }

  if (mode === 'grading') {
    return (
      <ScreenLayout title={title} onBack={backToSubjects}>
        <BacGradingView />
      </ScreenLayout>
    );
  }

  if (mode === 'submit') {
    return (
      <View style={styles.fill}>
        <ScreenLayout title={title} onBack={() => setMode('paper')} trailing={<CreditChip need={paper.subject.creditCost} />}>
          <BacSubmitView
            items={items}
            answers={draft.answers}
            cost={paper.subject.creditCost}
            error={submitError}
            sending={submitting}
            onSend={() => void send()}
            onBack={() => setMode('paper')}
          />
        </ScreenLayout>
        {gate.sheet}
      </View>
    );
  }

  const tabs = (
    <View style={styles.tabs} accessibilityRole="tablist">
      {SECTIONS.map((s) => {
        const on = s === position.section;
        const has = items.some((i) => i.section === s);
        return (
          <Pressable
            key={s}
            accessibilityRole="tab"
            accessibilityLabel={`Subiectul ${ROMAN[s]}`}
            accessibilityState={{ selected: on, disabled: !has }}
            disabled={!has}
            onPress={() => !on && go(s, 0)}
            style={[styles.tab, on && styles.tabOn]}
          >
            <AppText role="label" color={on ? 'primary' : 'textMuted'} numberOfLines={1}>
              {`Subiectul ${ROMAN[s]}`}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
  const map = (
    <View style={styles.mapRow}>
      <View style={styles.map}>
        {sectionItems.map((it, i) => {
          const here = i === index;
          const done = !emptyIds.has(it.id);
          return (
            <Pressable
              key={it.id}
              accessibilityRole="button"
              accessibilityLabel={`Cerința ${it.number}${done ? ', completată' : ''}`}
              accessibilityState={{ selected: here }}
              onPress={() => !here && go(position.section, i)}
              style={styles.slot}
            >
              <View style={[styles.dot, done && styles.dotDone, here && styles.dotHere]}>
                <AppText role="badge" style={{ color: done ? feedbackText.good : color.textMuted }}>
                  {it.number}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>
      <AppText role="caption" color={draft.saveState === 'error' ? 'danger' : 'textMuted'} accessibilityLiveRegion="polite">
        {draft.saveState === 'saved' ? 'Salvat' : draft.saveState === 'error' ? 'Nu s-a putut salva' : ''}
      </AppText>
    </View>
  );

  const wide = width >= SPLIT_MIN_WIDTH && sources.some((s) => !isShortSource(s.source.body));
  const sheetTemplate = sheet ? paper.templates[sheet] ?? null : null;
  const hint = item?.templateId ? paper.templates[item.templateId]?.body ?? null : null;
  return (
    <View style={styles.fill}>
      <ScreenLayout
        title={title}
        onBack={backToSubjects}
        trailing={
          <Pressable accessibilityRole="button" accessibilityLabel="Predă lucrarea" onPress={() => setMode('submit')} style={styles.submit}>
            <AppText role="label" color="primary">
              Predă lucrarea
            </AppText>
          </Pressable>
        }
        subheader={
          <View style={styles.sub}>
            {tabs}
            {map}
          </View>
        }
        actions={
          <View style={styles.row}>
            <Button flex label="← Înapoi" variant="secondary" disabled={flat <= 0} onPress={() => step(-1)} />
            <Button flex label="Următorul →" disabled={flat >= items.length - 1} onPress={() => step(1)} />
          </View>
        }
        contentKey={item?.id}
        wide={wide}
      >
        {failed ? (
          <View style={styles.failed} accessibilityLiveRegion="polite">
            <AppText role="small" style={{ color: feedbackText.wrong }}>
              {GRADING_FAILED}
            </AppText>
          </View>
        ) : null}
        {item ? (
          <BacItemView
            key={item.id}
            item={item}
            sources={sources}
            value={draft.answers[item.id]}
            onChange={(a, empty) => draft.setAnswer(item.id, a, empty)}
            hint={hint}
            templateIds={templateIds}
            onOpenTemplate={setSheet}
          />
        ) : null}
      </ScreenLayout>
      <TemplateSheet
        template={sheetTemplate}
        typeLabel={CONSOLIDATION_TYPE_LABELS[sheetTemplate?.exerciseType ?? item?.type ?? 'essay']}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

const DOT = 28;
const styles = StyleSheet.create({
  fill: { flex: 1 },
  gap: { gap: space[3] },
  loader: { marginTop: space[12], alignItems: 'center' },
  row: { flex: 1, flexDirection: 'row', gap: space[2.5] },
  submit: { minHeight: layout.minTouch, justifyContent: 'center', paddingHorizontal: space[1] },
  sub: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', gap: space[1], paddingHorizontal: space[4] },
  tabs: { flexDirection: 'row', backgroundColor: color.surfaceMuted, borderRadius: radius.pill, padding: space[1] },
  tab: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, paddingHorizontal: space[1] },
  tabOn: { backgroundColor: color.surface },
  mapRow: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  map: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  slot: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: color.border,
    backgroundColor: color.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: color.successSubtle, borderColor: color.success },
  dotHere: { borderWidth: 2.5, borderColor: color.primary },
  failed: { backgroundColor: color.dangerSubtle, borderRadius: radius.md, padding: space[3], marginBottom: space[3] },
});

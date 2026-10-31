import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { checkAnswer, legacyColors, legacyRadius, type Answer, type Question } from '@prepio/shared';
import { fontFamily } from '../theme/fonts';
import ChoiceQuestion from './ChoiceQuestion';
import DifficultyBadge from './DifficultyBadge';
import OrderQuestion from './OrderQuestion';

type Props = {
  question: Question;
  onAnswered: (correct: boolean) => void;
  /** Called by the "next" button shown after checking. */
  onNext?: () => void;
  /** Label of the button shown after checking. */
  nextLabel?: string;
};

export default function QuestionView({ question, onAnswered, onNext, nextLabel = 'Următoarea întrebare' }: Props) {
  const [correct, setCorrect] = useState<boolean | null>(null);
  const answered = correct !== null;

  const submit = (answer: Answer) => {
    if (answered) return;
    const ok = checkAnswer(question, answer);
    setCorrect(ok);
    onAnswered(ok);
  };

  const correctTexts =
    question.type === 'chronological_order' ? [] : question.options.filter((o) => o.correct).map((o) => o.text);

  return (
    <View style={styles.wrap}>
      <DifficultyBadge difficulty={question.difficulty} />
      <Text style={styles.prompt}>{question.prompt}</Text>

      {question.type === 'chronological_order' ? (
        <OrderQuestion items={question.options} answered={answered} correct={correct} onSubmit={submit} />
      ) : (
        <ChoiceQuestion type={question.type} options={question.options} answered={answered} onSubmit={submit} />
      )}

      {answered ? (
        <View style={[styles.feedback, correct ? styles.feedbackOk : styles.feedbackBad]}>
          <Text style={[styles.verdict, { color: correct ? legacyColors.success : legacyColors.error }]}>
            {correct ? 'Corect!' : 'Greșit'}
          </Text>
          {!correct && correctTexts.length > 0 ? (
            <Text style={styles.body}>
              {correctTexts.length === 1 ? 'Răspuns corect: ' : 'Răspunsuri corecte: '}
              {correctTexts.join('; ')}
            </Text>
          ) : null}
          {question.explanation ? <Text style={styles.body}>{question.explanation}</Text> : null}
          {onNext ? (
            <Button mode="contained" onPress={onNext}>
              {nextLabel}
            </Button>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  prompt: { fontFamily: fontFamily.heading, fontSize: 20, lineHeight: 28, color: legacyColors.ink },
  feedback: { gap: 8, padding: 14, borderRadius: legacyRadius, borderWidth: 1 },
  feedbackOk: { borderColor: legacyColors.success, backgroundColor: legacyColors.paper },
  feedbackBad: { borderColor: legacyColors.error, backgroundColor: legacyColors.paper },
  verdict: { fontFamily: fontFamily.headingBold, fontSize: 20 },
  body: { fontFamily: fontFamily.body, fontSize: 17, lineHeight: 26, color: legacyColors.ink },
});

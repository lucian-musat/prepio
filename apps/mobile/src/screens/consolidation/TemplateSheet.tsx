import { Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { color, feedbackText, radius, space, type SolutionTemplate } from '@prepio/shared';
import RichText from '../../components/cards/RichText';
import { SPLIT_MIN_WIDTH } from '../../components/marker/SourcePanel';
import { AppText, Button } from '../../ui';

const DIALOG_MAX = 560;
const BACKDROP = 'rgba(15,46,40,0.45)'; // mockup `.sheet-bg`: the text colour at 45 %

type Props = {
  /** The template to show; null hides the sheet. */
  template: SolutionTemplate | null;
  /** The exercise type's name, after „Șablon ·”. */
  typeLabel: string;
  onClose: () => void;
};

/**
 * The solution template („💡 Cum rezolv”, types mockup `.sheet`): a bottom sheet on the phone, a centred dialog
 * from 900 px. The type label, the title, „La BAC: …”, the formatted body and „Am înțeles”.
 */
export default function TemplateSheet({ template, typeLabel, onClose }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const dialog = width >= SPLIT_MIN_WIDTH;
  return (
    <Modal visible={!!template} transparent animationType={dialog ? 'fade' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, dialog && styles.rootDialog]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Închide șablonul" onPress={onClose} style={StyleSheet.absoluteFill} />
        {template ? (
          <View
            testID="template-sheet"
            accessibilityViewIsModal
            style={[styles.sheet, dialog ? styles.dialog : { paddingBottom: insets.bottom + space[4] }]}
          >
            {dialog ? null : <View style={styles.grab} />}
            <ScrollView contentContainerStyle={styles.body}>
              <AppText role="eyebrow" style={styles.kind}>
                Șablon · {typeLabel}
              </AppText>
              <AppText role="question" accessibilityRole="header">
                {template.title}
              </AppText>
              {template.points ? (
                <View style={styles.points}>
                  <AppText role="label" style={styles.pointsText}>
                    La BAC: {template.points}
                  </AppText>
                </View>
              ) : null}
              <RichText source={template.body} />
              <Button label="Am înțeles" onPress={onClose} />
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: BACKDROP },
  rootDialog: { justifyContent: 'center', alignItems: 'center', padding: space[6] },
  sheet: { maxHeight: '86%', backgroundColor: color.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  dialog: { width: '100%', maxWidth: DIALOG_MAX, borderRadius: radius.xl, paddingBottom: space[2] },
  grab: { width: 42, height: 5, borderRadius: 9, backgroundColor: color.border, alignSelf: 'center', marginTop: space[2], marginBottom: space[1] },
  body: { padding: space[4.5], paddingTop: space[2], gap: space[3] },
  kind: { color: feedbackText.almost },
  points: { alignSelf: 'flex-start', backgroundColor: color.accentSubtle, borderRadius: 6, paddingHorizontal: space[1.5] },
  pointsText: { color: feedbackText.almost },
});

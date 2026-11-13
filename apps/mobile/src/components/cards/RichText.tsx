import { StyleSheet, Text, View } from 'react-native';
import { color, parseRichText, radius, space, type CalloutVariant, type RichBlock, type RichSpan, type TextKey } from '@prepio/shared';
import { fontFamily } from '../../theme/fonts';
import { AppText } from '../../ui';
import { t } from '../../texts/store';

const CALLOUT: Record<CalloutVariant, { bg: string; edge: string; labelKey: TextKey }> = {
  retine: { bg: color.accentSubtle, edge: color.accent, labelKey: 'cards.callout.retine' },
  atentie: { bg: color.dangerSubtle, edge: color.danger, labelKey: 'cards.callout.atentie' },
  exemplu: { bg: color.primarySubtle, edge: color.primary, labelKey: 'cards.callout.exemplu' },
};

// Nested plain Text inherits the parent's role typography and colour; only bold/italic are added.
// Headings are already in the black weight, so they skip the bold family.
function Spans({ spans, heading = false }: { spans: RichSpan[]; heading?: boolean }) {
  return (
    <>
      {spans.map((s, i) => (
        <Text key={i} style={[s.bold && !heading && styles.bold, s.italic && styles.italic]}>
          {s.text}
        </Text>
      ))}
    </>
  );
}

function Block({ block }: { block: RichBlock }) {
  switch (block.kind) {
    case 'paragraph':
      return (
        <AppText role="body">
          <Spans spans={block.spans} />
        </AppText>
      );
    case 'heading':
      return (
        <AppText role="section" accessibilityRole="header">
          <Spans spans={block.spans} heading />
        </AppText>
      );
    case 'list':
      return (
        <View style={styles.list}>
          {block.items.map((item, i) => (
            <View key={i} style={styles.item}>
              <AppText role="body" style={styles.marker}>
                {block.ordered ? `${i + 1}.` : '•'}
              </AppText>
              <AppText role="body" style={styles.itemText}>
                <Spans spans={item} />
              </AppText>
            </View>
          ))}
        </View>
      );
    case 'callout': {
      const c = CALLOUT[block.variant];
      return (
        <View style={[styles.callout, { backgroundColor: c.bg, borderLeftColor: c.edge }]}>
          <AppText role="bodyStrong">{t(c.labelKey)}</AppText>
          {block.blocks.map((b, i) => (
            <Block key={i} block={b} />
          ))}
        </View>
      );
    }
  }
}

/** Card text: the Markdown subset from `parseRichText`, rendered as native Text (never as HTML). */
export default function RichText({ source }: { source: string }) {
  return (
    <View style={styles.root}>
      {parseRichText(source).map((b, i) => (
        <Block key={i} block={b} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[3] },
  bold: { fontFamily: fontFamily.bodyBold },
  italic: { fontStyle: 'italic' },
  list: { gap: space[1.5] },
  item: { flexDirection: 'row', gap: space[2] },
  marker: { minWidth: space[4] },
  itemText: { flex: 1 },
  callout: { gap: space[1.5], padding: space[3.5], borderLeftWidth: space[1], borderRadius: radius.md },
});

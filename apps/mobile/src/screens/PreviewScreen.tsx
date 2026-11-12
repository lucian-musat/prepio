import { useEffect, useState } from 'react';
import { Platform, StyleSheet } from 'react-native';
import { PREVIEW_READY_MESSAGE, parsePreviewMessage, space, type Card } from '@prepio/shared';
import { AppText, Button, ScreenLayout, Surface } from '../ui';
import CardView from '../components/cards/CardView';

type Shown = { card: Card; index: number; total: number };

const TITLE = 'Previzualizare';
const noop = () => {};

function Message({ text }: { text: string }) {
  return (
    <ScreenLayout title={TITLE} onBack={noop}>
      <Surface>
        <AppText role="small" color="textMuted" style={styles.message}>
          {text}
        </AppText>
      </Surface>
    </ScreenLayout>
  );
}

/**
 * Sign-in-free page the admin embeds in an iframe to preview the card being edited, framed like a lesson card.
 * It reads nothing from Supabase: the card arrives by postMessage, accepted only from EXPO_PUBLIC_ADMIN_ORIGIN
 * (without it, every message is ignored). The navigation is drawn but inert.
 */
export default function PreviewScreen() {
  const [shown, setShown] = useState<Shown | null>(null);
  const web = Platform.OS === 'web';

  useEffect(() => {
    const adminOrigin = process.env.EXPO_PUBLIC_ADMIN_ORIGIN;
    if (!web || !adminOrigin) return;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== adminOrigin) return;
      const parsed = parsePreviewMessage(event.data);
      if (parsed) setShown(parsed);
    };
    window.addEventListener('message', onMessage);
    if (window.parent && window.parent !== window) window.parent.postMessage(PREVIEW_READY_MESSAGE, adminOrigin);
    return () => window.removeEventListener('message', onMessage);
  }, [web]);

  if (!web) return <Message text="Previzualizarea este disponibilă doar pe web." />;
  if (!shown) return <Message text="Se așteaptă cardul…" />;

  const { card, index, total } = shown;
  return (
    <ScreenLayout
      title={TITLE}
      progress={(index + 1) / total}
      onBack={noop}
      actions={
        <>
          <Button flex variant="secondary" label="Înapoi" accessibilityLabel="Înapoi la cardul anterior" disabled onPress={noop} />
          <Button flex label="Continuă" disabled onPress={noop} />
        </>
      }
    >
      <CardView card={card} eyebrow={`Card ${index + 1} din ${total}`} />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  message: { textAlign: 'center', paddingVertical: space[2] },
});

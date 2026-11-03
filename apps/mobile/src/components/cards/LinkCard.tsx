import { useState } from 'react';
import { Image, StyleSheet, View, type TextStyle } from 'react-native';
import { color, radius, space, type CardContent } from '@prepio/shared';
import { AppText, Button } from '../../ui';
import { imageUrl } from '../../lib/content';
import RichText from './RichText';
import { openExternal } from './openExternal';

type Link = Extract<CardContent, { type: 'link' }>;

/** Hostname without a leading "www.", or null when the string is not an http(s) URL. */
function parseHttp(url: string): URL | null {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u : null;
  } catch {
    return null;
  }
}

// `wordBreak` is web-only: long URLs/titles must wrap instead of overflowing the card.
const WRAP = { flexShrink: 1, wordBreak: 'break-word' } as TextStyle;

/** An external link as a bordered preview (image, domain, title, description) with an open button. */
export default function LinkCard({ content }: { content: Link }) {
  const { url, pageTitle, description, image, text } = content;
  const parsed = parseHttp(url);
  const domain = parsed ? parsed.hostname.replace(/^www\./, '') : null;
  const uri = image ? (image.kind === 'url' ? image.url : imageUrl(image.path)) : null;
  // The failure belongs to one URI: the admin live preview never remounts the card, so a replacement
  // image after a failed one must show.
  const [failedUri, setFailedUri] = useState<string | null>(null);

  return (
    <View style={styles.root}>
      {text ? <RichText source={text} /> : null}
      <View style={styles.preview}>
        {uri && uri !== failedUri ? <Image testID="link-image" source={{ uri }} resizeMode="cover" accessible={false} onError={() => setFailedUri(uri)} style={styles.image} /> : null}
        <View style={styles.body}>
          {domain ? (
            <AppText role="caption" color="textMuted" style={[WRAP, styles.domain]}>
              {domain.toUpperCase()}
            </AppText>
          ) : null}
          <AppText role="label" style={WRAP}>
            {pageTitle}
          </AppText>
          {description ? (
            <AppText role="caption" color="textMuted" style={WRAP}>
              {description}
            </AppText>
          ) : null}
          <Button variant="secondary" label="Deschide ↗" disabled={!parsed} onPress={() => parsed && openExternal(parsed.href)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: space[3] },
  preview: { borderWidth: 1, borderColor: color.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.surface },
  image: { width: '100%', aspectRatio: 16 / 9, backgroundColor: color.surfaceMuted },
  body: { padding: space[3], gap: space[2] },
  domain: { letterSpacing: 0.5 },
});

import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Button, Text } from 'react-native-paper';
import { legacyColors, legacyRadius, type Card } from '@prepio/shared';
import { imageUrl } from '../lib/content';
import { fontFamily } from '../theme/fonts';

function CardView({ card }: { card: Card }) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!card.imagePath && !imageFailed;
  return (
    <View style={styles.card}>
      {card.title ? (
        <Text variant="titleLarge" style={styles.title}>
          {card.title}
        </Text>
      ) : null}
      {showImage ? (
        <View style={styles.figure}>
          <Image
            source={{ uri: imageUrl(card.imagePath!) }}
            accessibilityLabel={`${card.title ?? 'Card'} – ilustrație`}
            resizeMode="contain"
            style={styles.image}
            onError={() => setImageFailed(true)}
          />
          {card.imageCredit ? <Text style={styles.credit}>{card.imageCredit}</Text> : null}
        </View>
      ) : null}
      <Text style={styles.body}>{card.body}</Text>
    </View>
  );
}

type Props = { cards: Card[]; onFinish: () => void };

/** Shows learning cards one at a time. On the last card "Următorul" becomes "Continuă". */
export default function CardStepper({ cards, onFinish }: Props) {
  const [index, setIndex] = useState(0);
  const last = index === cards.length - 1;
  const card = cards[index];
  if (!card) return null;
  return (
    <View style={styles.wrap}>
      <CardView key={card.id} card={card} />
      <Text style={styles.counter}>
        {index + 1} / {cards.length}
      </Text>
      <View style={styles.nav}>
        <Button mode="outlined" disabled={index === 0} onPress={() => setIndex(index - 1)}>
          Înapoi
        </Button>
        <Button mode="contained" onPress={() => (last ? onFinish() : setIndex(index + 1))}>
          {last ? 'Continuă' : 'Următorul'}
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  card: {
    backgroundColor: legacyColors.paper,
    borderRadius: legacyRadius,
    borderWidth: 1,
    borderColor: legacyColors.border,
    borderTopWidth: 3,
    borderTopColor: legacyColors.gold,
    padding: 20,
    gap: 12,
    shadowColor: legacyColors.ink,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  title: { fontFamily: fontFamily.headingBold, color: legacyColors.bordeaux },
  figure: { gap: 4 },
  image: { width: '100%', height: 200, borderRadius: 8 },
  credit: { fontSize: 12, color: legacyColors.inkMuted, fontFamily: fontFamily.body },
  body: { fontSize: 17, lineHeight: 26, color: legacyColors.ink, fontFamily: fontFamily.body },
  counter: { textAlign: 'center', color: legacyColors.inkMuted, fontFamily: fontFamily.body },
  nav: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});

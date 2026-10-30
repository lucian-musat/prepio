import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ActivityIndicator, Button, Card, List, Text } from 'react-native-paper';
import { colors, radius } from '@prepio/shared';
import Screen from '../components/Screen';
import { fetchHome, type HomeData } from '../lib/content';
import { fontFamily } from '../theme/paperTheme';

export default function HomeScreen() {
  const [data, setData] = useState<HomeData | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    setFailed(false);
    setData(null);
    fetchHome().then(setData, () => setFailed(true));
  }, []);

  useEffect(load, [load]);

  if (failed) {
    return (
      <Screen>
        <Card style={styles.card}>
          <Card.Content style={styles.gap}>
            <Text variant="titleMedium">Nu am putut încărca lecțiile</Text>
            <Text>Verifică conexiunea la internet și încearcă din nou.</Text>
            <Button mode="contained" onPress={load}>
              Reîncearcă
            </Button>
          </Card.Content>
        </Card>
      </Screen>
    );
  }

  if (!data) {
    return (
      <Screen>
        <ActivityIndicator style={styles.loader} accessibilityLabel="Se încarcă" />
      </Screen>
    );
  }

  return (
    <Screen>
      {data.welcomeMessage ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text>{data.welcomeMessage}</Text>
          </Card.Content>
        </Card>
      ) : null}
      {data.sections.map((section) => {
        const title = section.path.join(' › ');
        return (
          <View key={title} style={styles.section}>
            <Text variant="titleMedium" style={styles.header}>
              {title}
            </Text>
            <Card style={styles.card}>
              {section.lessons.map((lesson, i) => (
                <List.Item
                  key={lesson.id}
                  title={lesson.title}
                  titleNumberOfLines={3}
                  titleStyle={styles.lessonTitle}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => router.push(`/lesson/${lesson.id}`)}
                  style={i > 0 ? styles.divider : undefined}
                />
              ))}
            </Card>
          </View>
        );
      })}
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
  },
  gap: { gap: 12 },
  loader: { marginTop: 48 },
  section: { gap: 8 },
  header: { fontFamily: fontFamily.headingBold, color: colors.bordeaux },
  lessonTitle: { fontFamily: fontFamily.body, color: colors.ink },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
});
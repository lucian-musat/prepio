import { Linking, StyleSheet } from 'react-native';
import { AppText } from '../ui';
import { CONTACT_EMAIL } from '../lib/legal';

/** The contact address as a link inside a sentence: it opens the mail app (`mailto:`). */
export default function EmailLink({ email = CONTACT_EMAIL }: { email?: string }) {
  return (
    <AppText
      accessibilityRole="link"
      color="primaryStrong"
      onPress={() => void Linking.openURL(`mailto:${email}`).catch(() => undefined)}
      style={styles.link}
    >
      {email}
    </AppText>
  );
}

const styles = StyleSheet.create({ link: { textDecorationLine: 'underline' } });

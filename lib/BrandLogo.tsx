import { Image, StyleSheet, Text, View } from 'react-native';
import Brand from '../constants/brand';

// Registry of barns that have a logo file.
// Uncomment (or add) an entry once assets/brands/<slug>/logo.png is dropped in.
const LOGO_REGISTRY: Record<string, any> = {
  // 'hidden-hill-farm': require('../assets/brands/hidden-hill-farm/logo.png'),
};

interface Props {
  // 'login'  — large centered logo on the login screen
  // 'header' — small inline logo in the dashboard header
  context: 'login' | 'header';
}

export default function BrandLogo({ context }: Props) {
  const logoSource = LOGO_REGISTRY[Brand.slug];

  if (logoSource) {
    const size = context === 'login' ? 80 : 32;
    return (
      <Image
        source={logoSource}
        style={{ width: size, height: size, resizeMode: 'contain' }}
      />
    );
  }

  // Fallback: S/S lettermark (matches existing design — vertical stack)
  if (context === 'login') {
    return (
      <View style={styles.loginMark}>
        <Text style={styles.loginS}>S</Text>
        <View style={styles.loginRule} />
        <Text style={styles.loginS}>S</Text>
      </View>
    );
  }

  return (
    <View style={styles.headerMark}>
      <Text style={styles.headerS}>S</Text>
      <View style={styles.headerRule} />
      <Text style={styles.headerS}>S</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  loginMark: { alignItems: 'center', gap: 2 },
  loginS: { fontSize: 36, fontWeight: '800', color: Brand.colors.headerText, lineHeight: 38 },
  loginRule: { width: 40, height: 2, backgroundColor: Brand.colors.headerText },

  headerMark: { alignItems: 'center', gap: 1 },
  headerS: { fontSize: 12, fontWeight: '800', color: Brand.colors.headerText, lineHeight: 13 },
  headerRule: { width: 16, height: 1.5, backgroundColor: Brand.colors.headerText },
});

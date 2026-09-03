import { Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Home } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

export default function HomeButton() {
  const { colors: C } = useTheme();

  return (
    <Pressable
      style={({ hovered }: any) => [
        styles.btn,
        { backgroundColor: 'rgba(255,255,255,0.18)' },
        hovered && { backgroundColor: 'rgba(255,255,255,0.32)' },
      ]}
      onPress={() => router.dismissAll()}
    >
      <Home size={18} color={C.secondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
});

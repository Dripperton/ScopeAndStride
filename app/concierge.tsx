import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Home, Send, Sparkles, RotateCcw } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { useProfile } from '../lib/useProfile';
import { useLanguage } from '../lib/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import Brand from '../constants/brand';

const SUGGESTED_QUESTIONS = [
  'Which horses have alerts right now?',
  'What events are coming up this week?',
  'How much is outstanding in unpaid invoices?',
  'When is the next farrier appointment?',
  'Give me an operational summary of the barn.',
];

const HORSE_OWNER_SUGGESTIONS = [
  "When is my horse's next farrier appointment?",
  'Do I have any outstanding invoices?',
  "Is my horse's coggins up to date?",
  "What's my horse's board type?",
];

export default function Concierge() {
  const router = useRouter();
  const { profile, isOwner, isStaff, isHorseOwner, horseLinks } = useProfile();
  const { t } = useLanguage();
  const theme = useTheme();
  const C = theme.colors;
  const F = theme.fonts;

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [askedQuestion, setAskedQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);

  const suggestions = isHorseOwner ? HORSE_OWNER_SUGGESTIONS : SUGGESTED_QUESTIONS;

  async function askConcierge(q: string) {
    if (!q.trim() || !profile?.id) return;

    setAskedQuestion(q.trim());
    setQuestion('');
    setAnswer('');
    setError('');
    setLoading(true);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('concierge-chat', {
        body: {
          question: q.trim(),
          userId: profile.id,
          role: profile.role,
          horseIds: horseLinks.map(l => l.horse_id),
        },
      });

      if (fnError || data?.error) {
        setError(data?.error || 'Could not reach the AI. Please try again.');
      } else {
        setAnswer(data.answer);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }

  function handleReset() {
    setQuestion('');
    setAnswer('');
    setAskedQuestion('');
    setError('');
    inputRef.current?.focus();
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: C.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: C.primary }]}>
        <View style={styles.headerLeft}>
          <Pressable
            style={({ hovered }: any) => [styles.homeBtn, hovered && styles.homeBtnHovered]}
            onPress={() => router.dismissTo('/dashboard')}
          >
            <Home size={18} color={C.secondary} />
          </Pressable>
          <View>
            <View style={styles.headerTitleRow}>
              <Text style={[styles.headerName, { color: C.headerText, fontFamily: F.sansBold }]}>{t('Concierge')}</Text>
              <View style={[styles.aiBadge, { backgroundColor: C.secondaryAlpha20 }]}>
                <Text style={[styles.aiBadgeText, { color: C.secondary, fontFamily: F.sansBold }]}>AI</Text>
              </View>
            </View>
            <Text style={styles.headerSub}>{t('Ask anything about your barn')}</Text>
          </View>
        </View>
      </View>

      {/* Content */}
      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={styles.bodyContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Empty state — suggestions */}
        {!askedQuestion && !loading && (
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: C.secondaryAlpha10 }]}>
              <Sparkles size={28} color={C.secondary} />
            </View>
            <Text style={[styles.emptyTitle, { color: C.text, fontFamily: F.serif }]}>
              {t('How can I help?')}
            </Text>
            <Text style={[styles.emptySubtitle, { color: C.textMuted, fontFamily: F.sans }]}>
              {t('I have access to your barn data — horses, schedule, billing, and more.')}
            </Text>

            <Text style={[styles.suggestionsLabel, { color: C.textMuted, fontFamily: F.sansBold }]}>
              {t('Try asking...')}
            </Text>
            {suggestions.map((s, i) => (
              <Pressable
                key={i}
                style={({ hovered }: any) => [
                  styles.suggestionChip,
                  { backgroundColor: C.card, borderColor: C.cardBorder },
                  hovered && { borderColor: C.secondary, backgroundColor: C.activeBg },
                ]}
                onPress={() => askConcierge(s)}
              >
                <Text style={[styles.suggestionText, { color: C.text, fontFamily: F.sans }]}>{s}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {/* Question bubble */}
        {askedQuestion !== '' && (
          <View style={styles.questionBubbleRow}>
            <View style={[styles.questionBubble, { backgroundColor: C.secondary }]}>
              <Text style={[styles.questionText, { fontFamily: F.sans }]}>{askedQuestion}</Text>
            </View>
          </View>
        )}

        {/* Loading */}
        {loading && (
          <View style={styles.loadingRow}>
            <View style={[styles.loadingBubble, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <ActivityIndicator size="small" color={C.secondary} />
              <Text style={[styles.loadingText, { color: C.textMuted, fontFamily: F.sans }]}>{t('Thinking...')}</Text>
            </View>
          </View>
        )}

        {/* Answer bubble */}
        {answer !== '' && (
          <View style={styles.answerRow}>
            <View style={[styles.answerIconCol]}>
              <View style={[styles.answerIcon, { backgroundColor: C.secondaryAlpha15 }]}>
                <Sparkles size={14} color={C.secondary} />
              </View>
            </View>
            <View style={[styles.answerBubble, { backgroundColor: C.card, borderColor: C.cardBorder }]}>
              <Text style={[styles.answerText, { color: C.text, fontFamily: F.sans }]}>{answer}</Text>
            </View>
          </View>
        )}

        {/* Error */}
        {error !== '' && (
          <View style={styles.answerRow}>
            <View style={[styles.answerBubble, { backgroundColor: C.errorBg, borderColor: C.error }]}>
              <Text style={[styles.answerText, { color: C.error, fontFamily: F.sans }]}>{error}</Text>
            </View>
          </View>
        )}

        {/* Ask another */}
        {(answer || error) && !loading && (
          <Pressable
            style={({ hovered }: any) => [styles.resetBtn, hovered && { backgroundColor: C.activeBg }]}
            onPress={handleReset}
          >
            <RotateCcw size={14} color={C.secondary} />
            <Text style={[styles.resetText, { color: C.secondary, fontFamily: F.sansMedium }]}>{t('Ask another question')}</Text>
          </Pressable>
        )}

        <View style={{ height: 20 }} />
      </ScrollView>

      {/* Input bar */}
      <View style={[styles.inputBar, { backgroundColor: C.card, borderTopColor: C.cardBorder }]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: C.text, fontFamily: F.sans, borderColor: C.cardBorder }]}
          placeholder={t('Ask Concierge anything...')}
          placeholderTextColor={C.textMuted}
          value={question}
          onChangeText={setQuestion}
          onSubmitEditing={() => askConcierge(question)}
          returnKeyType="send"
          editable={!loading}
          multiline={false}
        />
        <Pressable
          style={({ hovered }: any) => [
            styles.sendBtn,
            { backgroundColor: question.trim() ? C.secondary : C.cardBorder },
            hovered && question.trim() && { backgroundColor: C.secondaryDark },
          ]}
          onPress={() => askConcierge(question)}
          disabled={loading || !question.trim()}
        >
          {loading
            ? <ActivityIndicator size="small" color="white" />
            : <Send size={16} color="white" />}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: { padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  homeBtn: { width: 36, height: 36, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  homeBtnHovered: { backgroundColor: 'rgba(255,255,255,0.24)' },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerName: { fontSize: 16 },
  aiBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  aiBadgeText: { fontSize: 10, letterSpacing: 0.5 },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 1 },

  // Body
  body: { flex: 1 },
  bodyContent: { padding: 16 },

  // Empty state
  emptyState: { alignItems: 'center', paddingTop: 40 },
  emptyIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 24, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', maxWidth: 300, lineHeight: 20, marginBottom: 32 },
  suggestionsLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10, alignSelf: 'flex-start' },
  suggestionChip: { alignSelf: 'stretch', borderWidth: 1, borderRadius: 10, padding: 14, marginBottom: 8 },
  suggestionText: { fontSize: 14 },

  // Question bubble
  questionBubbleRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 12 },
  questionBubble: { borderRadius: 16, borderBottomRightRadius: 4, padding: 14, maxWidth: '85%' },
  questionText: { color: 'white', fontSize: 14, lineHeight: 20 },

  // Loading
  loadingRow: { marginBottom: 12 },
  loadingBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 16, borderWidth: 1, padding: 14, alignSelf: 'flex-start' },
  loadingText: { fontSize: 13 },

  // Answer bubble
  answerRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  answerIconCol: { paddingTop: 2 },
  answerIcon: { width: 24, height: 24, borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  answerBubble: { flex: 1, borderRadius: 16, borderBottomLeftRadius: 4, borderWidth: 1, padding: 14 },
  answerText: { fontSize: 14, lineHeight: 22 },

  // Reset
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, marginTop: 8 },
  resetText: { fontSize: 13 },

  // Input bar
  inputBar: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderTopWidth: 1 },
  input: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  sendBtn: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
});

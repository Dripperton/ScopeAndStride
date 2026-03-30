import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, Pressable, View } from 'react-native';
import { Home, ChessKnight, Calendar, DollarSign, MoreHorizontal } from 'lucide-react-native';
import { useProfile } from '../lib/useProfile';

const audits = [
  { id: 1, category: 'Feed Management', score: 92, status: 'Excellent', color: '#EDF5EF', textColor: '#2C4A35' },
  { id: 2, category: 'Medical Records', score: 78, status: 'Good', color: '#EAD9A8', textColor: '#6B4F1A' },
  { id: 3, category: 'Billing Compliance', score: 65, status: 'Needs Work', color: '#FDECEA', textColor: '#8B2E2E' },
  { id: 4, category: 'Staff Scheduling', score: 88, status: 'Good', color: '#EAD9A8', textColor: '#6B4F1A' },
  { id: 5, category: 'Facility Maintenance', score: 95, status: 'Excellent', color: '#EDF5EF', textColor: '#2C4A35' },
  { id: 6, category: 'Owner Communication', score: 70, status: 'Good', color: '#EAD9A8', textColor: '#6B4F1A' },
];

const tasks = [
  { id: 1, title: 'Update Coggins records for 3 horses', priority: 'High', done: false },
  { id: 2, title: 'Send March invoices to all owners', priority: 'High', done: false },
  { id: 3, title: 'Schedule spring vet wellness checks', priority: 'Medium', done: false },
  { id: 4, title: 'Review feed supplier contract', priority: 'Low', done: true },
  { id: 5, title: 'Update emergency contact list', priority: 'Medium', done: true },
];

export default function Concierge() {
  const router = useRouter();
  const { isOwner } = useProfile();
  const overallScore = 81;

  if (!isOwner) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <Text style={styles.headerIconText}>S{'\n'}S</Text>
            </View>
            <View>
              <Text style={styles.headerName}>Concierge</Text>
              <Text style={styles.headerBarn}>Operational Audit</Text>
            </View>
          </View>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
          <Text style={{ fontSize: 16, color: '#9A9285', textAlign: 'center' }}>You don't have permission to view this page.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Text style={styles.headerIconText}>S{'\n'}S</Text>
          </View>
          <View>
            <Text style={styles.headerName}>Concierge</Text>
            <Text style={styles.headerBarn}>Operational Audit</Text>
          </View>
        </View>
        <View style={styles.scoreBadge}>
          <Text style={styles.scoreNum}>{overallScore}</Text>
          <Text style={styles.scoreLabel}>Score</Text>
        </View>
      </View>
      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.overallCard}>
          <Text style={styles.overallTitle}>Hollow Creek Equestrian</Text>
          <Text style={styles.overallSub}>Overall operational health</Text>
          <View style={styles.scoreBar}>
            <View style={[styles.scoreBarFill, { width: '81%' }]} />
          </View>
          <Text style={styles.overallScore}>81/100 — Good Standing</Text>
        </View>
        <Text style={styles.sectionTitle}>Category Scores</Text>
        {audits.map((audit) => (
          <View key={audit.id} style={styles.auditCard}>
            <View style={styles.auditInfo}>
              <Text style={styles.auditCategory}>{audit.category}</Text>
              <View style={styles.auditBar}>
                <View style={[styles.auditBarFill, { width: `${audit.score}%`, backgroundColor: audit.score >= 90 ? '#2C4A35' : audit.score >= 75 ? '#C9A85C' : '#8B2E2E' }]} />
              </View>
            </View>
            <View style={[styles.auditBadge, { backgroundColor: audit.color }]}>
              <Text style={[styles.auditScore, { color: audit.textColor }]}>{audit.score}</Text>
            </View>
          </View>
        ))}
        <Text style={styles.sectionTitle}>Action Items</Text>
        {tasks.map((task) => (
          <View key={task.id} style={[styles.taskCard, task.done && styles.taskDone]}>
            <View style={[styles.taskCheck, task.done && styles.taskCheckDone]}>
              {task.done && <Text style={styles.taskCheckMark}>✓</Text>}
            </View>
            <View style={styles.taskInfo}>
              <Text style={[styles.taskTitle, task.done && styles.taskTitleDone]}>{task.title}</Text>
              <Text style={styles.taskPriority}>{task.priority} Priority</Text>
            </View>
          </View>
        ))}
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7F2' },
  header: { backgroundColor: '#2C4A35', padding: 16, paddingTop: 52, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 32, height: 32, backgroundColor: 'rgba(201,168,92,0.15)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerIconText: { fontSize: 10, fontWeight: '700', color: '#C9A85C', textAlign: 'center', lineHeight: 11 },
  headerName: { fontSize: 15, fontWeight: '600', color: '#C9A85C' },
  headerBarn: { fontSize: 10, color: 'rgba(255,255,255,0.4)' },
  scoreBadge: { backgroundColor: 'rgba(201,168,92,0.15)', borderRadius: 8, padding: 10, alignItems: 'center' },
  scoreNum: { fontSize: 22, fontWeight: '700', color: '#C9A85C' },
  scoreLabel: { fontSize: 9, color: 'rgba(201,168,92,0.6)', textTransform: 'uppercase', letterSpacing: 1 },
  body: { flex: 1, padding: 12 },
  overallCard: { backgroundColor: '#2C4A35', borderRadius: 12, padding: 20, marginBottom: 16 },
  overallTitle: { fontSize: 16, fontWeight: '600', color: '#C9A85C', marginBottom: 2 },
  overallSub: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginBottom: 14 },
  scoreBar: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 4, height: 6, marginBottom: 8 },
  scoreBarFill: { backgroundColor: '#C9A85C', borderRadius: 4, height: 6 },
  overallScore: { fontSize: 12, color: 'rgba(201,168,92,0.7)' },
  sectionTitle: { fontSize: 11, fontWeight: '700', color: '#9A9285', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10, marginTop: 4 },
  auditCard: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, gap: 12 },
  auditInfo: { flex: 1 },
  auditCategory: { fontSize: 13, fontWeight: '500', color: '#1A1A14', marginBottom: 6 },
  auditBar: { backgroundColor: '#F0EAD6', borderRadius: 3, height: 4 },
  auditBarFill: { borderRadius: 3, height: 4 },
  auditBadge: { width: 40, height: 40, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  auditScore: { fontSize: 15, fontWeight: '700' },
  taskCard: { backgroundColor: 'white', borderWidth: 1, borderColor: '#E8E0CC', borderRadius: 10, flexDirection: 'row', alignItems: 'center', padding: 12, marginBottom: 8, gap: 12 },
  taskDone: { opacity: 0.5 },
  taskCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: '#2C4A35', alignItems: 'center', justifyContent: 'center' },
  taskCheckDone: { backgroundColor: '#2C4A35' },
  taskCheckMark: { fontSize: 12, color: 'white', fontWeight: '700' },
  taskInfo: { flex: 1 },
  taskTitle: { fontSize: 13, color: '#1A1A14', fontWeight: '500' },
  taskTitleDone: { textDecorationLine: 'line-through', color: '#9A9285' },
  taskPriority: { fontSize: 10, color: '#9A9285', marginTop: 2 },
  homeBtn: { width: 32, height: 32, backgroundColor: 'rgba(201,168,92,0.15)', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  homeBtnHovered: { backgroundColor: 'rgba(201,168,92,0.3)' },
});

import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function PrivacyPolicy() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Privacy Policy</Text>
      <Text style={styles.meta}>Last updated: October 29, 2026</Text>

      <Text style={styles.body}>
        Scope &amp; Stride ("we", "us", or "our") operates the Scope &amp; Stride mobile application. This policy explains what data we collect, how we use it, and your rights.
      </Text>

      <Text style={styles.heading}>What we collect</Text>
      <Text style={styles.body}>
        • Account information: name and email address{'\n'}
        • Horse records: health data, service visits, farrier and vet records{'\n'}
        • Billing information: invoices and payment history (payment card data is processed by Stripe and never stored by us){'\n'}
        • Usage data: standard app analytics
      </Text>

      <Text style={styles.heading}>How we use it</Text>
      <Text style={styles.body}>
        • To provide barn management features within the app{'\n'}
        • To send email notifications about service visits and invoices{'\n'}
        • To sync billing data with QuickBooks (if connected)
      </Text>

      <Text style={styles.heading}>Third-party services</Text>
      <Text style={styles.body}>
        • Supabase — database and authentication{'\n'}
        • Stripe — payment processing{'\n'}
        • Resend — transactional email{'\n'}
        • QuickBooks — optional billing integration
      </Text>

      <Text style={styles.heading}>Data sharing</Text>
      <Text style={styles.body}>
        We do not sell your data. We share it only with the third-party services listed above, as necessary to operate the app.
      </Text>

      <Text style={styles.heading}>Data retention</Text>
      <Text style={styles.body}>
        Your data is retained for as long as your barn account is active. You may request deletion by contacting us.
      </Text>

      <Text style={styles.heading}>Contact</Text>
      <Text style={styles.body}>questions@scopeandstride.com</Text>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { padding: 32, paddingTop: 60, maxWidth: 640, alignSelf: 'center', width: '100%' },
  title: { fontSize: 28, fontWeight: '700', color: '#1A1A1A', marginBottom: 4 },
  meta: { fontSize: 13, color: '#9A9285', marginBottom: 24 },
  heading: { fontSize: 16, fontWeight: '700', color: '#1A1A1A', marginTop: 24, marginBottom: 8 },
  body: { fontSize: 15, color: '#3A3830', lineHeight: 24 },
});

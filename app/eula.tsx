import { ScrollView, StyleSheet, Text, View } from 'react-native';

export default function EULA() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>End-User License Agreement</Text>
      <Text style={styles.meta}>Last updated: November 5, 2026</Text>

      <Text style={styles.body}>
        Please read this End-User License Agreement ("Agreement") carefully before using the Scope &amp; Stride mobile application ("App") operated by Scope &amp; Stride ("we", "us", or "our"). By downloading, installing, or using the App, you agree to be bound by the terms of this Agreement.
      </Text>

      <Text style={styles.heading}>1. License Grant</Text>
      <Text style={styles.body}>
        We grant you a limited, non-exclusive, non-transferable, revocable license to use the App for your personal or internal business purposes, subject to the terms of this Agreement.
      </Text>

      <Text style={styles.heading}>2. Restrictions</Text>
      <Text style={styles.body}>
        You may not:{'\n'}
        • Copy, modify, or distribute the App or its content{'\n'}
        • Reverse engineer, decompile, or disassemble the App{'\n'}
        • Use the App for any unlawful purpose{'\n'}
        • Transfer your license to another party{'\n'}
        • Use the App to store or transmit malicious code
      </Text>

      <Text style={styles.heading}>3. User Accounts</Text>
      <Text style={styles.body}>
        You are responsible for maintaining the confidentiality of your account credentials and for all activity that occurs under your account. You must notify us immediately of any unauthorized use of your account.
      </Text>

      <Text style={styles.heading}>4. Data and Privacy</Text>
      <Text style={styles.body}>
        Your use of the App is also governed by our Privacy Policy, available at https://app.scopeandstride.com/privacy-policy. By using the App, you consent to the data practices described therein.
      </Text>

      <Text style={styles.heading}>5. Third-Party Integrations</Text>
      <Text style={styles.body}>
        The App may integrate with third-party services including QuickBooks (Intuit Inc.), Stripe, and others. Your use of those integrations is subject to the respective third-party terms of service. We are not responsible for the availability or accuracy of third-party services.
      </Text>

      <Text style={styles.heading}>6. Intellectual Property</Text>
      <Text style={styles.body}>
        The App and all content, features, and functionality are owned by Scope &amp; Stride and are protected by copyright, trademark, and other intellectual property laws. This Agreement does not transfer any ownership rights to you.
      </Text>

      <Text style={styles.heading}>7. Disclaimer of Warranties</Text>
      <Text style={styles.body}>
        The App is provided "as is" and "as available" without warranties of any kind, express or implied. We do not warrant that the App will be uninterrupted, error-free, or free of viruses or other harmful components.
      </Text>

      <Text style={styles.heading}>8. Limitation of Liability</Text>
      <Text style={styles.body}>
        To the fullest extent permitted by law, Scope &amp; Stride shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of the App, even if we have been advised of the possibility of such damages.
      </Text>

      <Text style={styles.heading}>9. Termination</Text>
      <Text style={styles.body}>
        We may terminate or suspend your access to the App at any time, with or without cause, with or without notice. Upon termination, your license to use the App will immediately cease.
      </Text>

      <Text style={styles.heading}>10. Governing Law</Text>
      <Text style={styles.body}>
        This Agreement shall be governed by and construed in accordance with the laws of the State of North Carolina, without regard to its conflict of law provisions.
      </Text>

      <Text style={styles.heading}>11. Changes to This Agreement</Text>
      <Text style={styles.body}>
        We reserve the right to modify this Agreement at any time. We will notify you of material changes by updating the "Last updated" date. Your continued use of the App after changes constitutes acceptance of the revised Agreement.
      </Text>

      <Text style={styles.heading}>12. Contact</Text>
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

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {
  ArrowLeft,
  User,
  MapPin,
  FileText,
  Building,
  CheckCircle2,
  Circle,
  Briefcase,
  Share2,
  Users,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { createNotification } from '../../lib/notificationService';

const DESIGN_SERVICES = [
  'Land Registration',
  'Mutation / Conversion',
  'L.U.C.C',
  'Building Plan Approval',
  '2D Floor Plan Design',
  '3D Floor Plan Design',
  '3D Elevation Design',
  'Soil Testing',
  'Structural Design',
  'Vastu Consultation',
  'Interior Design',
];

const EXECUTION_PROJECTS = [
  'Construction',
  'Commercial Construction',
  'Industrial Setup',
  'Renovation & Remodeling',
  'Interior Execution',
  'Landscaping',
];

const CLIENT_SOURCES = [
  'Website',
  'Referral',
  'Walk-in',
  'Phone Call',
  'WhatsApp',
  'Google Ads',
  'Google Maps (GMB)',
  'Instagram',
  'Facebook',
  'LinkedIn',
  'BNI',
  'Real Estate Brokers',
  'Site Signage / Hoardings',
  'Repeat Client',
  'Other',
];

export default function NewClientScreen({ navigation }: any) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('Walk-in');
  const [gst, setGst] = useState('');
  const [arrivingDate, setArrivingDate] = useState(new Date().toISOString().split('T')[0]);
  const [address, setAddress] = useState('');
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([]);
  const [notes, setNotes] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [assignedEmployee, setAssignedEmployee] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchEmployees();
  }, [user]);

  const fetchEmployees = async () => {
    try {
      const { data } = await supabase.from('employees').select('id, name, designation, role').order('name');
      if (data) {
        setEmployees(data);
        if (user?.name) {
          setAssignedEmployee(user.name);
        } else if (data.length > 0) {
          setAssignedEmployee(data[0].name);
        }
      }
    } catch (e: any) {
      console.warn('Error fetching employees', e.message);
    }
  };

  const toggleWorkType = (item: string) => {
    setSelectedWorkTypes((prev) => {
      if (prev.includes(item)) return prev.filter((x) => x !== item);
      return [...prev, item];
    });
  };

  const handleSaveClient = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter primary contact name.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Required', 'Please enter primary phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const combinedNotes = [
        gst.trim() ? `GST/PAN: ${gst.trim()}` : null,
        source ? `Source: ${source}` : null,
        notes.trim() ? notes.trim() : null,
      ]
        .filter(Boolean)
        .join(' | ');

      const payload = {
        name: name.trim(),
        company: company.trim() || null,
        phone: phone.trim(),
        email: email.trim() || null,
        address: address.trim() || null,
        notes: combinedNotes || null,
        status: 'active',
        work_types: selectedWorkTypes.length > 0 ? selectedWorkTypes.join(', ') : null,
        assigned_to: assignedEmployee || user?.name || user?.id || null,
        created_at: arrivingDate ? new Date(arrivingDate).toISOString() : new Date().toISOString(),
      };

      const { data, error } = await supabase.from('clients').insert([payload]).select();

      if (error) throw error;

      const clientId = data?.[0]?.id;
      await createNotification({
        title: 'New Client Onboarded',
        message: `${user?.name || 'A team member'} added client: "${name.trim()}"`,
        module: 'client',
        referenceId: clientId,
        recipientRole: 'All_Staff',
        createdByName: user?.name || 'Staff',
      });

      Alert.alert('Success', 'Client added successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save client.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color={Colors.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add New Client</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Identity & Contact */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <User color={Colors.primary} size={18} />
              <Text style={styles.sectionTitle}>Client Identification</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Company / Legal Entity (Optional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter organization or firm name"
                value={company}
                onChangeText={setCompany}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Primary Contact Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter client full name"
                value={name}
                onChangeText={setName}
              />
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                <Text style={styles.label}>Phone Number *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Primary phone"
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="client@mail.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                <Text style={styles.label}>GST / PAN (Tax ID)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="GSTIN or PAN"
                  value={gst}
                  onChangeText={setGst}
                  autoCapitalize="characters"
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Arriving Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={arrivingDate}
                  onChangeText={setArrivingDate}
                />
              </View>
            </View>
          </View>

          {/* Acquisition Source */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Share2 color={Colors.primary} size={18} />
              <Text style={styles.sectionTitle}>Client Source</Text>
            </View>
            <View style={styles.pillsRow}>
              {CLIENT_SOURCES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.pillBtn,
                    source === s && { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
                  ]}
                  onPress={() => setSource(s)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      source === s && { color: '#FFFFFF', fontWeight: 'bold' },
                    ]}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Assigned Team Member */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Users color={Colors.primary} size={18} />
              <Text style={styles.sectionTitle}>Assign Team Member</Text>
            </View>
            <Text style={styles.subtext}>
              Assign this client to a relationship manager or project executive:
            </Text>
            <View style={styles.pillsRow}>
              {employees.map((emp) => {
                const isSelected = assignedEmployee === emp.name || assignedEmployee === emp.id;
                return (
                  <TouchableOpacity
                    key={emp.id}
                    style={[
                      styles.pillBtn,
                      isSelected && { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
                    ]}
                    onPress={() => setAssignedEmployee(emp.name)}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        isSelected && { color: '#FFFFFF', fontWeight: 'bold' },
                      ]}
                    >
                      {emp.name} ({emp.designation || emp.role || 'Staff'})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Services & Projects Interest */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Briefcase color={Colors.primary} size={18} />
              <Text style={styles.sectionTitle}>
                Services & Projects Enrolled ({selectedWorkTypes.length} selected)
              </Text>
            </View>
            <Text style={styles.subtext}>
              Check the service or project types this client engages in (Syncs with Web CRM):
            </Text>

            <Text style={styles.categoryHeader}>Consultancy & Design Services</Text>
            <View style={{ gap: 6, marginBottom: 12 }}>
              {DESIGN_SERVICES.map((srv) => {
                const checked = selectedWorkTypes.includes(srv);
                return (
                  <TouchableOpacity
                    key={srv}
                    style={[styles.checkboxItem, checked && styles.checkboxItemActive]}
                    onPress={() => toggleWorkType(srv)}
                  >
                    {checked ? (
                      <CheckCircle2 size={18} color={Colors.success} />
                    ) : (
                      <Circle size={18} color={Colors.textMuted} />
                    )}
                    <Text style={[styles.checkboxLabel, checked && styles.checkboxLabelActive]}>
                      {srv}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.categoryHeader}>Construction & Execution Projects</Text>
            <View style={{ gap: 6 }}>
              {EXECUTION_PROJECTS.map((prj) => {
                const checked = selectedWorkTypes.includes(prj);
                return (
                  <TouchableOpacity
                    key={prj}
                    style={[styles.checkboxItem, checked && styles.checkboxItemActive]}
                    onPress={() => toggleWorkType(prj)}
                  >
                    {checked ? (
                      <CheckCircle2 size={18} color={Colors.success} />
                    ) : (
                      <Circle size={18} color={Colors.textMuted} />
                    )}
                    <Text style={[styles.checkboxLabel, checked && styles.checkboxLabelActive]}>
                      {prj}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Billing Address & Remarks */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <MapPin color={Colors.primary} size={18} />
              <Text style={styles.sectionTitle}>Billing & Location Details</Text>
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Official Billing Address</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                placeholder="Enter complete postal/billing address..."
                multiline
                value={address}
                onChangeText={setAddress}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Internal Notes / Special Instructions</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Client preferences, payment terms, etc..."
                multiline
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()} disabled={isSubmitting}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, isSubmitting && { opacity: 0.6 }]}
            onPress={handleSaveClient}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Add Client</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  scrollContent: { padding: 16, paddingBottom: 40 },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: Colors.primaryDark, marginLeft: 8 },
  subtext: { fontSize: 12, color: Colors.textMuted, marginBottom: 10 },
  categoryHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 6,
    marginBottom: 6,
  },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '600', color: Colors.text, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  row: { flexDirection: 'row' },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  pillText: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  checkboxItemActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  checkboxLabel: { fontSize: 13, color: Colors.text, fontWeight: '500' },
  checkboxLabelActive: { color: '#166534', fontWeight: 'bold' },
  footer: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
    marginRight: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: Colors.text },
  saveBtn: {
    flex: 2,
    backgroundColor: Colors.primaryDark,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 8,
  },
  saveBtnText: { fontSize: 15, fontWeight: 'bold', color: '#FFFFFF' },
});

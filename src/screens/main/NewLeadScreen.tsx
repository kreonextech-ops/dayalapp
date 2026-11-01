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
  Briefcase,
  FileText,
  Phone,
  MessageSquare,
  Mail,
  CheckCircle2,
  Circle,
  Flame,
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

const LEAD_SOURCES = [
  'Direct Call',
  'WhatsApp',
  'Facebook',
  'Instagram',
  'Google Ads',
  'Google Maps (GMB)',
  'Website',
  'Referral',
  'Walk-in',
  'Site Signboard',
  'Exhibition / Event',
  'Other',
];

const LEAD_STATUSES = ['New', 'Contacted', 'Ongoing', 'Won', 'Lost'];

const LEAD_TEMPERATURES = [
  { id: 'Hot Lead', label: 'Hot Lead 🔥', color: '#DC2626', bg: '#FEE2E2' },
  { id: 'Warm Lead', label: 'Warm Lead ☀️', color: '#D97706', bg: '#FEF3C7' },
  { id: 'Cold Lead', label: 'Cold Lead ❄️', color: '#2563EB', bg: '#EFF6FF' },
];

export default function NewLeadScreen({ navigation }: any) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('Direct Call');
  const [status, setStatus] = useState('New');
  const [temperature, setTemperature] = useState('Warm Lead');
  const [address, setAddress] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
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

  const toggleService = (srv: string) => {
    setSelectedServices((prev) => {
      if (prev.includes(srv)) return prev.filter((s) => s !== srv);
      return [...prev, srv];
    });
  };

  const handleSaveLead = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Please enter lead full name.');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Required', 'Please enter contact phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const mappedService =
        selectedServices.length > 0 ? selectedServices.join(', ') : 'General Enquiry';

      const finalNotes = [
        whatsapp.trim() ? `WhatsApp: ${whatsapp.trim()}` : null,
        temperature ? `Temperature: ${temperature}` : null,
        notes.trim() ? notes.trim() : null,
      ]
        .filter(Boolean)
        .join('\n');

      const payload = {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        source: source.trim(),
        status: status.trim(),
        address: address.trim() || null,
        service_type: mappedService,
        lead_temperature: temperature.replace(' Lead', ''),
        notes: finalNotes || null,
        assigned_to: assignedEmployee || user?.name || null,
      };

      const { data, error } = await supabase.from('leads').insert([payload]).select();

      if (error) throw error;

      const leadId = data?.[0]?.id;
      await createNotification({
        title: 'New Lead Added',
        message: `${user?.name || 'A team member'} added lead: "${name.trim()}" (${mappedService})`,
        module: 'lead',
        referenceId: leadId,
        recipientRole: 'All_Staff',
        createdByName: user?.name || 'Staff',
      });

      Alert.alert('Success', 'Lead created successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to save lead.');
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
          <Text style={styles.headerTitle}>New Lead</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Lead Contact Info */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <User color={Colors.primary} size={18} />
              <Text style={styles.sectionTitle}>Contact Details</Text>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
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
                <Text style={styles.label}>WhatsApp</Text>
                <TextInput
                  style={styles.input}
                  placeholder="WhatsApp number"
                  keyboardType="phone-pad"
                  value={whatsapp}
                  onChangeText={setWhatsapp}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                placeholder="client@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Site / Residential Address</Text>
              <TextInput
                style={[styles.input, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Address or location details..."
                multiline
                value={address}
                onChangeText={setAddress}
              />
            </View>
          </View>

          {/* Lead Classification & Status */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Flame color={Colors.primary} size={18} />
              <Text style={styles.sectionTitle}>Status & Temperature</Text>
            </View>

            <Text style={styles.label}>Lead Temperature</Text>
            <View style={styles.pillsRow}>
              {LEAD_TEMPERATURES.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.pillBtn,
                    temperature === t.id && { backgroundColor: t.bg, borderColor: t.color },
                  ]}
                  onPress={() => setTemperature(t.id)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      temperature === t.id && { color: t.color, fontWeight: 'bold' },
                    ]}
                  >
                    {t.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>Current Pipeline Status</Text>
            <View style={styles.pillsRow}>
              {LEAD_STATUSES.map((st) => (
                <TouchableOpacity
                  key={st}
                  style={[
                    styles.pillBtn,
                    status === st && { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
                  ]}
                  onPress={() => setStatus(st)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      status === st && { color: '#FFFFFF', fontWeight: 'bold' },
                    ]}
                  >
                    {st}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.label, { marginTop: 12 }]}>Lead Source</Text>
            <View style={styles.pillsRow}>
              {LEAD_SOURCES.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.pillBtn,
                    source === s && { backgroundColor: Colors.primary, borderColor: Colors.primary },
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
              Assign this lead to an executive or relationship manager:
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

          {/* Service Requirements (11 Design Services + 6 Execution Projects) */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Briefcase color={Colors.primary} size={18} />
              <Text style={styles.sectionTitle}>
                Services & Projects ({selectedServices.length} selected)
              </Text>
            </View>
            <Text style={styles.subtext}>
              Select the client's areas of interest (Mirroring Web CRM catalog):
            </Text>

            <Text style={styles.categoryHeader}>Consultancy & Design Services</Text>
            <View style={{ gap: 6, marginBottom: 12 }}>
              {DESIGN_SERVICES.map((srv) => {
                const checked = selectedServices.includes(srv);
                return (
                  <TouchableOpacity
                    key={srv}
                    style={[styles.checkboxItem, checked && styles.checkboxItemActive]}
                    onPress={() => toggleService(srv)}
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
                const checked = selectedServices.includes(prj);
                return (
                  <TouchableOpacity
                    key={prj}
                    style={[styles.checkboxItem, checked && styles.checkboxItemActive]}
                    onPress={() => toggleService(prj)}
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

          {/* Additional Notes */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <FileText color={Colors.primary} size={18} />
              <Text style={styles.sectionTitle}>Enquiry Remarks & Observations</Text>
            </View>
            <View style={styles.inputGroup}>
              <TextInput
                style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                placeholder="Initial client budget, preferred design style, meeting notes..."
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
            onPress={handleSaveLead}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Save Lead</Text>
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
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
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

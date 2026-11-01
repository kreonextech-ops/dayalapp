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
  Modal,
} from 'react-native';
import {
  ArrowLeft,
  User,
  Calendar,
  IndianRupee,
  Briefcase,
  CheckCircle2,
  Circle,
  ChevronDown,
  Check,
  Users,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { createNotification } from '../../lib/notificationService';

const EXECUTION_PROJECTS = [
  'Construction',
  'Commercial Construction',
  'Industrial Setup',
  'Renovation & Remodeling',
  'Interior Execution',
  'Landscaping',
];

export default function NewProjectScreen({ navigation, route }: any) {
  const { user } = useAuth();
  const preselectedClientId = route?.params?.clientId;

  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientSearch, setClientSearch] = useState('');

  const [selectedProjects, setSelectedProjects] = useState<string[]>(['Construction']);
  const [projectCharge, setProjectCharge] = useState('');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetDate, setTargetDate] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [assignedEmployee, setAssignedEmployee] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchClients();
    fetchEmployees();
  }, []);

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

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('id, name, phone, address')
        .order('name', { ascending: true });
      if (error) throw error;
      setClients(data || []);

      if (preselectedClientId && data) {
        const found = data.find((c: any) => c.id === preselectedClientId);
        if (found) setSelectedClient(found);
      }
    } catch (e: any) {
      console.warn('Error fetching clients', e.message);
    }
  };

  const toggleProject = (item: string) => {
    setSelectedProjects((prev) => {
      if (prev.includes(item)) return prev.filter((p) => p !== item);
      return [...prev, item];
    });
  };

  const handleCreateProject = async () => {
    if (!selectedClient) {
      Alert.alert('Required', 'Please select a client for this project.');
      return;
    }
    if (selectedProjects.length === 0) {
      Alert.alert('Required', 'Please select at least one execution scope.');
      return;
    }

    setIsSubmitting(true);
    try {
      const title =
        selectedProjects.length > 0
          ? selectedProjects[0] + (selectedProjects.length > 1 ? ' & Others' : '')
          : 'Construction Project';

      const totalVal = parseFloat(projectCharge) || 0;
      const advVal = parseFloat(advanceAmount) || 0;

      const metadata: any = {
        requirements: selectedProjects,
        financials: {
          total: totalVal,
          advance: advVal,
          targetDate: targetDate.trim(),
        },
        payments:
          advVal > 0
            ? [
                {
                  id: Date.now(),
                  amount: advVal,
                  date: new Date().toISOString().split('T')[0],
                  mode: 'Advance Booking',
                  note: 'Initial project advance',
                  recorded_by: user?.name || 'Staff',
                },
              ]
            : [],
        notes: notes.trim(),
        timeline: targetDate.trim(),
      };

      const payload = {
        client_id: selectedClient.id,
        name: title,
        budget: totalVal,
        start_date: startDate || null,
        end_date: targetDate || null,
        location: location.trim() || selectedClient.address || null,
        description: JSON.stringify(metadata),
        status: 'Active',
        assigned_to: assignedEmployee || user?.name || null,
      };

      const { data, error } = await supabase.from('projects').insert([payload]).select();
      if (error) throw error;

      const projId = data?.[0]?.id;
      await createNotification({
        title: 'New Project Created',
        message: `${user?.name || 'A team member'} created project: "${title}" for ${selectedClient.name}`,
        module: 'project',
        referenceId: projId,
        recipientRole: 'All_Staff',
        createdByName: user?.name || 'Staff',
      });

      Alert.alert('Success', 'Project created successfully!', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredClients = clients.filter(
    (c) =>
      c.name?.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.phone?.includes(clientSearch)
  );

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <ArrowLeft color={Colors.text} size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>New Project</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          {/* Client Selection */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <User color={Colors.primary} size={18} />
              <Text style={styles.sectionTitle}>Client Assignment *</Text>
            </View>

            <TouchableOpacity
              style={styles.clientSelector}
              onPress={() => setIsClientModalOpen(true)}
            >
              <View style={{ flex: 1 }}>
                <Text style={selectedClient ? styles.clientSelectedText : styles.clientPlaceholderText}>
                  {selectedClient ? selectedClient.name : 'Tap to select an existing client...'}
                </Text>
                {selectedClient?.phone && (
                  <Text style={styles.clientSubText}>
                    Phone: {selectedClient.phone} {selectedClient.address ? `• ${selectedClient.address}` : ''}
                  </Text>
                )}
              </View>
              <ChevronDown size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Project Scopes */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Briefcase color={Colors.primary} size={18} />
              <Text style={styles.sectionTitle}>
                Execution Scopes * ({selectedProjects.length} selected)
              </Text>
            </View>
            <Text style={styles.subtext}>
              Select the turnkey construction or execution categories:
            </Text>

            <View style={{ gap: 8, marginTop: 8 }}>
              {EXECUTION_PROJECTS.map((prj) => {
                const checked = selectedProjects.includes(prj);
                return (
                  <TouchableOpacity
                    key={prj}
                    style={[styles.checkboxItem, checked && styles.checkboxItemActive]}
                    onPress={() => toggleProject(prj)}
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

          {/* Site & Commercial Details */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <IndianRupee color={Colors.primary} size={18} />
              <Text style={styles.sectionTitle}>Commercials & Schedule</Text>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                <Text style={styles.label}>Total Contract Budget (₹)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 3500000"
                  keyboardType="numeric"
                  value={projectCharge}
                  onChangeText={setProjectCharge}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Advance Received (₹)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. 500000"
                  keyboardType="numeric"
                  value={advanceAmount}
                  onChangeText={setAdvanceAmount}
                />
              </View>
            </View>

            <View style={styles.row}>
              <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                <Text style={styles.label}>Commencement Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={startDate}
                  onChangeText={setStartDate}
                />
              </View>
              <View style={[styles.inputGroup, { flex: 1 }]}>
                <Text style={styles.label}>Target Handover Date</Text>
                <TextInput
                  style={styles.input}
                  placeholder="YYYY-MM-DD"
                  value={targetDate}
                  onChangeText={setTargetDate}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Site Location / Address</Text>
              <TextInput
                style={styles.input}
                placeholder="Plot / Site location"
                value={location}
                onChangeText={setLocation}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Scope Remarks & Specifications</Text>
              <TextInput
                style={[styles.input, { height: 70, textAlignVertical: 'top' }]}
                placeholder="e.g. Turnkey RCC with Vitrified tiles, 12 months milestone..."
                value={notes}
                onChangeText={setNotes}
                multiline
              />
            </View>

            {/* Assigned Engineering Team Member */}
            <View style={[styles.inputGroup, { marginTop: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Users size={16} color={Colors.primary} />
                <Text style={[styles.label, { marginBottom: 0 }]}>Assign Engineering Lead</Text>
              </View>
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
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()} disabled={isSubmitting}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, isSubmitting && { opacity: 0.6 }]}
            onPress={handleCreateProject}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.saveBtnText}>Create Project</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Client Selection Modal */}
        <Modal
          visible={isClientModalOpen}
          animationType="slide"
          transparent
          onRequestClose={() => setIsClientModalOpen(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: '80%' }]}>
              <Text style={styles.modalTitle}>Select Client</Text>
              <TextInput
                style={[styles.input, { marginVertical: 12 }]}
                placeholder="Search by client name or phone..."
                value={clientSearch}
                onChangeText={setClientSearch}
                autoFocus
              />

              <ScrollView showsVerticalScrollIndicator={false}>
                {filteredClients.map((c) => {
                  const isSelected = selectedClient?.id === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.clientRow, isSelected && { backgroundColor: '#F0FDF4' }]}
                      onPress={() => {
                        setSelectedClient(c);
                        setIsClientModalOpen(false);
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.clientRowName, isSelected && { color: Colors.success }]}>
                          {c.name}
                        </Text>
                        <Text style={styles.clientRowPhone}>
                          {c.phone || 'No phone'} {c.address ? `• ${c.address}` : ''}
                        </Text>
                      </View>
                      {isSelected && <Check size={18} color={Colors.success} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity
                style={[styles.cancelBtn, { marginTop: 16 }]}
                onPress={() => setIsClientModalOpen(false)}
              >
                <Text style={styles.cancelBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
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
  subtext: { fontSize: 12, color: Colors.textMuted, marginBottom: 8 },
  clientSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.background,
  },
  clientSelectedText: { fontSize: 15, fontWeight: 'bold', color: Colors.text },
  clientPlaceholderText: { fontSize: 14, color: Colors.textMuted },
  clientSubText: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  checkboxItemActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  checkboxLabel: { fontSize: 14, color: Colors.text, fontWeight: '500' },
  checkboxLabelActive: { color: '#166534', fontWeight: 'bold' },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.text },
  clientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    borderRadius: 6,
  },
  clientRowName: { fontSize: 14, fontWeight: 'bold', color: Colors.text },
  clientRowPhone: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  pillBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  pillText: {
    fontSize: 12,
    color: Colors.text,
  },
});

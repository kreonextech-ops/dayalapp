import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Users,
  Briefcase,
  CheckCircle2,
  Circle,
  Plus,
  Search,
  Calendar,
  Layers,
  ChevronDown,
  Check,
  UserCheck,
  User,
  Clock,
  Sparkles,
  ExternalLink,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { createNotification } from '../../lib/notificationService';

const ASSIGN_TYPES = [
  'Task',
  'Follow Up',
  'Lead',
  'Client',
  'Consultancy Service',
  'Construction Project',
];

export default function AssignmentsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = insets.top || (Platform.OS === 'ios' ? 44 : 20);
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin' || user?.role === 'CRO';

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'My Work' | 'Team Overview'>('My Work');
  const [filterEmployee, setFilterEmployee] = useState<string>('All');

  // Delegation Card State
  const [assignType, setAssignType] = useState('Task');
  const [assignRecordId, setAssignRecordId] = useState('');
  const [assignRecordLabel, setAssignRecordLabel] = useState('');
  const [assignEmployee, setAssignEmployee] = useState<any>(null);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignDesc, setAssignDesc] = useState('');
  const [assignDueDate, setAssignDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available records for search
  const [availableRecords, setAvailableRecords] = useState<any[]>([]);
  const [recordSearch, setRecordSearch] = useState('');
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);

  // Lists of assigned data
  const [assignedLeads, setAssignedLeads] = useState<any[]>([]);
  const [assignedClients, setAssignedClients] = useState<any[]>([]);
  const [assignedServices, setAssignedServices] = useState<any[]>([]);
  const [assignedProjects, setAssignedProjects] = useState<any[]>([]);
  const [assignedTasks, setAssignedTasks] = useState<any[]>([]);

  useEffect(() => {
    loadAllData();
  }, []);

  useEffect(() => {
    fetchAvailableRecords();
  }, [assignType]);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [empRes, leadsRes, clientsRes, servRes, projRes, taskRes] = await Promise.all([
        supabase.from('employees').select('*').order('name'),
        supabase.from('leads').select('*').order('created_at', { ascending: false }),
        supabase.from('clients').select('*').order('created_at', { ascending: false }),
        supabase.from('services').select('*').order('created_at', { ascending: false }),
        supabase.from('projects').select('*').order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').order('created_at', { ascending: false }),
      ]);

      const emps = empRes.data || [];
      setEmployees(emps);
      setAssignedLeads(leadsRes.data || []);
      setAssignedClients(clientsRes.data || []);
      setAssignedServices(servRes.data || []);
      setAssignedProjects(projRes.data || []);
      setAssignedTasks(taskRes.data || []);

      if (user?.name) {
        const found = emps.find((e: any) => e.name === user.name || e.id === user.id);
        if (found) setAssignEmployee(found);
        else if (emps.length > 0) setAssignEmployee(emps[0]);
      } else if (emps.length > 0) {
        setAssignEmployee(emps[0]);
      }
    } catch (e: any) {
      console.warn('Error loading assignment workflow data:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchAvailableRecords = async () => {
    setAssignRecordId('');
    setAssignRecordLabel('');
    if (assignType === 'Task' || assignType === 'Follow Up') {
      setAvailableRecords([]);
      return;
    }

    try {
      let table = 'leads';
      let cols = 'id, name, phone';
      if (assignType === 'Client') {
        table = 'clients';
        cols = 'id, name, company';
      } else if (assignType === 'Consultancy Service') {
        table = 'services';
        cols = 'id, title, name, assigned_to';
      } else if (assignType === 'Construction Project') {
        table = 'projects';
        cols = 'id, name, title, assigned_to';
      }

      const { data } = await supabase.from(table).select(cols).limit(100);
      if (data) {
        setAvailableRecords(
          data.map((d: any) => ({
            id: d.id,
            label: d.title || d.name || 'Untitled',
            sub: d.phone || d.company || '',
            raw: d,
          }))
        );
      }
    } catch (e: any) {
      console.warn('Error fetching selectable records:', e.message);
    }
  };

  const handleExecuteAssign = async () => {
    if (!assignEmployee) {
      Alert.alert('Required', 'Please choose a team member to assign.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (assignType === 'Task' || assignType === 'Follow Up') {
        if (!assignTitle.trim()) {
          Alert.alert('Required', 'Please enter a title for this assignment.');
          setIsSubmitting(false);
          return;
        }

        const payload = {
          title: assignTitle.trim(),
          name: assignTitle.trim(),
          description: assignDesc.trim() || null,
          assignee_id: assignEmployee.id,
          creator_id: user?.id || null,
          status: 'To Do',
          category: 'General',
          custom_category: assignType === 'Follow Up' ? 'Follow Up' : null,
          due_date: assignDueDate ? new Date(assignDueDate).toISOString() : null,
        };

        const { error } = await supabase.from('tasks').insert([payload]);
        if (error) throw error;

        await createNotification({
          title: `New ${assignType} Assigned`,
          message: `${user?.name || 'Admin'} assigned you "${assignTitle.trim()}"`,
          module: 'task',
          recipientUserId: assignEmployee.id,
          recipientRole: 'Employee',
          createdByName: user?.name,
        });

        Alert.alert('Success', `${assignType} delegated to ${assignEmployee.name}!`);
      } else {
        if (!assignRecordId) {
          Alert.alert('Required', `Please select the ${assignType} to assign.`);
          setIsSubmitting(false);
          return;
        }

        let table = 'leads';
        if (assignType === 'Client') table = 'clients';
        if (assignType === 'Consultancy Service') table = 'services';
        if (assignType === 'Construction Project') table = 'projects';

        const { data: recData, error: fetchErr } = await supabase
          .from(table)
          .select('assigned_to')
          .eq('id', assignRecordId)
          .single();
        if (fetchErr) throw fetchErr;

        let current = (recData?.assigned_to || '')
          .split(',')
          .map((s: string) => s.trim())
          .filter(Boolean);

        const targetIdentifier = assignEmployee.name || assignEmployee.id;
        if (!current.includes(targetIdentifier)) {
          current.push(targetIdentifier);
        }

        const updatedAssigned = current.join(', ');
        const { error: updErr } = await supabase
          .from(table)
          .update({ assigned_to: updatedAssigned })
          .eq('id', assignRecordId);
        if (updErr) throw updErr;

        await createNotification({
          title: `${assignType} Assigned`,
          message: `${user?.name || 'Admin'} delegated ${assignRecordLabel} to ${assignEmployee.name}`,
          module: (assignType === 'Lead' ? 'lead' : assignType === 'Client' ? 'client' : 'project') as any,
          referenceId: assignRecordId,
          recipientUserId: assignEmployee.id,
          recipientRole: 'Employee',
          createdByName: user?.name,
        });

        Alert.alert('Delegated', `Successfully assigned ${assignRecordLabel} to ${assignEmployee.name}!`);
      }

      setAssignTitle('');
      setAssignDesc('');
      setAssignRecordId('');
      setAssignRecordLabel('');
      loadAllData();
    } catch (e: any) {
      Alert.alert('Assignment Failed', e.message || 'Could not complete assignment');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTargetFilterName = () => {
    if (activeTab === 'My Work') {
      return (user?.name || '').toLowerCase();
    }
    if (filterEmployee === 'All') return null;
    return filterEmployee.toLowerCase();
  };

  const currentFilter = getTargetFilterName();

  const filterMatches = (assignedField: string | null | undefined) => {
    if (!currentFilter) return true;
    if (!assignedField) return false;
    const lower = assignedField.toLowerCase();
    return lower.includes(currentFilter);
  };

  const displayedLeads = assignedLeads.filter((l) => filterMatches(l.assigned_to));
  const displayedClients = assignedClients.filter((c) => filterMatches(c.assigned_to));
  const displayedServices = assignedServices.filter((s) => filterMatches(s.assigned_to));
  const displayedProjects = assignedProjects.filter((p) => filterMatches(p.assigned_to));
  const displayedTasks = assignedTasks.filter((t) => {
    if (!currentFilter) return true;
    if (activeTab === 'My Work') {
      return t.assignee_id === user?.id || (t.assignee_name && t.assignee_name.toLowerCase().includes(currentFilter));
    }
    const empObj = employees.find((e) => e.name.toLowerCase() === currentFilter);
    return t.assignee_id === empObj?.id || (t.assignee_name && t.assignee_name.toLowerCase().includes(currentFilter));
  });

  const totalAssignedItems =
    displayedLeads.length +
    displayedClients.length +
    displayedServices.length +
    displayedProjects.length +
    displayedTasks.length;

  return (
    <SafeAreaView style={[styles.container, { paddingTop: safeTop }]}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle}>Assignment Workflow</Text>
          <Text style={styles.topSubtitle}>Team Allocation & Delegation Engine</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadAllData}>
          <Text style={styles.refreshBtnText}>Sync</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAllData(); }} />}
      >
        {/* Quick Assign & Delegate Card */}
        <View style={styles.delegateCard}>
          <View style={styles.delegateHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Sparkles size={18} color={Colors.primary} />
              <Text style={styles.delegateTitle}>Quick Assign & Delegate</Text>
            </View>
            <View style={styles.liveSyncBadge}>
              <Text style={styles.liveSyncText}>Live Supabase Sync</Text>
            </View>
          </View>
          <Text style={styles.delegateSub}>
            Assign new Leads, Clients, Projects or delegate Tasks & Follow-ups to staff.
          </Text>

          {/* Type Picker */}
          <Text style={styles.inputLabel}>What to Assign?</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typesRow}>
            {ASSIGN_TYPES.map((type) => {
              const active = assignType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.typeChip, active && styles.typeChipActive]}
                  onPress={() => setAssignType(type)}
                >
                  <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* Form Fields Depending on Type */}
          {assignType === 'Task' || assignType === 'Follow Up' ? (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.inputLabel}>Title / Subject *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="What needs to be done?"
                value={assignTitle}
                onChangeText={setAssignTitle}
              />

              <Text style={styles.inputLabel}>Instructions / Remarks</Text>
              <TextInput
                style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
                placeholder="Provide details and instructions for the assignee..."
                value={assignDesc}
                onChangeText={setAssignDesc}
                multiline
              />

              <Text style={styles.inputLabel}>Due Date</Text>
              <TextInput
                style={styles.textInput}
                placeholder="YYYY-MM-DD"
                value={assignDueDate}
                onChangeText={setAssignDueDate}
              />
            </View>
          ) : (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.inputLabel}>Select {assignType} Record *</Text>
              <TouchableOpacity
                style={styles.selectorBtn}
                onPress={() => setIsRecordModalOpen(true)}
              >
                <Text style={assignRecordLabel ? styles.selectorText : styles.selectorPlaceholder}>
                  {assignRecordLabel || `Search & Select ${assignType}...`}
                </Text>
                <ChevronDown size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
          )}

          {/* Employee Target */}
          <Text style={styles.inputLabel}>Assign To Team Member *</Text>
          <TouchableOpacity
            style={styles.selectorBtn}
            onPress={() => setIsEmployeeModalOpen(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={styles.empMiniAvatar}>
                <Text style={styles.empMiniAvatarText}>
                  {assignEmployee?.name?.charAt(0) || 'U'}
                </Text>
              </View>
              <View>
                <Text style={styles.selectorText}>{assignEmployee?.name || 'Select Employee...'}</Text>
                <Text style={styles.empMiniSub}>
                  {assignEmployee?.designation || assignEmployee?.role || 'Dayal Team Member'}
                </Text>
              </View>
            </View>
            <ChevronDown size={18} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* Submit Action */}
          <TouchableOpacity
            style={[styles.assignSubmitBtn, isSubmitting && { opacity: 0.6 }]}
            onPress={handleExecuteAssign}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <UserCheck size={18} color="#FFFFFF" />
                <Text style={styles.assignSubmitText}>Confirm & Delegate Assignment</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Tab Toggle: My Work vs All Team */}
        <View style={styles.tabToggleRow}>
          <TouchableOpacity
            style={[styles.tabToggleBtn, activeTab === 'My Work' && styles.tabToggleBtnActive]}
            onPress={() => setActiveTab('My Work')}
          >
            <Text style={[styles.tabToggleText, activeTab === 'My Work' && styles.tabToggleTextActive]}>
              My Assignments
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabToggleBtn, activeTab === 'Team Overview' && styles.tabToggleBtnActive]}
            onPress={() => setActiveTab('Team Overview')}
          >
            <Text style={[styles.tabToggleText, activeTab === 'Team Overview' && styles.tabToggleTextActive]}>
              Team Directory Overview
            </Text>
          </TouchableOpacity>
        </View>

        {/* Employee Filter Bar if Team Overview */}
        {activeTab === 'Team Overview' && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.empFilterRow}>
            <TouchableOpacity
              style={[styles.empFilterChip, filterEmployee === 'All' && styles.empFilterChipActive]}
              onPress={() => setFilterEmployee('All')}
            >
              <Text style={[styles.empFilterText, filterEmployee === 'All' && styles.empFilterTextActive]}>
                All Staff
              </Text>
            </TouchableOpacity>
            {employees.map((emp) => (
              <TouchableOpacity
                key={emp.id}
                style={[styles.empFilterChip, filterEmployee === emp.name && styles.empFilterChipActive]}
                onPress={() => setFilterEmployee(emp.name)}
              >
                <Text style={[styles.empFilterText, filterEmployee === emp.name && styles.empFilterTextActive]}>
                  {emp.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Total Summary Strip */}
        <View style={styles.summaryStrip}>
          <Text style={styles.summaryLabel}>
            Showing assignments for:{' '}
            <Text style={{ fontWeight: 'bold', color: Colors.primaryDark }}>
              {activeTab === 'My Work' ? user?.name || 'You' : filterEmployee}
            </Text>
          </Text>
          <Text style={styles.summaryCount}>{totalAssignedItems} records</Text>
        </View>

        {/* Section: Assigned Leads */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderFlex}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <User size={16} color={Colors.primary} />
              <Text style={styles.sectionTitle}>Assigned Leads ({displayedLeads.length})</Text>
            </View>
          </View>
          {displayedLeads.length > 0 ? (
            displayedLeads.map((lead) => (
              <TouchableOpacity
                key={lead.id}
                style={styles.itemRow}
                onPress={() => navigation.navigate('LeadDetails', { id: lead.id })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{lead.name}</Text>
                  <Text style={styles.itemSub}>{lead.phone || 'No phone'} • {lead.service_type || 'General'}</Text>
                  <Text style={styles.itemAssigned}>Assigned: {lead.assigned_to || 'General Team'}</Text>
                </View>
                <View style={styles.badgeWrap}>
                  <Text style={styles.badgeText}>{lead.status || 'New'}</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyNote}>No leads assigned in this view.</Text>
          )}
        </View>

        {/* Section: Assigned Clients */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderFlex}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Users size={16} color="#3B82F6" />
              <Text style={styles.sectionTitle}>Assigned Clients ({displayedClients.length})</Text>
            </View>
          </View>
          {displayedClients.length > 0 ? (
            displayedClients.map((c) => (
              <TouchableOpacity
                key={c.id}
                style={styles.itemRow}
                onPress={() => navigation.navigate('ClientDetails', { id: c.id })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{c.name}</Text>
                  <Text style={styles.itemSub}>{c.company || c.phone || 'Client Workspace'}</Text>
                  <Text style={styles.itemAssigned}>Assigned: {c.assigned_to || 'Staff'}</Text>
                </View>
                <View style={[styles.badgeWrap, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                  <Text style={[styles.badgeText, { color: '#1E40AF' }]}>{c.status || 'Active'}</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyNote}>No clients assigned in this view.</Text>
          )}
        </View>

        {/* Section: Assigned Services */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderFlex}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Layers size={16} color="#059669" />
              <Text style={styles.sectionTitle}>Consultancy Cases ({displayedServices.length})</Text>
            </View>
          </View>
          {displayedServices.length > 0 ? (
            displayedServices.map((srv) => (
              <TouchableOpacity
                key={srv.id}
                style={styles.itemRow}
                onPress={() => navigation.navigate('ServiceDetails', { id: srv.id })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{srv.title || srv.name}</Text>
                  <Text style={styles.itemSub}>Case ID: #{srv.id.substring(0, 6).toUpperCase()}</Text>
                  <Text style={styles.itemAssigned}>Assigned: {srv.assigned_to || 'Design Team'}</Text>
                </View>
                <View style={[styles.badgeWrap, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                  <Text style={[styles.badgeText, { color: '#065F46' }]}>{srv.status || 'Active'}</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyNote}>No consultancy services assigned.</Text>
          )}
        </View>

        {/* Section: Assigned Projects */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderFlex}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Briefcase size={16} color="#D97706" />
              <Text style={styles.sectionTitle}>Construction Projects ({displayedProjects.length})</Text>
            </View>
          </View>
          {displayedProjects.length > 0 ? (
            displayedProjects.map((prj) => (
              <TouchableOpacity
                key={prj.id}
                style={styles.itemRow}
                onPress={() => navigation.navigate('ProjectDetails', { id: prj.id })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{prj.name || prj.title}</Text>
                  <Text style={styles.itemSub}>Budget: ₹{(prj.budget || 0).toLocaleString('en-IN')}</Text>
                  <Text style={styles.itemAssigned}>Engineers: {prj.assigned_to || 'Project Team'}</Text>
                </View>
                <View style={[styles.badgeWrap, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                  <Text style={[styles.badgeText, { color: '#B45309' }]}>{prj.status || 'Active'}</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyNote}>No projects assigned.</Text>
          )}
        </View>

        {/* Section: Tasks & Follow-ups */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeaderFlex}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Clock size={16} color="#7C3AED" />
              <Text style={styles.sectionTitle}>Tasks & Action Items ({displayedTasks.length})</Text>
            </View>
          </View>
          {displayedTasks.length > 0 ? (
            displayedTasks.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={styles.itemRow}
                onPress={() => navigation.navigate('TaskDetails', { id: t.id })}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{t.title || t.name}</Text>
                  <Text style={styles.itemSub}>{t.description || 'Action assignment'}</Text>
                  <Text style={styles.itemAssigned}>Due: {t.due_date ? t.due_date.split('T')[0] : 'Flexible'}</Text>
                </View>
                <View style={[styles.badgeWrap, { backgroundColor: '#F5F3FF', borderColor: '#DDD6FE' }]}>
                  <Text style={[styles.badgeText, { color: '#6D28D9' }]}>{t.status || 'To Do'}</Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyNote}>No tasks or follow-ups pending.</Text>
          )}
        </View>
      </ScrollView>

      {/* Select Record Modal */}
      <Modal visible={isRecordModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Select {assignType}</Text>
            <TextInput
              style={[styles.textInput, { marginVertical: 10 }]}
              placeholder={`Search ${assignType}...`}
              value={recordSearch}
              onChangeText={setRecordSearch}
              autoFocus
            />
            <ScrollView showsVerticalScrollIndicator={false}>
              {availableRecords
                .filter((r) => r.label.toLowerCase().includes(recordSearch.toLowerCase()))
                .map((r) => (
                  <TouchableOpacity
                    key={r.id}
                    style={[
                      styles.recordOption,
                      assignRecordId === r.id && { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
                    ]}
                    onPress={() => {
                      setAssignRecordId(r.id);
                      setAssignRecordLabel(r.label);
                      setIsRecordModalOpen(false);
                    }}
                  >
                    <Text style={styles.recordOptionLabel}>{r.label}</Text>
                    {r.sub ? <Text style={styles.recordOptionSub}>{r.sub}</Text> : null}
                  </TouchableOpacity>
                ))}
            </ScrollView>
            <TouchableOpacity
              style={[styles.assignSubmitBtn, { marginTop: 12, backgroundColor: Colors.textMuted }]}
              onPress={() => setIsRecordModalOpen(false)}
            >
              <Text style={styles.assignSubmitText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Select Employee Modal */}
      <Modal visible={isEmployeeModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Choose Staff Member</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 10 }}>
              {employees.map((emp) => {
                const isSelected = assignEmployee?.id === emp.id;
                return (
                  <TouchableOpacity
                    key={emp.id}
                    style={[
                      styles.empOptionRow,
                      isSelected && { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
                    ]}
                    onPress={() => {
                      setAssignEmployee(emp);
                      setIsEmployeeModalOpen(false);
                    }}
                  >
                    <View style={styles.empMiniAvatar}>
                      <Text style={styles.empMiniAvatarText}>{emp.name?.charAt(0) || 'U'}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.empOptionName}>{emp.name}</Text>
                      <Text style={styles.empOptionSub}>{emp.designation || emp.role || 'Staff'}</Text>
                    </View>
                    {isSelected ? (
                      <CheckCircle2 size={18} color={Colors.success} />
                    ) : (
                      <Circle size={18} color={Colors.textMuted} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={[styles.assignSubmitBtn, { marginTop: 12, backgroundColor: Colors.textMuted }]}
              onPress={() => setIsEmployeeModalOpen(false)}
            >
              <Text style={styles.assignSubmitText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: 6,
    marginRight: 8,
  },
  topTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.text,
  },
  topSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  refreshBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: Colors.primaryLight,
  },
  refreshBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  delegateCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    marginBottom: 16,
    elevation: 3,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  delegateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  delegateTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  liveSyncBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  liveSyncText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#166534',
  },
  delegateSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
    marginBottom: 4,
  },
  typesRow: {
    flexDirection: 'row',
    marginVertical: 4,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  typeChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
  },
  typeChipTextActive: {
    color: '#FFFFFF',
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: Colors.background,
  },
  selectorBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.background,
  },
  selectorText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  selectorPlaceholder: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  empMiniAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empMiniAvatarText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  empMiniSub: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  assignSubmitBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  assignSubmitText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  tabToggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  tabToggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabToggleBtnActive: {
    backgroundColor: Colors.primaryDark,
  },
  tabToggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabToggleTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  empFilterRow: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  empFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  empFilterChipActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#3B82F6',
  },
  empFilterText: {
    fontSize: 12,
    color: Colors.text,
  },
  empFilterTextActive: {
    color: '#1D4ED8',
    fontWeight: 'bold',
  },
  summaryStrip: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
  },
  summaryLabel: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  summaryCount: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionHeaderFlex: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  itemSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  itemAssigned: {
    fontSize: 10,
    color: Colors.primaryDark,
    fontWeight: '600',
    marginTop: 2,
  },
  badgeWrap: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.text,
  },
  emptyNote: {
    fontSize: 12,
    color: Colors.textMuted,
    fontStyle: 'italic',
    paddingVertical: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 18,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  recordOption: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    borderRadius: 6,
  },
  recordOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  recordOptionSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  empOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 10,
    borderRadius: 6,
  },
  empOptionName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  empOptionSub: {
    fontSize: 10,
    color: Colors.textMuted,
  },
});

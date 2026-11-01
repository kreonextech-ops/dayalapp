import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  TextInput,
  Modal,
  Alert,
  Platform,
  StatusBar,
  RefreshControl,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Phone,
  Mail,
  Shield,
  Briefcase,
  Building,
  User,
  CheckCircle2,
  Clock,
  Layers,
  ChevronRight,
  Edit2,
  X,
  Calendar,
  AlertCircle,
  Activity,
  UserCheck,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

export default function EmployeeDetailsScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const { id, employee: initialEmp } = route.params || {};
  const { isAdmin, isClient } = useAuth();

  const [employee, setEmployee] = useState<any>(initialEmp || null);
  const [loading, setLoading] = useState(!initialEmp);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'Overview' | 'Assigned Work' | 'Tasks' | 'Activity'>('Overview');

  // Workload and tasks
  const [assignedWork, setAssignedWork] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [workFilter, setWorkFilter] = useState<'All' | 'Lead' | 'Client' | 'Project' | 'Service'>('All');
  const [taskFilter, setTaskFilter] = useState<'All' | 'Pending' | 'Completed'>('All');

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editDesignation, setEditDesignation] = useState('');
  const [editDepartment, setEditDepartment] = useState('');
  const [editRole, setEditRole] = useState('Employee');
  const [isSaving, setIsSaving] = useState(false);

  const empId = id || initialEmp?.id;

  useEffect(() => {
    if (empId) {
      loadEmployeeFull();
    }
  }, [empId]);

  const loadEmployeeFull = async () => {
    try {
      // 1. Fetch employee details
      const { data: empData, error: empErr } = await supabase
        .from('employees')
        .select('*')
        .eq('id', empId)
        .single();

      if (!empErr && empData) {
        setEmployee(empData);
        setEditName(empData.name || '');
        setEditPhone(empData.phone || '');
        setEditEmail(empData.email || '');
        setEditDesignation(empData.designation || '');
        setEditDepartment(empData.department || '');
        setEditRole(empData.role || 'Employee');
      }

      const empName = empData?.name || initialEmp?.name || '';
      const empUuid = String(empId);

      // 2. Fetch assigned workload (Leads, Clients, Projects, Services)
      const [leadsRes, clientsRes, projectsRes, servicesRes, tasksRes, actRes] = await Promise.all([
        supabase
          .from('leads')
          .select('id, name, status, created_at, phone, source, assigned_to')
          .or(`assigned_to.eq.${empUuid},assigned_to.ilike.%${empName}%`),
        supabase
          .from('clients')
          .select('id, name, status, created_at, phone, company_name, assigned_to')
          .or(`assigned_to.eq.${empUuid},assigned_to.ilike.%${empName}%`),
        supabase
          .from('projects')
          .select('id, name, title, status, created_at, assigned_to')
          .or(`assigned_to.eq.${empUuid},assigned_to.ilike.%${empName}%,assigned_to.ilike.%${empUuid}%`),
        supabase
          .from('services')
          .select('id, title, status, created_at, assigned_to')
          .or(`assigned_to.eq.${empUuid},assigned_to.ilike.%${empName}%,assigned_to.ilike.%${empUuid}%`),
        supabase
          .from('tasks')
          .select('*')
          .eq('assignee_id', empUuid)
          .order('due_date', { ascending: true }),
        supabase
          .from('lead_activities')
          .select('*')
          .ilike('employee_name', `%${empName}%`)
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      const workload: any[] = [];
      if (leadsRes.data) {
        workload.push(...leadsRes.data.map(l => ({ ...l, workType: 'Lead', displayTitle: l.name })));
      }
      if (clientsRes.data) {
        workload.push(...clientsRes.data.map(c => ({ ...c, workType: 'Client', displayTitle: c.name })));
      }
      if (projectsRes.data) {
        workload.push(...projectsRes.data.map(p => ({ ...p, workType: 'Project', displayTitle: p.title || p.name })));
      }
      if (servicesRes.data) {
        workload.push(...servicesRes.data.map(s => ({ ...s, workType: 'Service', displayTitle: s.title || 'Consultancy Service' })));
      }

      workload.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAssignedWork(workload);

      setTasks(tasksRes.data || []);
      setActivities(actRes.data || []);
    } catch (e: any) {
      console.warn('Employee details load error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadEmployeeFull();
  };

  const handleToggleActive = async (val: boolean) => {
    if (!employee?.id) return;
    try {
      const { error } = await supabase
        .from('employees')
        .update({ is_active: val })
        .eq('id', employee.id);

      if (error) throw error;
      setEmployee((prev: any) => ({ ...prev, is_active: val }));
      Alert.alert('Status Updated', `Employee account is now ${val ? 'Active' : 'Deactivated'}.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update employee status');
    }
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      Alert.alert('Required', 'Please enter employee name.');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: editName.trim(),
        phone: editPhone.trim() || null,
        email: editEmail.trim() || null,
        designation: editDesignation.trim() || null,
        department: editDepartment.trim() || 'General',
        role: editRole,
      };

      const { error } = await supabase
        .from('employees')
        .update(payload)
        .eq('id', employee.id);

      if (error) throw error;

      setEmployee((prev: any) => ({ ...prev, ...payload }));
      setIsEditModalOpen(false);
      Alert.alert('Success', 'Employee profile updated successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update employee profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: safeTop, paddingHorizontal: 24 }]}>
        <Shield size={48} color={Colors.danger} />
        <Text style={{ fontSize: 18, fontWeight: '700', color: Colors.text, marginTop: 16 }}>Access Restricted</Text>
        <Text style={{ fontSize: 13, color: Colors.textMuted, marginTop: 6, textAlign: 'center', lineHeight: 20 }}>
          Employee profiles and staffing details are strictly reserved for System Administrators.
        </Text>
        <TouchableOpacity
          style={{ marginTop: 24, paddingVertical: 12, paddingHorizontal: 24, backgroundColor: Colors.primary, borderRadius: 10 }}
          onPress={() => navigation.goBack()}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading || !employee) {
    return (
      <View style={[styles.center, { paddingTop: safeTop }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Employee Profile...</Text>
      </View>
    );
  }

  const pendingTasksCount = tasks.filter(t => t.status !== 'Completed').length;
  const activeProjectsCount = assignedWork.filter(w => w.workType === 'Project').length;
  const activeServicesCount = assignedWork.filter(w => w.workType === 'Service').length;
  const assignedLeadsCount = assignedWork.filter(w => w.workType === 'Lead').length;

  const filteredWork = assignedWork.filter(item => {
    if (workFilter === 'All') return true;
    return item.workType === workFilter;
  });

  const filteredTasks = tasks.filter(task => {
    if (taskFilter === 'Pending') return task.status !== 'Completed';
    if (taskFilter === 'Completed') return task.status === 'Completed';
    return true;
  });

  const navigateToEntity = (item: any) => {
    if (item.workType === 'Lead') {
      navigation.navigate('LeadDetails', { id: item.id });
    } else if (item.workType === 'Client') {
      navigation.navigate('ClientDetails', { id: item.id });
    } else if (item.workType === 'Project') {
      navigation.navigate('ProjectDetails', { id: item.id });
    } else if (item.workType === 'Service') {
      navigation.navigate('ServiceDetails', { id: item.id });
    }
  };

  const getWorkTypeColor = (type: string) => {
    switch (type) {
      case 'Lead':
        return { bg: '#EFF6FF', text: '#2563EB', border: '#BFDBFE' };
      case 'Client':
        return { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0' };
      case 'Project':
        return { bg: '#FAF5FF', text: '#7C3AED', border: '#E9D5FF' };
      case 'Service':
        return { bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
      default:
        return { bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
    }
  };

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.topBarTitle} numberOfLines={1}>{employee.name}</Text>
          <Text style={styles.topBarSub}>EMP-{employee.id.substring(0, 8).toUpperCase()}</Text>
        </View>
        <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditModalOpen(true)}>
          <Edit2 size={16} color={Colors.primaryDark} />
          <Text style={styles.editBtnText}>Edit</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Profile Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroRow}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>
                {employee.name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'E'}
              </Text>
            </View>
            <View style={{ flex: 1, marginLeft: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.heroName}>{employee.name}</Text>
                {employee.role === 'Admin' ? (
                  <View style={styles.adminBadge}>
                    <Shield size={11} color="#B45309" />
                    <Text style={styles.adminBadgeText}>Admin</Text>
                  </View>
                ) : employee.role === 'CRO' ? (
                  <View style={[styles.adminBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                    <UserCheck size={11} color="#2563EB" />
                    <Text style={[styles.adminBadgeText, { color: '#2563EB' }]}>CRO</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.heroDesig}>{employee.designation || 'Staff Member'}</Text>
              <Text style={styles.heroDept}>{employee.department || 'Operations'}</Text>
            </View>
          </View>

          {/* Quick Contact & Status Row */}
          <View style={styles.heroActionsRow}>
            {employee.phone && (
              <TouchableOpacity
                style={[styles.heroActionBtn, { backgroundColor: '#10B981' }]}
                onPress={() => Linking.openURL(`tel:${employee.phone}`)}
              >
                <Phone size={14} color="#FFFFFF" />
                <Text style={styles.heroActionText}>Call</Text>
              </TouchableOpacity>
            )}
            {employee.email && (
              <TouchableOpacity
                style={[styles.heroActionBtn, { backgroundColor: '#2563EB' }]}
                onPress={() => Linking.openURL(`mailto:${employee.email}`)}
              >
                <Mail size={14} color="#FFFFFF" />
                <Text style={styles.heroActionText}>Email</Text>
              </TouchableOpacity>
            )}

            {/* Active Toggle Switch */}
            <View style={styles.statusToggleBox}>
              <Text style={styles.statusToggleLabel}>
                {employee.is_active !== false ? 'Active' : 'Inactive'}
              </Text>
              <Switch
                value={employee.is_active !== false}
                onValueChange={handleToggleActive}
                trackColor={{ false: '#CBD5E1', true: '#86EFAC' }}
                thumbColor={employee.is_active !== false ? '#10B981' : '#64748B'}
              />
            </View>
          </View>
        </View>

        {/* Tab Selection */}
        <View style={styles.tabsRow}>
          {(['Overview', 'Assigned Work', 'Tasks', 'Activity'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tabBtn, activeTab === tab && styles.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabBtnText, activeTab === tab && styles.tabBtnTextActive]}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ===================== TAB 1: OVERVIEW ===================== */}
        {activeTab === 'Overview' && (
          <View style={{ gap: 14 }}>
            {/* Live Metrics Grid */}
            <View style={styles.metricsGrid}>
              <View style={[styles.metricCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                <Text style={[styles.metricVal, { color: '#2563EB' }]}>{assignedLeadsCount}</Text>
                <Text style={styles.metricLabel}>Assigned Leads</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: '#FAF5FF', borderColor: '#E9D5FF' }]}>
                <Text style={[styles.metricVal, { color: '#7C3AED' }]}>{activeProjectsCount}</Text>
                <Text style={styles.metricLabel}>Active Projects</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                <Text style={[styles.metricVal, { color: '#D97706' }]}>{activeServicesCount}</Text>
                <Text style={styles.metricLabel}>Design Services</Text>
              </View>
              <View style={[styles.metricCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                <Text style={[styles.metricVal, { color: '#DC2626' }]}>{pendingTasksCount}</Text>
                <Text style={styles.metricLabel}>Pending Tasks</Text>
              </View>
            </View>

            {/* Profile Information Card */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Profile & Employment Details</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Full Name</Text>
                <Text style={styles.infoValue}>{employee.name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Role Access</Text>
                <Text style={[styles.infoValue, { fontWeight: '700', color: Colors.primaryDark }]}>
                  {employee.role || 'Staff'}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Department</Text>
                <Text style={styles.infoValue}>{employee.department || 'Not Assigned'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Designation</Text>
                <Text style={styles.infoValue}>{employee.designation || 'Staff Member'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phone</Text>
                <Text style={styles.infoValue}>{employee.phone || 'N/A'}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Email</Text>
                <Text style={styles.infoValue}>{employee.email || 'N/A'}</Text>
              </View>
              <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.infoLabel}>Member Since</Text>
                <Text style={styles.infoValue}>
                  {employee.created_at ? new Date(employee.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* ===================== TAB 2: ASSIGNED WORK ===================== */}
        {activeTab === 'Assigned Work' && (
          <View style={{ gap: 12 }}>
            {/* Filter chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterChipRow}>
              {(['All', 'Lead', 'Client', 'Project', 'Service'] as const).map(f => (
                <TouchableOpacity
                  key={f}
                  style={[styles.filterChip, workFilter === f && styles.filterChipActive]}
                  onPress={() => setWorkFilter(f)}
                >
                  <Text style={[styles.filterChipText, workFilter === f && styles.filterChipTextActive]}>
                    {f === 'All' ? `All Work (${assignedWork.length})` : `${f}s (${assignedWork.filter(w => w.workType === f).length})`}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {filteredWork.length === 0 ? (
              <View style={styles.emptyBox}>
                <Briefcase size={36} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No Assigned Work</Text>
                <Text style={styles.emptySub}>No active workload currently assigned under this filter.</Text>
              </View>
            ) : (
              filteredWork.map((item, idx) => {
                const colors = getWorkTypeColor(item.workType);
                return (
                  <TouchableOpacity
                    key={`${item.workType}-${item.id}-${idx}`}
                    style={styles.workCard}
                    onPress={() => navigateToEntity(item)}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <View style={[styles.workBadge, { backgroundColor: colors.bg, borderColor: colors.border }]}>
                        <Text style={[styles.workBadgeText, { color: colors.text }]}>{item.workType.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.workDate}>
                        {new Date(item.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                    <Text style={styles.workTitle}>{item.displayTitle}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                      <Text style={styles.workStatus}>Status: <Text style={{ fontWeight: '700' }}>{item.status || 'Active'}</Text></Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={styles.viewLink}>View Workspace</Text>
                        <ChevronRight size={14} color={Colors.primaryDark} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* ===================== TAB 3: TASKS ===================== */}
        {activeTab === 'Tasks' && (
          <View style={{ gap: 12 }}>
            <View style={styles.filterChipRow}>
              {(['All', 'Pending', 'Completed'] as const).map(tf => (
                <TouchableOpacity
                  key={tf}
                  style={[styles.filterChip, taskFilter === tf && styles.filterChipActive]}
                  onPress={() => setTaskFilter(tf)}
                >
                  <Text style={[styles.filterChipText, taskFilter === tf && styles.filterChipTextActive]}>
                    {tf} ({tf === 'All' ? tasks.length : tf === 'Pending' ? pendingTasksCount : tasks.length - pendingTasksCount})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {filteredTasks.length === 0 ? (
              <View style={styles.emptyBox}>
                <CheckCircle2 size={36} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No Tasks Found</Text>
                <Text style={styles.emptySub}>No tasks matching the selected filter.</Text>
              </View>
            ) : (
              filteredTasks.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={styles.taskCard}
                  onPress={() => navigation.navigate('TaskDetails', { id: t.id })}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                      {t.status === 'Completed' ? (
                        <CheckCircle2 size={18} color={Colors.success} />
                      ) : (
                        <Clock size={18} color="#D97706" />
                      )}
                      <Text style={[styles.taskTitle, t.status === 'Completed' && styles.taskTitleDone]} numberOfLines={1}>
                        {t.name || t.title}
                      </Text>
                    </View>
                    <ChevronRight size={16} color={Colors.textMuted} />
                  </View>

                  {t.description ? (
                    <Text style={styles.taskDesc} numberOfLines={2}>{t.description}</Text>
                  ) : null}

                  <View style={styles.taskFooter}>
                    <Text style={styles.taskDue}>Due: {t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'No date'}</Text>
                    <View style={[styles.priorityBadge, t.priority === 'High' ? styles.priorityHigh : styles.priorityNorm]}>
                      <Text style={[styles.priorityText, t.priority === 'High' ? styles.priorityHighText : styles.priorityNormText]}>
                        {t.priority || 'Medium'}
                      </Text>
                    </View>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* ===================== TAB 4: ACTIVITY ===================== */}
        {activeTab === 'Activity' && (
          <View style={{ gap: 12 }}>
            {activities.length === 0 ? (
              <View style={styles.emptyBox}>
                <Activity size={36} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No Activity Logs</Text>
                <Text style={styles.emptySub}>No interactions or timeline events recorded by this employee.</Text>
              </View>
            ) : (
              activities.map((a, i) => (
                <View key={a.id || i} style={styles.activityItem}>
                  <View style={styles.activityDot} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={styles.activityType}>{a.activity_type || a.activity_group || 'Update'}</Text>
                      <Text style={styles.activityTime}>
                        {new Date(a.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                    <Text style={styles.activityTitle}>{a.title}</Text>
                    {a.details ? <Text style={styles.activityDetails}>{a.details}</Text> : null}
                  </View>
                </View>
              ))
            )}
          </View>
        )}
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={isEditModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Employee Profile</Text>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                <X size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput style={styles.input} value={editName} onChangeText={setEditName} placeholder="Employee name" />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput style={styles.input} value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" placeholder="Phone number" />

              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput style={styles.input} value={editEmail} onChangeText={setEditEmail} keyboardType="email-address" placeholder="Email address" autoCapitalize="none" />

              <Text style={styles.inputLabel}>Designation</Text>
              <TextInput style={styles.input} value={editDesignation} onChangeText={setEditDesignation} placeholder="e.g. Civil Engineer / OAS" />

              <Text style={styles.inputLabel}>Department</Text>
              <TextInput style={styles.input} value={editDepartment} onChangeText={setEditDepartment} placeholder="e.g. Engineering / Sales" />

              <Text style={styles.inputLabel}>System Role</Text>
              <View style={styles.roleChoiceRow}>
                {['Employee', 'CRO', 'Admin'].map(r => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.roleChoiceBtn, editRole === r && styles.roleChoiceBtnActive]}
                    onPress={() => setEditRole(r)}
                  >
                    <Text style={[styles.roleChoiceText, editRole === r && styles.roleChoiceTextActive]}>
                      {r}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
                onPress={handleSaveProfile}
                disabled={isSaving}
              >
                {isSaving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.saveBtnText}>Save Changes</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textMuted,
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
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  topBarSub: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
  },
  editBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLargeText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  heroName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  heroDesig: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primaryDark,
    marginTop: 2,
  },
  heroDept: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
  },
  heroActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  heroActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  heroActionText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusToggleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginLeft: 'auto',
  },
  statusToggleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 10,
    padding: 3,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabBtnTextActive: {
    color: Colors.text,
    fontWeight: '700',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    minWidth: '46%',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  metricVal: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 4,
    textTransform: 'uppercase',
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  filterChipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  filterChipTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  workCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  workBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
  },
  workBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  workDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  workTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  workStatus: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  viewLink: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  taskCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  taskDesc: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  taskDue: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityHigh: {
    backgroundColor: '#FEE2E2',
  },
  priorityNorm: {
    backgroundColor: '#F1F5F9',
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  priorityHighText: {
    color: '#DC2626',
  },
  priorityNormText: {
    color: '#475569',
  },
  activityItem: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primaryDark,
    marginTop: 5,
  },
  activityType: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primaryDark,
    textTransform: 'uppercase',
  },
  activityTime: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  activityTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 2,
  },
  activityDetails: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  emptyBox: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.text,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    marginBottom: 6,
    marginTop: 10,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
  },
  roleChoiceRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  roleChoiceBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  roleChoiceBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  roleChoiceText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  roleChoiceTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  saveBtn: {
    backgroundColor: Colors.primaryDark,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
});

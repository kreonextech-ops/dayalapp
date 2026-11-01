import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  FlatList,
  Linking,
  TextInput,
  Modal,
  Alert,
  Platform,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  Plus,
  Phone,
  Flame,
  User,
  Filter,
  Share2,
  ChevronRight,
  Sun,
  Snowflake,
  Search,
  X,
  Briefcase,
  Layers,
  UserSquare2,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { createNotification } from '../../lib/notificationService';

export default function FollowUpsScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const { user, isAdmin } = useAuth();

  const [followUps, setFollowUps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterTab, setFilterTab] = useState<'All' | 'Overdue' | 'Today' | 'Hot' | 'Completed'>('All');

  // Related entities lookup cache
  const [entitiesMap, setEntitiesMap] = useState<Record<string, { name: string; phone?: string; type: string }>>({});
  const [employees, setEmployees] = useState<any[]>([]);

  // Schedule Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [moduleType, setModuleType] = useState<'Lead' | 'Client' | 'Project' | 'Service'>('Lead');
  const [recordOptions, setRecordOptions] = useState<any[]>([]);
  const [selectedRecordId, setSelectedRecordId] = useState('');
  const [selectedRecordName, setSelectedRecordName] = useState('');
  const [searchRecord, setSearchRecord] = useState('');
  const [showRecordPicker, setShowRecordPicker] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [temperature, setTemperature] = useState<'Hot' | 'Warm' | 'Cold'>('Hot');
  const [assigneeId, setAssigneeId] = useState(user?.id || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchFollowUps();
  }, []);

  useEffect(() => {
    if (isModalOpen) {
      loadRecordOptions();
    }
  }, [moduleType, isModalOpen]);

  const fetchFollowUps = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('tasks')
        .select('*')
        .or('custom_category.eq.Follow Up,type.eq.followup')
        .order('due_date', { ascending: true });

      if (!isAdmin && user?.id) {
        query = query.or(`assignee_id.eq.${user.id},creator_id.eq.${user.id}`);
      }

      const [tasksRes, empRes, leadsRes, clientsRes, projRes, servRes] = await Promise.all([
        query,
        supabase.from('employees').select('id, name, designation, role').order('name'),
        supabase.from('leads').select('id, name, phone'),
        supabase.from('clients').select('id, name, phone, company_name'),
        supabase.from('projects').select('id, name, title'),
        supabase.from('services').select('id, title'),
      ]);

      if (empRes.data) setEmployees(empRes.data);

      // Build quick lookup map for linked records
      const map: Record<string, { name: string; phone?: string; type: string }> = {};
      leadsRes.data?.forEach(l => {
        map[`lead_${l.id}`] = { name: l.name, phone: l.phone, type: 'Lead' };
      });
      clientsRes.data?.forEach(c => {
        map[`client_${c.id}`] = { name: c.name, phone: c.phone, type: 'Client' };
      });
      projRes.data?.forEach(p => {
        map[`project_${p.id}`] = { name: p.title || p.name, type: 'Project' };
      });
      servRes.data?.forEach(s => {
        map[`service_${s.id}`] = { name: s.title, type: 'Service' };
      });
      setEntitiesMap(map);

      setFollowUps(tasksRes.data || []);
    } catch (e: any) {
      console.warn('Follow up fetch error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchFollowUps();
  };

  const loadRecordOptions = async () => {
    try {
      let table = 'leads';
      if (moduleType === 'Client') table = 'clients';
      else if (moduleType === 'Project') table = 'projects';
      else if (moduleType === 'Service') table = 'services';

      const { data } = await supabase.from(table).select('*').limit(100);
      if (data) {
        setRecordOptions(
          data.map(d => ({
            id: d.id,
            name: d.name || d.title || 'Untitled',
            phone: d.phone || '',
          }))
        );
      }
    } catch (e: any) {
      console.warn('Record options load error:', e.message);
    }
  };

  const handleToggleComplete = async (item: any) => {
    const newStatus = item.status === 'Completed' ? 'Pending' : 'Completed';
    try {
      await supabase.from('tasks').update({ status: newStatus }).eq('id', item.id);
      setFollowUps(prev => prev.map(f => (f.id === item.id ? { ...f, status: newStatus } : f)));

      if (newStatus === 'Completed') {
        await createNotification({
          title: '✅ Follow-Up Completed',
          message: `"${item.title}" marked completed by ${user?.name || 'Staff'}`,
          module: 'followup',
          referenceId: item.id,
          recipientRole: 'All_Staff',
          createdByName: user?.name,
        });
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update status');
    }
  };

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Required', 'Please enter follow-up title / purpose.');
      return;
    }
    if (!selectedRecordId) {
      Alert.alert('Required', `Please select a linked ${moduleType} from the list.`);
      return;
    }

    setIsSaving(true);
    try {
      const payload: any = {
        name: title.trim(),
        title: title.trim(),
        description: description.trim() || null,
        custom_category: 'Follow Up',
        status: 'Pending',
        priority: temperature === 'Hot' ? 'High' : temperature === 'Warm' ? 'Medium' : 'Low',
        due_date: dueDate,
        category: moduleType,
        assignee_id: assigneeId || user?.id || null,
        creator_id: user?.id || null,
      };

      if (moduleType === 'Lead') payload.lead_id = selectedRecordId;
      else if (moduleType === 'Client') payload.client_id = selectedRecordId;
      else if (moduleType === 'Project') payload.project_id = selectedRecordId;
      else if (moduleType === 'Service') payload.service_id = selectedRecordId;

      const { data, error } = await supabase.from('tasks').insert([payload]).select();
      if (error) throw error;

      // Log to timeline if lead or client
      if (moduleType === 'Lead' || moduleType === 'Client') {
        await supabase.from('lead_activities').insert([
          {
            lead_id: payload.lead_id || null,
            client_id: payload.client_id || null,
            employee_name: user?.name || 'Staff',
            activity_group: 'Timeline',
            activity_type: 'Follow-Up',
            title: `Follow-up Scheduled: ${payload.title}`,
            details: `Due on ${dueDate}. Priority: ${temperature}. Remarks: ${description.trim() || 'None'}`,
          },
        ]);
      }

      // Notify assigned staff
      if (assigneeId && assigneeId !== user?.id) {
        await createNotification({
          title: `New Follow-Up Scheduled`,
          message: `${user?.name || 'Staff'} scheduled follow-up: "${payload.title}" due on ${dueDate}.`,
          module: 'task',
          referenceId: data[0].id,
          recipientRole: 'Employee',
          recipientUserId: assigneeId,
          createdByName: user?.name || 'Staff',
        });
      }

      Alert.alert('Success', 'Follow-up scheduled successfully.');
      setIsModalOpen(false);
      setTitle('');
      setDescription('');
      setSelectedRecordId('');
      setSelectedRecordName('');
      fetchFollowUps();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to schedule follow-up');
    } finally {
      setIsSaving(false);
    }
  };

  const navigateToLinkedEntity = (task: any) => {
    if (task.lead_id) {
      navigation.navigate('LeadDetails', { id: task.lead_id });
    } else if (task.client_id) {
      navigation.navigate('ClientDetails', { id: task.client_id });
    } else if (task.project_id) {
      navigation.navigate('ProjectDetails', { id: task.project_id });
    } else if (task.service_id) {
      navigation.navigate('ServiceDetails', { id: task.service_id });
    } else {
      navigation.navigate('TaskDetails', { id: task.id });
    }
  };

  // Date classification
  const todayStr = new Date().toISOString().split('T')[0];
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowStr = tomorrowDate.toISOString().split('T')[0];

  const overdueList = followUps.filter(
    f => f.status !== 'Completed' && f.due_date && f.due_date.split('T')[0] < todayStr
  );
  const todayList = followUps.filter(
    f => f.status !== 'Completed' && f.due_date && f.due_date.split('T')[0] === todayStr
  );
  const tomorrowList = followUps.filter(
    f => f.status !== 'Completed' && f.due_date && f.due_date.split('T')[0] === tomorrowStr
  );
  const upcomingList = followUps.filter(
    f => f.status !== 'Completed' && f.due_date && f.due_date.split('T')[0] > tomorrowStr
  );

  const filtered = followUps.filter(f => {
    if (filterTab === 'Overdue') {
      return f.status !== 'Completed' && f.due_date && f.due_date.split('T')[0] < todayStr;
    }
    if (filterTab === 'Today') {
      return f.due_date && f.due_date.split('T')[0] === todayStr;
    }
    if (filterTab === 'Hot') {
      return f.priority === 'High' && f.status !== 'Completed';
    }
    if (filterTab === 'Completed') {
      return f.status === 'Completed';
    }
    return true;
  });

  const getEntityInfo = (task: any): { name: string; phone?: string; type: string } => {
    if (task.lead_id && entitiesMap[`lead_${task.lead_id}`]) {
      return entitiesMap[`lead_${task.lead_id}`];
    }
    if (task.client_id && entitiesMap[`client_${task.client_id}`]) {
      return entitiesMap[`client_${task.client_id}`];
    }
    if (task.project_id && entitiesMap[`project_${task.project_id}`]) {
      return entitiesMap[`project_${task.project_id}`];
    }
    if (task.service_id && entitiesMap[`service_${task.service_id}`]) {
      return entitiesMap[`service_${task.service_id}`];
    }
    return { name: task.category || 'General Follow-Up', phone: undefined, type: task.category || 'CRM' };
  };

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 8 }}>
          <Text style={styles.topBarTitle}>Follow-Ups Center</Text>
          <Text style={styles.topBarSub}>Dayal CRM Scheduled Action Tracker</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setIsModalOpen(true)}>
          <Plus size={16} color="#FFFFFF" />
          <Text style={styles.addBtnText}>Schedule</Text>
        </TouchableOpacity>
      </View>

      {/* Summary KPI Badges (Command Center style) */}
      <View style={styles.kpiRow}>
        <TouchableOpacity
          style={[styles.kpiCard, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
          onPress={() => setFilterTab('Overdue')}
        >
          <Text style={[styles.kpiNum, { color: '#DC2626' }]}>{overdueList.length}</Text>
          <Text style={styles.kpiLabel}>Overdue 🚨</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.kpiCard, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
          onPress={() => setFilterTab('Today')}
        >
          <Text style={[styles.kpiNum, { color: '#D97706' }]}>{todayList.length}</Text>
          <Text style={styles.kpiLabel}>Today ⚡</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.kpiCard, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}
          onPress={() => setFilterTab('All')}
        >
          <Text style={[styles.kpiNum, { color: '#2563EB' }]}>{tomorrowList.length}</Text>
          <Text style={styles.kpiLabel}>Tomorrow 📅</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.kpiCard, { backgroundColor: '#F8FAFC', borderColor: '#E2E8F0' }]}
          onPress={() => setFilterTab('All')}
        >
          <Text style={[styles.kpiNum, { color: '#475569' }]}>{upcomingList.length}</Text>
          <Text style={styles.kpiLabel}>Upcoming</Text>
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {(['All', 'Overdue', 'Today', 'Hot', 'Completed'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterPill, filterTab === tab && styles.filterPillActive]}
            onPress={() => setFilterTab(tab)}
          >
            <Text style={[styles.filterText, filterTab === tab && styles.filterTextActive]}>
              {tab === 'Hot' ? '🔥 Hot' : tab === 'Overdue' ? `🚨 Overdue (${overdueList.length})` : tab}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading Follow-ups...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => {
            const isCompleted = item.status === 'Completed';
            const isOverdue = !isCompleted && item.due_date && item.due_date.split('T')[0] < todayStr;
            const entity = getEntityInfo(item);
            const assignedEmp = employees.find(e => e.id === item.assignee_id);

            return (
              <TouchableOpacity
                style={[styles.card, isCompleted && styles.cardCompleted, isOverdue && styles.cardOverdue]}
                onPress={() => navigateToLinkedEntity(item)}
                activeOpacity={0.7}
              >
                {/* Header row: Status toggle + Category badge + Due Date */}
                <View style={styles.cardHeader}>
                  <TouchableOpacity
                    style={styles.toggleBtn}
                    onPress={() => handleToggleComplete(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    {isCompleted ? (
                      <CheckCircle2 size={20} color={Colors.success} />
                    ) : (
                      <Circle size={20} color={isOverdue ? '#DC2626' : Colors.textMuted} />
                    )}
                  </TouchableOpacity>

                  <View style={styles.badgeRow}>
                    {item.priority === 'High' ? (
                      <View style={styles.hotBadge}>
                        <Flame size={11} color="#DC2626" />
                        <Text style={styles.hotBadgeText}>HOT</Text>
                      </View>
                    ) : item.priority === 'Medium' ? (
                      <View style={[styles.hotBadge, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                        <Sun size={11} color="#D97706" />
                        <Text style={[styles.hotBadgeText, { color: '#D97706' }]}>WARM</Text>
                      </View>
                    ) : (
                      <View style={[styles.hotBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE' }]}>
                        <Snowflake size={11} color="#2563EB" />
                        <Text style={[styles.hotBadgeText, { color: '#2563EB' }]}>COLD</Text>
                      </View>
                    )}

                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>
                        {(item.category || entity.type || 'TASK').toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={[styles.dueBadge, isOverdue && styles.dueBadgeOverdue]}>
                    <Clock size={11} color={isOverdue ? '#DC2626' : Colors.textMuted} />
                    <Text style={[styles.dueText, isOverdue && styles.dueTextOverdue]}>
                      {isOverdue ? 'Overdue: ' : 'Due: '}
                      {item.due_date ? new Date(item.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'Today'}
                    </Text>
                  </View>
                </View>

                {/* Follow-up Title & linked entity */}
                <View style={styles.cardBody}>
                  <Text style={[styles.title, isCompleted && styles.titleCompleted]}>
                    {item.name || item.title}
                  </Text>
                  {entity.name ? (
                    <Text style={styles.entityNameSub} numberOfLines={1}>
                      Linked: <Text style={{ fontWeight: '700', color: Colors.primaryDark }}>{entity.name}</Text>
                    </Text>
                  ) : null}
                  {item.description ? (
                    <Text style={styles.descSub} numberOfLines={2}>
                      {item.description}
                    </Text>
                  ) : null}
                </View>

                {/* Footer with staff info & quick contact buttons */}
                <View style={styles.cardFooter}>
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <User size={12} color={Colors.textMuted} />
                    <Text style={styles.assigneeText} numberOfLines={1}>
                      {assignedEmp?.name ? assignedEmp.name : 'Staff Assigned'}
                    </Text>
                  </View>

                  <View style={styles.actionButtonsRow}>
                    {entity.phone ? (
                      <>
                        <TouchableOpacity
                          style={[styles.smallActionBtn, { backgroundColor: '#10B981' }]}
                          onPress={() => Linking.openURL(`tel:${entity.phone}`)}
                        >
                          <Phone size={12} color="#FFFFFF" />
                          <Text style={styles.smallActionText}>Call</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.smallActionBtn, { backgroundColor: '#25D366' }]}
                          onPress={() => {
                            const clean = entity.phone!.replace(/[^0-9]/g, '');
                            Linking.openURL(`https://wa.me/${clean}`);
                          }}
                        >
                          <Share2 size={12} color="#FFFFFF" />
                          <Text style={styles.smallActionText}>WhatsApp</Text>
                        </TouchableOpacity>
                      </>
                    ) : null}
                    <View style={styles.viewArrowBtn}>
                      <ChevronRight size={16} color={Colors.primaryDark} />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Clock size={44} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Follow-Ups Found</Text>
              <Text style={styles.emptySub}>
                {filterTab === 'Overdue'
                  ? 'Great job! No overdue follow-ups.'
                  : 'Tap "+ Schedule" to set up a new client or lead follow-up reminder.'}
              </Text>
            </View>
          }
        />
      )}

      {/* Schedule Follow-Up Modal */}
      <Modal visible={isModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalHeading}>Schedule New Follow-Up</Text>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <X size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* Module Selector */}
              <Text style={styles.label}>1. Select Target Category *</Text>
              <View style={styles.moduleTypeRow}>
                {(['Lead', 'Client', 'Project', 'Service'] as const).map(mod => (
                  <TouchableOpacity
                    key={mod}
                    style={[styles.moduleTypeBtn, moduleType === mod && styles.moduleTypeBtnActive]}
                    onPress={() => {
                      setModuleType(mod);
                      setSelectedRecordId('');
                      setSelectedRecordName('');
                    }}
                  >
                    <Text style={[styles.moduleTypeText, moduleType === mod && styles.moduleTypeTextActive]}>
                      {mod}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Record Selector */}
              <Text style={styles.label}>2. Select {moduleType} *</Text>
              <TouchableOpacity
                style={styles.recordPickerBtn}
                onPress={() => setShowRecordPicker(!showRecordPicker)}
              >
                <Text style={selectedRecordName ? styles.recordPickerVal : styles.recordPickerPlaceholder} numberOfLines={1}>
                  {selectedRecordName || `Choose a ${moduleType}...`}
                </Text>
                <ChevronRight size={16} color={Colors.textMuted} />
              </TouchableOpacity>

              {/* Dropdown search list */}
              {showRecordPicker && (
                <View style={styles.pickerDropdown}>
                  <View style={styles.pickerSearchBox}>
                    <Search size={14} color={Colors.textMuted} />
                    <TextInput
                      style={styles.pickerSearchInput}
                      placeholder={`Search ${moduleType}...`}
                      value={searchRecord}
                      onChangeText={setSearchRecord}
                    />
                  </View>
                  <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                    {recordOptions
                      .filter(r => r.name.toLowerCase().includes(searchRecord.toLowerCase()))
                      .map(opt => (
                        <TouchableOpacity
                          key={opt.id}
                          style={[styles.pickerItem, selectedRecordId === opt.id && styles.pickerItemActive]}
                          onPress={() => {
                            setSelectedRecordId(opt.id);
                            setSelectedRecordName(opt.name);
                            setShowRecordPicker(false);
                          }}
                        >
                          <Text style={[styles.pickerItemText, selectedRecordId === opt.id && styles.pickerItemTextActive]}>
                            {opt.name}
                          </Text>
                          {opt.phone ? <Text style={styles.pickerItemPhone}>{opt.phone}</Text> : null}
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                </View>
              )}

              {/* Purpose & Title */}
              <Text style={styles.label}>3. Follow-Up Purpose / Title *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Call regarding quotation and floor plan review"
                value={title}
                onChangeText={setTitle}
              />

              {/* Description */}
              <Text style={styles.label}>4. Description / Agenda Notes</Text>
              <TextInput
                style={[styles.input, { height: 64, textAlignVertical: 'top' }]}
                placeholder="Key talking points or customer questions to address..."
                value={description}
                onChangeText={setDescription}
                multiline
              />

              {/* Temperature */}
              <Text style={styles.label}>5. Lead Temperature / Priority</Text>
              <View style={styles.tempChoiceRow}>
                {(['Hot', 'Warm', 'Cold'] as const).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.tempChoiceBtn, temperature === t && styles.tempChoiceBtnActive]}
                    onPress={() => setTemperature(t)}
                  >
                    <Text style={[styles.tempChoiceText, temperature === t && styles.tempChoiceTextActive]}>
                      {t === 'Hot' ? '🔥 Hot' : t === 'Warm' ? '☀️ Warm' : '❄️ Cold'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Due Date */}
              <Text style={styles.label}>6. Scheduled Due Date (YYYY-MM-DD)</Text>
              <TextInput
                style={styles.input}
                placeholder="YYYY-MM-DD"
                value={dueDate}
                onChangeText={setDueDate}
              />

              {/* Staff Assignee */}
              <Text style={styles.label}>7. Assign Staff Member</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {employees.map(emp => (
                    <TouchableOpacity
                      key={emp.id}
                      style={[styles.assigneeChip, assigneeId === emp.id && styles.assigneeChipActive]}
                      onPress={() => setAssigneeId(emp.id)}
                    >
                      <Text style={[styles.assigneeChipText, assigneeId === emp.id && styles.assigneeChipTextActive]}>
                        {emp.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <View style={styles.btnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalOpen(false)}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, isSaving && { opacity: 0.7 }]}
                  onPress={handleCreate}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.saveText}>Save Follow-Up</Text>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: Colors.textMuted },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: { padding: 6 },
  topBarTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  topBarSub: { fontSize: 11, color: Colors.textMuted },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    gap: 4,
  },
  addBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' },
  kpiRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  kpiNum: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  kpiLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textMuted,
    marginTop: 2,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
  filterText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  filterTextActive: { color: '#FFFFFF', fontWeight: '700' },
  listContent: { padding: 16, gap: 12, paddingBottom: 40 },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardCompleted: { opacity: 0.55 },
  cardOverdue: { borderColor: '#FCA5A5', backgroundColor: '#FFFDFD' },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  toggleBtn: {
    padding: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  hotBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  hotBadgeText: { fontSize: 9, fontWeight: 'bold', color: '#DC2626' },
  categoryBadge: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  categoryBadgeText: { fontSize: 9, fontWeight: '700', color: '#475569' },
  dueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  dueBadgeOverdue: {
    backgroundColor: '#FEE2E2',
  },
  dueText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  dueTextOverdue: {
    color: '#DC2626',
    fontWeight: '700',
  },
  cardBody: {
    marginBottom: 8,
  },
  title: { fontSize: 14, fontWeight: '700', color: Colors.text, lineHeight: 18 },
  titleCompleted: { textDecorationLine: 'line-through' },
  entityNameSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 3,
  },
  descSub: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 4,
    lineHeight: 16,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  assigneeText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  actionButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  smallActionText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  viewArrowBtn: {
    padding: 2,
  },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: Colors.text },
  emptySub: { fontSize: 12, color: Colors.textMuted, textAlign: 'center', paddingHorizontal: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '88%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  modalHeading: { fontSize: 17, fontWeight: 'bold', color: Colors.text },
  label: { fontSize: 12, fontWeight: '700', color: Colors.textSecondary, marginBottom: 6, marginTop: 10 },
  moduleTypeRow: { flexDirection: 'row', gap: 8 },
  moduleTypeBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  moduleTypeBtnActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#2563EB',
  },
  moduleTypeText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  moduleTypeTextActive: { color: '#2563EB', fontWeight: 'bold' },
  recordPickerBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#F8FAFC',
  },
  recordPickerVal: { fontSize: 13, fontWeight: '700', color: Colors.text },
  recordPickerPlaceholder: { fontSize: 13, color: Colors.textMuted },
  pickerDropdown: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    backgroundColor: Colors.surface,
    padding: 8,
    marginTop: 4,
  },
  pickerSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
  },
  pickerSearchInput: {
    flex: 1,
    fontSize: 12,
    padding: 4,
    color: Colors.text,
  },
  pickerItem: {
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
  },
  pickerItemActive: {
    backgroundColor: '#EFF6FF',
    borderRadius: 6,
  },
  pickerItemText: { fontSize: 13, fontWeight: '600', color: Colors.text },
  pickerItemTextActive: { color: '#2563EB' },
  pickerItemPhone: { fontSize: 11, color: Colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    backgroundColor: '#F8FAFC',
    color: Colors.text,
  },
  tempChoiceRow: { flexDirection: 'row', gap: 8 },
  tempChoiceBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  tempChoiceBtnActive: {
    backgroundColor: '#FEF3C7',
    borderColor: '#F59E0B',
  },
  tempChoiceText: { fontSize: 12, fontWeight: '600', color: Colors.textMuted },
  tempChoiceTextActive: { color: '#B45309', fontWeight: 'bold' },
  assigneeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#F8FAFC',
  },
  assigneeChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  assigneeChipText: { fontSize: 11, fontWeight: '600', color: Colors.textMuted },
  assigneeChipTextActive: { color: '#FFFFFF', fontWeight: 'bold' },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.border, alignItems: 'center' },
  cancelText: { color: Colors.text, fontWeight: '600' },
  saveBtn: { flex: 1, backgroundColor: Colors.primaryDark, paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  saveText: { color: '#FFFFFF', fontWeight: 'bold' },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
  Modal,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Search,
  CheckSquare,
  Clock,
  Plus,
  ChevronRight,
  Filter,
  CheckCircle2,
  Circle,
  User,
  ArrowLeft,
  Calendar,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { createNotification } from '../../lib/notificationService';

const TASK_STATUS_TABS = ['All', 'To Do', 'In Progress', 'Needs Approval', 'Completed'];

export default function TasksScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const { user, isAdmin, role } = useAuth();

  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeStatusTab, setActiveStatusTab] = useState('All');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New Task Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDue, setNewTaskDue] = useState(new Date().toISOString().split('T')[0]);
  const [newTaskPriority, setNewTaskPriority] = useState('High');
  const [newTaskCategory, setNewTaskCategory] = useState('General');

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchTerm, activeStatusTab, tasks]);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      let query = supabase.from('tasks').select('*').order('created_at', { ascending: false });

      if (!isAdmin && role !== 'CRO' && user?.id) {
        query = query.or(`assignee_id.eq.${user.id},creator_id.eq.${user.id}`);
      }

      const [taskRes, empRes] = await Promise.all([
        query,
        supabase.from('employees').select('id, name, role, email').order('name'),
      ]);

      if (taskRes.error) throw taskRes.error;
      setTasks(taskRes.data || []);
      if (empRes.data) setEmployees(empRes.data);
    } catch (e: any) {
      console.warn('Error fetching tasks:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let result = [...tasks];

    if (activeStatusTab !== 'All') {
      result = result.filter(t => t.status === activeStatusTab);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        t =>
          (t.title && t.title.toLowerCase().includes(q)) ||
          (t.name && t.name.toLowerCase().includes(q)) ||
          (t.description && t.description.toLowerCase().includes(q)) ||
          (t.category && t.category.toLowerCase().includes(q))
      );
    }

    setFilteredTasks(result);
  };

  const handleToggleTask = async (task: any, e: any) => {
    e.stopPropagation();
    const nextStatus = task.status === 'Completed' ? 'To Do' : 'Completed';
    try {
      const { error } = await supabase.from('tasks').update({ status: nextStatus }).eq('id', task.id);
      if (error) throw error;
      setTasks(prev => prev.map(t => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not update task');
    }
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim()) {
      Alert.alert('Required', 'Please enter task title.');
      return;
    }
    try {
      const assignedId = newTaskAssignee || user?.id || null;
      const { data, error } = await supabase.from('tasks').insert([
        {
          title: newTaskTitle.trim(),
          name: newTaskTitle.trim(),
          description: newTaskDesc.trim() || null,
          due_date: newTaskDue,
          priority: newTaskPriority,
          status: 'To Do',
          category: newTaskCategory,
          assignee_id: assignedId,
          creator_id: user?.id || null,
        },
      ]).select();
      if (error) throw error;

      // Notify the assigned employee in real-time
      if (assignedId) {
        const assignedEmp = employees.find(e => e.id === assignedId);
        await createNotification({
          title: '📋 New Task Assigned',
          message: `You were assigned task: "${newTaskTitle.trim()}" due ${newTaskDue}.`,
          module: 'task',
          referenceId: data?.[0]?.id,
          recipientRole: assignedEmp?.role === 'Admin' ? 'Admin' : 'Employee',
          recipientUserId: assignedId,
          createdByName: user?.name || 'Staff',
        });
      }

      setIsModalOpen(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskAssignee('');
      fetchTasks();
      Alert.alert('Success', 'Task created and assigned successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to create task');
    }
  };

  const renderTask = ({ item }: any) => {
    const isDone = item.status === 'Completed';

    return (
      <TouchableOpacity
        style={[styles.taskCard, isDone && { opacity: 0.75 }]}
        onPress={() => navigation.navigate('TaskDetails', { id: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardTopRow}>
          <TouchableOpacity onPress={(e) => handleToggleTask(item, e)} style={styles.checkCircle}>
            {isDone ? (
              <CheckCircle2 size={22} color={Colors.success} />
            ) : (
              <Circle size={22} color={Colors.textMuted} />
            )}
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]}>
              {item.title || item.name}
            </Text>
            {item.category && <Text style={styles.categorySub}>{item.category}</Text>}
            {!!item.description && (
              <Text style={styles.taskDescSub} numberOfLines={2}>
                {item.description}
              </Text>
            )}
          </View>

          <View
            style={[
              styles.priorityBadge,
              item.priority === 'High'
                ? styles.highBadge
                : item.priority === 'Medium'
                ? styles.medBadge
                : styles.normBadge,
            ]}
          >
            <Text
              style={[
                styles.priorityText,
                item.priority === 'High'
                  ? styles.highText
                  : item.priority === 'Medium'
                  ? styles.medText
                  : styles.normText,
              ]}
            >
              {item.priority || 'Normal'}
            </Text>
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.dueRow}>
            <Clock size={13} color={Colors.textMuted} />
            <Text style={styles.dueText}>{item.due_date || 'No Due Date'}</Text>
          </View>

          <View style={styles.assigneeChip}>
            <User size={11} color={Colors.primaryDark} />
            <Text style={styles.assigneeChipText} numberOfLines={1}>
              {employees.find(e => e.id === item.assignee_id)?.name || 'Unassigned'}
            </Text>
          </View>

          <View style={[styles.statusChip, { backgroundColor: isDone ? '#ECFDF5' : '#F1F5F9' }]}>
            <Text style={[styles.statusChipText, { color: isDone ? '#047857' : '#334155' }]}>
              {item.status || 'To Do'}
            </Text>
          </View>

          <ChevronRight size={18} color={Colors.textMuted} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
            <ArrowLeft size={22} color={Colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>Task Operations</Text>
            <Text style={styles.headerSubtitle}>{tasks.length} active assignments</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => setIsModalOpen(true)}>
          <Plus size={18} color="#FFFFFF" />
          <Text style={styles.addBtnText}>New</Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchBox}>
        <Search size={18} color={Colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search tasks, categories..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor={Colors.textMuted}
        />
      </View>

      {/* Status Filter Scroll */}
      <View style={styles.statusScrollWrapper}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={TASK_STATUS_TABS}
          keyExtractor={item => item}
          contentContainerStyle={styles.statusScroll}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.statusFilterChip, activeStatusTab === item && styles.statusFilterChipActive]}
              onPress={() => setActiveStatusTab(item)}
            >
              <Text
                style={[
                  styles.statusFilterText,
                  activeStatusTab === item && styles.statusFilterTextActive,
                ]}
              >
                {item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Task List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading Tasks...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTasks}
          keyExtractor={item => item.id.toString()}
          renderItem={renderTask}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchTasks} />}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <CheckSquare size={36} color={Colors.textMuted} />
              <Text style={styles.emptyCardTitle}>No Tasks Found</Text>
              <Text style={styles.emptyCardSub}>No tasks matching the selected filters.</Text>
            </View>
          }
        />
      )}

      {/* New Task Modal */}
      <Modal visible={isModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New Task</Text>

            <Text style={styles.inputLabel}>Task Title</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Concrete mix cube testing report"
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
            />

            <Text style={styles.inputLabel}>Description / Instructions</Text>
            <TextInput
              style={[styles.textInput, { height: 70, textAlignVertical: 'top' }]}
              placeholder="Enter detailed task instructions or specifications..."
              value={newTaskDesc}
              onChangeText={setNewTaskDesc}
              multiline
            />

            <Text style={styles.inputLabel}>Assign Employee</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6, flexWrap: 'wrap' }}>
              {employees.map(emp => {
                const isSelected = newTaskAssignee === emp.id;
                return (
                  <TouchableOpacity
                    key={emp.id}
                    style={[
                      styles.empSelectChip,
                      isSelected && styles.empSelectChipActive,
                    ]}
                    onPress={() => setNewTaskAssignee(emp.id)}
                  >
                    <User size={12} color={isSelected ? '#FFFFFF' : Colors.textMuted} />
                    <Text
                      style={[
                        styles.empSelectChipText,
                        isSelected && styles.empSelectChipTextActive,
                      ]}
                    >
                      {emp.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Category</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6, flexWrap: 'wrap' }}>
              {['General', 'Lead', 'Client', 'Project', 'Service'].map(c => (
                <TouchableOpacity
                  key={c}
                  style={[
                    styles.priorityChip,
                    newTaskCategory === c && { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
                  ]}
                  onPress={() => setNewTaskCategory(c)}
                >
                  <Text
                    style={[
                      styles.priorityChipText,
                      newTaskCategory === c && { color: '#FFFFFF', fontWeight: 'bold' },
                    ]}
                  >
                    {c}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Due Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="YYYY-MM-DD"
              value={newTaskDue}
              onChangeText={setNewTaskDue}
            />

            <Text style={styles.inputLabel}>Priority</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 6 }}>
              {['High', 'Medium', 'Normal'].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityChip,
                    newTaskPriority === p && { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
                  ]}
                  onPress={() => setNewTaskPriority(p)}
                >
                  <Text
                    style={[
                      styles.priorityChipText,
                      newTaskPriority === p && { color: '#FFFFFF', fontWeight: 'bold' },
                    ]}
                  >
                    {p}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleCreateTask}
              >
                <Text style={styles.modalConfirmText}>Create</Text>
              </TouchableOpacity>
            </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: 13,
    color: Colors.text,
  },
  statusScrollWrapper: {
    marginVertical: 10,
  },
  statusScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  statusFilterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusFilterChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  statusFilterText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  statusFilterTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 30,
  },
  taskCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  checkCircle: {
    marginTop: 2,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  categorySub: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: '600',
    marginTop: 2,
  },
  taskDescSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 4,
    lineHeight: 16,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  highBadge: { backgroundColor: '#FEE2E2' },
  highText: { color: '#B91C1C' },
  medBadge: { backgroundColor: '#FEF3C7' },
  medText: { color: '#B45309' },
  normBadge: { backgroundColor: '#F1F5F9' },
  normText: { color: '#475569' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  dueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dueText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  assigneeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    maxWidth: 110,
  },
  assigneeChipText: {
    fontSize: 11,
    color: Colors.primaryDark,
    fontWeight: '600',
  },
  empSelectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  empSelectChipActive: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  empSelectChipText: {
    fontSize: 12,
    color: Colors.text,
  },
  empSelectChipTextActive: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  statusChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyCardTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 12,
  },
  emptyCardSub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
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
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 10,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 10,
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    backgroundColor: Colors.background,
  },
  priorityChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  priorityChipText: {
    fontSize: 12,
    color: Colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  modalCancelText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  modalConfirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
});

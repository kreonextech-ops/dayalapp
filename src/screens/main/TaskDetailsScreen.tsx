import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  CheckSquare,
  Clock,
  User,
  Calendar,
  CheckCircle2,
  Circle,
  FileText,
  MessageSquare,
  Plus,
  ChevronRight,
  Edit2,
  Check,
  Tag,
  Briefcase,
  Layers,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { createNotification } from '../../lib/notificationService';

const TASK_STATUSES = ['To Do', 'In Progress', 'Needs Approval', 'Completed'];

export default function TaskDetailsScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const { id } = route.params || {};
  const { user } = useAuth();

  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'Overview' | 'Checklist' | 'Comments' | 'Files' | 'Activity'>('Overview');

  // Sub-items
  const [checklist, setChecklist] = useState<any[]>([]);
  const [newCheckItem, setNewCheckItem] = useState('');
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [isPostingComment, setIsPostingComment] = useState(false);

  // Description
  const [taskDesc, setTaskDesc] = useState('');
  const [isEditDescModalOpen, setIsEditDescModalOpen] = useState(false);
  const [editDescDraft, setEditDescDraft] = useState('');
  const [isSavingDesc, setIsSavingDesc] = useState(false);

  // Assignee Management
  const [employees, setEmployees] = useState<any[]>([]);
  const [isAssigneeModalOpen, setIsAssigneeModalOpen] = useState(false);
  const [isSavingAssignee, setIsSavingAssignee] = useState(false);

  // Status modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('To Do');

  useEffect(() => {
    if (id) loadTaskFull();
  }, [id]);

  const loadTaskFull = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('tasks').select('*').eq('id', id).single();
      if (error) throw error;
      setTask(data);
      setSelectedStatus(data.status || 'To Do');

      // Parse checklist & description
      let meta: any = {};
      let extractedDesc = '';
      if (typeof data.description === 'string') {
        if (data.description.startsWith('{')) {
          try {
            meta = JSON.parse(data.description);
            extractedDesc = meta.instructions || meta.description || meta.old_description || '';
          } catch {
            extractedDesc = data.description;
          }
        } else {
          extractedDesc = data.description;
        }
      }
      setTaskDesc(extractedDesc);

      if (Array.isArray(meta.checklist)) {
        setChecklist(meta.checklist);
      } else {
        setChecklist([]);
      }

      // Fetch comments from lead_activities where reference matches or activity_group = 'task'
      const { data: cData } = await supabase
        .from('lead_activities')
        .select('*')
        .eq('activity_group', 'task_comment')
        .order('created_at', { ascending: false });

      setComments(cData || []);

      const { data: empData } = await supabase.from('employees').select('id, name, role, email').order('name');
      setEmployees(empData || []);
    } catch (err: any) {
      console.warn('Error loading task details:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReassignEmployee = async (newEmp: any) => {
    setIsSavingAssignee(true);
    try {
      const { error } = await supabase.from('tasks').update({ assignee_id: newEmp.id }).eq('id', id);
      if (error) throw error;

      setTask((prev: any) => ({ ...prev, assignee_id: newEmp.id }));
      setIsAssigneeModalOpen(false);

      // Trigger real-time notification to the assigned employee
      await createNotification({
        title: '📋 Task Assigned to You',
        message: `You were assigned: "${task.title || task.name}". Due date: ${task.due_date || 'Ongoing'}.`,
        module: 'task',
        referenceId: task.id,
        recipientRole: newEmp.role === 'Admin' ? 'Admin' : 'Employee',
        recipientUserId: newEmp.id,
        createdByName: user?.name || 'Staff',
      });

      // Audit activity
      await supabase.from('lead_activities').insert([
        {
          activity_type: 'Task Assigned',
          activity_group: 'task_audit',
          title: `Task assigned to ${newEmp.name}`,
          details: `Task: ${task.title || task.name}`,
          employee_name: user?.name || 'Staff',
        },
      ]);

      Alert.alert('Success', `Task assigned to ${newEmp.name}. Notification sent.`);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not assign employee');
    } finally {
      setIsSavingAssignee(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', id);
      if (error) throw error;

      setTask((prev: any) => ({ ...prev, status: newStatus }));
      setSelectedStatus(newStatus);
      setIsStatusModalOpen(false);

      // Log activity
      await supabase.from('lead_activities').insert([
        {
          activity_type: 'Task Status',
          activity_group: 'task_audit',
          title: `Task "${task.title || task.name}" set to ${newStatus}`,
          details: `Updated by ${user?.name || 'Staff'}`,
          employee_name: user?.name || 'Staff',
        },
      ]);

      loadTaskFull();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update task status');
    }
  };

  const handleSaveDescription = async () => {
    setIsSavingDesc(true);
    try {
      const trimmed = editDescDraft.trim();
      let nextVal = trimmed;
      if (typeof task.description === 'string' && task.description.startsWith('{')) {
        try {
          const meta = JSON.parse(task.description);
          meta.instructions = trimmed;
          meta.description = trimmed;
          nextVal = JSON.stringify(meta);
        } catch {
          nextVal = trimmed;
        }
      }

      const { error } = await supabase.from('tasks').update({ description: nextVal }).eq('id', id);
      if (error) throw error;
      setTaskDesc(trimmed);
      setTask((prev: any) => ({ ...prev, description: nextVal }));
      setIsEditDescModalOpen(false);
      Alert.alert('Success', 'Task description updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not update description');
    } finally {
      setIsSavingDesc(false);
    }
  };

  const handleToggleCheckItem = async (itemId: string) => {
    const updated = checklist.map(it => (it.id === itemId ? { ...it, done: !it.done } : it));
    setChecklist(updated);

    try {
      let meta: any = {};
      try {
        meta = typeof task.description === 'string' && task.description.startsWith('{')
          ? JSON.parse(task.description)
          : {};
      } catch {}

      meta.checklist = updated;
      await supabase.from('tasks').update({ description: JSON.stringify(meta) }).eq('id', id);
    } catch (e) {
      console.warn('Could not save checklist', e);
    }
  };

  const handleAddCheckItem = async () => {
    if (!newCheckItem.trim()) return;
    const newItem = {
      id: Date.now().toString(),
      title: newCheckItem.trim(),
      done: false,
    };
    const updated = [...checklist, newItem];
    setChecklist(updated);
    setNewCheckItem('');

    try {
      let meta: any = {};
      try {
        meta = typeof task.description === 'string' && task.description.startsWith('{')
          ? JSON.parse(task.description)
          : {};
      } catch {}

      meta.checklist = updated;
      await supabase.from('tasks').update({ description: JSON.stringify(meta) }).eq('id', id);
    } catch (e) {
      console.warn('Could not add checklist item', e);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    setIsPostingComment(true);
    try {
      const { error } = await supabase.from('lead_activities').insert([
        {
          activity_type: 'Task Comment',
          activity_group: 'task_comment',
          title: `Comment on Task: ${task.title || task.name}`,
          details: commentText.trim(),
          employee_name: user?.name || 'Staff',
        },
      ]);
      if (error) throw error;
      setCommentText('');
      loadTaskFull();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not post comment');
    } finally {
      setIsPostingComment(false);
    }
  };

  if (loading || !task) {
    return (
      <View style={[styles.center, { paddingTop: safeTop }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Task Workspace...</Text>
      </View>
    );
  }

  const isDone = task.status === 'Completed';

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.topBarTitleBox}>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {task.title || task.name}
          </Text>
          <Text style={styles.topBarSubtitle}>TASK ID: TSK-{task.id.toString().substring(0, 5).toUpperCase()}</Text>
        </View>

        <TouchableOpacity
          style={[styles.statusBadge, { backgroundColor: isDone ? '#ECFDF5' : '#EFF6FF' }]}
          onPress={() => setIsStatusModalOpen(true)}
        >
          <Text style={[styles.statusText, { color: isDone ? '#047857' : Colors.primaryDark }]}>
            {task.status || 'To Do'}
          </Text>
          <Edit2 size={12} color={isDone ? '#047857' : Colors.primaryDark} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {[
            { id: 'Overview', label: 'Overview' },
            { id: 'Checklist', label: `Checklist (${checklist.filter(c => c.done).length}/${checklist.length})` },
            { id: 'Comments', label: `Discussion (${comments.length})` },
            { id: 'Files', label: 'Deliverables' },
            { id: 'Activity', label: 'Activity Log' },
          ].map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, activeTab === tab.id && styles.activeTabButton]}
              onPress={() => setActiveTab(tab.id as any)}
            >
              <Text style={[styles.tabButtonText, activeTab === tab.id && styles.activeTabButtonText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ======================= OVERVIEW TAB ======================= */}
        {activeTab === 'Overview' && (
          <View>
            <View style={styles.card}>
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <CheckSquare size={24} color={Colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clientName}>{task.title || task.name}</Text>
                  <Text style={styles.companyName}>Category: {task.category || 'General'}</Text>
                  <Text style={styles.assignedTag}>Priority: {task.priority || 'Normal'}</Text>
                </View>
              </View>

              {/* Action Buttons */}
              <View style={styles.quickActionsBar}>
                <TouchableOpacity
                  style={[styles.actionChip, { backgroundColor: isDone ? Colors.primary : Colors.success }]}
                  onPress={() => handleUpdateStatus(isDone ? 'To Do' : 'Completed')}
                >
                  <CheckCircle2 size={15} color="#FFFFFF" />
                  <Text style={styles.actionChipText}>
                    {isDone ? 'Mark as Pending' : 'Mark Completed'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionChip, { backgroundColor: Colors.primaryDark }]}
                  onPress={() => setIsStatusModalOpen(true)}
                >
                  <Edit2 size={15} color="#FFFFFF" />
                  <Text style={styles.actionChipText}>Change Status</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Assignment Details</Text>

              <View style={styles.detailRow}>
                <Calendar size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Target Due Date:</Text>
                <Text style={styles.detailVal}>{task.due_date || 'No Deadline'}</Text>
              </View>

              <View style={styles.detailRow}>
                <User size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Assigned Staff:</Text>
                <TouchableOpacity
                  style={styles.assigneeBtn}
                  onPress={() => setIsAssigneeModalOpen(true)}
                >
                  <Text style={styles.assigneeBtnText}>
                    {employees.find(e => e.id === task.assignee_id)?.name || 'Tap to Assign Staff'}
                  </Text>
                  <Edit2 size={12} color={Colors.primaryDark} />
                </TouchableOpacity>
              </View>

              <View style={styles.detailRow}>
                <Tag size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Priority Level:</Text>
                <Text style={styles.detailVal}>{task.priority || 'High'}</Text>
              </View>
            </View>

            {/* Description & Instructions Card */}
            <View style={styles.card}>
              <View style={styles.cardHeaderFlex}>
                <Text style={styles.cardSectionTitle}>Description & Instructions</Text>
                <TouchableOpacity
                  style={styles.editDescBtn}
                  onPress={() => {
                    setEditDescDraft(taskDesc);
                    setIsEditDescModalOpen(true);
                  }}
                >
                  <Edit2 size={13} color={Colors.primaryDark} />
                  <Text style={styles.editDescBtnText}>Edit</Text>
                </TouchableOpacity>
              </View>

              {taskDesc ? (
                <Text style={styles.descriptionBody}>{taskDesc}</Text>
              ) : (
                <TouchableOpacity
                  style={styles.emptyDescBox}
                  onPress={() => {
                    setEditDescDraft('');
                    setIsEditDescModalOpen(true);
                  }}
                >
                  <Text style={styles.emptyDescText}>+ Add task instructions or detailed description</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* ======================= CHECKLIST TAB ======================= */}
        {activeTab === 'Checklist' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Task Checklist & Action Items</Text>
              <Text style={styles.subtext}>Tap items to mark as completed:</Text>

              <View style={styles.checklist}>
                {checklist.length > 0 ? (
                  checklist.map(it => (
                    <TouchableOpacity
                      key={it.id}
                      style={[styles.checklistItem, it.done && styles.checklistItemActive]}
                      onPress={() => handleToggleCheckItem(it.id)}
                    >
                      {it.done ? (
                        <CheckCircle2 size={20} color={Colors.success} />
                      ) : (
                        <Circle size={20} color={Colors.textMuted} />
                      )}
                      <Text style={[styles.checklistText, it.done && styles.checklistTextActive]}>
                        {it.title}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.emptyNotice}>No checklist items defined. Add action items below.</Text>
                )}
              </View>

              <View style={[styles.noteInputRow, { marginTop: 16 }]}>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Add new checklist item..."
                  value={newCheckItem}
                  onChangeText={setNewCheckItem}
                />
                <TouchableOpacity style={styles.postNoteBtn} onPress={handleAddCheckItem}>
                  <Text style={styles.postNoteBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* ======================= COMMENTS TAB ======================= */}
        {activeTab === 'Comments' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Internal Discussion Thread</Text>

              <View style={styles.noteInputRow}>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Type an update or comment on this task..."
                  value={commentText}
                  onChangeText={setCommentText}
                  multiline
                />
                <TouchableOpacity
                  style={[styles.postNoteBtn, isPostingComment && { opacity: 0.6 }]}
                  onPress={handleAddComment}
                  disabled={isPostingComment}
                >
                  <Text style={styles.postNoteBtnText}>Post</Text>
                </TouchableOpacity>
              </View>

              {comments.length > 0 ? (
                comments.map((c, i) => (
                  <View key={i} style={styles.commentItem}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>{c.employee_name || 'Staff'}</Text>
                      <Text style={styles.commentDate}>
                        {new Date(c.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <Text style={styles.commentBody}>{c.details || c.description}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyNotice}>No comments on this task yet.</Text>
              )}
            </View>
          </View>
        )}

        {/* ======================= FILES TAB ======================= */}
        {activeTab === 'Files' && (
          <View>
            <View style={styles.emptyCard}>
              <FileText size={36} color={Colors.textMuted} />
              <Text style={styles.emptyCardTitle}>No Deliverables Attached</Text>
              <Text style={styles.emptyCardSub}>Files and attachments associated with this task will appear here.</Text>
            </View>
          </View>
        )}

        {/* ======================= ACTIVITY TAB ======================= */}
        {activeTab === 'Activity' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Task Audit Trail</Text>
              <View style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineCard}>
                  <Text style={styles.timelineType}>Task Created</Text>
                  <Text style={styles.timelineDesc}>Task registered in company CRM pipeline</Text>
                  <Text style={styles.timelineAuthor}>
                    Date: {task.created_at ? new Date(task.created_at).toLocaleDateString('en-IN') : 'Recent'}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* ======================= CHANGE STATUS MODAL ======================= */}
      <Modal visible={isStatusModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Task Status</Text>

            <View style={styles.stagePicker}>
              {TASK_STATUSES.map(st => (
                <TouchableOpacity
                  key={st}
                  style={[
                    styles.stageOption,
                    selectedStatus === st && { borderColor: Colors.primaryDark, backgroundColor: '#EFF6FF' },
                  ]}
                  onPress={() => setSelectedStatus(st)}
                >
                  <Text
                    style={[
                      styles.stageOptionText,
                      selectedStatus === st && { color: Colors.primaryDark, fontWeight: 'bold' },
                    ]}
                  >
                    {st}
                  </Text>
                  {selectedStatus === st && <Check size={18} color={Colors.primaryDark} />}
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsStatusModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => handleUpdateStatus(selectedStatus)}
              >
                <Text style={styles.modalConfirmText}>Save Status</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================= EDIT DESCRIPTION MODAL ======================= */}
      <Modal visible={isEditDescModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Task Description & Instructions</Text>

            <TextInput
              style={[styles.noteInput, { minHeight: 120, textAlignVertical: 'top', marginVertical: 14 }]}
              placeholder="Enter comprehensive instructions, checklist requirements, or specifications..."
              value={editDescDraft}
              onChangeText={setEditDescDraft}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsEditDescModalOpen(false)}
                disabled={isSavingDesc}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, isSavingDesc && { opacity: 0.6 }]}
                onPress={handleSaveDescription}
                disabled={isSavingDesc}
              >
                <Text style={styles.modalConfirmText}>{isSavingDesc ? 'Saving...' : 'Save Description'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================= REASSIGN EMPLOYEE MODAL ======================= */}
      <Modal visible={isAssigneeModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Assign Task to Staff</Text>
            <Text style={styles.subtext}>Select an employee to assign responsibility for this task. They will receive an immediate notification.</Text>

            <ScrollView showsVerticalScrollIndicator={false} style={{ marginVertical: 8 }}>
              {employees.map(emp => {
                const isSelected = task.assignee_id === emp.id;
                return (
                  <TouchableOpacity
                    key={emp.id}
                    style={[
                      styles.assigneeOptionRow,
                      isSelected && styles.assigneeOptionRowActive,
                    ]}
                    onPress={() => handleReassignEmployee(emp)}
                    disabled={isSavingAssignee}
                  >
                    <View style={[styles.assigneeAvatar, isSelected && { backgroundColor: Colors.primaryDark }]}>
                      <Text style={[styles.assigneeAvatarText, isSelected && { color: '#FFFFFF' }]}>
                        {emp.name?.charAt(0) || 'U'}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.assigneeOptionName, isSelected && { color: Colors.primaryDark, fontWeight: 'bold' }]}>
                        {emp.name}
                      </Text>
                      <Text style={styles.assigneeOptionRole}>{emp.role || 'Staff'} • {emp.email || emp.phone || 'Active'}</Text>
                    </View>
                    {isSelected && <Check size={18} color={Colors.primaryDark} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setIsAssigneeModalOpen(false)}
              disabled={isSavingAssignee}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
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
    justifyContent: 'space-between',
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
  topBarTitleBox: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  topBarSubtitle: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
    marginTop: 1,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  tabBarWrapper: {
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tabScroll: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activeTabButton: {
    backgroundColor: Colors.primaryDark,
    borderColor: Colors.primaryDark,
  },
  tabButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  activeTabButtonText: {
    color: '#FFFFFF',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  clientName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text,
  },
  companyName: {
    fontSize: 13,
    color: Colors.primaryDark,
    fontWeight: '600',
    marginTop: 2,
  },
  assignedTag: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 4,
  },
  quickActionsBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  actionChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 12,
  },
  cardHeaderFlex: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  editDescBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  editDescBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  descriptionBody: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 20,
  },
  emptyDescBox: {
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  emptyDescText: {
    fontSize: 13,
    color: Colors.primaryDark,
    fontWeight: '600',
  },
  subtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    marginLeft: 8,
    width: 130,
  },
  detailVal: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
    flex: 1,
  },
  assigneeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  assigneeBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  assigneeOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 8,
  },
  assigneeOptionRowActive: {
    backgroundColor: '#EFF6FF',
    borderColor: Colors.primaryDark,
  },
  assigneeAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#E2E8F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  assigneeAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
  },
  assigneeOptionName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  assigneeOptionRole: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  checklist: {
    gap: 8,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  checklistItemActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  checklistText: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
  },
  checklistTextActive: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
  },
  noteInputRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  noteInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    backgroundColor: Colors.background,
    minHeight: 44,
  },
  postNoteBtn: {
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  postNoteBtnText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 13,
  },
  commentItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentAuthor: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.text,
  },
  commentDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  commentBody: {
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  emptyNotice: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 30,
    alignItems: 'center',
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
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginTop: 6,
    marginRight: 10,
  },
  timelineCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  timelineType: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  timelineDesc: {
    fontSize: 13,
    color: Colors.text,
    marginVertical: 4,
  },
  timelineAuthor: {
    fontSize: 11,
    color: Colors.textMuted,
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
    marginBottom: 14,
  },
  stagePicker: {
    gap: 8,
    marginBottom: 16,
  },
  stageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stageOptionText: {
    fontSize: 14,
    color: Colors.text,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 12,
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

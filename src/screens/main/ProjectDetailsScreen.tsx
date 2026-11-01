import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Linking,
  TextInput,
  Alert,
  Modal,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  Briefcase,
  User,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  IndianRupee,
  Phone,
  FileText,
  Layers,
  MapPin,
  MessageSquare,
  Plus,
  ChevronRight,
  Edit2,
  Check,
  Share2,
  TrendingUp,
  AlertCircle,
  Hammer,
  Users,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { createNotification } from '../../lib/notificationService';

const PROJECT_STATUSES = ['Pending', 'In Progress', 'On Hold', 'In Review', 'Completed', 'Cancelled'];

const DEFAULT_CONSTRUCTION_STEPS = [
  { id: 1, order: 1, title: 'Site Setup & Mobilization', completed: false },
  { id: 2, order: 2, title: 'Excavation & Foundation', completed: false },
  { id: 3, order: 3, title: 'Structural Framework & Superstructure', completed: false },
  { id: 4, order: 4, title: 'Masonry & Core Works', completed: false },
  { id: 5, order: 5, title: 'MEP Rough-ins (Plumbing, Electrical, HVAC)', completed: false },
  { id: 6, order: 6, title: 'Plastering, Flooring & Finishes', completed: false },
  { id: 7, order: 7, title: 'Handover & Final Inspection', completed: false },
];

export default function ProjectDetailsScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const { id } = route.params || {};
  const { user, isAdmin } = useAuth();

  const [project, setProject] = useState<any>(null);
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    'Overview' | 'Scope' | 'Workspace' | 'Steps' | 'Payments' | 'FollowUps' | 'Tasks' | 'Timeline' | 'Communication'
  >('Overview');

  // Sub-data collections
  const [tasks, setTasks] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [steps, setSteps] = useState<any[]>(DEFAULT_CONSTRUCTION_STEPS);
  const [comments, setComments] = useState<any[]>([]);

  // Assigned Team state
  const [employees, setEmployees] = useState<any[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Payment Recording Modal
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payDate, setPayDate] = useState(new Date().toISOString().split('T')[0]);
  const [payMode, setPayMode] = useState('Bank Transfer');
  const [payNote, setPayNote] = useState('');
  const [isSavingPay, setIsSavingPay] = useState(false);

  // Status modal
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('In Progress');

  // New Note state
  const scrollViewRef = useRef<any>(null);
  const [notesYPos, setNotesYPos] = useState(0);
  const [noteText, setNoteText] = useState('');
  const [isPostingNote, setIsPostingNote] = useState(false);

  // Follow-up modal
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpDesc, setFollowUpDesc] = useState('');
  const [followUpDue, setFollowUpDue] = useState(new Date().toISOString().split('T')[0]);
  const [followUpPriority, setFollowUpPriority] = useState('High');

  // Task modal
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskAssignee, setTaskAssignee] = useState('');
  const [taskDue, setTaskDue] = useState(new Date().toISOString().split('T')[0]);
  const [taskPriority, setTaskPriority] = useState('High');

  // Communication modal
  const [isCommModalOpen, setIsCommModalOpen] = useState(false);
  const [commType, setCommType] = useState('Call');
  const [commResponse, setCommResponse] = useState('');

  useEffect(() => {
    if (id) {
      loadProjectFull();
    }
  }, [id]);

  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const loadProjectFull = async () => {
    setLoading(true);
    try {
      const { data: projData, error: projErr } = await supabase.from('projects').select('*').eq('id', id).single();
      if (projErr) throw projErr;
      setProject(projData);
      setSelectedStatus(projData.status || 'In Progress');

      // Parse metadata from description
      let parsedMeta: any = {};
      try {
        parsedMeta = typeof projData.description === 'string' && projData.description.startsWith('{')
          ? JSON.parse(projData.description)
          : {};
      } catch {
        parsedMeta = {};
      }

      if (Array.isArray(parsedMeta.steps) && parsedMeta.steps.length > 0) {
        setSteps(parsedMeta.steps.map((s: any, idx: number) => ({
          ...s,
          id: s.id || idx + 1,
          order: s.order || idx + 1,
          title: s.title || s.name || `Phase ${idx + 1}`,
          completed: !!(s.completed ?? s.done),
        })));
      } else {
        setSteps(DEFAULT_CONSTRUCTION_STEPS);
      }

      // Fetch client
      if (projData.client_id) {
        const { data: cData } = await supabase.from('clients').select('*').eq('id', projData.client_id).single();
        if (cData) setClient(cData);
      }

      // Concurrently fetch linked tasks, activities, and docs
      const [taskRes, actRes, docRes] = await Promise.all([
        supabase
          .from('tasks')
          .select('*')
          .or(`project_id.eq.${id}${projData.client_id ? `,client_id.eq.${projData.client_id}` : ''}`)
          .order('created_at', { ascending: false }),
        supabase
          .from('lead_activities')
          .select('*')
          .or(`project_id.eq.${id}${projData.client_id ? `,client_id.eq.${projData.client_id}` : ''}`)
          .order('created_at', { ascending: false }),
        supabase
          .from('documents')
          .select('*')
          .or(`project_id.eq.${id}${projData.client_id ? `,client_id.eq.${projData.client_id}` : ''}`)
          .order('created_at', { ascending: false }),
      ]);

      setTasks(taskRes.data || []);
      const allActs = actRes.data || [];
      setActivities(allActs);
      setComments(allActs.filter((a: any) => a.activity_group === 'comment' || a.activity_type === 'Comment'));
      setDocuments(docRes.data || []);

      // Fetch employees for team assignment
      const { data: empData } = await supabase.from('employees').select('id, name, designation, role').order('name');
      if (empData) setEmployees(empData);
    } catch (err: any) {
      console.warn('Error loading project details:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', id);
      if (error) throw error;

      setProject((prev: any) => ({ ...prev, status: newStatus }));
      setSelectedStatus(newStatus);
      setIsStatusModalOpen(false);

      await supabase.from('lead_activities').insert([
        {
          project_id: id,
          client_id: project.client_id || null,
          activity_type: 'Status Change',
          activity_group: 'Timeline',
          title: `Project Status Changed to ${newStatus}`,
          details: `Stage updated by ${user?.name || 'Site Incharge'}`,
          employee_name: user?.name || 'Staff',
        },
      ]);

      await createNotification({
        title: 'Project Stage Updated',
        message: `${project.name} stage changed to "${newStatus}"`,
        module: 'project',
        referenceId: id,
        recipientRole: 'All_Staff',
        createdByName: user?.name,
      });

      loadProjectFull();
    } catch (e: any) {
      Alert.alert('Update Failed', e.message || 'Could not update status');
    }
  };

  const handleToggleStep = async (stepId: any) => {
    const updatedSteps = steps.map(s => {
      if (s.id === stepId) {
        const nextVal = !(s.completed ?? s.done);
        return { ...s, completed: nextVal, done: nextVal };
      }
      return s;
    });
    setSteps(updatedSteps);

    const completedCount = updatedSteps.filter(s => s.completed ?? s.done).length;
    const computedPercentage = Math.round((completedCount / updatedSteps.length) * 100);

    try {
      let parsedMeta: any = {};
      try {
        parsedMeta = typeof project.description === 'string' && project.description.startsWith('{')
          ? JSON.parse(project.description)
          : {};
      } catch {}

      parsedMeta.steps = updatedSteps;
      parsedMeta.progress = computedPercentage;

      const { error } = await supabase
        .from('projects')
        .update({
          description: JSON.stringify(parsedMeta),
          progress_details: { percentage: computedPercentage },
        })
        .eq('id', id);

      if (!error) {
        setProject((prev: any) => ({
          ...prev,
          progress_details: { percentage: computedPercentage },
        }));
      }
    } catch (e: any) {
      console.warn('Failed to save step progress', e.message);
    }
  };

  const handleAddPayment = async () => {
    if (!payAmount.trim()) {
      Alert.alert('Required', 'Please enter payment amount.');
      return;
    }
    setIsSavingPay(true);
    try {
      let parsedMeta: any = {};
      try {
        parsedMeta = typeof project?.description === 'string' && project.description.startsWith('{')
          ? JSON.parse(project.description)
          : {};
      } catch {}

      const currentPayments = Array.isArray(parsedMeta.payments) ? parsedMeta.payments : [];
      const newPayRecord = {
        id: Date.now(),
        amount: payAmount.trim(),
        date: payDate,
        mode: payMode,
        note: payNote.trim(),
        recorded_by: user?.name || 'Staff',
        recorded_at: new Date().toISOString(),
      };

      const updatedPayments = [...currentPayments, newPayRecord];
      parsedMeta.payments = updatedPayments;

      const { error: projErr } = await supabase
        .from('projects')
        .update({ description: JSON.stringify(parsedMeta) })
        .eq('id', id);

      if (projErr) throw projErr;

      await supabase.from('lead_activities').insert([
        {
          project_id: id,
          client_id: project.client_id || null,
          employee_name: user?.name || 'Staff',
          activity_group: 'Timeline',
          activity_type: 'Payment',
          title: `Payment Recorded: ₹${parseFloat(payAmount).toLocaleString('en-IN')}`,
          details: `₹${parseFloat(payAmount).toLocaleString('en-IN')} via ${payMode} on ${payDate}.${payNote ? ' Note: ' + payNote : ''}`,
        },
      ]);

      setPayAmount('');
      setPayNote('');
      setIsPaymentModalOpen(false);
      loadProjectFull();
      Alert.alert('Success', 'Payment receipt recorded successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not record payment');
    } finally {
      setIsSavingPay(false);
    }
  };

  const EXECUTION_SERVICES = [
    'Construction',
    'Commercial Construction',
    'Industrial Setup',
    'Renovation & Remodeling',
    'Interior Execution',
    'Landscaping',
  ];

  const handleToggleRequirement = async (req: string) => {
    let parsedMeta: any = {};
    try {
      parsedMeta = typeof project.description === 'string' && project.description.startsWith('{')
        ? JSON.parse(project.description)
        : {};
    } catch {}

    const currentReqs: string[] = Array.isArray(parsedMeta.requirements) ? parsedMeta.requirements : [];
    const updatedReqs = currentReqs.includes(req)
      ? currentReqs.filter(r => r !== req)
      : [...currentReqs, req];

    parsedMeta.requirements = updatedReqs;

    try {
      const { error } = await supabase
        .from('projects')
        .update({ description: JSON.stringify(parsedMeta) })
        .eq('id', id);

      if (!error) {
        setProject((prev: any) => ({ ...prev, description: JSON.stringify(parsedMeta) }));
      }
    } catch (e: any) {
      console.warn('Failed to update scope requirement', e.message);
    }
  };

  const handleAddComment = async () => {
    if (!noteText.trim()) return;
    setIsPostingNote(true);
    try {
      const { error } = await supabase.from('lead_activities').insert([
        {
          project_id: id,
          client_id: project.client_id || null,
          activity_type: 'Comment',
          activity_group: 'comment',
          title: 'Site Execution Note',
          details: noteText.trim(),
          employee_name: user?.name || 'Site Supervisor',
        },
      ]);
      if (error) throw error;
      setNoteText('');
      loadProjectFull();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to post note');
    } finally {
      setIsPostingNote(false);
    }
  };

  const handleToggleAssignEmployee = async (empId: string, empName: string) => {
    let currentAssigned = (project?.assigned_to || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const exists = currentAssigned.includes(empId) || currentAssigned.includes(empName);
    let nextAssigned: string[];
    if (exists) {
      nextAssigned = currentAssigned.filter((x: string) => x !== empId && x !== empName);
    } else {
      nextAssigned = [...currentAssigned, empName || empId];
    }
    const newAssignedString = nextAssigned.join(', ');

    setProject((prev: any) => ({ ...prev, assigned_to: newAssignedString }));

    try {
      const { error } = await supabase.from('projects').update({ assigned_to: newAssignedString || null }).eq('id', id);
      if (error) throw error;
    } catch (e: any) {
      console.warn('Failed to update assigned employee', e.message);
    }
  };

  const handleCreateFollowUp = async () => {
    if (!followUpTitle.trim()) {
      Alert.alert('Required', 'Please enter follow-up objective.');
      return;
    }
    try {
      const { error } = await supabase.from('tasks').insert([
        {
          name: followUpTitle.trim(),
          title: followUpTitle.trim(),
          description: followUpDesc.trim() || null,
          due_date: followUpDue,
          project_id: id,
          client_id: project.client_id || null,
          priority: followUpPriority,
          status: 'Pending',
          type: 'followup',
          custom_category: 'Follow Up',
        },
      ]);
      if (error) throw error;
      setIsFollowUpModalOpen(false);
      setFollowUpTitle('');
      setFollowUpDesc('');
      loadProjectFull();
      Alert.alert('Scheduled', 'Follow-up appointment booked.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not schedule follow-up');
    }
  };

  const handleCreateTask = async () => {
    if (!taskTitle.trim()) {
      Alert.alert('Required', 'Please enter task title.');
      return;
    }
    try {
      const targetAssigneeId = taskAssignee || user?.id || null;
      const { data, error } = await supabase.from('tasks').insert([
        {
          name: taskTitle.trim(),
          title: taskTitle.trim(),
          description: taskDesc.trim() || null,
          due_date: taskDue,
          project_id: id,
          client_id: project.client_id || null,
          priority: taskPriority,
          status: 'To Do',
          category: 'Project',
          assignee_id: targetAssigneeId,
          creator_id: user?.id || null,
        },
      ]).select();
      if (error) throw error;

      if (targetAssigneeId) {
        const targetEmp = employees.find(e => e.id === targetAssigneeId);
        await createNotification({
          title: '📋 New Site Task Assigned',
          message: `Task: "${taskTitle.trim()}" for project ${project.name || 'Site'}. Due: ${taskDue}`,
          module: 'task',
          referenceId: data?.[0]?.id,
          recipientRole: targetEmp?.role === 'Admin' ? 'Admin' : 'Employee',
          recipientUserId: targetAssigneeId,
          createdByName: user?.name || 'Staff',
        });
      }

      setIsTaskModalOpen(false);
      setTaskTitle('');
      setTaskDesc('');
      setTaskAssignee('');
      loadProjectFull();
      Alert.alert('Success', 'Site task created.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not create task');
    }
  };

  const handleLogCommunication = async () => {
    if (!commResponse.trim()) {
      Alert.alert('Required', 'Please enter interaction summary.');
      return;
    }
    try {
      const { error } = await supabase.from('lead_activities').insert([
        {
          project_id: id,
          client_id: project.client_id || null,
          activity_type: commType,
          activity_group: 'Communication',
          title: `${commType} Recorded (Site)`,
          details: commResponse.trim(),
          employee_name: user?.name || 'Site Staff',
        },
      ]);
      if (error) throw error;
      setIsCommModalOpen(false);
      setCommResponse('');
      loadProjectFull();
      Alert.alert('Saved', 'Communication record logged.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to log communication');
    }
  };

  // Financial parsing
  let meta: any = {};
  try {
    meta = typeof project?.description === 'string' && project.description.startsWith('{')
      ? JSON.parse(project.description)
      : {};
  } catch {}

  const financials = meta.financials || { total: project?.budget || 0, advance: 0 };
  const payments = Array.isArray(meta.payments) ? meta.payments : [];
  const totalAmount = parseFloat(financials.total || project?.budget || 0) || 0;
  const advance = parseFloat(financials.advance || 0) || 0;
  const paidPayments = payments.reduce((acc: number, p: any) => acc + (parseFloat(p.amount) || 0), 0);
  const totalPaid = advance + paidPayments;
  const balanceDue = Math.max(totalAmount - totalPaid, 0);
  const progressPercent = project?.progress_details?.percentage || meta.progress || Math.round((steps.filter(s => s.done).length / steps.length) * 100);

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'completed':
        return Colors.success;
      case 'in progress':
        return Colors.primaryDark;
      case 'on hold':
      case 'in review':
        return '#D97706';
      case 'cancelled':
        return Colors.danger;
      default:
        return '#2563EB';
    }
  };

  if (loading || !project) {
    return (
      <View style={[styles.center, { paddingTop: safeTop }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Construction Site...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.topBarTitleBox}>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {project.name}
          </Text>
          <Text style={styles.topBarSubtitle}>SITE ID: PRJ-{project.id.substring(0, 6).toUpperCase()}</Text>
        </View>

        <TouchableOpacity
          style={[styles.statusBadge, { backgroundColor: getStatusColor(project.status) + '15' }]}
          onPress={() => setIsStatusModalOpen(true)}
        >
          <Text style={[styles.statusText, { color: getStatusColor(project.status) }]}>
            {project.status || 'In Progress'}
          </Text>
          <Edit2 size={12} color={getStatusColor(project.status)} style={{ marginLeft: 4 }} />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {[
            { id: 'Overview', label: 'Overview' },
            { id: 'Scope', label: 'Scope & Specs' },
            { id: 'Workspace', label: `Workspace (${documents.length})` },
            { id: 'Steps', label: `Milestones (${progressPercent}%)` },
            { id: 'Payments', label: 'Payments' },
            { id: 'FollowUps', label: `Follow-Ups (${tasks.filter(t => t.type === 'followup').length})` },
            { id: 'Tasks', label: `Tasks (${tasks.length})` },
            { id: 'Timeline', label: 'Timeline' },
            { id: 'Communication', label: 'Communication' },
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

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 40 : 120 },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* ======================= OVERVIEW TAB ======================= */}
        {activeTab === 'Overview' && (
          <View>
            {/* Site Hero Card */}
            <View style={styles.card}>
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <Hammer size={24} color={Colors.primaryDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.clientName}>{project.name}</Text>
                  <Text style={styles.companyName}>
                    {client ? `Client: ${client.name}` : 'Direct Commercial Site'}
                  </Text>
                  <Text style={styles.assignedTag}>
                    Incharge: {project.assigned_to || 'Assigned to Engineering'}
                  </Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressContainer}>
                <View style={styles.progressHeaderRow}>
                  <Text style={styles.progressHeading}>Construction Completion</Text>
                  <Text style={styles.progressPercentText}>{progressPercent}%</Text>
                </View>
                <View style={styles.progressBarTrack}>
                  <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
                </View>
              </View>

              {/* Quick Actions */}
              <View style={styles.quickActionsBar}>
                {client?.phone && (
                  <TouchableOpacity
                    style={[styles.actionChip, { backgroundColor: '#10B981' }]}
                    onPress={() => Linking.openURL(`tel:${client.phone}`)}
                  >
                    <Phone size={15} color="#FFFFFF" />
                    <Text style={styles.actionChipText}>Call Client</Text>
                  </TouchableOpacity>
                )}
                {client?.phone && (
                  <TouchableOpacity
                    style={[styles.actionChip, { backgroundColor: '#25D366' }]}
                    onPress={() => {
                      const clean = client.phone.replace(/[^0-9]/g, '');
                      Linking.openURL(`https://wa.me/${clean}`);
                    }}
                  >
                    <Share2 size={15} color="#FFFFFF" />
                    <Text style={styles.actionChipText}>WhatsApp</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.actionChip, { backgroundColor: Colors.primary }]}
                  onPress={() => setIsFollowUpModalOpen(true)}
                >
                  <Plus size={15} color="#FFFFFF" />
                  <Text style={styles.actionChipText}>Follow-Up</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionChip, { backgroundColor: '#4F46E5' }]}
                  onPress={() => setIsCommModalOpen(true)}
                >
                  <MessageSquare size={15} color="#FFFFFF" />
                  <Text style={styles.actionChipText}>Log Note</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Assigned Engineering Team Card */}
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Users size={18} color={Colors.primaryDark} />
                  <Text style={[styles.cardSectionTitle, { marginBottom: 0 }]}>Assigned Engineering Team</Text>
                </View>
                <TouchableOpacity
                  style={[styles.smallAddBtn, { backgroundColor: Colors.primaryDark }]}
                  onPress={() => setIsAssignModalOpen(true)}
                >
                  <Plus size={14} color="#FFFFFF" />
                  <Text style={styles.smallAddBtnText}>Assign Staff</Text>
                </TouchableOpacity>
              </View>

              {employees.length > 0 ? (
                <View style={{ gap: 8 }}>
                  {employees
                    .filter((emp) => {
                      const cur = (project.assigned_to || '').toLowerCase();
                      return cur.includes((emp.name || '').toLowerCase()) || cur.includes((emp.id || '').toLowerCase());
                    })
                    .map((emp) => (
                      <View key={emp.id} style={styles.teamMemberRow}>
                        <View style={styles.teamAvatar}>
                          <Text style={styles.teamAvatarText}>{emp.name?.charAt(0) || 'U'}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.teamMemberName}>{emp.name}</Text>
                          <Text style={styles.teamMemberRole}>{emp.designation || emp.role || 'Site Engineer'}</Text>
                        </View>
                        <TouchableOpacity
                          onPress={() => handleToggleAssignEmployee(emp.id, emp.name)}
                          style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, backgroundColor: '#FEE2E2' }}
                        >
                          <Text style={{ fontSize: 11, color: Colors.danger, fontWeight: 'bold' }}>Remove</Text>
                        </TouchableOpacity>
                      </View>
                    ))}

                  {employees.filter((emp) => {
                    const cur = (project.assigned_to || '').toLowerCase();
                    return cur.includes((emp.name || '').toLowerCase()) || cur.includes((emp.id || '').toLowerCase());
                  }).length === 0 && (
                    <Text style={styles.emptyNotice}>
                      No specific site engineers assigned yet. Tap 'Assign Staff' to assign team.
                    </Text>
                  )}
                </View>
              ) : (
                <Text style={styles.emptyNotice}>Loading engineering team...</Text>
              )}
            </View>

            {/* Financial Summary */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Financial Position</Text>
              <View style={styles.metricsGrid}>
                <View style={[styles.metricCard, { backgroundColor: '#F0FDF4' }]}>
                  <Text style={styles.metricLabel}>Total Budget</Text>
                  <Text style={[styles.metricValue, { color: '#166534' }]}>
                    ₹{totalAmount.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: '#EFF6FF' }]}>
                  <Text style={styles.metricLabel}>Received</Text>
                  <Text style={[styles.metricValue, { color: '#1E40AF' }]}>
                    ₹{totalPaid.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: '#FEF2F2' }]}>
                  <Text style={styles.metricLabel}>Pending Due</Text>
                  <Text style={[styles.metricValue, { color: '#991B1B' }]}>
                    ₹{balanceDue.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Site & Client Details */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Site Specifications</Text>

              <View style={styles.detailRow}>
                <User size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Client Name:</Text>
                <Text style={styles.detailVal}>{client?.name || 'Direct / Undefined'}</Text>
              </View>

              <View style={styles.detailRow}>
                <MapPin size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Site Location:</Text>
                <Text style={styles.detailVal}>{project.location || client?.address || 'Siliguri, West Bengal'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Calendar size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Commencement:</Text>
                <Text style={styles.detailVal}>
                  {project.start_date || (project.created_at ? new Date(project.created_at).toLocaleDateString('en-IN') : 'Scheduled')}
                </Text>
              </View>

              <View style={styles.detailRow}>
                <Clock size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Target Handover:</Text>
                <Text style={styles.detailVal}>{project.end_date || meta.timeline || 'On Schedule'}</Text>
              </View>
            </View>

            {/* Discussion Feed */}
            <View style={styles.card} onLayout={(e) => setNotesYPos(e.nativeEvent.layout.y)}>
              <Text style={styles.cardSectionTitle}>Site Log & Engineering Updates</Text>

              <View style={styles.noteInputRow}>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Add site daily log / material delivery note..."
                  value={noteText}
                  onChangeText={setNoteText}
                  multiline
                  onFocus={() => {
                    setTimeout(() => {
                      scrollViewRef.current?.scrollToEnd({ animated: true });
                    }, 150);
                  }}
                />
                <TouchableOpacity
                  style={[styles.postNoteBtn, isPostingNote && { opacity: 0.6 }]}
                  onPress={handleAddComment}
                  disabled={isPostingNote}
                >
                  <Text style={styles.postNoteBtnText}>Post</Text>
                </TouchableOpacity>
              </View>

              {comments.length > 0 ? (
                comments.map((c, i) => (
                  <View key={i} style={styles.commentItem}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentAuthor}>{c.employee_name || 'Site Incharge'}</Text>
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
                <Text style={styles.emptyNotice}>No site execution logs recorded yet.</Text>
              )}
            </View>
          </View>
        )}

        {/* ======================= SCOPE TAB ======================= */}
        {activeTab === 'Scope' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Service Requirements</Text>
              <Text style={styles.subtext}>Tap to toggle the execution scopes applicable for this site:</Text>

              <View style={{ gap: 8, marginTop: 10 }}>
                {EXECUTION_SERVICES.map((srv) => {
                  const reqs: string[] = Array.isArray(meta.requirements) ? meta.requirements : [];
                  const isChecked = reqs.includes(srv);
                  return (
                    <TouchableOpacity
                      key={srv}
                      style={[
                        styles.checklistItem,
                        isChecked && styles.checklistItemActive,
                      ]}
                      onPress={() => handleToggleRequirement(srv)}
                    >
                      {isChecked ? (
                        <CheckCircle2 size={20} color={Colors.success} />
                      ) : (
                        <Circle size={20} color={Colors.textMuted} />
                      )}
                      <Text
                        style={[
                          styles.checklistText,
                          isChecked && styles.checklistTextActive,
                          { flex: 1 },
                        ]}
                      >
                        {srv}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {(meta.area || meta.structure_type || meta.concrete_grade || meta.steel_grade || meta.finishing || meta.notes) && (
              <View style={styles.card}>
                <Text style={styles.cardSectionTitle}>Site Specifications</Text>
                {meta.area && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Built-up Area:</Text>
                    <Text style={styles.detailVal}>{meta.area}</Text>
                  </View>
                )}
                {meta.structure_type && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Structure Type:</Text>
                    <Text style={styles.detailVal}>{meta.structure_type}</Text>
                  </View>
                )}
                {meta.concrete_grade && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Grade of Concrete:</Text>
                    <Text style={styles.detailVal}>{meta.concrete_grade}</Text>
                  </View>
                )}
                {meta.steel_grade && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Steel Specification:</Text>
                    <Text style={styles.detailVal}>{meta.steel_grade}</Text>
                  </View>
                )}
                {meta.finishing && (
                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Finishing Standard:</Text>
                    <Text style={styles.detailVal}>{meta.finishing}</Text>
                  </View>
                )}
                {meta.notes && (
                  <View style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border }}>
                    <Text style={[styles.detailLabel, { width: '100%', marginBottom: 4 }]}>Architectural Remarks:</Text>
                    <Text style={styles.detailVal}>{meta.notes}</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* ======================= WORKSPACE TAB ======================= */}
        {activeTab === 'Workspace' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Site Blueprints & Drawings</Text>
            </View>

            {documents.length > 0 ? (
              documents.map(d => (
                <View key={d.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <FileText size={20} color={Colors.primary} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{d.name || d.title || 'Drawing Blueprint'}</Text>
                      <Text style={styles.itemId}>
                        Uploaded: {new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                    {d.file_url && (
                      <TouchableOpacity
                        style={styles.openBtn}
                        onPress={() => Linking.openURL(d.file_url)}
                      >
                        <Text style={styles.openBtnText}>Open</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <FileText size={36} color={Colors.textMuted} />
                <Text style={styles.emptyCardTitle}>No Drawings Uploaded</Text>
                <Text style={styles.emptyCardSub}>Blueprints, elevations, and structural drawings will appear here.</Text>
              </View>
            )}
          </View>
        )}

        {/* ======================= STEPS TAB ======================= */}
        {activeTab === 'Steps' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Construction Milestones</Text>
              <Text style={styles.subtext}>Tap to toggle completion for each phase of site execution:</Text>

              <View style={styles.checklist}>
                {steps.map((st, idx) => {
                  const isDone = !!(st.completed ?? st.done);
                  return (
                    <TouchableOpacity
                      key={st.id || idx}
                      style={[styles.checklistItem, isDone && styles.checklistItemActive]}
                      onPress={() => handleToggleStep(st.id)}
                    >
                      {isDone ? (
                        <CheckCircle2 size={20} color={Colors.success} />
                      ) : (
                        <Circle size={20} color={Colors.textMuted} />
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.checklistText, isDone && styles.checklistTextActive]}>
                          {st.title || st.name}
                        </Text>
                        <Text style={styles.checklistStepNum}>Phase {st.order || idx + 1}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>
        )}

        {/* ======================= PAYMENTS TAB ======================= */}
        {activeTab === 'Payments' && (
          <View>
            <View style={styles.card}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={[styles.cardSectionTitle, { marginBottom: 0 }]}>Financial Ledger</Text>
                <TouchableOpacity
                  style={styles.smallAddBtn}
                  onPress={() => setIsPaymentModalOpen(true)}
                >
                  <Plus size={14} color="#FFFFFF" />
                  <Text style={styles.smallAddBtnText}>Record Payment</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.metricsGrid}>
                <View style={[styles.metricCard, { backgroundColor: '#F0FDF4' }]}>
                  <Text style={styles.metricLabel}>Total Contract</Text>
                  <Text style={[styles.metricValue, { color: '#166534' }]}>
                    ₹{totalAmount.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: '#EFF6FF' }]}>
                  <Text style={styles.metricLabel}>Total Paid</Text>
                  <Text style={[styles.metricValue, { color: '#1E40AF' }]}>
                    ₹{totalPaid.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: '#FEF2F2' }]}>
                  <Text style={styles.metricLabel}>Pending Due</Text>
                  <Text style={[styles.metricValue, { color: '#991B1B' }]}>
                    ₹{balanceDue.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Payment Milestone Receipts</Text>
              {advance > 0 && (
                <View style={styles.finItemRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.finItemName}>Initial Project Advance</Text>
                    <Text style={styles.finItemSub}>Booking & Mobilization</Text>
                  </View>
                  <Text style={[styles.finItemVal, { color: Colors.success }]}>
                    ₹{advance.toLocaleString('en-IN')}
                  </Text>
                </View>
              )}

              {payments.length > 0 ? (
                payments.map((p: any, idx: number) => (
                  <View key={idx} style={styles.finItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.finItemName}>{p.title || p.note || `Stage Payment #${idx + 1}`}</Text>
                      <Text style={styles.finItemSub}>
                        {p.date || 'Received'}{p.mode ? ` • ${p.mode}` : ''}{p.recorded_by ? ` • By ${p.recorded_by}` : ''}
                      </Text>
                    </View>
                    <Text style={[styles.finItemVal, { color: Colors.success }]}>
                      ₹{(parseFloat(p.amount) || 0).toLocaleString('en-IN')}
                    </Text>
                  </View>
                ))
              ) : advance === 0 ? (
                <Text style={styles.emptyNotice}>No payments recorded for this project yet. Tap 'Record Payment' to log a client receipt.</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* ======================= FOLLOW UPS TAB ======================= */}
        {activeTab === 'FollowUps' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Project Follow-Ups</Text>
              <TouchableOpacity
                style={styles.smallAddBtn}
                onPress={() => setIsFollowUpModalOpen(true)}
              >
                <Plus size={14} color="#FFFFFF" />
                <Text style={styles.smallAddBtnText}>Schedule</Text>
              </TouchableOpacity>
            </View>

            {tasks.filter(t => t.type === 'followup' || t.custom_category === 'Follow Up').length > 0 ? (
              tasks
                .filter(t => t.type === 'followup' || t.custom_category === 'Follow Up')
                .map(t => (
                  <View key={t.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{t.name || t.title}</Text>
                        <Text style={styles.itemId}>Due: {t.due_date || 'No Date'}</Text>
                      </View>
                      <View style={[styles.itemBadge, { backgroundColor: '#FEF3C7' }]}>
                        <Text style={[styles.itemBadgeText, { color: '#B45309' }]}>
                          {t.priority || 'High'}
                        </Text>
                      </View>
                    </View>
                    {!!t.description && (
                      <Text style={styles.itemSubText} numberOfLines={3}>
                        {t.description}
                      </Text>
                    )}
                  </View>
                ))
            ) : (
              <View style={styles.emptyCard}>
                <Clock size={36} color={Colors.textMuted} />
                <Text style={styles.emptyCardTitle}>No Pending Follow-ups</Text>
                <Text style={styles.emptyCardSub}>Keep this site on track with timely client check-ins.</Text>
              </View>
            )}
          </View>
        )}

        {/* ======================= TASKS TAB ======================= */}
        {activeTab === 'Tasks' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Site Action Items</Text>
              <TouchableOpacity
                style={styles.smallAddBtn}
                onPress={() => setIsTaskModalOpen(true)}
              >
                <Plus size={14} color="#FFFFFF" />
                <Text style={styles.smallAddBtnText}>New Task</Text>
              </TouchableOpacity>
            </View>

            {tasks.length > 0 ? (
              tasks.map(t => (
                <View key={t.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{t.name || t.title}</Text>
                      <Text style={styles.itemId}>Due: {t.due_date || 'Ongoing'}</Text>
                      <Text style={styles.timelineAuthor}>
                        Assigned: {employees.find(e => e.id === t.assignee_id)?.name || 'Unassigned'}
                      </Text>
                    </View>
                    <View style={[styles.itemBadge, { backgroundColor: Colors.surface }]}>
                      <Text style={styles.itemBadgeText}>{t.status || 'To Do'}</Text>
                    </View>
                  </View>
                  {!!t.description && (
                    <Text style={styles.itemSubText} numberOfLines={3}>
                      {t.description}
                    </Text>
                  )}
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <CheckCircle2 size={36} color={Colors.textMuted} />
                <Text style={styles.emptyCardTitle}>All Site Tasks Cleared</Text>
                <Text style={styles.emptyCardSub}>No outstanding engineering tasks for this site.</Text>
              </View>
            )}
          </View>
        )}

        {/* ======================= TIMELINE TAB ======================= */}
        {activeTab === 'Timeline' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Site Audit & Milestone Timeline</Text>
            </View>

            {activities.length > 0 ? (
              activities.map((a, i) => (
                <View key={i} style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineCard}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.timelineType}>{a.activity_type || a.title || 'Event'}</Text>
                      <Text style={styles.commentDate}>
                        {new Date(a.created_at).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <Text style={styles.timelineDesc}>{a.details || a.description}</Text>
                    <Text style={styles.timelineAuthor}>Logged by: {a.employee_name || 'Site Incharge'}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Clock size={36} color={Colors.textMuted} />
                <Text style={styles.emptyCardTitle}>No Timeline Entries</Text>
                <Text style={styles.emptyCardSub}>Phase changes and site logs appear here.</Text>
              </View>
            )}
          </View>
        )}

        {/* ======================= COMMUNICATION TAB ======================= */}
        {activeTab === 'Communication' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Site Communication History</Text>
              <TouchableOpacity
                style={styles.smallAddBtn}
                onPress={() => setIsCommModalOpen(true)}
              >
                <Plus size={14} color="#FFFFFF" />
                <Text style={styles.smallAddBtnText}>Log Call</Text>
              </TouchableOpacity>
            </View>

            {activities.filter(a => ['Call', 'WhatsApp', 'Email', 'Meeting'].includes(a.activity_type)).length > 0 ? (
              activities
                .filter(a => ['Call', 'WhatsApp', 'Email', 'Meeting'].includes(a.activity_type))
                .map((a, i) => (
                  <View key={i} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{a.title || a.activity_type}</Text>
                        <Text style={styles.itemId}>
                          {new Date(a.created_at).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </Text>
                      </View>
                      <View style={[styles.itemBadge, { backgroundColor: '#E0E7FF' }]}>
                        <Text style={[styles.itemBadgeText, { color: '#3730A3' }]}>{a.activity_type}</Text>
                      </View>
                    </View>
                    <Text style={styles.itemSubText}>{a.details || a.description}</Text>
                    <Text style={styles.timelineAuthor}>Handled by: {a.employee_name || 'Staff'}</Text>
                  </View>
                ))
            ) : (
              <View style={styles.emptyCard}>
                <MessageSquare size={36} color={Colors.textMuted} />
                <Text style={styles.emptyCardTitle}>No Interactions Recorded</Text>
                <Text style={styles.emptyCardSub}>Log client phone calls, meetings, or site inspections.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* ======================= CHANGE STATUS MODAL ======================= */}
      <Modal visible={isStatusModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Site Stage</Text>
            <Text style={styles.modalSub}>Select current construction status:</Text>

            <View style={styles.stagePicker}>
              {PROJECT_STATUSES.map(st => (
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
                <Text style={styles.modalConfirmText}>Save Stage</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================= FOLLOW UP MODAL ======================= */}
      <Modal visible={isFollowUpModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Schedule Site Follow-Up</Text>

            <Text style={styles.inputLabel}>Subject / Purpose</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Inspect slab reinforcement bar layout"
              value={followUpTitle}
              onChangeText={setFollowUpTitle}
            />

            <Text style={styles.inputLabel}>Description / Agenda</Text>
            <TextInput
              style={[styles.textInput, { height: 68, textAlignVertical: 'top' }]}
              placeholder="Key inspection points, notes, or agenda..."
              value={followUpDesc}
              onChangeText={setFollowUpDesc}
              multiline
            />

            <Text style={styles.inputLabel}>Due Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="YYYY-MM-DD"
              value={followUpDue}
              onChangeText={setFollowUpDue}
            />

            <Text style={styles.inputLabel}>Priority</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
              {['High', 'Medium', 'Normal'].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityChip,
                    followUpPriority === p && { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
                  ]}
                  onPress={() => setFollowUpPriority(p)}
                >
                  <Text
                    style={[
                      styles.priorityChipText,
                      followUpPriority === p && { color: '#FFFFFF', fontWeight: 'bold' },
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
                onPress={() => setIsFollowUpModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleCreateFollowUp}
              >
                <Text style={styles.modalConfirmText}>Schedule</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================= TASK MODAL ======================= */}
      <Modal visible={isTaskModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Task for Project Site</Text>

            <Text style={styles.inputLabel}>Task Title</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Schedule concrete batch delivery"
              value={taskTitle}
              onChangeText={setTaskTitle}
            />

            <Text style={styles.inputLabel}>Description / Instructions</Text>
            <TextInput
              style={[styles.textInput, { height: 68, textAlignVertical: 'top' }]}
              placeholder="Detailed instructions or specifications..."
              value={taskDesc}
              onChangeText={setTaskDesc}
              multiline
            />

            <Text style={styles.inputLabel}>Assign Employee</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6, flexWrap: 'wrap' }}>
              {employees.map(emp => {
                const isSelected = taskAssignee === emp.id;
                return (
                  <TouchableOpacity
                    key={emp.id}
                    style={[
                      styles.priorityChip,
                      isSelected && { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
                    ]}
                    onPress={() => setTaskAssignee(emp.id)}
                  >
                    <Text
                      style={[
                        styles.priorityChipText,
                        isSelected && { color: '#FFFFFF', fontWeight: 'bold' },
                      ]}
                    >
                      {emp.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.inputLabel}>Due Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.textInput}
              placeholder="YYYY-MM-DD"
              value={taskDue}
              onChangeText={setTaskDue}
            />

            <Text style={styles.inputLabel}>Priority</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
              {['High', 'Medium', 'Normal'].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityChip,
                    taskPriority === p && { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
                  ]}
                  onPress={() => setTaskPriority(p)}
                >
                  <Text
                    style={[
                      styles.priorityChipText,
                      taskPriority === p && { color: '#FFFFFF', fontWeight: 'bold' },
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
                onPress={() => setIsTaskModalOpen(false)}
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

      {/* ======================= COMMUNICATION MODAL ======================= */}
      <Modal visible={isCommModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Log Site Discussion</Text>

            <Text style={styles.inputLabel}>Channel</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
              {['Call', 'WhatsApp', 'Email', 'Meeting'].map(ch => (
                <TouchableOpacity
                  key={ch}
                  style={[
                    styles.priorityChip,
                    commType === ch && { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
                  ]}
                  onPress={() => setCommType(ch)}
                >
                  <Text
                    style={[
                      styles.priorityChipText,
                      commType === ch && { color: '#FFFFFF', fontWeight: 'bold' },
                    ]}
                  >
                    {ch}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Summary / Decisions Taken</Text>
            <TextInput
              style={[styles.textInput, { height: 90, textAlignVertical: 'top' }]}
              placeholder="Record material delivery verification, client approval, etc..."
              value={commResponse}
              onChangeText={setCommResponse}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsCommModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={handleLogCommunication}
              >
                <Text style={styles.modalConfirmText}>Save Log</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Record Payment Modal */}
      <Modal
        visible={isPaymentModalOpen}
        animationType="fade"
        transparent
        onRequestClose={() => setIsPaymentModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Record Payment Receipt</Text>
            <Text style={styles.modalSub}>Add client milestone payment to construction ledger</Text>

            <Text style={styles.inputLabel}>Amount (₹) *</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. 100000"
              value={payAmount}
              onChangeText={setPayAmount}
              keyboardType="numeric"
            />

            <Text style={styles.inputLabel}>Date</Text>
            <TextInput
              style={styles.textInput}
              placeholder="YYYY-MM-DD"
              value={payDate}
              onChangeText={setPayDate}
            />

            <Text style={styles.inputLabel}>Payment Mode</Text>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
              {['Bank Transfer', 'UPI', 'Cheque', 'Cash'].map((mode) => (
                <TouchableOpacity
                  key={mode}
                  style={[
                    styles.priorityChip,
                    payMode === mode && { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
                  ]}
                  onPress={() => setPayMode(mode)}
                >
                  <Text
                    style={[
                      styles.priorityChipText,
                      payMode === mode && { color: '#FFFFFF', fontWeight: 'bold' },
                    ]}
                  >
                    {mode}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Stage Reference / Note</Text>
            <TextInput
              style={[styles.textInput, { height: 60, textAlignVertical: 'top' }]}
              placeholder="e.g. 2nd Slab Casting payment, UTR number, etc..."
              value={payNote}
              onChangeText={setPayNote}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsPaymentModalOpen(false)}
                disabled={isSavingPay}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, isSavingPay && { opacity: 0.6 }]}
                onPress={handleAddPayment}
                disabled={isSavingPay}
              >
                {isSavingPay ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalConfirmText}>Save Payment</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Assign Team Modal */}
      <Modal
        visible={isAssignModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAssignModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Assign Engineering Team</Text>
            <Text style={styles.modalSub}>Select site incharge & engineers for this project</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                {employees.map((emp) => {
                  const cur = (project?.assigned_to || '').toLowerCase();
                  const isAssigned = cur.includes((emp.name || '').toLowerCase()) || cur.includes((emp.id || '').toLowerCase());
                  return (
                    <TouchableOpacity
                      key={emp.id}
                      style={[
                        styles.teamMemberRow,
                        isAssigned && { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
                      ]}
                      onPress={() => handleToggleAssignEmployee(emp.id, emp.name)}
                    >
                      <View style={[styles.teamAvatar, isAssigned && { backgroundColor: '#BBF7D0' }]}>
                        <Text style={[styles.teamAvatarText, isAssigned && { color: '#166534' }]}>
                          {emp.name?.charAt(0) || 'U'}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.teamMemberName, isAssigned && { color: '#166534' }]}>
                          {emp.name}
                        </Text>
                        <Text style={styles.teamMemberRole}>{emp.designation || emp.role || 'Site Engineer'}</Text>
                      </View>
                      {isAssigned ? (
                        <CheckCircle2 size={20} color={Colors.success} />
                      ) : (
                        <Circle size={20} color={Colors.textMuted} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={[styles.modalActions, { marginTop: 16 }]}>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={() => setIsAssignModalOpen(false)}
              >
                <Text style={styles.modalConfirmText}>Done</Text>
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
    backgroundColor: Colors.background,
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
  progressContainer: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  progressHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  progressPercentText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  progressBarTrack: {
    height: 7,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primaryDark,
    borderRadius: 4,
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
  subtext: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  metricCard: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 13,
    fontWeight: 'bold',
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
  emptyNotice: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
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
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  smallAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primaryDark,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  smallAddBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  itemCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
  },
  itemId: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  itemBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  itemBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  itemSubText: {
    fontSize: 13,
    color: Colors.text,
    marginTop: 8,
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
    fontWeight: '500',
  },
  checklistTextActive: {
    color: '#166534',
    fontWeight: '600',
  },
  checklistStepNum: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 2,
  },
  finItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  finItemName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
  },
  finItemSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
  finItemVal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
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
  openBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: 6,
  },
  openBtnText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.primaryDark,
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
  },
  modalSub: {
    fontSize: 13,
    color: Colors.textMuted,
    marginTop: 4,
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
  teamMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  teamAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  teamMemberName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
  },
  teamMemberRole: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
});

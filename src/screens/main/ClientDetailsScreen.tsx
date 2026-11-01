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
  Phone,
  Mail,
  MapPin,
  Building,
  Briefcase,
  Layers,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  FileText,
  MessageSquare,
  Plus,
  ChevronRight,
  Edit2,
  Edit3,
  Check,
  IndianRupee,
  Share2,
  Tag,
  ExternalLink,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { createNotification } from '../../lib/notificationService';

const CLIENT_STATUSES = [
  { value: 'Ongoing', label: 'STATUS: ONGOING', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { value: 'Hold', label: 'STATUS: HOLD', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { value: 'Closed', label: 'STATUS: CLOSED', color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' },
  { value: 'Active', label: 'STATUS: ACTIVE', color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0' },
];

const CLIENT_TEMP_OPTIONS = [
  { value: 'Hot', label: 'HOT', icon: '🔥', color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' },
  { value: 'Warm', label: 'WARM', icon: '☀️', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { value: 'Cold', label: 'COLD', icon: '❄️', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
];

const DESIGN_SERVICES_LIST = [
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

const CONSTRUCTION_SERVICES_LIST = [
  'Residential Construction',
  'Commercial Construction',
  'Industrial Construction',
  'Painting & Epoxy Flooring',
  'Renovation & Remodeling',
  'Turnkey Projects',
  'Electrical & Plumbing',
];

export default function ClientDetailsScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const { id } = route.params || {};
  const { user, isAdmin } = useAuth();

  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    | 'Overview'
    | 'Projects'
    | 'Requirement'
    | 'Workspace'
    | 'Financials'
    | 'FollowUps'
    | 'Tasks'
    | 'Timeline'
    | 'Visit'
    | 'Documents'
    | 'Communication'
  >('Overview');

  // Sub-modules state
  const [projects, setProjects] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [siteVisits, setSiteVisits] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Financial totals
  const [finTotals, setFinTotals] = useState({ total: 0, paid: 0, due: 0 });

  // Status & Temp Modals
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('Ongoing');
  const [isTempModalOpen, setIsTempModalOpen] = useState(false);
  const [selectedTemp, setSelectedTemp] = useState('Warm');

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

  // Selected requirements state
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isSavingRequirements, setIsSavingRequirements] = useState(false);

  // Edit Client Info State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editPlotSize, setEditPlotSize] = useState('');
  const [editTimeline, setEditTimeline] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const openEditModal = () => {
    if (!client) return;
    setEditName(client.name || '');
    setEditPhone(client.phone || '');
    setEditEmail(client.email || '');
    setEditAddress(client.address || '');
    setEditCompany(client.company || '');
    setEditPlotSize(client.plot_size || '');
    setEditTimeline(client.timeline || '');
    setEditNotes(client.notes || '');
    setIsEditModalOpen(true);
  };

  const handleSaveClientInfo = async () => {
    if (!editName.trim()) {
      Alert.alert('Required', 'Please enter client name.');
      return;
    }
    setIsSavingEdit(true);
    try {
      const updates = {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        address: editAddress.trim(),
        company: editCompany.trim(),
        plot_size: editPlotSize.trim(),
        timeline: editTimeline.trim(),
        notes: editNotes.trim(),
      };
      const { error } = await supabase.from('clients').update(updates).eq('id', id);
      if (error) throw error;

      await supabase.from('lead_activities').insert([
        {
          client_id: id,
          activity_type: 'Client Updated',
          activity_group: 'Timeline',
          title: 'Client Profile Modified',
          details: `Updated info for ${editName.trim()}`,
          employee_name: user?.name || 'Staff',
        },
      ]);

      setClient((prev: any) => ({ ...prev, ...updates }));
      setIsEditModalOpen(false);
      Alert.alert('Success', 'Client information updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update client');
    } finally {
      setIsSavingEdit(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadClientData();
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

  const loadClientData = async () => {
    setLoading(true);
    try {
      const { data: cData, error: cErr } = await supabase.from('clients').select('*').eq('id', id).single();
      if (cErr) throw cErr;
      setClient(cData);
      setSelectedStatus(cData.status || 'Ongoing');
      setSelectedTemp(cData.lead_temperature || 'Warm');

      // Initialize selected services from client record
      const parsedWorkTypes = (cData.work_types || '')
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
      const leadDataServices = cData.leadData?.selectedServices || [];
      setSelectedServices(Array.from(new Set([...parsedWorkTypes, ...leadDataServices])));

      // Fetch all linked collections concurrently
      const [projRes, servRes, taskRes, actRes, docRes, visitRes] = await Promise.all([
        supabase.from('projects').select('*').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('services').select('*').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('tasks').select('*').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('lead_activities').select('*').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('documents').select('*').eq('client_id', id).order('created_at', { ascending: false }),
        supabase.from('site_visits').select('*').or(`client_id.eq.${id},lead_id.eq.${id}`).order('created_at', { ascending: false }),
      ]);

      const projList = projRes.data || [];
      const servList = servRes.data || [];
      setProjects(projList);
      setServices(servList);
      setTasks(taskRes.data || []);
      setDocuments(docRes.data || []);
      setSiteVisits(visitRes.data || []);

      const allActs = actRes.data || [];
      setActivities(allActs);
      setComments(allActs.filter((a: any) => a.activity_group === 'comment' || a.activity_type === 'Comment'));

      // Calculate Financials from projects and services
      let totalAmount = 0;
      let totalPaid = 0;

      [...projList, ...servList].forEach((item: any) => {
        try {
          const meta = typeof item.description === 'string' && item.description.startsWith('{')
            ? JSON.parse(item.description)
            : {};
          const itemTotal = parseFloat(meta.financials?.total || item.budget || 0) || 0;
          const advance = parseFloat(meta.financials?.advance || 0) || 0;
          const payments = Array.isArray(meta.payments) ? meta.payments : [];
          const paidPayments = payments.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
          totalAmount += itemTotal;
          totalPaid += advance + paidPayments;
        } catch {
          // Ignore parse errors
        }
      });

      setFinTotals({
        total: totalAmount,
        paid: totalPaid,
        due: Math.max(totalAmount - totalPaid, 0),
      });

      const { data: empData } = await supabase.from('employees').select('id, name, designation, role').order('name');
      if (empData) setEmployees(empData);
    } catch (err: any) {
      console.warn('Error loading client workspace:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAssignEmployee = async (empId: string, empName: string) => {
    let currentAssigned = (client?.assigned_to || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const exists = currentAssigned.includes(empId) || currentAssigned.includes(empName);
    let nextAssigned: string[];
    if (exists) {
      nextAssigned = currentAssigned.filter((x: string) => x !== empId && x !== empName);
    } else {
      nextAssigned = [...currentAssigned, empName || empId];
    }
    const newAssignedString = nextAssigned.join(', ');

    setClient((prev: any) => ({ ...prev, assigned_to: newAssignedString }));

    try {
      const { error } = await supabase.from('clients').update({ assigned_to: newAssignedString || null }).eq('id', id);
      if (error) throw error;

      await createNotification({
        title: '👥 Client Team Assigned',
        message: `${client.name} team assigned: ${newAssignedString || 'Unassigned'}`,
        module: 'client',
        referenceId: id,
        recipientRole: 'All_Staff',
        recipientUserId: empId,
        createdByName: user?.name,
      });
    } catch (e: any) {
      console.warn('Failed to update assigned employee', e.message);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    try {
      const { error } = await supabase.from('clients').update({ status: newStatus }).eq('id', id);
      if (error) throw error;

      setClient((prev: any) => ({ ...prev, status: newStatus }));
      setSelectedStatus(newStatus);
      setIsStatusModalOpen(false);

      // Log status update
      await supabase.from('lead_activities').insert([
        {
          client_id: id,
          activity_type: 'Status Change',
          activity_group: 'Timeline',
          title: `Client Status Changed to ${newStatus}`,
          details: `Status updated by ${user?.name || 'Staff Member'}`,
          employee_name: user?.name || 'Staff',
        },
      ]);

      await createNotification({
        title: 'Client Status Updated',
        message: `${client.name}'s status was changed to ${newStatus}`,
        module: 'client',
        referenceId: id,
        recipientRole: 'All_Staff',
        createdByName: user?.name,
      });

      loadClientData();
    } catch (e: any) {
      Alert.alert('Update Failed', e.message || 'Could not change client status');
    }
  };

  const handleUpdateTemperature = async (newTemp: string) => {
    setIsTempModalOpen(false);
    try {
      const { error } = await supabase.from('clients').update({ lead_temperature: newTemp }).eq('id', id);
      if (error) throw error;

      setClient((prev: any) => ({ ...prev, lead_temperature: newTemp }));
      setSelectedTemp(newTemp);

      await supabase.from('lead_activities').insert([
        {
          client_id: id,
          activity_type: 'Temperature Updated',
          activity_group: 'Timeline',
          title: `Client Priority Temperature set to ${newTemp}`,
          details: `Updated by ${user?.name || 'Staff Member'}`,
          employee_name: user?.name || 'Staff',
        },
      ]);

      await createNotification({
        title: '🔥 Client Priority Updated',
        message: `${client.name}'s priority temperature set to "${newTemp}"`,
        module: 'client',
        referenceId: id,
        recipientRole: 'All_Staff',
        createdByName: user?.name,
      });

      loadClientData();
    } catch (e: any) {
      Alert.alert('Update Failed', e.message || 'Could not change temperature');
    }
  };

  const handleAddComment = async () => {
    if (!noteText.trim()) return;
    setIsPostingNote(true);
    try {
      const { error } = await supabase.from('lead_activities').insert([
        {
          client_id: id,
          activity_type: 'Comment',
          activity_group: 'comment',
          title: 'Internal Note / Update',
          details: noteText.trim(),
          employee_name: user?.name || 'Staff',
        },
      ]);
      if (error) throw error;
      setNoteText('');
      loadClientData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to post note');
    } finally {
      setIsPostingNote(false);
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
          client_id: id,
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
      loadClientData();
      Alert.alert('Success', 'Follow-up scheduled.');
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
          client_id: id,
          priority: taskPriority,
          status: 'To Do',
          category: 'Client',
          assignee_id: targetAssigneeId,
          creator_id: user?.id || null,
        },
      ]).select();
      if (error) throw error;

      if (targetAssigneeId) {
        const targetEmp = employees.find(e => e.id === targetAssigneeId);
        await createNotification({
          title: '📋 New Client Task Assigned',
          message: `Task: "${taskTitle.trim()}" for client ${client?.name || 'Client'}. Due: ${taskDue}`,
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
      loadClientData();
      Alert.alert('Success', 'Task created successfully.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not create task');
    }
  };

  const handleLogCommunication = async () => {
    if (!commResponse.trim()) {
      Alert.alert('Required', 'Please enter interaction summary or customer feedback.');
      return;
    }
    try {
      const { error } = await supabase.from('lead_activities').insert([
        {
          client_id: id,
          activity_type: commType,
          activity_group: 'Communication',
          title: `${commType} Interaction Logged`,
          details: commResponse.trim(),
          employee_name: user?.name || 'Staff',
        },
      ]);
      if (error) throw error;
      setIsCommModalOpen(false);
      setCommResponse('');
      loadClientData();
      Alert.alert('Logged', 'Communication recorded.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not log communication');
    }
  };

  const toggleServiceRequirement = (srv: string) => {
    if (selectedServices.includes(srv)) {
      setSelectedServices(selectedServices.filter(s => s !== srv));
    } else {
      setSelectedServices([...selectedServices, srv]);
    }
  };

  const handleSaveRequirements = async () => {
    setIsSavingRequirements(true);
    try {
      const workTypesStr = selectedServices.join(', ');
      const updatedLeadData = {
        ...(client.leadData || {}),
        selectedServices,
      };

      const { error } = await supabase
        .from('clients')
        .update({
          work_types: workTypesStr,
          leadData: updatedLeadData,
        })
        .eq('id', id);

      if (error) throw error;

      // Also log activity
      await supabase.from('lead_activities').insert([
        {
          client_id: id,
          activity_type: 'Requirements Updated',
          activity_group: 'Timeline',
          title: 'Service Requirements Modified',
          details: `Updated scope: ${workTypesStr || 'None selected'}`,
          employee_name: user?.name || 'Staff',
        },
      ]);

      Alert.alert('Saved', 'Service requirements updated successfully.');
      loadClientData();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save requirements');
    } finally {
      setIsSavingRequirements(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
      case 'ongoing':
        return Colors.primaryDark;
      case 'completed':
        return Colors.success;
      case 'on hold':
        return '#D97706';
      case 'cancelled':
      case 'inactive':
        return Colors.danger;
      default:
        return Colors.primary;
    }
  };

  if (loading || !client) {
    return (
      <View style={[styles.center, { paddingTop: safeTop }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Client Workspace...</Text>
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
            {client.name}
          </Text>
          <Text style={styles.topBarSubtitle}>CLIENT ID: CL-{client.id.substring(0, 6).toUpperCase()}</Text>
        </View>

        <View style={styles.headerBadgesRow}>
          <TouchableOpacity
            style={[styles.statusBadgeBtn, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}
            onPress={() => setIsStatusModalOpen(true)}
          >
            <Text style={[styles.statusBadgeText, { color: '#B45309' }]}>
              {client.status || 'Ongoing'}
            </Text>
            <Edit2 size={11} color="#B45309" style={{ marginLeft: 3 }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tempBadgeBtn, { backgroundColor: '#FEE2E2', borderColor: '#FECACA' }]}
            onPress={() => setIsTempModalOpen(true)}
          >
            <Text style={{ fontSize: 11 }}>
              {client.lead_temperature === 'Cold' ? '❄️' : client.lead_temperature === 'Warm' ? '☀️' : '🔥'}
            </Text>
            <Text style={[styles.tempBadgeText, { color: '#DC2626' }]}>
              {client.lead_temperature || 'Hot'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Primary Tab Navigation */}
      <View style={styles.tabBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {[
            { id: 'Overview', label: 'Overview' },
            { id: 'Projects', label: `Projects & Services (${projects.length + services.length})` },
            { id: 'Requirement', label: 'Services Req.' },
            { id: 'Workspace', label: `Workspace (${services.length})` },
            ...(isAdmin ? [{ id: 'Financials', label: 'Financials' }] : []),
            { id: 'FollowUps', label: `Follow-Ups (${tasks.filter(t => t.type === 'followup').length})` },
            { id: 'Tasks', label: `Tasks (${tasks.length})` },
            { id: 'Timeline', label: 'Timeline' },
            { id: 'Visit', label: `Visits (${siteVisits.length})` },
            { id: 'Documents', label: `Docs (${documents.length})` },
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

      {/* Content with Keyboard Avoiding */}
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
              {/* Quick Profile Card */}
              <View style={styles.card}>
                <View style={styles.profileRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{client.name?.charAt(0).toUpperCase() || 'C'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clientName}>{client.name}</Text>
                    {client.company ? (
                      <Text style={styles.companyName}>{client.company}</Text>
                    ) : (
                      <Text style={styles.metaSub}>Individual Client</Text>
                    )}
                    <Text style={styles.assignedTag}>
                      Assigned: {client.assigned_to || 'Engineering & Operations'}
                    </Text>
                  </View>
                </View>

                {/* Quick Actions Bar */}
                <View style={styles.quickActionsBar}>
                  {client.phone && (
                    <TouchableOpacity
                      style={[styles.actionChip, { backgroundColor: '#10B981' }]}
                      onPress={() => Linking.openURL(`tel:${client.phone}`)}
                    >
                      <Phone size={15} color="#FFFFFF" />
                      <Text style={styles.actionChipText}>Call</Text>
                    </TouchableOpacity>
                  )}
                  {client.phone && (
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
                    <Text style={styles.actionChipText}>Log Call</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Financial Quick Glance */}
              {isAdmin && (
                <View style={styles.card}>
                  <Text style={styles.cardSectionTitle}>Financial Overview</Text>
                  <View style={styles.metricsGrid}>
                    <View style={[styles.metricCard, { backgroundColor: '#F0FDF4' }]}>
                      <Text style={styles.metricLabel}>Total Contract</Text>
                      <Text style={[styles.metricValue, { color: '#166534' }]}>
                        ₹{finTotals.total.toLocaleString('en-IN')}
                      </Text>
                    </View>
                    <View style={[styles.metricCard, { backgroundColor: '#EFF6FF' }]}>
                      <Text style={styles.metricLabel}>Total Received</Text>
                      <Text style={[styles.metricValue, { color: '#1E40AF' }]}>
                        ₹{finTotals.paid.toLocaleString('en-IN')}
                      </Text>
                    </View>
                    <View style={[styles.metricCard, { backgroundColor: '#FEF2F2' }]}>
                      <Text style={styles.metricLabel}>Balance Due</Text>
                      <Text style={[styles.metricValue, { color: '#991B1B' }]}>
                        ₹{finTotals.due.toLocaleString('en-IN')}
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              {/* Assigned Team Card */}
              <View style={styles.card}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Users size={18} color={Colors.primaryDark} />
                    <Text style={[styles.cardSectionTitle, { marginBottom: 0 }]}>Assigned Team</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.smallAddBtn, { backgroundColor: Colors.primaryDark }]}
                    onPress={() => setIsAssignModalOpen(true)}
                  >
                    <Plus size={14} color="#FFFFFF" />
                    <Text style={styles.smallAddBtnText}>Assign Team</Text>
                  </TouchableOpacity>
                </View>

                {employees.length > 0 ? (
                  <View style={{ gap: 8 }}>
                    {employees
                      .filter((emp) => {
                        const cur = (client.assigned_to || '').toLowerCase();
                        return cur.includes((emp.name || '').toLowerCase()) || cur.includes((emp.id || '').toLowerCase());
                      })
                      .map((emp) => (
                        <View key={emp.id} style={styles.teamMemberRow}>
                          <View style={styles.teamAvatar}>
                            <Text style={styles.teamAvatarText}>{emp.name?.charAt(0) || 'U'}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.teamMemberName}>{emp.name}</Text>
                            <Text style={styles.teamMemberRole}>{emp.designation || emp.role || 'Relationship Manager / CRO'}</Text>
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
                      const cur = (client.assigned_to || '').toLowerCase();
                      return cur.includes((emp.name || '').toLowerCase()) || cur.includes((emp.id || '').toLowerCase());
                    }).length === 0 && (
                      <Text style={styles.emptyNotice}>
                        No specific team member assigned yet. Tap 'Assign Team' to assign.
                      </Text>
                    )}
                  </View>
                ) : (
                  <Text style={styles.emptyNotice}>Loading team list...</Text>
                )}
              </View>

              {/* Contact & Property Information with Edit Option */}
              <View style={styles.card}>
                <View style={styles.cardHeaderFlex}>
                  <Text style={[styles.cardSectionTitle, { marginBottom: 0 }]}>Contact & Specifications</Text>
                  <TouchableOpacity style={styles.editInfoBtn} onPress={openEditModal}>
                    <Edit3 size={13} color={Colors.primaryDark} />
                    <Text style={styles.editInfoBtnText}>Edit Info</Text>
                  </TouchableOpacity>
                </View>

              <View style={styles.detailRow}>
                <Phone size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Phone:</Text>
                <Text style={styles.detailVal}>{client.phone || 'Not available'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Mail size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Email:</Text>
                <Text style={styles.detailVal}>{client.email || 'Not available'}</Text>
              </View>

              <View style={styles.detailRow}>
                <MapPin size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Site Address:</Text>
                <Text style={styles.detailVal}>{client.address || 'Address not registered'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Building size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Plot Size:</Text>
                <Text style={styles.detailVal}>{client.plot_size || 'N/A'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Calendar size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Target Timeline:</Text>
                <Text style={styles.detailVal}>{client.timeline || 'Flexible'}</Text>
              </View>
            </View>

            {/* Scope / Work Types */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Enrolled Work Types</Text>
              <View style={styles.tagWrap}>
                {selectedServices.length > 0 ? (
                  selectedServices.map((srv, idx) => (
                    <View key={idx} style={styles.scopeTag}>
                      <Text style={styles.scopeTagText}>{srv}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyNotice}>No work types assigned yet.</Text>
                )}
              </View>
            </View>

            {/* Internal Staff Notes Feed */}
            <View style={styles.card} onLayout={(e) => setNotesYPos(e.nativeEvent.layout.y)}>
              <Text style={styles.cardSectionTitle}>Internal Discussion & Notes</Text>

              <View style={styles.noteInputRow}>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Type an internal note about this client..."
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
                <Text style={styles.emptyNotice}>No internal notes added yet.</Text>
              )}
            </View>
          </View>
        )}

        {/* ======================= PROJECTS & SERVICES PORTFOLIO TAB ======================= */}
        {activeTab === 'Projects' && (
          <View>
            <View style={styles.portfolioHeaderCard}>
              <View>
                <Text style={styles.portfolioHeading}>Client Portfolio</Text>
                <Text style={styles.portfolioSub}>All consultancy services and construction sites for {client.name}</Text>
              </View>
            </View>

            {/* 1. Consultancy Services Section */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Layers size={18} color="#2563EB" />
                <Text style={styles.sectionTitle}>Consultancy Services ({services.length})</Text>
              </View>
              <TouchableOpacity
                style={styles.smallAddBtn}
                onPress={() => navigation.navigate('NewService', { clientId: id, clientName: client.name })}
              >
                <Plus size={13} color="#FFFFFF" />
                <Text style={styles.smallAddBtnText}>New Service</Text>
              </TouchableOpacity>
            </View>

            {services.length > 0 ? (
              services.map(srv => {
                let amount = 0;
                let reqCount = 0;
                try {
                  const meta = typeof srv.description === 'string' && srv.description.startsWith('{')
                    ? JSON.parse(srv.description)
                    : {};
                  amount = parseFloat(meta.financials?.total || 0) || 0;
                  reqCount = Array.isArray(meta.requirements) ? meta.requirements.length : 1;
                } catch {}

                return (
                  <TouchableOpacity
                    key={srv.id}
                    style={styles.itemCard}
                    onPress={() => navigation.navigate('ServiceDetails', { id: srv.id })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.itemHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{srv.title || 'Consultancy Service'}</Text>
                        <Text style={styles.itemId}>SRV-{srv.id.substring(0, 6).toUpperCase()}</Text>
                      </View>
                      <View style={[styles.itemBadge, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1 }]}>
                        <Text style={[styles.itemBadgeText, { color: '#1D4ED8' }]}>{srv.status || 'Pending'}</Text>
                      </View>
                    </View>

                    <View style={styles.itemFooter}>
                      <Text style={styles.itemMeta}>Value: ₹{amount > 0 ? amount.toLocaleString('en-IN') : 'Flexible'}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 11, color: Colors.primaryDark, fontWeight: 'bold' }}>View Service</Text>
                        <ChevronRight size={16} color={Colors.primaryDark} />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={[styles.emptyCard, { marginBottom: 16 }]}>
                <Layers size={32} color={Colors.textMuted} />
                <Text style={styles.emptyCardTitle}>No Consultancy Services</Text>
                <Text style={styles.emptyCardSub}>No active architectural, 2D/3D design, or approval cases.</Text>
              </View>
            )}

            {/* 2. Construction Projects Section */}
            <View style={[styles.sectionHeaderRow, { marginTop: 12 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Briefcase size={18} color="#059669" />
                <Text style={styles.sectionTitle}>Construction Projects ({projects.length})</Text>
              </View>
              <TouchableOpacity
                style={[styles.smallAddBtn, { backgroundColor: '#059669' }]}
                onPress={() => navigation.navigate('NewProject', { clientId: id, clientName: client.name })}
              >
                <Plus size={13} color="#FFFFFF" />
                <Text style={styles.smallAddBtnText}>New Project</Text>
              </TouchableOpacity>
            </View>

            {projects.length > 0 ? (
              projects.map(proj => {
                const meta = typeof proj.description === 'string' && proj.description.startsWith('{')
                  ? JSON.parse(proj.description)
                  : {};
                const progress = proj.progress_details?.percentage || meta.progress || 0;

                return (
                  <TouchableOpacity
                    key={proj.id}
                    style={styles.itemCard}
                    onPress={() => navigation.navigate('ProjectDetails', { id: proj.id })}
                    activeOpacity={0.7}
                  >
                    <View style={styles.itemHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{proj.name}</Text>
                        <Text style={styles.itemId}>PRJ-{proj.id.substring(0, 6).toUpperCase()}</Text>
                      </View>
                      <View style={[styles.itemBadge, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0', borderWidth: 1 }]}>
                        <Text style={[styles.itemBadgeText, { color: '#047857' }]}>{proj.status || 'Active'}</Text>
                      </View>
                    </View>

                    <View style={styles.progressRow}>
                      <View style={styles.progressBarTrack}>
                        <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                      </View>
                      <Text style={styles.progressPercent}>{progress}%</Text>
                    </View>

                    <View style={styles.itemFooter}>
                      <Text style={styles.itemMeta}>Budget: ₹{(proj.budget || 0).toLocaleString('en-IN')}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Text style={{ fontSize: 11, color: '#047857', fontWeight: 'bold' }}>View Project</Text>
                        <ChevronRight size={16} color="#047857" />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyCard}>
                <Briefcase size={32} color={Colors.textMuted} />
                <Text style={styles.emptyCardTitle}>No Construction Projects</Text>
                <Text style={styles.emptyCardSub}>This client does not have any active construction sites.</Text>
              </View>
            )}
          </View>
        )}

        {/* ======================= SERVICE REQUIREMENT TAB ======================= */}
        {activeTab === 'Requirement' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Design & Consultancy Services</Text>
              <Text style={styles.subtext}>Tap to toggle requested design modules for this client:</Text>

              <View style={styles.checklist}>
                {DESIGN_SERVICES_LIST.map((srv, idx) => {
                  const isChecked = selectedServices.includes(srv);
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.checklistItem, isChecked && styles.checklistItemActive]}
                      onPress={() => toggleServiceRequirement(srv)}
                    >
                      {isChecked ? (
                        <CheckCircle2 size={18} color={Colors.primaryDark} />
                      ) : (
                        <Circle size={18} color={Colors.textMuted} />
                      )}
                      <Text style={[styles.checklistText, isChecked && styles.checklistTextActive]}>
                        {srv}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={[styles.cardSectionTitle, { marginTop: 20 }]}>Construction Services</Text>
              <View style={styles.checklist}>
                {CONSTRUCTION_SERVICES_LIST.map((srv, idx) => {
                  const isChecked = selectedServices.includes(srv);
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.checklistItem, isChecked && styles.checklistItemActive]}
                      onPress={() => toggleServiceRequirement(srv)}
                    >
                      {isChecked ? (
                        <CheckCircle2 size={18} color={Colors.primaryDark} />
                      ) : (
                        <Circle size={18} color={Colors.textMuted} />
                      )}
                      <Text style={[styles.checklistText, isChecked && styles.checklistTextActive]}>
                        {srv}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[styles.primaryActionBtn, isSavingRequirements && { opacity: 0.6 }]}
                onPress={handleSaveRequirements}
                disabled={isSavingRequirements}
              >
                <Text style={styles.primaryActionBtnText}>
                  {isSavingRequirements ? 'Saving Changes...' : 'Save Service Scope'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================= SERVICE WORKSPACE TAB ======================= */}
        {activeTab === 'Workspace' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Enrolled Consultancy Cases</Text>
            </View>

            {services.length > 0 ? (
              services.map(srv => (
                <TouchableOpacity
                  key={srv.id}
                  style={styles.itemCard}
                  onPress={() => navigation.navigate('ServiceDetails', { id: srv.id })}
                  activeOpacity={0.7}
                >
                  <View style={styles.itemHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{srv.name || srv.title || 'Consultancy Service'}</Text>
                      <Text style={styles.itemId}>CASE: SRV-{srv.id.toString().substring(0, 5).toUpperCase()}</Text>
                    </View>
                    <View style={[styles.itemBadge, { backgroundColor: '#F3E8FF' }]}>
                      <Text style={[styles.itemBadgeText, { color: '#6B21A8' }]}>{srv.status || 'Active'}</Text>
                    </View>
                  </View>

                  <View style={styles.itemFooter}>
                    <Text style={styles.itemMeta}>Category: {srv.category || 'Architectural'}</Text>
                    <ChevronRight size={18} color={Colors.textMuted} />
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Layers size={36} color={Colors.textMuted} />
                <Text style={styles.emptyCardTitle}>No Consultancy Cases</Text>
                <Text style={styles.emptyCardSub}>No active design or legal consulting workspaces registered.</Text>
              </View>
            )}
          </View>
        )}

        {/* ======================= FINANCIALS TAB ======================= */}
        {activeTab === 'Financials' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Financial Summary</Text>
              <View style={styles.metricsGrid}>
                <View style={[styles.metricCard, { backgroundColor: '#F0FDF4' }]}>
                  <Text style={styles.metricLabel}>Total Contract</Text>
                  <Text style={[styles.metricValue, { color: '#166534' }]}>
                    ₹{finTotals.total.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: '#EFF6FF' }]}>
                  <Text style={styles.metricLabel}>Total Paid</Text>
                  <Text style={[styles.metricValue, { color: '#1E40AF' }]}>
                    ₹{finTotals.paid.toLocaleString('en-IN')}
                  </Text>
                </View>
                <View style={[styles.metricCard, { backgroundColor: '#FEF2F2' }]}>
                  <Text style={styles.metricLabel}>Balance Due</Text>
                  <Text style={[styles.metricValue, { color: '#991B1B' }]}>
                    ₹{finTotals.due.toLocaleString('en-IN')}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Billing Breakdown by Site</Text>
              {projects.length > 0 ? (
                projects.map((p, idx) => (
                  <View key={idx} style={styles.finItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.finItemName}>{p.name}</Text>
                      <Text style={styles.finItemSub}>Site Project</Text>
                    </View>
                    <Text style={styles.finItemVal}>₹{(p.budget || 0).toLocaleString('en-IN')}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyNotice}>No billing records found.</Text>
              )}
            </View>
          </View>
        )}

        {/* ======================= FOLLOW UPS TAB ======================= */}
        {activeTab === 'FollowUps' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Client Follow-Up Schedule</Text>
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
                <Text style={styles.emptyCardSub}>Keep this relationship warm by scheduling a reminder.</Text>
              </View>
            )}
          </View>
        )}

        {/* ======================= TASKS TAB ======================= */}
        {activeTab === 'Tasks' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Client Operational Tasks</Text>
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
                <Text style={styles.emptyCardTitle}>All Tasks Completed</Text>
                <Text style={styles.emptyCardSub}>No outstanding action items for this client account.</Text>
              </View>
            )}
          </View>
        )}

        {/* ======================= TIMELINE TAB ======================= */}
        {activeTab === 'Timeline' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Client Activity & Audit Log</Text>
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
                    <Text style={styles.timelineAuthor}>Logged by: {a.employee_name || 'Staff'}</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Clock size={36} color={Colors.textMuted} />
                <Text style={styles.emptyCardTitle}>No Timeline Entries</Text>
                <Text style={styles.emptyCardSub}>All client interactions and stage changes appear here.</Text>
              </View>
            )}
          </View>
        )}

        {/* ======================= VISIT TAB ======================= */}
        {activeTab === 'Visit' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Site Inspection Visits</Text>
            </View>

            {siteVisits.length > 0 ? (
              siteVisits.map(v => (
                <View key={v.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{v.purpose || 'Site Inspection'}</Text>
                      <Text style={styles.itemId}>Date: {v.visit_date || 'Recorded'}</Text>
                    </View>
                    <View style={[styles.itemBadge, { backgroundColor: '#ECFDF5' }]}>
                      <Text style={[styles.itemBadgeText, { color: '#047857' }]}>
                        {v.status || 'Completed'}
                      </Text>
                    </View>
                  </View>
                  {v.notes && <Text style={styles.itemSubText}>{v.notes}</Text>}
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <MapPin size={36} color={Colors.textMuted} />
                <Text style={styles.emptyCardTitle}>No Site Visits Recorded</Text>
                <Text style={styles.emptyCardSub}>Inspection reports and site visit surveys appear here.</Text>
              </View>
            )}
          </View>
        )}

        {/* ======================= DOCUMENTS TAB ======================= */}
        {activeTab === 'Documents' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Client Documents & Blueprints</Text>
            </View>

            {documents.length > 0 ? (
              documents.map(d => (
                <View key={d.id} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <FileText size={20} color={Colors.primary} style={{ marginRight: 8 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{d.name || d.title || 'Document'}</Text>
                      <Text style={styles.itemId}>
                        Uploaded: {new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                    {d.file_url && (
                      <TouchableOpacity
                        style={styles.docOpenBtn}
                        onPress={() => Linking.openURL(d.file_url)}
                      >
                        <ExternalLink size={16} color={Colors.primaryDark} />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <FileText size={36} color={Colors.textMuted} />
                <Text style={styles.emptyCardTitle}>No Documents Attached</Text>
                <Text style={styles.emptyCardSub}>Contracts, agreements, and blueprints are organized here.</Text>
              </View>
            )}
          </View>
        )}

        {/* ======================= COMMUNICATION TAB ======================= */}
        {activeTab === 'Communication' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Communication History</Text>
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
                <Text style={styles.emptyCardSub}>Log client phone calls, WhatsApp messages, or site meetings.</Text>
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
            <Text style={styles.modalTitle}>Update Client Status</Text>
            <Text style={styles.modalSub}>Select current status for this client account:</Text>

            <View style={styles.stagePicker}>
              {CLIENT_STATUSES.map(st => (
                <TouchableOpacity
                  key={st.value}
                  style={[
                    styles.stageOption,
                    (client.status || 'Ongoing').toLowerCase() === st.value.toLowerCase() && {
                      borderColor: st.color,
                      backgroundColor: st.bg,
                    },
                  ]}
                  onPress={() => handleUpdateStatus(st.value)}
                >
                  <Text
                    style={[
                      styles.stageOptionText,
                      { color: st.color, fontWeight: 'bold' },
                    ]}
                  >
                    {st.label}
                  </Text>
                  {(client.status || 'Ongoing').toLowerCase() === st.value.toLowerCase() && (
                    <Check size={18} color={st.color} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setIsStatusModalOpen(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ======================= TEMPERATURE MODAL ======================= */}
      <Modal visible={isTempModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Client Priority</Text>
            <Text style={styles.modalSub}>Select client engagement temperature:</Text>

            <View style={styles.stagePicker}>
              {CLIENT_TEMP_OPTIONS.map(tp => (
                <TouchableOpacity
                  key={tp.value}
                  style={[
                    styles.stageOption,
                    (client.lead_temperature || 'Warm').toLowerCase() === tp.value.toLowerCase() && {
                      borderColor: tp.color,
                      backgroundColor: tp.bg,
                    },
                  ]}
                  onPress={() => handleUpdateTemperature(tp.value)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>{tp.icon}</Text>
                    <Text style={[styles.stageOptionText, { color: tp.color, fontWeight: 'bold' }]}>
                      {tp.label}
                    </Text>
                  </View>
                  {(client.lead_temperature || 'Warm').toLowerCase() === tp.value.toLowerCase() && (
                    <Check size={18} color={tp.color} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setIsTempModalOpen(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ======================= FOLLOW UP MODAL ======================= */}
      <Modal visible={isFollowUpModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Schedule Follow-Up</Text>

            <Text style={styles.inputLabel}>Subject / Purpose</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Discuss revised structural blueprint"
              value={followUpTitle}
              onChangeText={setFollowUpTitle}
            />

            <Text style={styles.inputLabel}>Description / Agenda</Text>
            <TextInput
              style={[styles.textInput, { height: 68, textAlignVertical: 'top' }]}
              placeholder="Key discussion points, topics, or agenda..."
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
            <Text style={styles.modalTitle}>New Task for Client</Text>

            <Text style={styles.inputLabel}>Task Title</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Prepare foundation drawing delivery"
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
            <Text style={styles.modalTitle}>Log Client Communication</Text>

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

            <Text style={styles.inputLabel}>Client Feedback / Discussion Notes</Text>
            <TextInput
              style={[styles.textInput, { height: 90, textAlignVertical: 'top' }]}
              placeholder="Summarize key points, client queries or feedback..."
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

      {/* Assign Team Modal */}
      <Modal
        visible={isAssignModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsAssignModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Assign Team Members</Text>
            <Text style={styles.modalSub}>Select relationship managers & staff for this client</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                {employees.map((emp) => {
                  const cur = (client?.assigned_to || '').toLowerCase();
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
                        <Text style={styles.teamMemberRole}>{emp.designation || emp.role || 'Staff Member'}</Text>
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

      {/* ======================= EDIT CLIENT INFORMATION MODAL ======================= */}
      <Modal visible={isEditModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.cardHeaderFlex}>
              <Text style={styles.modalTitle}>Edit Client Profile</Text>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                <Text style={{ fontSize: 18, color: Colors.textMuted, fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Client / Contact Name *</Text>
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Full name"
              />

              <Text style={styles.inputLabel}>Company / Enterprise</Text>
              <TextInput
                style={styles.textInput}
                value={editCompany}
                onChangeText={setEditCompany}
                placeholder="e.g. Dayal Enterprises"
              />

              <Text style={styles.inputLabel}>Phone Number</Text>
              <TextInput
                style={styles.textInput}
                value={editPhone}
                onChangeText={setEditPhone}
                keyboardType="phone-pad"
                placeholder="+91 98765 43210"
              />

              <Text style={styles.inputLabel}>Email Address</Text>
              <TextInput
                style={styles.textInput}
                value={editEmail}
                onChangeText={setEditEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="client@gmail.com"
              />

              <Text style={styles.inputLabel}>Site / Billing Address</Text>
              <TextInput
                style={styles.textInput}
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="Plot/Street/City"
              />

              <Text style={styles.inputLabel}>Plot / Property Dimensions</Text>
              <TextInput
                style={styles.textInput}
                value={editPlotSize}
                onChangeText={setEditPlotSize}
                placeholder="e.g. 2400 sq ft"
              />

              <Text style={styles.inputLabel}>Target Construction Timeline</Text>
              <TextInput
                style={styles.textInput}
                value={editTimeline}
                onChangeText={setEditTimeline}
                placeholder="e.g. 6 Months"
              />

              <Text style={styles.inputLabel}>Internal Profile Notes</Text>
              <TextInput
                style={[styles.textInput, { minHeight: 60 }]}
                value={editNotes}
                onChangeText={setEditNotes}
                multiline
                placeholder="Key specifications, preferences..."
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setIsEditModalOpen(false)}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalConfirmBtn, isSavingEdit && { opacity: 0.6 }]}
                  onPress={handleSaveClientInfo}
                  disabled={isSavingEdit}
                >
                  <Text style={styles.modalConfirmText}>{isSavingEdit ? 'Saving...' : 'Save Changes'}</Text>
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
  headerBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: 'bold',
  },
  tempBadgeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    gap: 3,
  },
  tempBadgeText: {
    fontSize: 11,
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
  cardHeaderFlex: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  portfolioHeaderCard: {
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  portfolioHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  portfolioSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  editInfoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    gap: 4,
  },
  editInfoBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primaryDark,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primaryDark,
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
  metaSub: {
    fontSize: 12,
    color: Colors.textMuted,
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
    width: 105,
  },
  detailVal: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: '500',
    flex: 1,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  scopeTag: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  scopeTagText: {
    color: '#1D4ED8',
    fontSize: 12,
    fontWeight: '600',
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
  itemFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  itemMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginVertical: 8,
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primaryDark,
    borderRadius: 3,
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: 'bold',
    color: Colors.textMuted,
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
  checklist: {
    gap: 8,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  checklistItemActive: {
    backgroundColor: '#EFF6FF',
    borderColor: '#93C5FD',
  },
  checklistText: {
    fontSize: 13,
    color: Colors.text,
  },
  checklistTextActive: {
    color: '#1D4ED8',
    fontWeight: '600',
  },
  primaryActionBtn: {
    backgroundColor: Colors.primaryDark,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
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
  docOpenBtn: {
    padding: 6,
    backgroundColor: Colors.primaryLight,
    borderRadius: 6,
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
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    gap: 12,
  },
  teamAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  teamAvatarText: {
    color: Colors.primaryDark,
    fontWeight: 'bold',
    fontSize: 15,
  },
  teamMemberName: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  teamMemberRole: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
  },
});

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
  Calendar,
  Clock,
  User,
  Plus,
  CheckCircle2,
  Circle,
  FileText,
  MessageSquare,
  ChevronRight,
  Flame,
  Sun,
  Snowflake,
  FileCheck2,
  Map,
  Layers,
  Edit2,
  Edit3,
  Check,
  Share2,
  IndianRupee,
  Briefcase,
  UserCheck,
  Users,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { createNotification } from '../../lib/notificationService';

const LEAD_STATUS_OPTIONS = [
  { value: 'New', label: 'STATUS: NEW', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
  { value: 'Ongoing', label: 'STATUS: ONGOING', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { value: 'Success', label: 'STATUS: SUCCESS / WON', color: '#16A34A', bg: '#DCFCE7', border: '#BBF7D0' },
  { value: 'Closed', label: 'STATUS: CLOSED / LOST', color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' },
];

const LEAD_TEMP_OPTIONS = [
  { value: 'Hot', label: 'HOT LEAD', icon: '🔥', color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' },
  { value: 'Warm', label: 'WARM LEAD', icon: '☀️', color: '#D97706', bg: '#FFFBEB', border: '#FDE68A' },
  { value: 'Cold', label: 'COLD LEAD', icon: '❄️', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
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

export default function LeadDetailsScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const { id } = route.params || {};
  const { user } = useAuth();

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    | 'Overview'
    | 'Communication'
    | 'Requirement'
    | 'Workspace'
    | 'Quotations'
    | 'FollowUps'
    | 'Tasks'
    | 'Timeline'
    | 'Visit'
    | 'Documents'
  >('Overview');

  // Status & Temp Modals
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isTempModalOpen, setIsTempModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);

  // Sub-data collections
  const [employees, setEmployees] = useState<any[]>([]);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [siteVisits, setSiteVisits] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [isSavingServices, setIsSavingServices] = useState(false);

  // Note state
  const scrollViewRef = useRef<any>(null);
  const [notesYPos, setNotesYPos] = useState(0);
  const [noteText, setNoteText] = useState('');
  const [isPostingNote, setIsPostingNote] = useState(false);

  // Follow-up modal
  const [isFollowUpModalOpen, setIsFollowUpModalOpen] = useState(false);
  const [followUpTitle, setFollowUpTitle] = useState('');
  const [followUpDesc, setFollowUpDesc] = useState('');
  const [followUpDue, setFollowUpDue] = useState(new Date().toISOString().split('T')[0]);
  const [followUpTemp, setFollowUpTemp] = useState('Hot');

  // Task modal
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskAssignee, setNewTaskAssignee] = useState('');
  const [newTaskDue, setNewTaskDue] = useState(new Date().toISOString().split('T')[0]);

  // Communication modal
  const [isCommModalOpen, setIsCommModalOpen] = useState(false);
  const [commType, setCommType] = useState('Call');
  const [commOutcome, setCommOutcome] = useState('Connected');
  const [commResponse, setCommResponse] = useState('');

  // Quotation records from Supabase
  const [quotations, setQuotations] = useState<any[]>([]);

  // Edit Lead Info State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editPlotSize, setEditPlotSize] = useState('');
  const [editBudget, setEditBudget] = useState('');
  const [editTimeline, setEditTimeline] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const openEditModal = () => {
    if (!lead) return;
    setEditName(lead.name || '');
    setEditPhone(lead.phone || '');
    setEditEmail(lead.email || '');
    setEditAddress(lead.address || '');
    setEditPlotSize(lead.plot_size || '');
    setEditBudget(lead.budget || '');
    setEditTimeline(lead.timeline || '');
    setEditSource(lead.source || '');
    setEditNotes(lead.notes || '');
    setIsEditModalOpen(true);
  };

  const handleSaveLeadInfo = async () => {
    if (!editName.trim()) {
      Alert.alert('Required', 'Please enter lead name.');
      return;
    }
    setIsSavingEdit(true);
    try {
      const updates = {
        name: editName.trim(),
        phone: editPhone.trim(),
        email: editEmail.trim(),
        address: editAddress.trim(),
        plot_size: editPlotSize.trim(),
        budget: editBudget.trim(),
        timeline: editTimeline.trim(),
        source: editSource.trim(),
        notes: editNotes.trim(),
      };
      const { error } = await supabase.from('leads').update(updates).eq('id', id);
      if (error) throw error;

      await supabase.from('lead_activities').insert([
        {
          lead_id: id,
          activity_type: 'Lead Updated',
          activity_group: 'Timeline',
          title: 'Lead Information Updated',
          details: `Modified details for ${editName.trim()}`,
          employee_name: user?.name || 'Staff',
        },
      ]);

      setLead((prev: any) => ({ ...prev, ...updates }));
      setIsEditModalOpen(false);
      Alert.alert('Success', 'Lead information updated.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update lead');
    } finally {
      setIsSavingEdit(false);
    }
  };

  useEffect(() => {
    if (id) loadLeadFull();
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

  const loadLeadFull = async () => {
    setLoading(true);
    try {
      const { data: leadData, error } = await supabase.from('leads').select('*').eq('id', id).single();
      if (error) throw error;
      setLead(leadData);

      // Selected services
      const parsedWorkTypes = (leadData.service_type || '')
        .split(',')
        .map((s: string) => s.trim())
        .filter((s: string) => s.length > 0);
      setSelectedServices(parsedWorkTypes);

      // Fetch sub-modules concurrently
      const [tRes, aRes, dRes, vRes, qRes] = await Promise.all([
        supabase.from('tasks').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
        supabase.from('lead_activities').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
        supabase.from('documents').select('*').or(`lead_id.eq.${id},client_id.eq.${id}`).order('created_at', { ascending: false }),
        supabase.from('site_visits').select('*').eq('lead_id', id).order('created_at', { ascending: false }),
        supabase.from('quotations').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      ]);

      setTasks(tRes.data || []);
      const allActs = aRes.data || [];
      setActivities(allActs);
      setComments(allActs.filter((a: any) => a.activity_group === 'comment' || a.activity_type === 'Comment'));
      setDocuments(dRes.data || []);
      setSiteVisits(vRes.data || []);
      setQuotations(qRes.data || []);

      const { data: empData } = await supabase.from('employees').select('id, name, designation, role').order('name');
      if (empData) setEmployees(empData);
    } catch (err: any) {
      console.warn('Error loading lead:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStatus = async (newStatus: string) => {
    setIsStatusModalOpen(false);
    try {
      const { error } = await supabase.from('leads').update({ status: newStatus }).eq('id', id);
      if (error) throw error;

      setLead((prev: any) => ({ ...prev, status: newStatus }));

      await supabase.from('lead_activities').insert([
        {
          lead_id: id,
          activity_type: 'Status Change',
          activity_group: 'Timeline',
          title: `Lead Status Changed to ${newStatus}`,
          details: `Updated by ${user?.name || 'Staff'}`,
          employee_name: user?.name || 'Staff',
        },
      ]);

      await createNotification({
        title: 'Lead Status Updated',
        message: `${lead.name}'s status changed to "${newStatus}"`,
        module: 'lead',
        referenceId: id,
        recipientRole: 'All_Staff',
        createdByName: user?.name,
      });

      if (newStatus === 'Success' || newStatus === 'Won') {
        setIsConvertModalOpen(true);
      }

      loadLeadFull();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update status');
    }
  };

  const handleSelectTemperature = async (newTemp: string) => {
    setIsTempModalOpen(false);
    try {
      const { error } = await supabase.from('leads').update({ lead_temperature: newTemp }).eq('id', id);
      if (error) throw error;

      setLead((prev: any) => ({ ...prev, lead_temperature: newTemp }));

      await supabase.from('lead_activities').insert([
        {
          lead_id: id,
          activity_type: 'Temperature Updated',
          activity_group: 'Timeline',
          title: `Lead Temperature set to ${newTemp}`,
          details: `Updated by ${user?.name || 'Staff'}`,
          employee_name: user?.name || 'Staff',
        },
      ]);

      await createNotification({
        title: '🔥 Lead Temperature Updated',
        message: `${lead.name}'s priority updated to "${newTemp}"`,
        module: 'lead',
        referenceId: id,
        recipientRole: 'All_Staff',
        createdByName: user?.name,
      });

      loadLeadFull();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update temperature');
    }
  };

  const handleToggleAssignEmployee = async (empId: string, empName: string) => {
    let currentAssigned = (lead?.assigned_to || '').split(',').map((s: string) => s.trim()).filter(Boolean);
    const exists = currentAssigned.includes(empId) || currentAssigned.includes(empName);
    let nextAssigned: string[];
    if (exists) {
      nextAssigned = currentAssigned.filter((x: string) => x !== empId && x !== empName);
    } else {
      nextAssigned = [...currentAssigned, empName || empId];
    }
    const newAssignedString = nextAssigned.join(', ');

    setLead((prev: any) => ({ ...prev, assigned_to: newAssignedString }));

    try {
      const { error } = await supabase.from('leads').update({ assigned_to: newAssignedString || null }).eq('id', id);
      if (error) throw error;

      await createNotification({
        title: '👥 Lead Assignment Updated',
        message: `${lead.name} assigned team: ${newAssignedString || 'Unassigned'}`,
        module: 'lead',
        referenceId: id,
        recipientRole: 'All_Staff',
        recipientUserId: empId,
        createdByName: user?.name,
      });
    } catch (e: any) {
      console.warn('Failed to update assigned employee', e.message);
    }
  };

  const handleConvertToClient = async () => {
    setIsConvertModalOpen(false);
    try {
      const { data: newClientData, error: insertError } = await supabase
        .from('clients')
        .insert([
          {
            name: lead.name,
            status: 'Ongoing',
            email: lead.email,
            phone: lead.phone,
            address: lead.address,
            company: lead.company,
            source: lead.source,
            work_types: lead.service_type,
            budget: lead.budget,
            plot_size: lead.plot_size,
            timeline: lead.timeline,
            lead_temperature: lead.lead_temperature,
            notes: lead.notes,
            created_at: new Date().toISOString(),
          },
        ])
        .select();

      if (insertError) throw insertError;

      const newClientId = newClientData[0].id;

      // Link existing tasks, documents, and visits to the new client
      await Promise.all([
        supabase.from('tasks').update({ client_id: newClientId }).eq('lead_id', id),
        supabase.from('documents').update({ client_id: newClientId }).eq('lead_id', id),
        supabase.from('site_visits').update({ client_id: newClientId }).eq('lead_id', id),
        supabase.from('lead_activities').update({ client_id: newClientId }).eq('lead_id', id),
        supabase.from('leads').update({ status: 'Success' }).eq('id', id),
      ]);

      await createNotification({
        title: '🎉 Lead Converted to Client!',
        message: `${lead.name} was successfully enrolled as an official Client`,
        module: 'client',
        referenceId: newClientId,
        recipientRole: 'All_Staff',
        createdByName: user?.name,
      });

      Alert.alert('Lead Converted!', `${lead.name} has been successfully enrolled as an official Client.`, [
        {
          text: 'Open Client Workspace',
          onPress: () => navigation.replace('ClientDetails', { id: newClientId }),
        },
        { text: 'Stay Here', style: 'cancel' },
      ]);
    } catch (e: any) {
      Alert.alert('Conversion Failed', e.message || 'Could not convert to client');
    }
  };

  const handleAddComment = async () => {
    if (!noteText.trim()) return;
    setIsPostingNote(true);
    try {
      const { error } = await supabase.from('lead_activities').insert([
        {
          lead_id: id,
          activity_type: 'Comment',
          activity_group: 'comment',
          title: 'Internal Discussion Note',
          details: noteText.trim(),
          employee_name: user?.name || 'Staff',
        },
      ]);
      if (error) throw error;
      setNoteText('');
      loadLeadFull();
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
      const payload = {
        title: followUpTitle.trim(),
        name: followUpTitle.trim(),
        description: followUpDesc.trim() || null,
        due_date: new Date(followUpDue).toISOString(),
        custom_category: 'Follow Up',
        priority: followUpTemp,
        status: 'To Do',
        category: 'Lead',
        lead_id: id,
        creator_id: user?.id || null,
        assignee_id: user?.id || null,
      };

      const { data, error } = await supabase.from('tasks').insert([payload]).select();
      if (error) throw error;

      await supabase.from('lead_activities').insert([
        {
          lead_id: id,
          activity_type: 'Follow-Up Scheduled',
          activity_group: 'Timeline',
          title: `Follow-Up: ${followUpTitle.trim()}`,
          details: `Due on ${followUpDue} (${followUpTemp} Lead)${followUpDesc.trim() ? ` - ${followUpDesc.trim()}` : ''}`,
          employee_name: user?.name || 'Staff',
        },
      ]);

      await createNotification({
        title: '📅 New Follow-Up Scheduled',
        message: `${lead.name}: "${followUpTitle.trim()}" due ${followUpDue}`,
        module: 'followup',
        referenceId: id,
        recipientRole: 'All_Staff',
        recipientUserId: user?.id,
        createdByName: user?.name,
      });

      setIsFollowUpModalOpen(false);
      setFollowUpTitle('');
      setFollowUpDesc('');
      loadLeadFull();
      Alert.alert('Success', 'Follow-up reminder scheduled.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to schedule follow-up');
    }
  };

  const handleLogCommunication = async () => {
    if (!commResponse.trim()) {
      Alert.alert('Required', 'Please enter client response summary.');
      return;
    }
    try {
      const { error } = await supabase.from('lead_activities').insert([
        {
          lead_id: id,
          activity_group: 'Communication',
          activity_type: commType,
          title: `Outgoing - ${commOutcome}`,
          details: commResponse.trim(),
          employee_name: user?.name || 'Staff',
          metadata: { interaction_date: new Date().toISOString() },
        },
      ]);
      if (error) throw error;

      await createNotification({
        title: `📞 ${commType} Logged (${commOutcome})`,
        message: `${lead.name}: "${commResponse.trim().substring(0, 75)}"`,
        module: 'communication',
        referenceId: id,
        recipientRole: 'All_Staff',
        createdByName: user?.name,
      });

      setIsCommModalOpen(false);
      setCommResponse('');
      loadLeadFull();
      Alert.alert('Logged', 'Interaction recorded.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not log communication');
    }
  };

  const handleToggleService = (srv: string) => {
    if (selectedServices.includes(srv)) {
      setSelectedServices(selectedServices.filter(s => s !== srv));
    } else {
      setSelectedServices([...selectedServices, srv]);
    }
  };

  const handleSaveServices = async () => {
    setIsSavingServices(true);
    try {
      const workTypes = selectedServices.join(', ');
      const { error } = await supabase.from('leads').update({ service_type: workTypes }).eq('id', id);
      if (error) throw error;
      Alert.alert('Saved', 'Service scope updated.');
      loadLeadFull();
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to save services');
    } finally {
      setIsSavingServices(false);
    }
  };

  if (loading || !lead) {
    return (
      <View style={[styles.center, { paddingTop: safeTop }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading Lead Workspace...</Text>
      </View>
    );
  }

  const currentStatusObj =
    LEAD_STATUS_OPTIONS.find(o => o.value.toLowerCase() === (lead.status || 'New').toLowerCase()) ||
    LEAD_STATUS_OPTIONS[0];

  const currentTempObj =
    LEAD_TEMP_OPTIONS.find(t => t.value.toLowerCase() === (lead.lead_temperature || 'Warm').toLowerCase()) ||
    LEAD_TEMP_OPTIONS[1];

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.topBarTitleBox}>
          <Text style={styles.topBarTitle} numberOfLines={1}>
            {lead.name}
          </Text>
          <Text style={styles.topBarSubtitle}>LEAD ID: LD-{lead.id.substring(0, 6).toUpperCase()}</Text>
        </View>

        {/* Status & Temp Dual Buttons */}
        <View style={styles.headerBadgesRow}>
          <TouchableOpacity
            style={[styles.statusBadgeBtn, { backgroundColor: currentStatusObj.bg, borderColor: currentStatusObj.border }]}
            onPress={() => setIsStatusModalOpen(true)}
          >
            <Text style={[styles.statusBadgeText, { color: currentStatusObj.color }]}>
              {lead.status || 'New'}
            </Text>
            <Edit2 size={11} color={currentStatusObj.color} style={{ marginLeft: 3 }} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tempBadgeBtn, { backgroundColor: currentTempObj.bg, borderColor: currentTempObj.border }]}
            onPress={() => setIsTempModalOpen(true)}
          >
            <Text style={styles.tempBadgeIcon}>{currentTempObj.icon}</Text>
            <Text style={[styles.tempBadgeText, { color: currentTempObj.color }]}>
              {lead.lead_temperature || 'Warm'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabBarWrapper}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {[
            { id: 'Overview', label: 'Overview' },
            { id: 'Communication', label: 'Communication' },
            { id: 'Requirement', label: 'Service Requirement' },
            { id: 'Workspace', label: 'Service Workspace' },
            { id: 'Quotations', label: 'Quotation Builder' },
            { id: 'FollowUps', label: `Follow-Ups (${tasks.filter(t => t.custom_category === 'Follow Up' || t.type === 'followup').length})` },
            { id: 'Tasks', label: `Tasks (${tasks.length})` },
            { id: 'Timeline', label: 'Timeline' },
            { id: 'Visit', label: `Visits (${siteVisits.length})` },
            { id: 'Documents', label: `Docs (${documents.length})` },
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
              <View style={styles.card}>
                <View style={styles.profileRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{lead.name?.charAt(0).toUpperCase() || 'L'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.clientName}>{lead.name}</Text>
                    <Text style={styles.companyName}>Source: {lead.source || 'Direct Enquiry'}</Text>
                    <Text style={styles.assignedTag}>
                      Assigned: {lead.assigned_to || 'General Sales / CRO'}
                    </Text>
                  </View>
                </View>

                {/* Quick Actions */}
                <View style={styles.quickActionsBar}>
                  {lead.phone && (
                    <TouchableOpacity
                      style={[styles.actionChip, { backgroundColor: '#10B981' }]}
                      onPress={() => Linking.openURL(`tel:${lead.phone}`)}
                    >
                      <Phone size={15} color="#FFFFFF" />
                      <Text style={styles.actionChipText}>Call</Text>
                    </TouchableOpacity>
                  )}
                  {lead.phone && (
                    <TouchableOpacity
                      style={[styles.actionChip, { backgroundColor: '#25D366' }]}
                      onPress={() => {
                        const clean = lead.phone.replace(/[^0-9]/g, '');
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
                  <TouchableOpacity
                    style={[styles.actionChip, { backgroundColor: '#059669' }]}
                    onPress={() => setIsConvertModalOpen(true)}
                  >
                    <UserCheck size={15} color="#FFFFFF" />
                    <Text style={styles.actionChipText}>Convert Client</Text>
                  </TouchableOpacity>
                </View>
              </View>

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
                        const cur = (lead.assigned_to || '').toLowerCase();
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
                      const cur = (lead.assigned_to || '').toLowerCase();
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

              {/* Contact & Property Specifications with Edit Option */}
              <View style={styles.card}>
                <View style={styles.cardHeaderFlex}>
                  <Text style={[styles.cardSectionTitle, { marginBottom: 0 }]}>Lead Contact & Property Details</Text>
                  <TouchableOpacity style={styles.editInfoBtn} onPress={openEditModal}>
                    <Edit3 size={13} color={Colors.primaryDark} />
                    <Text style={styles.editInfoBtnText}>Edit Info</Text>
                  </TouchableOpacity>
                </View>

              <View style={styles.detailRow}>
                <Phone size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Phone:</Text>
                <Text style={styles.detailVal}>{lead.phone || 'N/A'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Mail size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Email:</Text>
                <Text style={styles.detailVal}>{lead.email || 'N/A'}</Text>
              </View>

              <View style={styles.detailRow}>
                <MapPin size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Address:</Text>
                <Text style={styles.detailVal}>{lead.address || 'Not specified'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Briefcase size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Plot Size:</Text>
                <Text style={styles.detailVal}>{lead.plot_size || 'N/A'}</Text>
              </View>

              <View style={styles.detailRow}>
                <IndianRupee size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Budget Range:</Text>
                <Text style={styles.detailVal}>{lead.budget || 'Flexible'}</Text>
              </View>

              <View style={styles.detailRow}>
                <Calendar size={16} color={Colors.textMuted} />
                <Text style={styles.detailLabel}>Target Timeline:</Text>
                <Text style={styles.detailVal}>{lead.timeline || 'Immediate'}</Text>
              </View>
            </View>

            {/* Scope / Work Types */}
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Enrolled Services</Text>
              <View style={styles.tagWrap}>
                {selectedServices.length > 0 ? (
                  selectedServices.map((srv, idx) => (
                    <View key={idx} style={styles.scopeTag}>
                      <Text style={styles.scopeTagText}>{srv}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyNotice}>No services selected yet.</Text>
                )}
              </View>
            </View>

            {/* Internal Staff Notes Feed */}
            <View style={styles.card} onLayout={(e) => setNotesYPos(e.nativeEvent.layout.y)}>
              <Text style={styles.cardSectionTitle}>Internal Discussion & Notes</Text>

              <View style={styles.noteInputRow}>
                <TextInput
                  style={styles.noteInput}
                  placeholder="Type an internal note about this lead..."
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
                <Text style={styles.emptyNotice}>No internal notes recorded yet.</Text>
              )}
            </View>
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

            {activities.filter(a => a.activity_group === 'Communication').length > 0 ? (
              activities
                .filter(a => a.activity_group === 'Communication')
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
                <Text style={styles.emptyCardTitle}>No Calls or Messages Logged</Text>
                <Text style={styles.emptyCardSub}>Log client phone calls, WhatsApp chats, or in-person meetings.</Text>
              </View>
            )}
          </View>
        )}

        {/* ======================= SERVICE REQUIREMENT TAB ======================= */}
        {activeTab === 'Requirement' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Design Services</Text>
              <View style={styles.checklist}>
                {DESIGN_SERVICES_LIST.map((srv, idx) => {
                  const isChecked = selectedServices.includes(srv);
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.checklistItem, isChecked && styles.checklistItemActive]}
                      onPress={() => handleToggleService(srv)}
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
                      onPress={() => handleToggleService(srv)}
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
                style={[styles.primaryActionBtn, isSavingServices && { opacity: 0.6 }]}
                onPress={handleSaveServices}
                disabled={isSavingServices}
              >
                <Text style={styles.primaryActionBtnText}>
                  {isSavingServices ? 'Saving Scope...' : 'Save Services'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ======================= SERVICE WORKSPACE TAB ======================= */}
        {activeTab === 'Workspace' && (
          <View>
            <View style={styles.card}>
              <Text style={styles.cardSectionTitle}>Active Service Scope</Text>
              {selectedServices.length > 0 ? (
                selectedServices.map((srv, idx) => (
                  <View key={idx} style={styles.finItemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.finItemName}>{srv}</Text>
                      <Text style={styles.finItemSub}>Consultancy Requirement</Text>
                    </View>
                    <View style={[styles.itemBadge, { backgroundColor: '#DCFCE7' }]}>
                      <Text style={[styles.itemBadgeText, { color: '#15803d' }]}>Active</Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyNotice}>No services enrolled yet.</Text>
              )}
            </View>
          </View>
        )}

        {/* ======================= QUOTATIONS TAB ======================= */}
        {activeTab === 'Quotations' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Estimates & Formal Quotations</Text>
            </View>

            {quotations.length > 0 ? (
              quotations.map((q, idx) => (
                <View key={q.id || idx} style={styles.itemCard}>
                  <View style={styles.itemHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.itemTitle}>{q.quotation_no ? `Quote #${q.quotation_no}` : 'Quotation'}</Text>
                      <Text style={styles.itemId}>{q.description || 'Consultancy / Engineering Quotation'}</Text>
                    </View>
                    <View
                      style={[
                        styles.itemBadge,
                        { backgroundColor: q.status === 'CLOSED' ? '#ECFDF5' : '#FEF3C7' },
                      ]}
                    >
                      <Text
                        style={[
                          styles.itemBadgeText,
                          { color: q.status === 'CLOSED' ? '#047857' : '#B45309' },
                        ]}
                      >
                        {q.status || 'Pending'}
                      </Text>
                    </View>
                  </View>
                  {q.submission_deadline ? (
                    <Text style={styles.itemSubText}>{q.submission_deadline}</Text>
                  ) : null}
                  {q.date_arrived ? (
                    <Text style={styles.timelineAuthor}>Date: {q.date_arrived}</Text>
                  ) : null}
                  {q.file_url ? (
                    <TouchableOpacity
                      style={[styles.openBtn, { marginTop: 8 }]}
                      onPress={() => Linking.openURL(q.file_url)}
                    >
                      <Text style={styles.openBtnText}>View Document</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <FileText size={36} color={Colors.textMuted} />
                <Text style={styles.emptyCardTitle}>No Quotations Prepared</Text>
                <Text style={styles.emptyCardSub}>No formal quotations or estimates have been created for this lead yet.</Text>
              </View>
            )}
          </View>
        )}

        {/* ======================= FOLLOW UPS TAB ======================= */}
        {activeTab === 'FollowUps' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Follow-Up Schedule</Text>
              <TouchableOpacity
                style={styles.smallAddBtn}
                onPress={() => setIsFollowUpModalOpen(true)}
              >
                <Plus size={14} color="#FFFFFF" />
                <Text style={styles.smallAddBtnText}>Schedule</Text>
              </TouchableOpacity>
            </View>

            {tasks.filter(t => t.custom_category === 'Follow Up' || t.type === 'followup').length > 0 ? (
              tasks
                .filter(t => t.custom_category === 'Follow Up' || t.type === 'followup')
                .map(t => (
                  <View key={t.id} style={styles.itemCard}>
                    <View style={styles.itemHeader}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemTitle}>{t.name || t.title}</Text>
                        <Text style={styles.itemId}>Due: {t.due_date ? new Date(t.due_date).toLocaleDateString('en-IN') : 'No Date'}</Text>
                      </View>
                      <View
                        style={[
                          styles.itemBadge,
                          {
                            backgroundColor:
                              t.priority === 'Hot' ? '#FEE2E2' : t.priority === 'Warm' ? '#FEF3C7' : '#EFF6FF',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.itemBadgeText,
                            {
                              color:
                                t.priority === 'Hot' ? '#DC2626' : t.priority === 'Warm' ? '#D97706' : '#2563EB',
                            },
                          ]}
                        >
                          {t.priority || 'Hot'}
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
                <Text style={styles.emptyCardTitle}>No Follow-Ups Scheduled</Text>
                <Text style={styles.emptyCardSub}>Keep this lead hot by scheduling a check-in appointment.</Text>
              </View>
            )}
          </View>
        )}

        {/* ======================= TASKS TAB ======================= */}
        {activeTab === 'Tasks' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Operational Tasks</Text>
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
                      <Text style={styles.itemId}>Due: {t.due_date || 'No Date'}</Text>
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
                <Text style={styles.emptyCardTitle}>No Tasks Assigned</Text>
                <Text style={styles.emptyCardSub}>Assign staff action items for this lead.</Text>
              </View>
            )}
          </View>
        )}

        {/* ======================= TIMELINE TAB ======================= */}
        {activeTab === 'Timeline' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Lead Audit Trail</Text>
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
                <Text style={styles.emptyCardTitle}>No Timeline Events</Text>
                <Text style={styles.emptyCardSub}>Stage modifications and call logs appear here.</Text>
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
                      <Text style={styles.itemTitle}>{v.purpose || v.visit_type || 'Site Visit'}</Text>
                      <Text style={styles.itemId}>Date: {v.visiting_date || v.visit_date || 'Recorded'}</Text>
                    </View>
                    <View style={[styles.itemBadge, { backgroundColor: '#ECFDF5' }]}>
                      <Text style={[styles.itemBadgeText, { color: '#047857' }]}>
                        {v.status || 'Completed'}
                      </Text>
                    </View>
                  </View>
                  {v.outcome && <Text style={styles.itemSubText}>Outcome: {v.outcome}</Text>}
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <MapPin size={36} color={Colors.textMuted} />
                <Text style={styles.emptyCardTitle}>No Site Visits Recorded</Text>
                <Text style={styles.emptyCardSub}>Site inspections and field surveys will appear here.</Text>
              </View>
            )}
          </View>
        )}

        {/* ======================= DOCUMENTS TAB ======================= */}
        {activeTab === 'Documents' && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Lead Files & Photos</Text>
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
                <Text style={styles.emptyCardTitle}>No Documents Attached</Text>
                <Text style={styles.emptyCardSub}>Site photos and KYC documents appear here.</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      {/* ======================= STATUS PICKER MODAL ======================= */}
      <Modal visible={isStatusModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Update Lead Stage</Text>
            <Text style={styles.modalSub}>Select pipeline status for this lead:</Text>

            <View style={styles.stagePicker}>
              {LEAD_STATUS_OPTIONS.map(st => (
                <TouchableOpacity
                  key={st.value}
                  style={[
                    styles.stageOption,
                    (lead.status || 'New').toLowerCase() === st.value.toLowerCase() && {
                      borderColor: st.color,
                      backgroundColor: st.bg,
                    },
                  ]}
                  onPress={() => handleSelectStatus(st.value)}
                >
                  <Text
                    style={[
                      styles.stageOptionText,
                      { color: st.color, fontWeight: 'bold' },
                    ]}
                  >
                    {st.label}
                  </Text>
                  {(lead.status || 'New').toLowerCase() === st.value.toLowerCase() && (
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

      {/* ======================= TEMPERATURE PICKER MODAL ======================= */}
      <Modal visible={isTempModalOpen} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Lead Temperature</Text>
            <Text style={styles.modalSub}>Set urgency and engagement level:</Text>

            <View style={styles.stagePicker}>
              {LEAD_TEMP_OPTIONS.map(tp => (
                <TouchableOpacity
                  key={tp.value}
                  style={[
                    styles.stageOption,
                    (lead.lead_temperature || 'Warm').toLowerCase() === tp.value.toLowerCase() && {
                      borderColor: tp.color,
                      backgroundColor: tp.bg,
                    },
                  ]}
                  onPress={() => handleSelectTemperature(tp.value)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Text style={{ fontSize: 18 }}>{tp.icon}</Text>
                    <Text style={[styles.stageOptionText, { color: tp.color, fontWeight: 'bold' }]}>
                      {tp.label}
                    </Text>
                  </View>
                  {(lead.lead_temperature || 'Warm').toLowerCase() === tp.value.toLowerCase() && (
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

      {/* ======================= CONVERT TO CLIENT MODAL ======================= */}
      <Modal visible={isConvertModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🎉 Convert Lead to Client</Text>
            <Text style={styles.modalSub}>
              Convert <Text style={{ fontWeight: 'bold', color: Colors.text }}>{lead.name}</Text> into an enrolled Client account?
            </Text>

            <View style={styles.convertDetailBox}>
              <Text style={styles.convertDetailText}>• Creates permanent Client profile in CRM</Text>
              <Text style={styles.convertDetailText}>• Transfers all site visits, documents & follow-ups</Text>
              <Text style={styles.convertDetailText}>• Sets status to Won / Ongoing Client</Text>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsConvertModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: '#16A34A' }]}
                onPress={handleConvertToClient}
              >
                <Text style={styles.modalConfirmText}>Convert Now</Text>
              </TouchableOpacity>
            </View>
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
              placeholder="e.g. Call regarding revised 2D plan quotation"
              value={followUpTitle}
              onChangeText={setFollowUpTitle}
            />

            <Text style={styles.inputLabel}>Description / Agenda</Text>
            <TextInput
              style={[styles.textInput, { height: 68, textAlignVertical: 'top' }]}
              placeholder="Key notes, customer requests, or agenda..."
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

            <Text style={styles.inputLabel}>Temperature</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 8 }}>
              {['Hot', 'Warm', 'Cold'].map(p => (
                <TouchableOpacity
                  key={p}
                  style={[
                    styles.priorityChip,
                    followUpTemp === p && { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
                  ]}
                  onPress={() => setFollowUpTemp(p)}
                >
                  <Text
                    style={[
                      styles.priorityChipText,
                      followUpTemp === p && { color: '#FFFFFF', fontWeight: 'bold' },
                    ]}
                  >
                    {p === 'Hot' ? '🔥 Hot' : p === 'Warm' ? '☀️ Warm' : '❄️ Cold'}
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

      {/* ======================= COMMUNICATION MODAL ======================= */}
      <Modal visible={isCommModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Log Lead Communication</Text>

            <Text style={styles.inputLabel}>Channel</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginVertical: 6 }}>
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

            <Text style={styles.inputLabel}>Outcome</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6, flexWrap: 'wrap' }}>
              {['Connected', 'Busy', 'Callback Requested', 'Wrong Number', 'Meeting Scheduled'].map(oc => (
                <TouchableOpacity
                  key={oc}
                  style={[
                    styles.priorityChip,
                    commOutcome === oc && { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
                  ]}
                  onPress={() => setCommOutcome(oc)}
                >
                  <Text
                    style={[
                      styles.priorityChipText,
                      commOutcome === oc && { color: '#FFFFFF', fontWeight: 'bold' },
                    ]}
                  >
                    {oc}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.inputLabel}>Client Feedback & Discussion</Text>
            <TextInput
              style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
              placeholder="Record customer response and requirements..."
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

      {/* ======================= TASK MODAL ======================= */}
      <Modal visible={isTaskModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Task for Lead</Text>

            <Text style={styles.inputLabel}>Task Title</Text>
            <TextInput
              style={styles.textInput}
              placeholder="e.g. Send preliminary quotation PDF"
              value={newTaskTitle}
              onChangeText={setNewTaskTitle}
            />

            <Text style={styles.inputLabel}>Description / Instructions</Text>
            <TextInput
              style={[styles.textInput, { height: 68, textAlignVertical: 'top' }]}
              placeholder="Detailed instructions or specifications..."
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
                      styles.priorityChip,
                      isSelected && { backgroundColor: Colors.primaryDark, borderColor: Colors.primaryDark },
                    ]}
                    onPress={() => setNewTaskAssignee(emp.id)}
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
              value={newTaskDue}
              onChangeText={setNewTaskDue}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setIsTaskModalOpen(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirmBtn}
                onPress={async () => {
                  if (!newTaskTitle.trim()) return;
                  const targetAssigneeId = newTaskAssignee || user?.id || null;
                  const { data, error } = await supabase.from('tasks').insert([
                    {
                      title: newTaskTitle.trim(),
                      name: newTaskTitle.trim(),
                      description: newTaskDesc.trim() || null,
                      due_date: newTaskDue,
                      lead_id: id,
                      status: 'To Do',
                      priority: 'High',
                      category: 'Lead',
                      assignee_id: targetAssigneeId,
                      creator_id: user?.id || null,
                    },
                  ]).select();

                  if (!error && targetAssigneeId) {
                    const targetEmp = employees.find(e => e.id === targetAssigneeId);
                    await createNotification({
                      title: '📋 New Lead Task Assigned',
                      message: `Task: "${newTaskTitle.trim()}" for lead ${lead?.name || 'Lead'}. Due: ${newTaskDue}`,
                      module: 'task',
                      referenceId: data?.[0]?.id,
                      recipientRole: targetEmp?.role === 'Admin' ? 'Admin' : 'Employee',
                      recipientUserId: targetAssigneeId,
                      createdByName: user?.name || 'Staff',
                    });
                  }

                  setIsTaskModalOpen(false);
                  setNewTaskTitle('');
                  setNewTaskDesc('');
                  setNewTaskAssignee('');
                  loadLeadFull();
                }}
              >
                <Text style={styles.modalConfirmText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ======================= EDIT LEAD INFORMATION MODAL ======================= */}
      <Modal visible={isEditModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '85%' }]}>
            <View style={styles.cardHeaderFlex}>
              <Text style={styles.modalTitle}>Edit Lead Information</Text>
              <TouchableOpacity onPress={() => setIsEditModalOpen(false)}>
                <Text style={{ fontSize: 18, color: Colors.textMuted, fontWeight: 'bold' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Full Name *</Text>
              <TextInput
                style={styles.textInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Lead full name"
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
                placeholder="lead@gmail.com"
              />

              <Text style={styles.inputLabel}>Physical / Site Address</Text>
              <TextInput
                style={styles.textInput}
                value={editAddress}
                onChangeText={setEditAddress}
                placeholder="Plot/Street/City"
              />

              <Text style={styles.inputLabel}>Plot Size</Text>
              <TextInput
                style={styles.textInput}
                value={editPlotSize}
                onChangeText={setEditPlotSize}
                placeholder="e.g. 1500 sq ft / 30x50"
              />

              <Text style={styles.inputLabel}>Budget Range</Text>
              <TextInput
                style={styles.textInput}
                value={editBudget}
                onChangeText={setEditBudget}
                placeholder="e.g. ₹ 45 Lakhs"
              />

              <Text style={styles.inputLabel}>Target Timeline</Text>
              <TextInput
                style={styles.textInput}
                value={editTimeline}
                onChangeText={setEditTimeline}
                placeholder="e.g. Immediate / Next Month"
              />

              <Text style={styles.inputLabel}>Enquiry Source</Text>
              <TextInput
                style={styles.textInput}
                value={editSource}
                onChangeText={setEditSource}
                placeholder="e.g. Website, Referral, Banner"
              />

              <Text style={styles.inputLabel}>General Notes / Requirements</Text>
              <TextInput
                style={[styles.textInput, { minHeight: 60 }]}
                value={editNotes}
                onChangeText={setEditNotes}
                multiline
                placeholder="Additional client requirements..."
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
                  onPress={handleSaveLeadInfo}
                  disabled={isSavingEdit}
                >
                  <Text style={styles.modalConfirmText}>{isSavingEdit ? 'Saving...' : 'Save Changes'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
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
            <Text style={styles.modalSub}>Select relationship managers & staff for this lead</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ gap: 8 }}>
                {employees.map((emp) => {
                  const cur = (lead?.assigned_to || '').toLowerCase();
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
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    padding: 6,
    marginRight: 6,
  },
  topBarTitleBox: {
    flex: 1,
  },
  topBarTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
  },
  topBarSubtitle: {
    fontSize: 10,
    color: Colors.textMuted,
    fontWeight: '600',
    marginTop: 1,
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
    gap: 4,
  },
  tempBadgeIcon: {
    fontSize: 12,
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
    width: 125,
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
  },
  convertDetailBox: {
    backgroundColor: '#F0FDF4',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BBF7D0',
    marginVertical: 10,
    gap: 6,
  },
  convertDetailText: {
    fontSize: 12,
    color: '#166534',
    fontWeight: '500',
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
    alignItems: 'center',
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

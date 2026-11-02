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
  Platform,
  StatusBar,
  RefreshControl,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  FileText,
  Send,
  Layers,
  Sparkles,
  MessageCircle,
  Copy,
  Paperclip,
  X,
  Camera,
  Image as ImageIcon,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { createClientNotification } from '../../lib/notificationService';
import R2ImageThumbnail from '../../components/R2ImageThumbnail';
import {
  pickImageAndUpload,
  takePhotoAndUpload,
  pickDocumentAndUpload,
  deleteR2File,
} from '../../lib/r2Storage';

// Default Templates from Web CRM
const DEFAULT_TEMPLATES = [
  {
    id: 'tpl_lucc',
    name: 'L.U.C.C & Legal Services',
    steps: [
      { id: 1, order: 1, title: 'Document Collection & Title Deed Verification' },
      { id: 2, order: 2, title: 'Land Survey & Site Inspection' },
      { id: 3, order: 3, title: 'Application Submission to Municipal / Panchayat Authority' },
      { id: 4, order: 4, title: 'Departmental Clearance & Field Verification' },
      { id: 5, order: 5, title: 'Final L.U.C.C / Sanction Certificate Issuance' },
    ],
  },
  {
    id: 'tpl_architectural',
    name: 'Architectural & 3D Design',
    steps: [
      { id: 1, order: 1, title: 'Client Requirement Brief & Site Analysis' },
      { id: 2, order: 2, title: 'Conceptual 2D Floor Plan Layouts' },
      { id: 3, order: 3, title: '3D Front Elevation & Exterior Concept' },
      { id: 4, order: 4, title: 'Structural & MEP Drawings Preparation' },
      { id: 5, order: 5, title: 'Final Design Approval & Client Handover' },
    ],
  },
  {
    id: 'tpl_construction',
    name: 'Civil Construction Execution',
    steps: [
      { id: 1, order: 1, title: 'Site Setup & Mobilization' },
      { id: 2, order: 2, title: 'Excavation & Foundation' },
      { id: 3, order: 3, title: 'Structural Framework & Superstructure' },
      { id: 4, order: 4, title: 'Masonry & Core Works' },
      { id: 5, order: 5, title: 'MEP Rough-ins (Plumbing, Electrical, HVAC)' },
      { id: 6, order: 6, title: 'Plastering, Flooring & Finishes' },
      { id: 7, order: 7, title: 'Handover & Final Inspection' },
    ],
  },
];

export default function ClientHubScreen({ navigation, route }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const { user } = useAuth();

  const { clientLogin } = route.params || {};
  const clientId = clientLogin?.department || clientLogin?.id;
  const clientName = clientLogin?.name || 'Client';

  const [activeTab, setActiveTab] = useState<'milestones' | 'chat'>('milestones');
  const [milestones, setMilestones] = useState<any[]>([]);
  const [employeeRecord, setEmployeeRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Template Modal
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  // Add Milestone Modal
  const [isAddMilestoneOpen, setIsAddMilestoneOpen] = useState(false);
  const [newMilestoneTitle, setNewMilestoneTitle] = useState('');

  // Expandable milestone note
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [commentInput, setCommentInput] = useState<{ [key: number]: string }>({});

  // Chat Tab states
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const [uploadingMilestoneId, setUploadingMilestoneId] = useState<number | null>(null);
  const [uploadingChat, setUploadingChat] = useState(false);

  // Custom Bottom Sheet Action Picker for Attachments
  const [attachPickerModal, setAttachPickerModal] = useState<{
    visible: boolean;
    milestoneId?: number;
    target: 'milestone' | 'chat';
    title: string;
    subtitle: string;
  }>({
    visible: false,
    target: 'milestone',
    title: '',
    subtitle: '',
  });

  const fetchMilestonesAndChat = async () => {
    if (!clientId) return;
    try {
      // 1. Fetch employee record where role = 'Client' and department = clientId
      const { data: empData } = await supabase
        .from('employees')
        .select('*')
        .eq('department', clientId)
        .eq('role', 'Client')
        .maybeSingle();

      if (empData) {
        setEmployeeRecord(empData);
        const perms = empData.permissions || {};
        if (Array.isArray(perms.milestones)) {
          setMilestones(perms.milestones);
        }
      }

      // 2. Fetch Chat Messages
      const { data: cMsgs } = await supabase
        .from('client_messages')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });

      if (cMsgs) setChatMessages(cMsgs);
    } catch (err: any) {
      console.warn('Error fetching client hub data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMilestonesAndChat();
  }, [clientId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchMilestonesAndChat();
  };

  // Save Milestones to DB
  const persistMilestones = async (newMilestones: any[]) => {
    if (!employeeRecord?.id) return;
    try {
      const updatedPerms = { ...(employeeRecord.permissions || {}), milestones: newMilestones };
      await supabase
        .from('employees')
        .update({ permissions: updatedPerms })
        .eq('id', employeeRecord.id);

      setEmployeeRecord((prev: any) => ({ ...prev, permissions: updatedPerms }));
      setMilestones(newMilestones);
    } catch (err: any) {
      Alert.alert('Save Failed', err.message || 'Could not save milestones');
    }
  };

  // Apply Standard Template
  const handleApplyTemplate = (tpl: any) => {
    Alert.alert(
      'Apply Template',
      `Apply "${tpl.name}"? This will set up ${tpl.steps.length} milestones for ${clientName}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Apply & Load',
          onPress: async () => {
            const loadedSteps = tpl.steps.map((s: any, i: number) => ({
              id: Date.now() + i,
              order: s.order || i + 1,
              title: s.title,
              completed: false,
              comments: [],
              files: [],
            }));
            await persistMilestones(loadedSteps);
            setIsTemplateModalOpen(false);

            // Notify Client
            await createClientNotification({
              clientId,
              clientEmpId: employeeRecord?.id,
              title: `📋 New Project Roadmap: ${tpl.name}`,
              message: `Dayal Team added ${loadedSteps.length} milestones to your project dashboard.`,
              module: 'milestone',
            });
          },
        },
      ]
    );
  };

  // Add Custom Milestone
  const handleAddMilestone = async () => {
    if (!newMilestoneTitle.trim()) return;
    const newObj = {
      id: Date.now(),
      order: milestones.length + 1,
      title: newMilestoneTitle.trim(),
      completed: false,
      comments: [],
      files: [],
    };
    const updated = [...milestones, newObj].sort((a, b) => a.order - b.order);
    setNewMilestoneTitle('');
    setIsAddMilestoneOpen(false);
    await persistMilestones(updated);

    // Notify Client
    await createClientNotification({
      clientId,
      clientEmpId: employeeRecord?.id,
      title: `🏗️ New Milestone Added: ${newObj.title}`,
      message: `A new milestone has been scheduled for your project.`,
      module: 'milestone',
    });
  };

  // Toggle Complete Milestone -> NOTIFIES CLIENT!
  const handleToggleComplete = async (milestone: any) => {
    const nextStatus = !milestone.completed;
    const updated = milestones.map(m => (m.id === milestone.id ? { ...m, completed: nextStatus } : m));
    await persistMilestones(updated);

    // NOTIFY CLIENT ON COMPLETION
    if (nextStatus) {
      await createClientNotification({
        clientId,
        clientEmpId: employeeRecord?.id,
        title: `✅ Milestone Completed: ${milestone.title}`,
        message: `Dayal Team has marked this milestone as completed!`,
        module: 'milestone',
      });
      Alert.alert('Milestone Completed', `"${milestone.title}" marked completed and client notified.`);
    }
  };

  // Delete Milestone
  const handleDeleteMilestone = (milestoneId: number) => {
    Alert.alert('Delete Milestone', 'Are you sure you want to delete this milestone?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const updated = milestones.filter(m => m.id !== milestoneId);
          await persistMilestones(updated);
        },
      },
    ]);
  };

  // Staff adds a comment on a milestone -> NOTIFIES CLIENT!
  const handleAddStaffComment = async (milestoneId: number) => {
    const text = (commentInput[milestoneId] || '').trim();
    if (!text) return;

    const commentObj = {
      id: Date.now(),
      text,
      author: user?.name || 'Dayal Team',
      role: 'Admin',
      timestamp: new Date().toISOString(),
    };

    const targetM = milestones.find(m => m.id === milestoneId);
    const updated = milestones.map(m => {
      if (m.id === milestoneId) {
        return { ...m, comments: [...(m.comments || []), commentObj] };
      }
      return m;
    });

    setCommentInput(prev => ({ ...prev, [milestoneId]: '' }));
    await persistMilestones(updated);

    // NOTIFY CLIENT!
    await createClientNotification({
      clientId,
      clientEmpId: employeeRecord?.id,
      title: `📝 Update on: ${targetM?.title || 'Milestone'}`,
      message: text.length > 70 ? `${text.substring(0, 70)}...` : text,
      module: 'milestone',
    });

    Alert.alert('Posted', 'Update logged and client notified.');
  };

  // Staff sends a direct chat message -> NOTIFIES CLIENT!
  const handleSendChatMessage = async () => {
    const text = chatInput.trim();
    if (!text || !clientId) return;

    setSendingChat(true);
    setChatInput('');

    try {
      const newMsg = {
        client_id: clientId,
        sender_type: 'admin',
        message: text,
      };

      const { data, error } = await supabase.from('client_messages').insert([newMsg]).select();
      if (error) throw error;

      if (data && data[0]) {
        setChatMessages(prev => [...prev, data[0]]);
      }

      // NOTIFY CLIENT!
      await createClientNotification({
        clientId,
        clientEmpId: employeeRecord?.id,
        title: `💬 New Message from Dayal Team`,
        message: text.length > 80 ? `${text.substring(0, 80)}...` : text,
        module: 'chat',
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Could not send message');
      setChatInput(text);
    } finally {
      setSendingChat(false);
    }
  };

  // Staff attaches file / photo to a client milestone
  const promptStaffUploadFile = (milestoneId: number) => {
    setAttachPickerModal({
      visible: true,
      milestoneId,
      target: 'milestone',
      title: 'Attach File to Milestone',
      subtitle: 'Upload site drawings, CAD files, photos or blueprints to Cloudflare R2.',
    });
  };

  const handleStaffUploadFile = async (milestoneId: number, mode: 'camera' | 'gallery' | 'document') => {
    setUploadingMilestoneId(milestoneId);
    try {
      let res = null;
      if (mode === 'camera') {
        res = await takePhotoAndUpload('client_milestones');
      } else if (mode === 'gallery') {
        res = await pickImageAndUpload('client_milestones');
      } else {
        res = await pickDocumentAndUpload('client_milestones');
      }

      if (!res) {
        setUploadingMilestoneId(null);
        return;
      }

      const fileObj = {
        id: Date.now(),
        name: res.name,
        fileKey: res.key,
        url: res.url,
        author: user?.name || 'Dayal Team',
        role: 'Staff',
        timestamp: new Date().toISOString(),
      };

      const updated = milestones.map(m => {
        if (m.id === milestoneId) {
          return { ...m, files: [...(m.files || []), fileObj] };
        }
        return m;
      });

      setMilestones(updated);
      await persistMilestones(updated);

      const targetM = milestones.find(m => m.id === milestoneId);

      // NOTIFY CLIENT!
      await createClientNotification({
        clientId,
        clientEmpId: employeeRecord?.id,
        title: `📎 New Document Attached`,
        message: `Dayal team attached "${res.name}" to Step ${targetM?.order || ''}: ${targetM?.title || ''}`,
        module: 'milestone',
        referenceId: clientId,
      });

      Alert.alert('Success', `Attached "${res.name}" to milestone.`);
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'Could not upload to R2.');
    } finally {
      setUploadingMilestoneId(null);
    }
  };

  const handleStaffDeleteFile = async (milestoneId: number, fileId: number, fileKey?: string) => {
    Alert.alert('Delete File', 'Remove this attached file from Cloudflare R2?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (fileKey) await deleteR2File(fileKey);

            const updated = milestones.map(m => {
              if (m.id === milestoneId) {
                return { ...m, files: (m.files || []).filter((f: any) => f.id !== fileId) };
              }
              return m;
            });

            setMilestones(updated);
            await persistMilestones(updated);
          } catch (e: any) {
            Alert.alert('Error', 'Failed to delete file.');
          }
        },
      },
    ]);
  };

  // Staff sends file attachment in chat
  const promptStaffAttachChat = () => {
    setAttachPickerModal({
      visible: true,
      target: 'chat',
      title: 'Send Attachment to Client',
      subtitle: 'Share site photos, drawings or documents with client in chat.',
    });
  };

  const handleStaffAttachChat = async (mode: 'camera' | 'gallery' | 'document') => {
    if (!clientId) return;
    setUploadingChat(true);

    try {
      let res = null;
      if (mode === 'camera') {
        res = await takePhotoAndUpload(`chat/${clientId}`);
      } else if (mode === 'gallery') {
        res = await pickImageAndUpload(`chat/${clientId}`);
      } else {
        res = await pickDocumentAndUpload(`chat/${clientId}`);
      }

      if (!res) {
        setUploadingChat(false);
        return;
      }

      const newMsg = {
        client_id: clientId,
        sender_type: 'admin',
        message: res.name,
        file_url: res.key,
        file_name: res.name,
      };

      const { data, error } = await supabase.from('client_messages').insert([newMsg]).select();
      if (error) throw error;

      if (data && data[0]) {
        setChatMessages(prev => [...prev, data[0]]);
      }

      // NOTIFY CLIENT!
      await createClientNotification({
        clientId,
        clientEmpId: employeeRecord?.id,
        title: `📎 New File from Dayal Team`,
        message: `Sent file: "${res.name}"`,
        module: 'chat',
      });
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'Could not upload attachment.');
    } finally {
      setUploadingChat(false);
    }
  };

  const completedCount = milestones.filter(m => m.completed).length;
  const progressPercent = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{clientName}</Text>
          <Text style={styles.headerSub}>Client Portal Hub & Milestones</Text>
        </View>

        {activeTab === 'milestones' && (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TouchableOpacity
              style={styles.templateBtn}
              onPress={() => setIsTemplateModalOpen(true)}
            >
              <Copy size={14} color="#2563EB" />
              <Text style={styles.templateBtnText}>Templates</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.addStepBtn}
              onPress={() => setIsAddMilestoneOpen(true)}
            >
              <Plus size={16} color="#FFFFFF" />
              <Text style={styles.addStepBtnText}>Add</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Tabs Row */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'milestones' && styles.tabBtnActive]}
          onPress={() => setActiveTab('milestones')}
        >
          <Layers size={16} color={activeTab === 'milestones' ? '#2563EB' : Colors.textMuted} />
          <Text style={[styles.tabBtnText, activeTab === 'milestones' && styles.tabBtnTextActive]}>
            Milestones ({milestones.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'chat' && styles.tabBtnActive]}
          onPress={() => setActiveTab('chat')}
        >
          <MessageCircle size={16} color={activeTab === 'chat' ? '#2563EB' : Colors.textMuted} />
          <Text style={[styles.tabBtnText, activeTab === 'chat' && styles.tabBtnTextActive]}>
            Client Chat ({chatMessages.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab 1: Milestones */}
      {activeTab === 'milestones' ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {/* Progress Banner */}
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.progressTitle}>Client Project Progress</Text>
                <Text style={styles.progressSub}>
                  {completedCount} of {milestones.length} milestones completed
                </Text>
              </View>
              <Text style={styles.progressPercentText}>{progressPercent}%</Text>
            </View>
            <View style={styles.progressBarTrack}>
              <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
            </View>
          </View>

          {/* Milestone List */}
          {milestones.length === 0 ? (
            <View style={styles.emptyCard}>
              <Layers size={32} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>No Milestones Configured</Text>
              <Text style={styles.emptySub}>
                Load a standard template (L.U.C.C, Architectural, or Construction) or create custom steps.
              </Text>
              <TouchableOpacity
                style={styles.applyTemplateBigBtn}
                onPress={() => setIsTemplateModalOpen(true)}
              >
                <Copy size={16} color="#FFFFFF" />
                <Text style={styles.applyTemplateBigBtnText}>Load Project Template</Text>
              </TouchableOpacity>
            </View>
          ) : (
            milestones.map((m: any, index: number) => {
              const isExpanded = expandedId === m.id;
              const hasComments = Array.isArray(m.comments) && m.comments.length > 0;

              return (
                <View
                  key={m.id || index}
                  style={[styles.milestoneCard, m.completed && styles.milestoneCardDone]}
                >
                  <View style={styles.milestoneMainRow}>
                    {/* Toggle Completion Button */}
                    <TouchableOpacity
                      onPress={() => handleToggleComplete(m)}
                      style={styles.checkTouch}
                    >
                      {m.completed ? (
                        <CheckCircle2 size={24} color="#16A34A" />
                      ) : (
                        <Clock size={20} color="#94A3B8" />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={{ flex: 1, marginHorizontal: 8 }}
                      onPress={() => setExpandedId(isExpanded ? null : m.id)}
                    >
                      <Text style={[styles.stepOrder, m.completed && { color: '#16A34A' }]}>
                        STEP {m.order || index + 1} • {m.completed ? 'COMPLETED' : 'IN PROGRESS'}
                      </Text>
                      <Text style={[styles.stepTitle, m.completed && styles.stepTitleDone]}>
                        {m.title}
                      </Text>
                    </TouchableOpacity>

                    {/* Actions */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity
                        onPress={() => setExpandedId(isExpanded ? null : m.id)}
                        style={styles.expandBtn}
                      >
                        {isExpanded ? <ChevronUp size={18} color={Colors.textMuted} /> : <ChevronDown size={18} color={Colors.textMuted} />}
                      </TouchableOpacity>

                      <TouchableOpacity
                        onPress={() => handleDeleteMilestone(m.id)}
                        style={styles.deleteBtn}
                      >
                        <Trash2 size={16} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Expanded: Staff Comments & Client Updates & R2 Files */}
                  {isExpanded && (
                    <View style={styles.expandedBox}>
                      {/* Attached Documents & Photos */}
                      <View style={{ marginBottom: 12 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <Text style={styles.expandedSubTitle}>Documents & Site Photos</Text>
                          <TouchableOpacity
                            style={styles.staffAttachBtn}
                            onPress={() => promptStaffUploadFile(m.id)}
                            disabled={uploadingMilestoneId === m.id}
                          >
                            {uploadingMilestoneId === m.id ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Plus size={12} color="#FFFFFF" />
                                <Text style={styles.staffAttachBtnText}>+ Attach Drawing / Photo</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>

                        {Array.isArray(m.files) && m.files.length > 0 ? (
                          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 4 }}>
                            {m.files.map((f: any) => (
                              <R2ImageThumbnail
                                key={f.id}
                                fileKey={f.fileKey}
                                url={f.url}
                                fileName={f.name}
                                author={f.author}
                                timestamp={f.timestamp}
                                showDelete={true}
                                onDelete={() => handleStaffDeleteFile(m.id, f.id, f.fileKey)}
                              />
                            ))}
                          </ScrollView>
                        ) : (
                          <TouchableOpacity
                            style={styles.staffNoFilesBox}
                            onPress={() => promptStaffUploadFile(m.id)}
                          >
                            <FileText size={15} color={Colors.textMuted} />
                            <Text style={styles.staffNoFilesText}>No blueprints or photos attached. Tap to upload.</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      <Text style={styles.expandedSubTitle}>Milestone Communication Notes</Text>

                      {hasComments ? (
                        m.comments.map((c: any) => (
                          <View
                            key={c.id}
                            style={[
                              styles.commentItem,
                              c.role === 'Client' ? styles.commentClient : styles.commentStaff,
                            ]}
                          >
                            <View style={styles.commentMeta}>
                              <Text style={styles.commentAuthor}>
                                {c.author} ({c.role === 'Client' ? 'Client' : 'Staff'})
                              </Text>
                              <Text style={styles.commentTime}>
                                {new Date(c.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </Text>
                            </View>
                            <Text style={styles.commentText}>{c.text}</Text>
                          </View>
                        ))
                      ) : (
                        <Text style={styles.noComments}>No updates logged on this milestone.</Text>
                      )}

                      {/* Add Staff Note Input */}
                      <View style={styles.noteInputRow}>
                        <TextInput
                          style={styles.noteInput}
                          placeholder="Add update note (Client will be notified)..."
                          placeholderTextColor={Colors.textMuted}
                          value={commentInput[m.id] || ''}
                          onChangeText={val => setCommentInput(prev => ({ ...prev, [m.id]: val }))}
                        />
                        <TouchableOpacity
                          style={[styles.noteSendBtn, !commentInput[m.id]?.trim() && { opacity: 0.5 }]}
                          onPress={() => handleAddStaffComment(m.id)}
                          disabled={!commentInput[m.id]?.trim()}
                        >
                          <Send size={15} color="#FFFFFF" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      ) : (
        // Tab 2: Client Chat
        <View style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.chatScroll}
          >
            {chatMessages.length === 0 ? (
              <View style={styles.emptyCard}>
                <MessageCircle size={32} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No Messages Yet</Text>
                <Text style={styles.emptySub}>
                  Send a message to {clientName}. They will receive an instant notification in their portal!
                </Text>
              </View>
            ) : (
              chatMessages.map((msg: any) => {
                const isStaff = msg.sender_type === 'admin';
                return (
                  <View
                    key={msg.id}
                    style={[styles.chatBubbleWrap, isStaff ? styles.chatStaffWrap : styles.chatClientWrap]}
                  >
                    <View style={[styles.chatBubble, isStaff ? styles.chatStaffBubble : styles.chatClientBubble]}>
                      <Text style={[styles.chatSender, isStaff ? styles.chatStaffSender : styles.chatClientSender]}>
                        {isStaff ? 'Dayal Team (You)' : clientName}
                      </Text>

                      {msg.file_url ? (
                        <View style={{ marginTop: 4, marginBottom: 4 }}>
                          <R2ImageThumbnail
                            fileKey={msg.file_url}
                            fileName={msg.file_name || msg.message}
                            style={{ marginRight: 0, marginBottom: 0, width: 200, height: 150 }}
                          />
                          {msg.message && msg.message !== msg.file_name && (
                            <Text style={[styles.chatMsgText, isStaff ? styles.chatStaffText : styles.chatClientText, { marginTop: 4 }]}>
                              {msg.message}
                            </Text>
                          )}
                        </View>
                      ) : (
                        <Text style={[styles.chatMsgText, isStaff ? styles.chatStaffText : styles.chatClientText]}>
                          {msg.message}
                        </Text>
                      )}

                      <Text style={[styles.chatTime, isStaff ? styles.chatStaffTime : styles.chatClientTime]}>
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* Chat Input */}
          <View style={styles.chatInputRow}>
            <TouchableOpacity
              style={styles.chatAttachBtn}
              onPress={promptStaffAttachChat}
              disabled={uploadingChat}
              activeOpacity={0.7}
            >
              {uploadingChat ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Paperclip size={20} color={Colors.textMuted} />
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.chatTextInput}
              placeholder={`Message ${clientName}...`}
              placeholderTextColor={Colors.textMuted}
              value={chatInput}
              onChangeText={setChatInput}
            />
            <TouchableOpacity
              style={[styles.chatSendBtn, (!chatInput.trim() || sendingChat) && { opacity: 0.5 }]}
              onPress={handleSendChatMessage}
              disabled={!chatInput.trim() || sendingChat}
            >
              {sendingChat ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Send size={18} color="#FFFFFF" />}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ===================== TEMPLATES MODAL ===================== */}
      <Modal visible={isTemplateModalOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Project Template</Text>
            <Text style={styles.modalSub}>Pre-loads standard engineering milestones for this client.</Text>

            <View style={{ gap: 10, marginTop: 14 }}>
              {DEFAULT_TEMPLATES.map(tpl => (
                <TouchableOpacity
                  key={tpl.id}
                  style={styles.templateCard}
                  onPress={() => handleApplyTemplate(tpl)}
                >
                  <View style={styles.tplIconCircle}>
                    <Layers size={18} color="#2563EB" />
                  </View>
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={styles.tplName}>{tpl.name}</Text>
                    <Text style={styles.tplCount}>{tpl.steps.length} Milestones</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setIsTemplateModalOpen(false)}
            >
              <Text style={styles.modalCancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ===================== ADD MILESTONE MODAL ===================== */}
      <Modal visible={isAddMilestoneOpen} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Project Milestone</Text>
            <Text style={styles.modalSub}>Client will receive a notification of this step.</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="e.g. 3D Elevation Review & Approval"
              placeholderTextColor={Colors.textMuted}
              value={newMilestoneTitle}
              onChangeText={setNewMilestoneTitle}
            />

            <View style={styles.modalBtnsRow}>
              <TouchableOpacity
                style={styles.modalCancelBtnHalf}
                onPress={() => setIsAddMilestoneOpen(false)}
              >
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmBtnHalf}
                onPress={handleAddMilestone}
              >
                <Text style={styles.modalConfirmBtnText}>Add Step</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ===================== ATTACHMENT ACTION SHEET MODAL ===================== */}
      <Modal
        visible={attachPickerModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachPickerModal(prev => ({ ...prev, visible: false }))}
      >
        <TouchableOpacity
          style={styles.actionSheetBackdrop}
          activeOpacity={1}
          onPress={() => setAttachPickerModal(prev => ({ ...prev, visible: false }))}
        >
          <View style={styles.actionSheetCard} onStartShouldSetResponder={() => true}>
            {/* Header with Title and Close Button */}
            <View style={styles.actionSheetHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.actionSheetTitle}>{attachPickerModal.title}</Text>
                <Text style={styles.actionSheetSub}>{attachPickerModal.subtitle}</Text>
              </View>
              <TouchableOpacity
                style={styles.actionSheetCloseBtn}
                onPress={() => setAttachPickerModal(prev => ({ ...prev, visible: false }))}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            {/* Options */}
            <View style={styles.actionSheetOptions}>
              <TouchableOpacity
                style={styles.actionOptionItem}
                onPress={() => {
                  const mId = attachPickerModal.milestoneId;
                  const target = attachPickerModal.target;
                  setAttachPickerModal(prev => ({ ...prev, visible: false }));
                  if (target === 'milestone' && mId) {
                    handleStaffUploadFile(mId, 'camera');
                  } else {
                    handleStaffAttachChat('camera');
                  }
                }}
              >
                <View style={[styles.actionOptionIconWrap, { backgroundColor: '#EFF6FF' }]}>
                  <Camera size={20} color="#2563EB" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.actionOptionTitle}>Take Site Photo</Text>
                  <Text style={styles.actionOptionSub}>Capture site progress with your camera</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionOptionItem}
                onPress={() => {
                  const mId = attachPickerModal.milestoneId;
                  const target = attachPickerModal.target;
                  setAttachPickerModal(prev => ({ ...prev, visible: false }));
                  if (target === 'milestone' && mId) {
                    handleStaffUploadFile(mId, 'gallery');
                  } else {
                    handleStaffAttachChat('gallery');
                  }
                }}
              >
                <View style={[styles.actionOptionIconWrap, { backgroundColor: '#FDF4FF' }]}>
                  <ImageIcon size={20} color="#C026D3" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.actionOptionTitle}>Choose from Gallery</Text>
                  <Text style={styles.actionOptionSub}>Pick photos from your device albums</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionOptionItem}
                onPress={() => {
                  const mId = attachPickerModal.milestoneId;
                  const target = attachPickerModal.target;
                  setAttachPickerModal(prev => ({ ...prev, visible: false }));
                  if (target === 'milestone' && mId) {
                    handleStaffUploadFile(mId, 'document');
                  } else {
                    handleStaffAttachChat('document');
                  }
                }}
              >
                <View style={[styles.actionOptionIconWrap, { backgroundColor: '#FEF3C7' }]}>
                  <FileText size={20} color="#D97706" />
                </View>
                <View style={{ flex: 1, marginLeft: 12 }}>
                  <Text style={styles.actionOptionTitle}>Choose Document</Text>
                  <Text style={styles.actionOptionSub}>Upload PDF, CAD drawings (DWG/DXF), docs</Text>
                </View>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.actionSheetCancelBtn}
              onPress={() => setAttachPickerModal(prev => ({ ...prev, visible: false }))}
            >
              <Text style={styles.actionSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  templateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  templateBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#2563EB',
  },
  addStepBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#2563EB',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  addStepBtnText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabBtnActive: {
    borderBottomColor: '#2563EB',
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabBtnTextActive: {
    color: '#2563EB',
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 12,
  },
  progressCard: {
    backgroundColor: Colors.surface,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
  },
  progressSub: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  progressPercentText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#2563EB',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 3,
  },
  emptyCard: {
    backgroundColor: Colors.surface,
    padding: 30,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 20,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 10,
  },
  emptySub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  applyTemplateBigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 16,
  },
  applyTemplateBigBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  milestoneCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  milestoneCardDone: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  milestoneMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  checkTouch: {
    padding: 4,
  },
  stepOrder: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  stepTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 1,
  },
  stepTitleDone: {
    color: '#166534',
  },
  expandBtn: {
    padding: 6,
  },
  deleteBtn: {
    padding: 6,
  },
  expandedBox: {
    padding: 12,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  expandedSubTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textMuted,
    marginVertical: 6,
  },
  commentItem: {
    padding: 8,
    borderRadius: 8,
    marginBottom: 6,
  },
  commentStaff: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  commentClient: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  commentMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  commentAuthor: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#374151',
  },
  commentTime: {
    fontSize: 9.5,
    color: Colors.textMuted,
  },
  commentText: {
    fontSize: 12,
    color: Colors.text,
  },
  noComments: {
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 6,
  },
  noteInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  noteInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: Colors.text,
  },
  noteSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatScroll: {
    padding: 16,
    paddingBottom: 20,
    gap: 10,
  },
  chatBubbleWrap: {
    flexDirection: 'row',
  },
  chatStaffWrap: {
    justifyContent: 'flex-end',
  },
  chatClientWrap: {
    justifyContent: 'flex-start',
  },
  chatBubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  chatStaffBubble: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 2,
  },
  chatClientBubble: {
    backgroundColor: Colors.surface,
    borderBottomLeftRadius: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chatSender: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 2,
  },
  chatStaffSender: {
    color: '#BFDBFE',
    textAlign: 'right',
  },
  chatClientSender: {
    color: '#2563EB',
  },
  chatMsgText: {
    fontSize: 13,
  },
  chatStaffText: {
    color: '#FFFFFF',
  },
  chatClientText: {
    color: Colors.text,
  },
  chatTime: {
    fontSize: 9,
    marginTop: 3,
  },
  chatStaffTime: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  chatClientTime: {
    color: Colors.textMuted,
  },
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  chatAttachBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatTextInput: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    color: Colors.text,
  },
  chatSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  staffAttachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  staffAttachBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  staffNoFilesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 8,
    gap: 6,
    justifyContent: 'center',
  },
  staffNoFilesText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
  },
  templateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tplIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  tplName: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text,
  },
  tplCount: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  modalCancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginTop: 14,
  },
  modalCancelBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: Colors.textMuted,
  },
  modalInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: Colors.text,
    marginVertical: 14,
  },
  modalBtnsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelBtnHalf: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalConfirmBtnHalf: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#2563EB',
  },
  modalConfirmBtnText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  actionSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  actionSheetCard: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  actionSheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  actionSheetTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: Colors.text,
  },
  actionSheetSub: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  actionSheetCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSheetOptions: {
    marginVertical: 14,
    gap: 10,
  },
  actionOptionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionOptionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionOptionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
  actionOptionSub: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 1,
  },
  actionSheetCancelBtn: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  actionSheetCancelText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text,
  },
});

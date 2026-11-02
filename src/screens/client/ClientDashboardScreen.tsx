import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  Alert,
  Platform,
  StatusBar,
  RefreshControl,
  Linking,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Briefcase,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  FileText,
  Send,
  Trash2,
  Layers,
  Sparkles,
  Phone,
  MessageCircle,
  Camera,
  Paperclip,
  Plus,
  Upload,
  X,
  Image as ImageIcon,
} from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { createNotification } from '../../lib/notificationService';
import R2ImageThumbnail from '../../components/R2ImageThumbnail';
import {
  pickImageAndUpload,
  takePhotoAndUpload,
  pickDocumentAndUpload,
  deleteR2File,
} from '../../lib/r2Storage';

export default function ClientDashboardScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const { user } = useAuth();

  const [clientProfile, setClientProfile] = useState<any>(null);
  const [employeeRecord, setEmployeeRecord] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [activeProject, setActiveProject] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Expanded milestone details & comments
  const [expandedMilestoneId, setExpandedMilestoneId] = useState<number | null>(null);
  const [commentText, setCommentText] = useState<{ [key: number]: string }>({});
  const [submittingComment, setSubmittingComment] = useState(false);
  const [uploadingMilestoneId, setUploadingMilestoneId] = useState<number | null>(null);
  const [attachPickerModal, setAttachPickerModal] = useState<{
    visible: boolean;
    milestoneId?: number;
  }>({
    visible: false,
  });

  const clientId = user?.clientId || user?.id;

  const fetchClientPortalData = async () => {
    if (!clientId) return;
    try {
      // 1. Fetch Client Profile from clients table
      const { data: cData } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .maybeSingle();

      if (cData) setClientProfile(cData);

      // 2. Fetch Client Employee record for milestones
      const { data: empData } = await supabase
        .from('employees')
        .select('*')
        .eq('department', clientId)
        .eq('role', 'Client')
        .maybeSingle();

      if (empData) {
        setEmployeeRecord(empData);
        const perms = empData.permissions || {};
        if (Array.isArray(perms.milestones) && perms.milestones.length > 0) {
          setMilestones(perms.milestones);
        } else {
          setMilestones([]);
        }
      }

      // 3. Fetch Projects & Services for this Client
      const [projRes, servRes] = await Promise.all([
        supabase.from('projects').select('*').eq('client_id', clientId),
        supabase.from('services').select('*').eq('client_id', clientId),
      ]);

      const combined: any[] = [];
      if (projRes.data) {
        projRes.data.forEach(p => combined.push({ ...p, _type: 'project', displayName: p.name || 'Construction Project' }));
      }
      if (servRes.data) {
        servRes.data.forEach(s => combined.push({ ...s, _type: 'service', displayName: s.title || s.name || 'Design & Legal Service' }));
      }

      setProjects(combined);
      if (combined.length > 0 && !activeProject) {
        setActiveProject(combined[0]);
      }
    } catch (err: any) {
      console.warn('Error loading client portal:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchClientPortalData();
  }, [clientId]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchClientPortalData();
  };

  // Client adds a comment on a milestone -> NOTIFIES ADMIN & ASSIGNED STAFF
  const handleAddMilestoneComment = async (milestoneId: number) => {
    const text = (commentText[milestoneId] || '').trim();
    if (!text) return;

    setSubmittingComment(true);
    try {
      const commentObj = {
        id: Date.now(),
        text,
        author: user?.name || clientProfile?.name || 'Client',
        role: 'Client',
        timestamp: new Date().toISOString(),
      };

      const updated = milestones.map(m => {
        if (m.id === milestoneId) {
          return { ...m, comments: [...(m.comments || []), commentObj] };
        }
        return m;
      });

      // Update in Supabase employees.permissions
      if (employeeRecord?.id) {
        const updatedPerms = { ...(employeeRecord.permissions || {}), milestones: updated };
        await supabase
          .from('employees')
          .update({ permissions: updatedPerms })
          .eq('id', employeeRecord.id);

        setEmployeeRecord((prev: any) => ({ ...prev, permissions: updatedPerms }));
      }

      setMilestones(updated);
      setCommentText(prev => ({ ...prev, [milestoneId]: '' }));

      // Find milestone title
      const targetM = milestones.find(m => m.id === milestoneId);

      // ALERT ADMIN & ASSIGNED STAFF
      await createNotification({
        title: `💬 Client Note: ${user?.name || clientProfile?.name}`,
        message: `Milestone "${targetM?.title || 'Update'}": "${text.substring(0, 75)}"`,
        module: 'client',
        referenceId: clientId,
        recipientRole: 'Admin',
        createdByName: user?.name || clientProfile?.name,
      });

      Alert.alert('Posted', 'Your note has been submitted to the project team.');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not post note.');
    } finally {
      setSubmittingComment(false);
    }
  };

  // Client deletes their own comment
  const handleDeleteComment = async (milestoneId: number, commentId: number) => {
    Alert.alert('Delete Note', 'Remove your communication update?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const updated = milestones.map(m => {
              if (m.id === milestoneId) {
                return { ...m, comments: (m.comments || []).filter((c: any) => c.id !== commentId) };
              }
              return m;
            });

            if (employeeRecord?.id) {
              const updatedPerms = { ...(employeeRecord.permissions || {}), milestones: updated };
              await supabase
                .from('employees')
                .update({ permissions: updatedPerms })
                .eq('id', employeeRecord.id);

              setEmployeeRecord((prev: any) => ({ ...prev, permissions: updatedPerms }));
            }

            setMilestones(updated);
          } catch (e: any) {
            Alert.alert('Error', 'Failed to delete note.');
          }
        },
      },
    ]);
  };

  // Client uploads image / document to Cloudflare R2
  const promptUploadFile = (milestoneId: number) => {
    setAttachPickerModal({
      visible: true,
      milestoneId,
    });
  };

  const handleUploadFile = async (milestoneId: number, mode: 'camera' | 'gallery' | 'document') => {
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
        author: user?.name || clientProfile?.name || 'Client',
        role: 'Client',
        timestamp: new Date().toISOString(),
      };

      const updated = milestones.map(m => {
        if (m.id === milestoneId) {
          return { ...m, files: [...(m.files || []), fileObj] };
        }
        return m;
      });

      if (employeeRecord?.id) {
        const updatedPerms = { ...(employeeRecord.permissions || {}), milestones: updated };
        await supabase
          .from('employees')
          .update({ permissions: updatedPerms })
          .eq('id', employeeRecord.id);

        setEmployeeRecord((prev: any) => ({ ...prev, permissions: updatedPerms }));
      }

      setMilestones(updated);

      const targetM = milestones.find(m => m.id === milestoneId);

      // ALERT ADMIN & ASSIGNED STAFF
      await createNotification({
        title: `📎 New File from ${user?.name || clientProfile?.name}`,
        message: `Attached "${res.name}" under milestone "${targetM?.title || 'Milestone'}"`,
        module: 'client',
        referenceId: clientId,
        recipientRole: 'Admin',
        createdByName: user?.name || clientProfile?.name,
      });

      Alert.alert('Upload Successful', `"${res.name}" is now attached to this milestone.`);
    } catch (err: any) {
      Alert.alert('Upload Failed', err.message || 'Could not upload file to Cloudflare R2.');
    } finally {
      setUploadingMilestoneId(null);
    }
  };

  const handleDeleteFile = async (milestoneId: number, fileId: number, fileKey?: string) => {
    Alert.alert('Remove File', 'Are you sure you want to delete this attached file?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (fileKey) {
              await deleteR2File(fileKey);
            }

            const updated = milestones.map(m => {
              if (m.id === milestoneId) {
                return { ...m, files: (m.files || []).filter((f: any) => f.id !== fileId) };
              }
              return m;
            });

            if (employeeRecord?.id) {
              const updatedPerms = { ...(employeeRecord.permissions || {}), milestones: updated };
              await supabase
                .from('employees')
                .update({ permissions: updatedPerms })
                .eq('id', employeeRecord.id);

              setEmployeeRecord((prev: any) => ({ ...prev, permissions: updatedPerms }));
            }

            setMilestones(updated);
          } catch (e: any) {
            Alert.alert('Error', 'Failed to delete file.');
          }
        },
      },
    ]);
  };

  const completedCount = milestones.filter(m => m.completed).length;
  const progressPercent = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 100) : 0;

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: safeTop }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your project workspace...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: safeTop }]}>
      {/* Client Profile Header */}
      <View style={styles.header}>
        <View style={styles.profileAvatar}>
          <Text style={styles.profileAvatarText}>
            {(clientProfile?.name || user?.name || 'C').charAt(0).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.welcomeText}>Welcome,</Text>
          <Text style={styles.clientName}>{clientProfile?.name || user?.name || 'Valued Client'}</Text>
          <View style={styles.portalTag}>
            <Sparkles size={11} color="#059669" />
            <Text style={styles.portalTagText}>Client Portal Active</Text>
          </View>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Linked Project / Service Banner */}
        {activeProject ? (
          <View style={styles.projectBanner}>
            <View style={styles.projectTypeBadge}>
              <Text style={styles.projectTypeBadgeText}>
                {activeProject._type === 'project' ? 'Civil Construction' : 'Design & Legal Service'}
              </Text>
            </View>
            <Text style={styles.projectTitle}>{activeProject.displayName}</Text>
            <View style={styles.projectStatusRow}>
              <View style={styles.statusIndicator} />
              <Text style={styles.projectStatusText}>Status: {activeProject.status || 'In Progress'}</Text>
            </View>

            {/* Project Switcher if multiple projects */}
            {projects.length > 1 && (
              <View style={styles.switchWrap}>
                <Text style={styles.switchLabel}>Switch View:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                  {projects.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.switchChip, activeProject.id === p.id && styles.switchChipActive]}
                      onPress={() => setActiveProject(p)}
                    >
                      <Text style={[styles.switchChipText, activeProject.id === p.id && styles.switchChipTextActive]}>
                        {p.displayName}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.noProjectCard}>
            <Briefcase size={28} color={Colors.primary} />
            <Text style={styles.noProjectTitle}>Welcome to Dayal Construction</Text>
            <Text style={styles.noProjectSub}>
              Your assigned construction or design project will appear here once mobilized.
            </Text>
          </View>
        )}

        {/* Milestones & Progress Section */}
        <View style={styles.milestonesSection}>
          <View style={styles.milestoneHeader}>
            <View>
              <Text style={styles.sectionTitle}>Project Milestones</Text>
              <Text style={styles.sectionSubtitle}>
                {completedCount} of {milestones.length} steps completed ({progressPercent}%)
              </Text>
            </View>
            <View style={styles.progressCircle}>
              <Text style={styles.progressCircleText}>{progressPercent}%</Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarTrack}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>

          {/* Milestones List */}
          {milestones.length === 0 ? (
            <View style={styles.emptyMilestonesBox}>
              <Clock size={32} color={Colors.textMuted} />
              <Text style={styles.emptyMilestonesTitle}>Setting Up Project Roadmap</Text>
              <Text style={styles.emptyMilestonesSub}>
                Dayal Construction engineering team is preparing your project milestone schedule.
              </Text>
            </View>
          ) : (
            milestones.map((m: any, index: number) => {
              const isExpanded = expandedMilestoneId === m.id;
              const hasComments = Array.isArray(m.comments) && m.comments.length > 0;
              const hasFiles = Array.isArray(m.files) && m.files.length > 0;

              return (
                <View
                  key={m.id || index}
                  style={[
                    styles.milestoneCard,
                    m.completed && styles.milestoneCardCompleted,
                    isExpanded && styles.milestoneCardExpanded,
                  ]}
                >
                  {/* Milestone Header Row */}
                  <TouchableOpacity
                    style={styles.milestoneMainRow}
                    activeOpacity={0.8}
                    onPress={() => setExpandedMilestoneId(isExpanded ? null : m.id)}
                  >
                    <View style={styles.milestoneLeft}>
                      {m.completed ? (
                        <View style={styles.completedIconWrap}>
                          <CheckCircle2 size={22} color="#16A34A" />
                        </View>
                      ) : (
                        <View style={styles.pendingIconWrap}>
                          <Clock size={18} color="#2563EB" />
                        </View>
                      )}

                      <View style={{ flex: 1, marginLeft: 10 }}>
                        <Text style={[styles.milestoneStepText, m.completed && { color: '#16A34A' }]}>
                          STEP {m.order || index + 1}
                        </Text>
                        <Text style={[styles.milestoneTitle, m.completed && styles.milestoneTitleDone]}>
                          {m.title}
                        </Text>
                        <View style={styles.metaBadgesRow}>
                          {m.completed ? (
                            <View style={styles.statusCompletedPill}>
                              <Text style={styles.statusCompletedText}>Completed</Text>
                            </View>
                          ) : (
                            <View style={styles.statusPendingPill}>
                              <Text style={styles.statusPendingText}>In Progress</Text>
                            </View>
                          )}
                          {hasComments && (
                            <View style={styles.countBadge}>
                              <MessageSquare size={10} color={Colors.textMuted} />
                              <Text style={styles.countBadgeText}>{m.comments.length}</Text>
                            </View>
                          )}
                          {hasFiles && (
                            <View style={styles.countBadge}>
                              <FileText size={10} color={Colors.textMuted} />
                              <Text style={styles.countBadgeText}>{m.files.length}</Text>
                            </View>
                          )}
                        </View>
                      </View>
                    </View>

                    <View style={{ padding: 4 }}>
                      {isExpanded ? <ChevronUp size={20} color={Colors.textMuted} /> : <ChevronDown size={20} color={Colors.textMuted} />}
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Milestone Details: Comments & Files */}
                  {isExpanded && (
                    <View style={styles.expandedContent}>
                      {/* Files & Photos Section (Cloudflare R2) */}
                      <View style={styles.filesSection}>
                        <View style={styles.filesSectionHeader}>
                          <Text style={styles.subSectionTitle}>Documents & Site Photos</Text>
                          <TouchableOpacity
                            style={styles.attachBtn}
                            onPress={() => promptUploadFile(m.id)}
                            disabled={uploadingMilestoneId === m.id}
                            activeOpacity={0.8}
                          >
                            {uploadingMilestoneId === m.id ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Plus size={12} color="#FFFFFF" />
                                <Text style={styles.attachBtnText}>+ Add Photo / File</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        </View>

                        {hasFiles ? (
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.filesScrollContainer}
                          >
                            {m.files.map((f: any) => (
                              <R2ImageThumbnail
                                key={f.id}
                                fileKey={f.fileKey}
                                url={f.url}
                                fileName={f.name}
                                author={f.author}
                                timestamp={f.timestamp}
                                showDelete={f.role === 'Client' || f.author === user?.name}
                                onDelete={() => handleDeleteFile(m.id, f.id, f.fileKey)}
                              />
                            ))}
                          </ScrollView>
                        ) : (
                          <TouchableOpacity
                            style={styles.noFilesBox}
                            onPress={() => promptUploadFile(m.id)}
                          >
                            <FileText size={16} color={Colors.textMuted} />
                            <Text style={styles.noFilesText}>
                              No drawings or photos attached. Tap to upload.
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Comments & Discussion Thread */}
                      <View style={styles.commentsSection}>
                        <Text style={styles.subSectionTitle}>Communication & Updates</Text>

                        {hasComments ? (
                          m.comments.map((c: any) => {
                            const isMyComment = c.role === 'Client';
                            return (
                              <View
                                key={c.id}
                                style={[styles.commentBubble, isMyComment ? styles.myComment : styles.teamComment]}
                              >
                                <View style={styles.commentHeader}>
                                  <Text style={[styles.commentAuthor, isMyComment && { color: Colors.primaryDark }]}>
                                    {c.author || (isMyComment ? 'You' : 'Dayal Team')}
                                  </Text>
                                  <Text style={styles.commentTime}>
                                    {new Date(c.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </Text>
                                  {isMyComment && (
                                    <TouchableOpacity
                                      onPress={() => handleDeleteComment(m.id, c.id)}
                                      style={{ padding: 2, marginLeft: 6 }}
                                    >
                                      <Trash2 size={12} color={Colors.danger} />
                                    </TouchableOpacity>
                                  )}
                                </View>
                                <Text style={styles.commentBody}>{c.text}</Text>
                              </View>
                            );
                          })
                        ) : (
                          <Text style={styles.noCommentsText}>No updates or notes logged on this milestone yet.</Text>
                        )}

                        {/* Input to write communication note */}
                        <View style={styles.commentInputWrap}>
                          <TextInput
                            style={styles.commentInput}
                            placeholder="Write a message or query on this milestone..."
                            placeholderTextColor={Colors.textMuted}
                            value={commentText[m.id] || ''}
                            onChangeText={val => setCommentText(prev => ({ ...prev, [m.id]: val }))}
                            multiline
                          />
                          <TouchableOpacity
                            style={[styles.sendBtn, !commentText[m.id]?.trim() && { opacity: 0.5 }]}
                            onPress={() => handleAddMilestoneComment(m.id)}
                            disabled={submittingComment || !commentText[m.id]?.trim()}
                          >
                            {submittingComment ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Send size={15} color="#FFFFFF" />
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>

        {/* Quick Contact Dayal Engineering Card */}
        <View style={styles.supportCard}>
          <Text style={styles.supportTitle}>Need Help or Have a Question?</Text>
          <Text style={styles.supportSubtitle}>
            Directly connect with your assigned Dayal Construction project engineer.
          </Text>
          <View style={styles.supportBtnsRow}>
            <TouchableOpacity
              style={styles.callSupportBtn}
              onPress={() => Linking.openURL('tel:+919876543210')}
            >
              <Phone size={16} color="#FFFFFF" />
              <Text style={styles.callSupportBtnText}>Call Office</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.chatSupportBtn}
              onPress={() => navigation.navigate('Chat')}
            >
              <MessageCircle size={16} color={Colors.primaryDark} />
              <Text style={styles.chatSupportBtnText}>Chat</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* ===================== ATTACHMENT ACTION SHEET MODAL ===================== */}
      <Modal
        visible={attachPickerModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachPickerModal({ visible: false })}
      >
        <TouchableOpacity
          style={styles.actionSheetBackdrop}
          activeOpacity={1}
          onPress={() => setAttachPickerModal({ visible: false })}
        >
          <View style={styles.actionSheetCard} onStartShouldSetResponder={() => true}>
            <View style={styles.actionSheetHeader}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={styles.actionSheetTitle}>Attach File to Milestone</Text>
                <Text style={styles.actionSheetSub}>
                  Upload photos, architectural drawings or documents to your project.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.actionSheetCloseBtn}
                onPress={() => setAttachPickerModal({ visible: false })}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <X size={20} color={Colors.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.actionSheetOptions}>
              <TouchableOpacity
                style={styles.actionOptionItem}
                onPress={() => {
                  const mId = attachPickerModal.milestoneId;
                  setAttachPickerModal({ visible: false });
                  if (mId) handleUploadFile(mId, 'camera');
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
                  setAttachPickerModal({ visible: false });
                  if (mId) handleUploadFile(mId, 'gallery');
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
                  setAttachPickerModal({ visible: false });
                  if (mId) handleUploadFile(mId, 'document');
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
              onPress={() => setAttachPickerModal({ visible: false })}
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
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: Colors.textMuted,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF6FF',
    borderWidth: 2,
    borderColor: '#BFDBFE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileAvatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.primaryDark,
  },
  welcomeText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500',
  },
  clientName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
  },
  portalTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  portalTagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    gap: 16,
  },
  projectBanner: {
    backgroundColor: '#1E3A8A',
    borderRadius: 18,
    padding: 18,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  projectTypeBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  projectTypeBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  projectTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  projectStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ADE80',
  },
  projectStatusText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  switchWrap: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.15)',
  },
  switchLabel: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '600',
  },
  switchChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginRight: 8,
  },
  switchChipActive: {
    backgroundColor: '#FFFFFF',
  },
  switchChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  switchChipTextActive: {
    color: '#1E3A8A',
  },
  noProjectCard: {
    backgroundColor: Colors.surface,
    padding: 24,
    borderRadius: 16,
    alignItems: 'center',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  noProjectTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 10,
  },
  noProjectSub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  milestonesSection: {
    backgroundColor: Colors.surface,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  milestoneHeader: {
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
  sectionSubtitle: {
    fontSize: 11.5,
    color: Colors.textMuted,
    marginTop: 2,
  },
  progressCircle: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: '#93C5FD',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressCircleText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#2563EB',
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#2563EB',
    borderRadius: 3,
  },
  emptyMilestonesBox: {
    padding: 30,
    alignItems: 'center',
  },
  emptyMilestonesTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 10,
  },
  emptyMilestonesSub: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
  milestoneCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
    overflow: 'hidden',
  },
  milestoneCardCompleted: {
    backgroundColor: '#F0FDF4',
    borderColor: '#BBF7D0',
  },
  milestoneCardExpanded: {
    borderColor: '#93C5FD',
  },
  milestoneMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  milestoneLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  completedIconWrap: {
    marginTop: 2,
  },
  pendingIconWrap: {
    marginTop: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  milestoneStepText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#2563EB',
    letterSpacing: 0.5,
  },
  milestoneTitle: {
    fontSize: 13.5,
    fontWeight: '600',
    color: Colors.text,
    marginTop: 1,
  },
  milestoneTitleDone: {
    color: '#15803D',
  },
  metaBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  statusCompletedPill: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  statusCompletedText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#166534',
  },
  statusPendingPill: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  statusPendingText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#1E40AF',
  },
  countBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  countBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  expandedContent: {
    padding: 12,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  filesSection: {
    marginTop: 10,
    marginBottom: 10,
  },
  filesSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  attachBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  attachBtnText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  filesScrollContainer: {
    paddingVertical: 4,
  },
  noFilesBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    justifyContent: 'center',
  },
  noFilesText: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  subSectionTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 6,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 4,
    gap: 6,
  },
  fileName: {
    flex: 1,
    fontSize: 12,
    color: Colors.text,
    fontWeight: '500',
  },
  fileDate: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  commentsSection: {
    marginTop: 6,
  },
  commentBubble: {
    padding: 10,
    borderRadius: 10,
    marginBottom: 6,
  },
  myComment: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  teamComment: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  commentAuthor: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
  commentTime: {
    fontSize: 9.5,
    color: Colors.textMuted,
  },
  commentBody: {
    fontSize: 12,
    color: '#1F2937',
    lineHeight: 17,
  },
  noCommentsText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  commentInputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: Colors.text,
    maxHeight: 70,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportCard: {
    backgroundColor: '#EFF6FF',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  supportTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E3A8A',
  },
  supportSubtitle: {
    fontSize: 11.5,
    color: '#3B82F6',
    marginTop: 2,
    marginBottom: 12,
    lineHeight: 16,
  },
  supportBtnsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  callSupportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  callSupportBtnText: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  chatSupportBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#93C5FD',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  chatSupportBtnText: {
    fontSize: 12.5,
    fontWeight: 'bold',
    color: Colors.primaryDark,
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

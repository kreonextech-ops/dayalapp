import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Send, ArrowLeft, ShieldCheck, User, Sparkles, Paperclip, Camera } from 'lucide-react-native';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { createNotification } from '../../lib/notificationService';
import R2ImageThumbnail from '../../components/R2ImageThumbnail';
import {
  pickImageAndUpload,
  takePhotoAndUpload,
  pickDocumentAndUpload,
} from '../../lib/r2Storage';

export default function ClientChatScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(insets.top, Platform.OS === 'android' ? (StatusBar.currentHeight || 28) : 20);
  const { user } = useAuth();
  const clientId = user?.clientId || user?.id;

  const [messages, setMessages] = useState<any[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const fetchMessages = async () => {
    if (!clientId) return;
    try {
      const { data, error } = await supabase
        .from('client_messages')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
    } catch (err: any) {
      console.warn('Error fetching messages:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();

    if (!clientId) return;

    // Real-time subscription to incoming messages
    const channel = supabase
      .channel(`client_messages_${clientId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'client_messages',
          filter: `client_id=eq.${clientId}`,
        },
        payload => {
          setMessages(prev => {
            if (prev.some(m => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId]);

  const handleSendMessage = async () => {
    const text = inputText.trim();
    if (!text || !clientId) return;

    setSending(true);
    setInputText('');

    try {
      const newMsg = {
        client_id: clientId,
        sender_type: 'client',
        message: text,
      };

      const { data, error } = await supabase.from('client_messages').insert([newMsg]).select();
      if (error) throw error;

      if (data && data[0]) {
        setMessages(prev => [...prev, data[0]]);
      }

      // NOTIFY ADMIN & ASSIGNED STAFF IMMEDIATELY
      await createNotification({
        title: `💬 New Message from ${user?.name || 'Client'}`,
        message: text.length > 80 ? `${text.substring(0, 80)}...` : text,
        module: 'client',
        referenceId: clientId,
        recipientRole: 'Admin',
        createdByName: user?.name || 'Client',
      });
    } catch (err: any) {
      Alert.alert('Send Error', err.message || 'Could not send message.');
      setInputText(text); // restore
    } finally {
      setSending(false);
    }
  };

  const promptAttach = () => {
    Alert.alert('Send Attachment', 'Share photos, drawings or documents with Dayal Team.', [
      {
        text: '📸 Take Site Photo',
        onPress: () => handleAttachFile('camera'),
      },
      {
        text: '🖼️ Choose from Gallery',
        onPress: () => handleAttachFile('gallery'),
      },
      {
        text: '📄 Choose Document (PDF, DWG)',
        onPress: () => handleAttachFile('document'),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleAttachFile = async (mode: 'camera' | 'gallery' | 'document') => {
    if (!clientId) return;
    setUploading(true);

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
        setUploading(false);
        return;
      }

      const newMsg = {
        client_id: clientId,
        sender_type: 'client',
        message: res.name,
        file_url: res.key,
        file_name: res.name,
      };

      const { data, error } = await supabase.from('client_messages').insert([newMsg]).select();
      if (error) throw error;

      if (data && data[0]) {
        setMessages(prev => [...prev, data[0]]);
      }

      // NOTIFY ADMIN IMMEDIATELY
      await createNotification({
        title: `📎 New File from ${user?.name || 'Client'}`,
        message: `Sent attachment: "${res.name}"`,
        module: 'client',
        referenceId: clientId,
        recipientRole: 'Admin',
        createdByName: user?.name || 'Client',
      });
    } catch (err: any) {
      Alert.alert('Upload Error', err.message || 'Could not upload attachment to Cloudflare R2.');
    } finally {
      setUploading(false);
    }
  };

  const formatMessageTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: safeTop }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.teamAvatar}>
          <ShieldCheck size={20} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.headerTitle}>Dayal Engineering Team</Text>
          <View style={styles.onlineRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.onlineText}>Direct Project Support</Text>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Connecting to message center...</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconBox}>
              <Sparkles size={28} color={Colors.primaryDark} />
            </View>
            <Text style={styles.emptyTitle}>Chat with Dayal Engineering</Text>
            <Text style={styles.emptySub}>
              Have questions regarding your floor plans, municipal sanctions, or construction site progress? Send a direct message here!
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={item => item.id?.toString() || Math.random().toString()}
            contentContainerStyle={styles.messageList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const isClient = item.sender_type === 'client';
              return (
                <View style={[styles.bubbleWrapper, isClient ? styles.clientWrapper : styles.teamWrapper]}>
                  {!isClient && (
                    <View style={styles.senderAvatar}>
                      <Text style={styles.senderAvatarText}>D</Text>
                    </View>
                  )}
                  <View style={[styles.bubble, isClient ? styles.clientBubble : styles.teamBubble]}>
                    <Text style={[styles.senderLabel, isClient ? styles.clientSenderLabel : styles.teamSenderLabel]}>
                      {isClient ? 'You' : 'Dayal Team'}
                    </Text>

                    {item.file_url ? (
                      <View style={{ marginTop: 4, marginBottom: 4 }}>
                        <R2ImageThumbnail
                          fileKey={item.file_url}
                          fileName={item.file_name || item.message}
                          style={{ marginRight: 0, marginBottom: 0, width: 200, height: 150 }}
                        />
                        {item.message && item.message !== item.file_name && (
                          <Text style={[styles.messageText, isClient ? styles.clientMessageText : styles.teamMessageText, { marginTop: 4 }]}>
                            {item.message}
                          </Text>
                        )}
                      </View>
                    ) : (
                      <Text style={[styles.messageText, isClient ? styles.clientMessageText : styles.teamMessageText]}>
                        {item.message}
                      </Text>
                    )}

                    <Text style={[styles.timeText, isClient ? styles.clientTimeText : styles.teamTimeText]}>
                      {formatMessageTime(item.created_at)}
                    </Text>
                  </View>
                </View>
              );
            }}
          />
        )}

        {/* Message Input Bar */}
        <View style={styles.inputContainer}>
          <TouchableOpacity
            style={styles.attachButton}
            onPress={promptAttach}
            disabled={uploading}
            activeOpacity={0.7}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Paperclip size={20} color={Colors.textMuted} />
            )}
          </TouchableOpacity>

          <TextInput
            style={styles.input}
            placeholder="Type your message to Dayal team..."
            placeholderTextColor={Colors.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
            onPress={handleSendMessage}
            disabled={!inputText.trim() || sending}
            activeOpacity={0.8}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Send size={18} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: Colors.textMuted,
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
  teamAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  onlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 1,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#16A34A',
  },
  onlineText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },
  messageList: {
    padding: 16,
    paddingBottom: 20,
    gap: 12,
  },
  bubbleWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 6,
    gap: 8,
  },
  clientWrapper: {
    justifyContent: 'flex-end',
  },
  teamWrapper: {
    justifyContent: 'flex-start',
  },
  senderAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#1E3A8A',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  senderAvatarText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  clientBubble: {
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
  },
  teamBubble: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  senderLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    marginBottom: 2,
  },
  clientSenderLabel: {
    color: '#BFDBFE',
    textAlign: 'right',
  },
  teamSenderLabel: {
    color: '#2563EB',
  },
  messageText: {
    fontSize: 13.5,
    lineHeight: 19,
  },
  clientMessageText: {
    color: '#FFFFFF',
  },
  teamMessageText: {
    color: Colors.text,
  },
  timeText: {
    fontSize: 9.5,
    marginTop: 4,
  },
  clientTimeText: {
    color: 'rgba(255, 255, 255, 0.75)',
    textAlign: 'right',
  },
  teamTimeText: {
    color: Colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
  },
  emptySub: {
    fontSize: 12.5,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    gap: 8,
  },
  attachButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    fontSize: 13.5,
    color: Colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#93C5FD',
  },
});

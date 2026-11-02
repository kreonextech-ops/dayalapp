import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { FileText, ExternalLink, Image as ImageIcon, Trash2 } from 'lucide-react-native';
import { getR2FileUrl, openR2FileInBrowser } from '../lib/r2Storage';
import { Colors } from '../constants/Colors';

interface R2ImageThumbnailProps {
  fileKey?: string;
  url?: string;
  fileName?: string;
  author?: string;
  timestamp?: string;
  showDelete?: boolean;
  onDelete?: () => void;
  style?: any;
}

export default function R2ImageThumbnail({
  fileKey,
  url: directUrl,
  fileName = 'Attachment',
  author,
  timestamp,
  showDelete = false,
  onDelete,
  style,
}: R2ImageThumbnailProps) {
  const [signedUrl, setSignedUrl] = useState<string | null>(directUrl || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const effectiveKey = fileKey || directUrl || '';
  const isImage = /\.(jpeg|jpg|png|webp|gif)$/i.test(fileName || effectiveKey);

  useEffect(() => {
    let isMounted = true;
    const resolveUrl = async () => {
      if (!effectiveKey) {
        setLoading(false);
        return;
      }

      if (effectiveKey.startsWith('http://') || effectiveKey.startsWith('https://')) {
        if (isMounted) {
          setSignedUrl(effectiveKey);
          setLoading(false);
        }
        return;
      }

      try {
        const generated = await getR2FileUrl(effectiveKey);
        if (isMounted) {
          setSignedUrl(generated);
          setLoading(false);
        }
      } catch (e) {
        if (isMounted) {
          setError(true);
          setLoading(false);
        }
      }
    };

    resolveUrl();
    return () => {
      isMounted = false;
    };
  }, [effectiveKey]);

  const handlePress = async () => {
    if (signedUrl) {
      try {
        await Linking.openURL(signedUrl);
      } catch {
        openR2FileInBrowser(effectiveKey);
      }
    } else {
      openR2FileInBrowser(effectiveKey);
    }
  };

  if (isImage) {
    return (
      <View style={[styles.imageContainer, style]}>
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={handlePress}
          style={styles.imagePressable}
        >
          {loading ? (
            <View style={styles.imageLoading}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : error || !signedUrl ? (
            <View style={styles.imageError}>
              <ImageIcon size={22} color={Colors.textMuted} />
              <Text style={styles.errorText}>Image</Text>
            </View>
          ) : (
            <Image
              source={{ uri: signedUrl }}
              style={styles.image}
              resizeMode="cover"
            />
          )}

          <View style={styles.imageOverlay}>
            <Text style={styles.imageName} numberOfLines={1}>
              {fileName}
            </Text>
            {author && (
              <Text style={styles.authorText} numberOfLines={1}>
                By {author}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        {showDelete && onDelete && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={onDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Trash2 size={13} color="#EF4444" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  // Non-image document / PDF / CAD Drawing
  return (
    <View style={[styles.docContainer, style]}>
      <TouchableOpacity
        style={styles.docPressable}
        activeOpacity={0.7}
        onPress={handlePress}
      >
        <View style={styles.docIconBox}>
          <FileText size={20} color={Colors.primaryDark} />
        </View>
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={styles.docTitle} numberOfLines={1}>
            {fileName}
          </Text>
          <View style={styles.metaRow}>
            {author && <Text style={styles.docSub}>{author}</Text>}
            {timestamp && (
              <Text style={styles.docSub}>
                {' • '}
                {new Date(timestamp).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                })}
              </Text>
            )}
          </View>
        </View>
        <ExternalLink size={16} color={Colors.textMuted} />
      </TouchableOpacity>

      {showDelete && onDelete && (
        <TouchableOpacity
          style={styles.docDeleteBtn}
          onPress={onDelete}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Trash2 size={15} color="#EF4444" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  imageContainer: {
    width: 140,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    position: 'relative',
    marginRight: 10,
    marginBottom: 10,
  },
  imagePressable: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageError: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
  },
  errorText: {
    fontSize: 10,
    color: Colors.textMuted,
    marginTop: 4,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  imageName: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  authorText: {
    color: '#CBD5E1',
    fontSize: 9,
  },
  deleteButton: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 12,
    padding: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  docContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 10,
    marginBottom: 8,
  },
  docPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  docIconBox: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  docSub: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  docDeleteBtn: {
    padding: 6,
    marginLeft: 6,
  },
});

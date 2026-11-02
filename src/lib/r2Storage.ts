import CryptoJS from 'crypto-js';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { Linking, Alert } from 'react-native';

const R2_ENDPOINT =
  process.env.EXPO_PUBLIC_R2_ENDPOINT ||
  'https://06c0bed1fd7b4a7923d9ab4d899da5e9.r2.cloudflarestorage.com';
const R2_ACCESS_KEY =
  process.env.EXPO_PUBLIC_R2_ACCESS_KEY || '151e301c7ca9f5370e590c14de885e4a';
const R2_SECRET_KEY =
  process.env.EXPO_PUBLIC_R2_SECRET_KEY ||
  '35d26691b60485bc3a9cbfc3d0ab95aee4b0ed9bfe44e6ad2fb7e1c9aa70b560';
const BUCKET_NAME = process.env.EXPO_PUBLIC_R2_BUCKET_NAME || 'dayal-crm-docs';

const endpointHost = R2_ENDPOINT.replace(/^https?:\/\//, '');
const HOST = `${BUCKET_NAME}.${endpointHost}`;

function hmac(key: any, string: string): any {
  return CryptoJS.HmacSHA256(string, key);
}

function sha256(string: string): string {
  return CryptoJS.SHA256(string).toString(CryptoJS.enc.Hex);
}

/**
 * Pure JavaScript AWS SigV4 signed URL generator.
 * Works 100% reliably in React Native Hermes / Expo Go / Production APK without any Node.js dependencies.
 */
export function signR2Url({
  method,
  key,
  expiresIn = 86400,
}: {
  method: 'GET' | 'PUT' | 'DELETE';
  key: string;
  expiresIn?: number;
}): string {
  const normalizedKey = key.startsWith('/') ? key : `/${key}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const date = amzDate.substring(0, 8);
  const region = 'auto';
  const service = 's3';
  const credentialScope = `${date}/${region}/${service}/aws4_request`;

  const queryParams: Record<string, string> = {
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${R2_ACCESS_KEY}/${credentialScope}`,
    'X-Amz-Date': amzDate,
    'X-Amz-Expires': String(expiresIn),
    'X-Amz-SignedHeaders': 'host',
  };

  const canonicalQuery = Object.keys(queryParams)
    .sort()
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(queryParams[k])}`)
    .join('&');

  const canonicalHeaders = `host:${HOST}\n`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    method,
    normalizedKey,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');

  const kDate = hmac(`AWS4${R2_SECRET_KEY}`, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');

  const signature = hmac(kSigning, stringToSign).toString(CryptoJS.enc.Hex);

  return `https://${HOST}${normalizedKey}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    case 'pdf':
      return 'application/pdf';
    case 'dwg':
    case 'dxf':
      return 'application/acad';
    case 'doc':
    case 'docx':
      return 'application/msword';
    case 'xls':
    case 'xlsx':
      return 'application/vnd.ms-excel';
    default:
      return 'application/octet-stream';
  }
}

/**
 * Uploads a local file URI (from Expo ImagePicker or DocumentPicker) to Cloudflare R2
 * Returns the permanent fileKey, raw name, and a temporary presigned view URL.
 */
export async function uploadUriToR2(
  fileUri: string,
  rawName: string,
  folder = 'general',
  mimeType?: string
): Promise<{ key: string; name: string; url: string }> {
  const sanitizedName = rawName.replace(/[^a-zA-Z0-9.-]/g, '_');
  const fileKey = `${folder}/${Date.now()}-${sanitizedName}`;
  const resolvedMime = mimeType || getMimeType(rawName);

  // 1. Generate presigned PUT URL using pure JS SigV4
  const uploadUrl = signR2Url({
    method: 'PUT',
    key: fileKey,
    expiresIn: 3600, // 1 hour
  });

  // 2. Stream binary file directly from device storage to Cloudflare R2
  const uploadResponse = await FileSystem.uploadAsync(uploadUrl, fileUri, {
    httpMethod: 'PUT',
    uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    headers: {
      'Content-Type': resolvedMime,
    },
  });

  if (uploadResponse.status < 200 || uploadResponse.status >= 300) {
    throw new Error(`R2 upload failed with status ${uploadResponse.status}`);
  }

  // 3. Generate viewable signed GET URL (valid for 24 hours)
  const signedViewUrl = getR2FileUrl(fileKey);

  return {
    key: fileKey,
    name: rawName,
    url: signedViewUrl,
  };
}

/**
 * Generates an AWS SigV4 presigned GET URL for viewing or downloading any R2 file
 */
export function getR2FileUrl(key: string): string {
  if (!key) return '';
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return key;
  }
  return signR2Url({ method: 'GET', key, expiresIn: 86400 });
}

/**
 * Opens an R2 file or document in the device's native browser/viewer
 */
export async function openR2FileInBrowser(keyOrUrl: string) {
  try {
    let url = keyOrUrl;
    if (!keyOrUrl.startsWith('http')) {
      url = getR2FileUrl(keyOrUrl);
    }
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('Cannot Open', 'Unable to open file link on this device.');
    }
  } catch (err: any) {
    Alert.alert('File Error', err.message || 'Could not load file.');
  }
}

/**
 * Deletes a file from Cloudflare R2
 */
export async function deleteR2File(key: string): Promise<void> {
  if (!key || key.startsWith('http')) return;
  try {
    const deleteUrl = signR2Url({ method: 'DELETE', key, expiresIn: 600 });
    await fetch(deleteUrl, { method: 'DELETE' });
  } catch (err) {
    console.warn('Failed to delete file from R2:', err);
  }
}

/**
 * Prompt user to select an image from device gallery and upload to R2
 */
export async function pickImageAndUpload(folder = 'client_milestones') {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission Denied', 'Please grant photo library access to upload photos.');
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.85,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const fileName = asset.fileName || `photo_${Date.now()}.jpg`;
  return await uploadUriToR2(asset.uri, fileName, folder, asset.mimeType || 'image/jpeg');
}

/**
 * Prompt user to take a new photo with camera and upload to R2
 */
export async function takePhotoAndUpload(folder = 'client_milestones') {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Permission Denied', 'Please grant camera access to take site photos.');
    return null;
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.85,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const fileName = asset.fileName || `site_photo_${Date.now()}.jpg`;
  return await uploadUriToR2(asset.uri, fileName, folder, asset.mimeType || 'image/jpeg');
}

/**
 * Prompt user to select any document (PDF, CAD, Doc) and upload to R2
 */
export async function pickDocumentAndUpload(folder = 'client_milestones') {
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return null;
  }

  const asset = result.assets[0];
  const fileName = asset.name || `document_${Date.now()}`;
  return await uploadUriToR2(asset.uri, fileName, folder, asset.mimeType || 'application/octet-stream');
}

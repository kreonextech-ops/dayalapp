import { AwsClient } from 'aws4fetch';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
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
const BUCKET_URL = `https://${BUCKET_NAME}.${endpointHost}`;

export const aws = new AwsClient({
  accessKeyId: R2_ACCESS_KEY,
  secretAccessKey: R2_SECRET_KEY,
  service: 's3',
  region: 'auto',
});

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
  const targetUrl = `${BUCKET_URL}/${fileKey}`;

  // 1. Fetch file as binary blob from local URI
  const fileResponse = await fetch(fileUri);
  const blob = await fileResponse.blob();

  // 2. Direct AWS SigV4 signed upload to Cloudflare R2
  const uploadResponse = await aws.fetch(targetUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': resolvedMime,
    },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`R2 upload failed with status ${uploadResponse.status}`);
  }

  // 3. Generate viewable signed GET URL
  const signedViewUrl = await getR2FileUrl(fileKey);

  return {
    key: fileKey,
    name: rawName,
    url: signedViewUrl,
  };
}

/**
 * Generates an AWS SigV4 presigned GET URL for viewing or downloading any R2 file
 */
export async function getR2FileUrl(key: string): Promise<string> {
  if (!key) return '';
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return key;
  }

  const targetUrl = `${BUCKET_URL}/${key}`;
  const signed = await aws.sign(targetUrl, {
    method: 'GET',
    aws: { signQuery: true },
  });

  return signed.url;
}

/**
 * Opens an R2 file or document in the device's native browser/viewer
 */
export async function openR2FileInBrowser(keyOrUrl: string) {
  try {
    let url = keyOrUrl;
    if (!keyOrUrl.startsWith('http')) {
      url = await getR2FileUrl(keyOrUrl);
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
    const targetUrl = `${BUCKET_URL}/${key}`;
    await aws.fetch(targetUrl, {
      method: 'DELETE',
    });
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

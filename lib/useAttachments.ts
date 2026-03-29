import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { Platform } from 'react-native';
import { supabase } from './supabase';

export type Attachment = {
  uri: string;
  type: 'image' | 'gif' | 'pdf';
  filename: string;
  mimeType?: string;
  base64?: string;
};

export async function pickImage(): Promise<Attachment | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    alert('Photo library permission is required.');
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: false,
    quality: 0.8,
    base64: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const filename = asset.uri.split('/').pop() || `image_${Date.now()}.jpg`;
  const isGif = filename.toLowerCase().endsWith('.gif') || asset.mimeType === 'image/gif';
  return {
    uri: asset.uri,
    type: isGif ? 'gif' : 'image',
    filename,
    mimeType: asset.mimeType || 'image/jpeg',
    base64: asset.base64 || undefined,
  };
}

export async function pickCamera(): Promise<Attachment | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    alert('Camera permission is required.');
    return null;
  }
  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: false,
    quality: 0.8,
    base64: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    type: 'image',
    filename: `photo_${Date.now()}.jpg`,
    mimeType: 'image/jpeg',
    base64: asset.base64 || undefined,
  };
}

export async function pickDocument(): Promise<Attachment | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  return {
    uri: asset.uri,
    type: 'pdf',
    filename: asset.name || 'document.pdf',
    mimeType: 'application/pdf',
  };
}

export async function uploadAttachment(attachment: Attachment, postId: string): Promise<string | null> {
  try {
    const ext = attachment.filename.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${postId}/${Date.now()}.${ext}`;
    const contentType = attachment.mimeType || 'application/octet-stream';

    let fileData: Blob | ArrayBuffer;

    if (attachment.base64) {
      // Use base64 if available (most reliable across platforms)
      const binary = atob(attachment.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      fileData = bytes.buffer;
    } else if (Platform.OS === 'web') {
      // Web without base64 — fetch the object URL
      const response = await fetch(attachment.uri);
      if (!response.ok) throw new Error('Failed to fetch file');
      fileData = await response.blob();
    } else {
      // Native without base64 — read via expo-file-system
      const FileSystem = require('expo-file-system');
      const base64 = await FileSystem.readAsStringAsync(attachment.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      fileData = bytes.buffer;
    }

    const { data, error } = await supabase.storage
      .from('post-attachments')
      .upload(path, fileData, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error('Supabase upload error:', JSON.stringify(error));
      return null;
    }

    const { data: urlData } = supabase.storage.from('post-attachments').getPublicUrl(path);
    return urlData.publicUrl;
  } catch (e) {
    console.error('Upload failed:', e);
    return null;
  }
}

import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { supabase } from './supabase';

export type Attachment = {
  uri: string;
  type: 'image' | 'gif' | 'pdf';
  filename: string;
  mimeType?: string;
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
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const filename = asset.uri.split('/').pop() || 'image.jpg';
  const isGif = filename.toLowerCase().endsWith('.gif') || asset.mimeType === 'image/gif';
  return {
    uri: asset.uri,
    type: isGif ? 'gif' : 'image',
    filename,
    mimeType: asset.mimeType || 'image/jpeg',
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
  });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const filename = `photo_${Date.now()}.jpg`;
  return {
    uri: asset.uri,
    type: 'image',
    filename,
    mimeType: 'image/jpeg',
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
    const ext = attachment.filename.split('.').pop() || 'jpg';
    const path = `${postId}/${Date.now()}.${ext}`;

    const response = await fetch(attachment.uri);
    const blob = await response.blob();

    const { error } = await supabase.storage
      .from('post-attachments')
      .upload(path, blob, {
        contentType: attachment.mimeType || 'application/octet-stream',
        upsert: false,
      });

    if (error) { console.error('Upload error:', error); return null; }

    const { data } = supabase.storage.from('post-attachments').getPublicUrl(path);
    return data.publicUrl;
  } catch (e) {
    console.error('Upload failed:', e);
    return null;
  }
}

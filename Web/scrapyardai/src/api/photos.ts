import { verifyIdToken } from '../lib/auth';
import { savePhotoMetadata, getUserPhotos } from '../lib/database';
import { uploadPhoto, getPhotoUrl } from '../lib/storage';

export async function handleUpload(request: Request, env: Env) {
  const idToken = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!idToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const user = await verifyIdToken(idToken);
  if (!user) {
    return new Response('Invalid token', { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get('photo') as File;
  if (!file) {
    return new Response('No file uploaded', { status: 400 });
  }

  const photoId = crypto.randomUUID();
  const r2Key = `user/${user.uid}/photos/${photoId}`;

  await uploadPhoto(env.MY_BUCKET, r2Key, file);
  await savePhotoMetadata(env.DB, photoId, user.uid, r2Key);

  return new Response(JSON.stringify({ success: true, photoId }), {
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function handleGetPhotos(request: Request, env: Env) {
  const idToken = request.headers.get('Authorization')?.split('Bearer ')[1];
  if (!idToken) {
    return new Response('Unauthorized', { status: 401 });
  }

  const user = await verifyIdToken(idToken);
  if (!user) {
    return new Response('Invalid token', { status: 401 });
  }

  const photos = await getUserPhotos(env.DB, user.uid);
  const photosWithUrls = await Promise.all(photos.map(async (photo) => ({
    ...photo,
    url: await getPhotoUrl(env.MY_BUCKET, photo.r2_key),
  })));

  return new Response(JSON.stringify(photosWithUrls), {
    headers: { 'Content-Type': 'application/json' },
  });
}

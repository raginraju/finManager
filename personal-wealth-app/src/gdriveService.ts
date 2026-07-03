const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const APP_FOLDER_NAME = 'wealthmanager';
const DRIVE_FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

const folderIdCache = new Map<string, Promise<string>>();

interface DriveFileSearchResponse {
  files: Array<{ id: string; name: string }>;
}

function escapeDriveQueryValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function extractEmailFromToken(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const decoded = JSON.parse(atob(parts[1]));
    return decoded.email || null;
  } catch {
    return null;
  }
}

async function queryFirstFileId(token: string, rawQuery: string): Promise<string | null> {
  const query = encodeURIComponent(rawQuery);
  const response = await fetch(`${DRIVE_API_URL}?q=${query}&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed querying Google Drive for requested resource.');
  }

  const data: DriveFileSearchResponse = await response.json();
  return data.files.length > 0 ? data.files[0].id : null;
}

async function getOrCreateAppFolder(token: string): Promise<string> {
  const cacheKey = extractEmailFromToken(token) || token;

  if (folderIdCache.has(cacheKey)) {
    return folderIdCache.get(cacheKey)!;
  }

  const folderPromise = (async () => {
    const safeFolderName = escapeDriveQueryValue(APP_FOLDER_NAME);
    const existingFolderId = await queryFirstFileId(
      token,
      `name = '${safeFolderName}' and mimeType = '${DRIVE_FOLDER_MIME_TYPE}' and trashed = false`,
    );

    if (existingFolderId) {
      return existingFolderId;
    }

    const response = await fetch(DRIVE_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: APP_FOLDER_NAME,
        mimeType: DRIVE_FOLDER_MIME_TYPE,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create Google Drive folder: ${APP_FOLDER_NAME}`);
    }

    const data: { id: string } = await response.json();
    return data.id;
  })();

  folderIdCache.set(cacheKey, folderPromise);
  return folderPromise;
}

/**
 * Locate a specific data file by name inside the application's Google Drive folder.
 */
export async function findDataFile(token: string, fileName: string): Promise<string | null> {
  const folderId = await getOrCreateAppFolder(token);
  const safeFileName = escapeDriveQueryValue(fileName);
  return queryFirstFileId(
    token,
    `name = '${safeFileName}' and '${folderId}' in parents and trashed = false`,
  );
}

/**
 * Downloads the binary file (wealth.db) from Google Drive as a raw ArrayBuffer.
 */
export async function downloadBinaryFile(token: string, fileId: string): Promise<ArrayBuffer> {
  const response = await fetch(`${DRIVE_API_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    throw new Error('Failed to download binary SQLite database from Google Drive.');
  }
  
  return await response.arrayBuffer();
}

/**
 * Uploads or overwrites the SQLite database file in your Google Drive sandbox.
 * Handles both the initial creation (POST) and atomic updates (PATCH).
 */
export async function uploadBinaryFile(
  token: string, 
  filename: string, 
  arrayBuffer: Uint8Array, 
  fileId?: string | null
): Promise<string> {
  const folderId = await getOrCreateAppFolder(token);
  
  const metadata = {
    name: filename,
    mimeType: 'application/octet-stream',
    ...(fileId ? {} : { parents: [folderId] }), // Parent parameter is only required for initial creation
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', new Blob([arrayBuffer as BlobPart], { type: 'application/octet-stream' }));

  const url = fileId 
    ? `${UPLOAD_API_URL}/${fileId}?uploadType=multipart`
    : `${UPLOAD_API_URL}?uploadType=multipart`;

  const response = await fetch(url, {
    method: fileId ? 'PATCH' : 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed pushing SQLite binary asset to cloud core destination. Status: ${response.status}`);
  }
  
  const data = await response.json();
  return data.id;
}
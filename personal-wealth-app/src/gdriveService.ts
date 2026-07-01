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
 * Locate a specific data file by name inside the user's Google Drive space.
 * 💡 MODIFIED: Added dynamic fileName search lookup criteria
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
 * Retrieve the contents of a specific JSON file via its unique File ID.
 */
export async function downloadDataFile(token: string, fileId: string): Promise<any> {
  const response = await fetch(`${DRIVE_API_URL}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error('Failed to stream data payload down from Drive storage.');
  return await response.json();
}

/**
 * Create a fresh JSON file in the application space using a specific shard identifier name.
 * 💡 MODIFIED: Check if file exists first, return existing ID if found
 */
export async function createDataFile(token: string, payload: any, fileName: string): Promise<string> {
  // Check if file already exists
  const existingFileId = await findDataFile(token, fileName);
  if (existingFileId) {
    return existingFileId;
  }

  const folderId = await getOrCreateAppFolder(token);
  const metadata = {
    name: fileName,
    mimeType: 'application/json',
    parents: [folderId],
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', new Blob([JSON.stringify(payload)], { type: 'application/json' }));

  const response = await fetch(`${UPLOAD_API_URL}?uploadType=multipart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) throw new Error(`Initial creation sequence rejected by Drive API for target file: ${fileName}`);
  const data = await response.json();
  return data.id;
}

/**
 * Perform a destructive atomic overwrite of an existing file ID with modern payloads.
 */
export async function updateDataFile(token: string, fileId: string, payload: any): Promise<void> {
  const response = await fetch(`${UPLOAD_API_URL}/${fileId}?uploadType=media`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) throw new Error('File sync overwrite execution failed.');
}
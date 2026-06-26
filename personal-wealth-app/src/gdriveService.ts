const DRIVE_API_URL = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API_URL = 'https://www.googleapis.com/upload/drive/v3/files';
const FILE_NAME = 'wealth-data.json';

interface DriveFileSearchResponse {
  files: Array<{ id: string; name: string }>;
}

/**
 * Locate the application sandbox data file inside the user's Google Drive.
 */
export async function findDataFile(token: string): Promise<string | null> {
  const query = encodeURIComponent(`name = '${FILE_NAME}' and trashed = false`);
  const response = await fetch(`${DRIVE_API_URL}?q=${query}&spaces=drive`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) throw new Error('Failed to query Google Drive directory structure.');
  
  const data: DriveFileSearchResponse = await response.json();
  return data.files.length > 0 ? data.files[0].id : null;
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
 * Create a fresh JSON file in the root of the application sandbox space.
 */
export async function createDataFile(token: string, payload: any): Promise<string> {
  const metadata = {
    name: FILE_NAME,
    mimeType: 'application/json',
  };

  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('file', new Blob([JSON.stringify(payload)], { type: 'application/json' }));

  const response = await fetch(`${UPLOAD_API_URL}?uploadType=multipart`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (!response.ok) throw new Error('Initial creation sequence rejected by Drive API.');
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
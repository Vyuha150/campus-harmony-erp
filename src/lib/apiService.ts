import { api } from './api';

// Role-to-API prefix mapping
const ROLE_PREFIX: Record<string, string> = {
  student: '/students',
  faculty: '/faculty',
  hod: '/hod',
  dean: '/dean',
  vice_chancellor: '/vc',
  pro_vc: '/vc',
  registrar: '/registrar',
  coe: '/coe',
  finance_officer: '/finance',
  placement_officer: '/placements',
  sports_director: '/sports',
  alumni_officer: '/alumni',
  iqac_coordinator: '/iqac',
  grievance_officer: '/grievances',
  security_officer: '/security',
  super_admin: '/admin',
  librarian: '/library',
};

export function getRolePrefix(role: string): string {
  return ROLE_PREFIX[role] || '/students';
}

/**
 * Pull the most useful message out of a failed request.
 *
 * The rebuilt modules return a typed error envelope:
 *
 *     { success: false, error: { code, message, details } }
 *
 * while the older routes return `{ success: false, message }`. This checked only
 * the older shape, so EVERY error from the rebuilt modules was discarded and
 * replaced with a bare "API Error" — the server explains precisely why a renewal
 * was refused or which field failed validation, and none of it reached the user.
 *
 * Field-level details are appended where present, because "The request contains
 * invalid data" is not actionable on its own.
 */
function getApiErrorMessage(error: any, fallback: string): string {
  const payload = error?.response?.data;

  // Typed envelope from the rebuilt modules.
  const typedMessage = payload?.error?.message;
  if (typeof typedMessage === 'string' && typedMessage.trim().length > 0) {
    const fields = payload?.error?.details?.fields;
    if (fields && typeof fields === 'object') {
      const parts = Object.entries(fields)
        .map(([field, messages]) => {
          const text = Array.isArray(messages) ? messages.join(', ') : String(messages);
          return field === '_' ? text : `${field}: ${text}`;
        })
        .filter(Boolean);
      if (parts.length > 0) return `${typedMessage} (${parts.join('; ')})`;
    }
    return typedMessage;
  }

  // Legacy routes.
  const responseMessage = payload?.message;
  if (typeof responseMessage === 'string' && responseMessage.trim().length > 0) {
    return responseMessage;
  }

  const directMessage = error?.message;
  if (typeof directMessage === 'string' && directMessage.trim().length > 0) {
    return directMessage;
  }
  return fallback;
}

export async function fetchApi<T = any>(endpoint: string): Promise<T> {
  try {
    const { data } = await api.get(endpoint);
    if (data.success === false) throw new Error(data.message || 'API Error');
    return data.data as T;
  } catch (error: any) {
    throw new Error(getApiErrorMessage(error, 'API Error'));
  }
}

export async function postApi<T = any>(endpoint: string, body: any): Promise<T> {
  try {
    const { data } = await api.post(endpoint, body);
    if (data.success === false) throw new Error(data.message || 'API Error');
    return data.data as T;
  } catch (error: any) {
    throw new Error(getApiErrorMessage(error, 'API Error'));
  }
}

export async function putApi<T = any>(endpoint: string, body: any): Promise<T> {
  try {
    const { data } = await api.put(endpoint, body);
    if (data.success === false) throw new Error(data.message || 'API Error');
    return data.data as T;
  } catch (error: any) {
    throw new Error(getApiErrorMessage(error, 'API Error'));
  }
}

/**
 * `body` goes through axios's `data` config, since axios's `delete()` has no
 * separate body parameter. Optional because plenty of DELETE routes take
 * none — but roughly 30 across the app now require `{ reason }` (T-hardening
 * passes across several modules), and every one of those was unreachable
 * from the UI until this parameter existed: there was no way to send the
 * body they validate against.
 */
export async function deleteApi(endpoint: string, body?: Record<string, unknown>): Promise<void> {
  try {
    const { data } = await api.delete(endpoint, body ? { data: body } : undefined);
    if (data.success === false) throw new Error(data.message || 'API Error');
  } catch (error: any) {
    throw new Error(getApiErrorMessage(error, 'API Error'));
  }
}

/**
 * Collect a delete reason via a native prompt, enforcing the same 10-500
 * character bound every hardened DELETE route validates server-side — so a
 * caller finds out a reason is too short here, not from a failed request.
 * Returns null if the user cancelled or never met the minimum; callers
 * should treat null as "abort the delete", not retry silently.
 */
export function promptForDeleteReason(subject: string): string | null {
  const reason = window.prompt(`Reason for deleting ${subject} (at least 10 characters):`);
  if (reason === null) return null;
  const trimmed = reason.trim();
  if (trimmed.length < 10) {
    window.alert('A reason of at least 10 characters is required to delete this record.');
    return null;
  }
  return trimmed;
}

/** Who may read an uploaded file, and what it belongs to. Defaults: private to the uploader. */
export interface UploadOptions {
  visibility?: 'private' | 'role_restricted' | 'institution';
  allowedRoles?: string[];
  relatedEntityType?: string;
  relatedEntityId?: string;
}

export async function uploadApi<T = any>(file: File, module: string, options: UploadOptions = {}): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('module', module);
  if (options.visibility) formData.append('visibility', options.visibility);
  if (options.allowedRoles) formData.append('allowedRoles', JSON.stringify(options.allowedRoles));
  if (options.relatedEntityType) formData.append('relatedEntityType', options.relatedEntityType);
  if (options.relatedEntityId) formData.append('relatedEntityId', options.relatedEntityId);

  const { data } = await api.post('/uploads', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  if (data.success === false) throw new Error(data.message || 'Upload failed');
  return data.data as T;
}

/**
 * Download a stored file through the signed-in session.
 *
 * Uploaded files are served from `/api/uploads/:id`, which requires the user's
 * token. Opening that URL in a new tab (what the download buttons did) sends no
 * token, so every download was refused. This fetches the file with the token
 * and saves it.
 */
export async function downloadUpload(url: string, filename = 'download'): Promise<void> {
  const path = url.replace(/^.*?\/api(?=\/)/, '');
  const response = await api.get(path, { responseType: 'blob' });
  const disposition = String(response.headers['content-disposition'] ?? '');
  const named = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1];
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(response.data as Blob);
  link.href = objectUrl;
  link.download = named ? decodeURIComponent(named) : filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
}

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

export async function deleteApi(endpoint: string): Promise<void> {
  try {
    const { data } = await api.delete(endpoint);
    if (data.success === false) throw new Error(data.message || 'API Error');
  } catch (error: any) {
    throw new Error(getApiErrorMessage(error, 'API Error'));
  }
}

export async function uploadApi<T = any>(file: File, module: string): Promise<T> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('module', module);

  const { data } = await api.post('/uploads', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  if (data.success === false) throw new Error(data.message || 'Upload failed');
  return data.data as T;
}

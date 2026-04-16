/**
 * API client with Authorization header.
 * Attaches the Cognito ID token to every request.
 */

import { getToken, login } from '../auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

async function request(path, options = {}) {
  const token = getToken();
  if (!token) {
    login();
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: token,
      ...options.headers,
    },
  });

  if (response.status === 401) {
    login();
    throw new Error('Session expired');
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  return response.json();
}

/** Send a chat message and get the assistant response + extracted fields. */
export function sendChatMessage(sessionId, message, user = null) {
  return request('/chat', {
    method: 'POST',
    body: JSON.stringify({
      session_id: sessionId,
      message,
      user_name: user?.name || '',
      user_email: user?.email || '',
    }),
  });
}

/** Submit a completed intake to the ARB queue. */
export function submitRequest(sessionId, submitter = '', submitterEmail = '') {
  return request('/requests', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, submitter, submitter_email: submitterEmail }),
  });
}

/** List all requests, optionally filtered by status. */
export function listRequests(status = '') {
  const qs = status ? `?status=${status}` : '';
  return request(`/requests${qs}`);
}

/** Get a single request by ID. */
export function getRequest(requestId) {
  return request(`/requests/${requestId}`);
}

/** Update a request (status, assigned_to, criticality, target_date). */
export function updateRequest(requestId, updates) {
  return request(`/requests/${requestId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

/** Add a triage note to a request. */
export function addNote(requestId, text, author) {
  return request(`/requests/${requestId}/notes`, {
    method: 'POST',
    body: JSON.stringify({ text, author }),
  });
}

/** Get all triage notes for a request. */
export function getNotes(requestId) {
  return request(`/requests/${requestId}/notes`);
}

/** Update a triage note. */
export function updateNote(requestId, sk, text) {
  return request(`/requests/${requestId}/notes`, {
    method: 'PUT',
    body: JSON.stringify({ sk, text }),
  });
}

/** Delete a triage note. */
export function deleteNote(requestId, sk) {
  return request(`/requests/${requestId}/notes`, {
    method: 'DELETE',
    body: JSON.stringify({ sk }),
  });
}

/** Get a presigned upload URL for a file attachment. */
export function getUploadUrl(requestId, filename, contentType, category = 'general') {
  return request(`/requests/${requestId}/attachments`, {
    method: 'POST',
    body: JSON.stringify({ filename, content_type: contentType, category }),
  });
}

/** Upload a file directly to S3 using a presigned URL. */
export async function uploadFileToS3(presignedUrl, file) {
  const response = await fetch(presignedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
}

/** List attachments for a request. */
export function listAttachments(requestId) {
  return request(`/requests/${requestId}/attachments`);
}

/** Delete a request. */
export function deleteRequest(requestId) {
  return request(`/requests/${requestId}`, { method: 'DELETE' });
}

/** Add a field-level annotation. */
export function addAnnotation(requestId, fieldName, text, author) {
  return request(`/requests/${requestId}/annotations`, {
    method: 'POST',
    body: JSON.stringify({ field_name: fieldName, text, author }),
  });
}

/** Get all annotations for a request. */
export function getAnnotations(requestId) {
  return request(`/requests/${requestId}/annotations`);
}

/** Update an annotation's text. */
export function updateAnnotation(requestId, sk, text) {
  return request(`/requests/${requestId}/annotations`, {
    method: 'PUT',
    body: JSON.stringify({ sk, text }),
  });
}

/** Delete an annotation. */
export function deleteAnnotation(requestId, sk) {
  return request(`/requests/${requestId}/annotations`, {
    method: 'DELETE',
    body: JSON.stringify({ sk }),
  });
}

/** Get an LLM-generated summary of a request. */
export function getRequestSummary(requestId) {
  return request(`/requests/${requestId}/summary`);
}

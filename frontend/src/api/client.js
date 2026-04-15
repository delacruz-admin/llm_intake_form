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
export function sendChatMessage(sessionId, message) {
  return request('/chat', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId, message }),
  });
}

/** Submit a completed intake to the ARB queue. */
export function submitRequest(sessionId) {
  return request('/requests', {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
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

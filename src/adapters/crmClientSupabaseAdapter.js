async function requestCrmApi(authToken, options = {}) {
  const token = String(authToken || '').trim();

  if (!token) {
    throw new Error('CRM_ADMIN_TOKEN_MISSING');
  }

  const response = await fetch('/api/crm', {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data?.ok) {
    const error = new Error(
      data?.error ||
      `CRM_API_HTTP_${response.status}`
    );

    error.status = data?.status || 'ERROR';
    error.details = data;
    throw error;
  }

  return data;
}

async function loadDashboard(authToken) {
  return requestCrmApi(authToken, {
    method: 'GET'
  });
}

async function createIdentity(
  {
    displayName,
    canonicalId,
    entityType
  },
  authToken
) {
  const result = await requestCrmApi(authToken, {
    method: 'POST',
    body: JSON.stringify({
      action: 'create_identity',
      displayName,
      canonicalId,
      entityType
    })
  });

  return result.identity;
}

export {
  createIdentity,
  loadDashboard
};

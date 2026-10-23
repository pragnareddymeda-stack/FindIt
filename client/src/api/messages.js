import api from './client.js';

/** Opens (creating on first use) the private conversation for a claim. Only its two parties may call this. */
export async function getClaimConversation(claimId) {
  const { data } = await api.get(`/claims/${claimId}/conversation`);
  return data.data.conversation;
}

export async function listConversations(params) {
  const { data } = await api.get('/conversations', { params });
  return { conversations: data.data.conversations, unreadTotal: data.data.unreadTotal, pagination: data.pagination };
}

/** Returns { messages (oldest first), hasMore, conversation }. Reading marks the conversation read. */
export async function getMessages(id, params) {
  const { data } = await api.get(`/conversations/${id}/messages`, { params });
  return data.data;
}

export async function sendMessage(id, text) {
  const { data } = await api.post(`/conversations/${id}/messages`, { text });
  return data.data.message;
}

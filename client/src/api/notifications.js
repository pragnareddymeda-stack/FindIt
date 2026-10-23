import api from './client.js';

export async function listNotifications(params) {
  const { data } = await api.get('/notifications', { params });
  return { notifications: data.data.notifications, unreadCount: data.data.unreadCount, pagination: data.pagination };
}

export async function fetchUnreadCount() {
  const { data } = await api.get('/notifications', { params: { limit: 1, unread: 'true' } });
  return data.data.unreadCount;
}

export async function markNotificationRead(id) {
  const { data } = await api.patch(`/notifications/${id}/read`);
  return data.data.notification;
}

export async function markAllNotificationsRead() {
  const { data } = await api.patch('/notifications/read-all');
  return data.data.updated;
}

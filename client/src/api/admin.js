import api from './client.js';

export async function getDashboard() {
  const { data } = await api.get('/admin/dashboard');
  return data.data;
}

export async function listUsers(params) {
  const { data } = await api.get('/admin/users', { params });
  return { users: data.data.users, pagination: data.pagination };
}
export async function setUserStatus(id, payload) {
  const { data } = await api.patch(`/admin/users/${id}/status`, payload);
  return data.data.user;
}

export async function listReports(params) {
  const { data } = await api.get('/admin/reports', { params });
  return { reports: data.data.reports, pagination: data.pagination };
}
export async function moderateReport(id, payload) {
  const { data } = await api.patch(`/admin/reports/${id}/moderation`, payload);
  return data.data.report;
}

export async function listAbuseReports(params) {
  const { data } = await api.get('/admin/abuse-reports', { params });
  return { abuseReports: data.data.abuseReports, pagination: data.pagination };
}
export async function decideAbuseReport(id, payload) {
  const { data } = await api.patch(`/admin/abuse-reports/${id}`, payload);
  return data.data.abuseReport;
}

export async function listDisputes(params) {
  const { data } = await api.get('/admin/disputes', { params });
  return { disputes: data.data.disputes, pagination: data.pagination };
}
export async function resolveDispute(id, payload) {
  const { data } = await api.patch(`/admin/disputes/${id}/resolution`, payload);
  return data.data.dispute;
}

export async function listAuditLogs(params) {
  const { data } = await api.get('/admin/audit-logs', { params });
  return { logs: data.data.logs, pagination: data.pagination };
}

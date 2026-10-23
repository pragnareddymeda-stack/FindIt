export const CATEGORY_OPTIONS = [
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'WALLETS_PURSES', label: 'Wallets and purses' },
  { value: 'ID_DOCUMENTS', label: 'ID cards and documents' },
  { value: 'KEYS', label: 'Keys' },
  { value: 'BAGS', label: 'Bags' },
  { value: 'BOOKS_STATIONERY', label: 'Books and stationery' },
  { value: 'CLOTHING', label: 'Clothing' },
  { value: 'ACCESSORIES', label: 'Accessories' },
  { value: 'OTHER', label: 'Other' },
];

export const CONTACT_OPTIONS = [
  { value: 'IN_APP', label: 'In-app messages' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'PHONE', label: 'Phone' },
];

export const ITEM_STATUS_LABELS = {
  ACTIVE: 'Active',
  RETURNED: 'Returned',
  CLOSED: 'Closed',
  WITHDRAWN: 'Withdrawn',
  HIDDEN: 'Hidden by moderator',
};

export const CLAIM_STATUS_LABELS = {
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  WITHDRAWN: 'Withdrawn',
};

export const HANDOVER_STATUS_LABELS = {
  ARRANGING: 'Arranging',
  SCHEDULED: 'Scheduled',
  HANDED_OVER: 'Handed over',
  COMPLETED: 'Completed',
  DISPUTED: 'Disputed',
  CANCELLED: 'Cancelled',
};

export const STATUS_LABELS = { ...ITEM_STATUS_LABELS, ...CLAIM_STATUS_LABELS, ...HANDOVER_STATUS_LABELS };

export const categoryLabel = (v) => CATEGORY_OPTIONS.find((c) => c.value === v)?.label ?? v;
export const contactLabel = (v) => CONTACT_OPTIONS.find((c) => c.value === v)?.label ?? v;

export const ABUSE_REASON_OPTIONS = [
  { value: 'SPAM', label: 'Spam or advert' },
  { value: 'INAPPROPRIATE', label: 'Inappropriate content' },
  { value: 'SCAM', label: 'Scam or fraud' },
  { value: 'PRIVATE_INFO', label: 'Shows private information' },
  { value: 'OTHER', label: 'Something else' },
];
export const abuseReasonLabel = (v) => ABUSE_REASON_OPTIONS.find((r) => r.value === v)?.label ?? v;

export const AUDIT_ACTION_LABELS = {
  USER_SUSPENDED: 'User suspended',
  USER_REACTIVATED: 'User reactivated',
  REPORT_HIDDEN: 'Report hidden',
  REPORT_UNHIDDEN: 'Report restored',
  ABUSE_REPORT_RESOLVED: 'Abuse report resolved',
  ABUSE_REPORT_DISMISSED: 'Abuse report dismissed',
  DISPUTE_RESOLVED: 'Dispute resolved',
  CLAIM_VIEWED_BY_ADMIN: 'Claim viewed by admin',
  CLAIM_DECIDED_BY_ADMIN: 'Claim decided by admin',
};

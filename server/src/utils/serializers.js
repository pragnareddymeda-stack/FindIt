// Explicit whitelists. Public output is built field by field so a new private field
// added to the model can never leak by accident.

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

function ownerRef(createdBy) {
  if (!createdBy) return null;
  if (createdBy.name !== undefined) return { id: createdBy._id, name: createdBy.name };
  return { id: createdBy };
}

export const itemOwnerId = (item) => item.createdBy?._id ?? item.createdBy;
export const isItemOwner = (item, userId) => sameId(itemOwnerId(item), userId);

export function toPublicItem(item, viewerId = null) {
  return {
    id: item._id,
    type: item.type,
    title: item.title,
    category: item.category,
    description: item.description,
    dateOccurred: item.dateOccurred,
    approxTime: item.approxTime,
    location: item.location,
    contactPreference: item.contactPreference,
    imageUrl: item.imageUrl || '',
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    owner: ownerRef(item.createdBy),
    isOwner: isItemOwner(item, viewerId),
  };
}

/** Only for the report's creator. Adds the private finder-only fields. */
export function toOwnerItem(item) {
  const out = { ...toPublicItem(item), isOwner: true };
  if (item.type === 'FOUND') {
    out.privateDetails = item.privateDetails;
    out.verificationQuestions = item.verificationQuestions.map((q) => ({
      id: q._id,
      question: q.question,
      expectedAnswer: q.expectedAnswer,
    }));
  }
  return out;
}

export const pagination = (page, limit, total) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
});

// ---------- claims ----------
const userRef = (u) => (u && u.name !== undefined ? { id: u._id, name: u.name } : u ? { id: u } : null);

const itemSummary = (i) =>
  i && i.title !== undefined
    ? { id: i._id, type: i.type, title: i.title, category: i.category, location: i.location, status: i.status }
    : i
      ? { id: i }
      : null;

const baseClaim = (c) => ({
  id: c._id,
  status: c.status,
  explanation: c.explanation,
  evidence: c.evidence,
  reviewNote: c.reviewNote,
  decidedAt: c.decidedAt,
  createdAt: c.createdAt,
  updatedAt: c.updatedAt,
  item: itemSummary(c.item),
});

/** What the person who submitted the claim sees. Never includes the finder's expected answers. */
export const toClaimantClaim = (c) => ({
  ...baseClaim(c),
  answers: c.answers.map((a) => ({ questionId: a.questionId, question: a.question, answer: a.answer })),
});

/** What the finder (or an admin) sees: the answers plus the finder's own expected answers for comparison. */
export function toFinderClaim(c, item) {
  const questions = item?.verificationQuestions ?? c.item?.verificationQuestions ?? [];
  const byId = new Map(questions.map((q) => [String(q._id), q.expectedAnswer]));
  const byText = new Map(questions.map((q) => [q.question, q.expectedAnswer]));
  return {
    ...baseClaim(c),
    claimant: userRef(c.claimant),
    answers: c.answers.map((a) => ({
      questionId: a.questionId,
      question: a.question,
      answer: a.answer,
      expectedAnswer: byId.get(String(a.questionId)) ?? byText.get(a.question) ?? '',
    })),
  };
}

export const toClaimSummary = (c) => ({
  id: c._id,
  status: c.status,
  createdAt: c.createdAt,
  item: itemSummary(c.item),
  claimant: userRef(c.claimant),
});

// ---------- handovers ----------
/** Only the two parties (and admins, read-only) ever receive this. No email or phone is included. */
export function toHandover(h, viewAs, nextActions = []) {
  return {
    id: h._id,
    claimId: h.claim?._id ?? h.claim,
    item: itemSummary(h.item),
    finder: userRef(h.finder),
    claimant: userRef(h.claimant),
    status: h.status,
    meetingTime: h.meetingTime,
    meetingPlace: h.meetingPlace,
    note: h.note,
    handedOverAt: h.handedOverAt,
    confirmedAt: h.confirmedAt,
    disputeReason: h.disputeReason,
    disputedAt: h.disputedAt,
    cancelledAt: h.cancelledAt,
    resolvedAt: h.resolvedAt,
    resolutionNote: h.resolutionNote,
    history: (h.history || []).map((e) => ({ status: e.status, role: e.role, at: e.at, note: e.note })),
    createdAt: h.createdAt,
    updatedAt: h.updatedAt,
    viewAs,
    nextActions,
  };
}

// ---------- messaging and notifications ----------
export const toNotification = (n) => ({
  id: n._id,
  type: n.type,
  title: n.title,
  body: n.body,
  link: n.link,
  read: Boolean(n.readAt),
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
});

export const toMessage = (m, sender) => {
  const s = sender ?? m.sender;
  return {
    id: m._id,
    conversationId: m.conversation?._id ?? m.conversation,
    sender: s && s.name !== undefined ? { id: s._id, name: s.name } : { id: s?._id ?? s },
    text: m.text,
    createdAt: m.createdAt,
  };
};

/** `conv` must have claim (status, isActive), item (title), finder and claimant (name) populated. */
export function toConversation(conv, userId) {
  const role = sameId(conv.finder?._id ?? conv.finder, userId) ? 'FINDER' : 'CLAIMANT';
  const other = role === 'FINDER' ? conv.claimant : conv.finder;
  return {
    id: conv._id,
    claimId: conv.claim?._id ?? conv.claim,
    claimStatus: conv.claim?.status,
    canSend: conv.claim?.isActive === true,
    item: conv.item?.title !== undefined ? { id: conv.item._id, title: conv.item.title } : { id: conv.item },
    other: other?.name !== undefined ? { id: other._id, name: other.name } : { id: other },
    unread: role === 'FINDER' ? conv.unreadFinder : conv.unreadClaimant,
    lastMessage: conv.lastMessageText
      ? { text: conv.lastMessageText, at: conv.lastMessageAt, mine: sameId(conv.lastMessageSender, userId) }
      : null,
    updatedAt: conv.lastMessageAt,
  };
}

// ---------- admin ----------
export const toAdminUser = (u) => ({
  id: u._id, name: u.name, email: u.email, role: u.role, status: u.status, createdAt: u.createdAt,
});

/** Public listing fields plus moderation info. Never includes private details or verification answers. */
export const toAdminItem = (item, openAbuseReports = 0) => ({
  ...toPublicItem(item),
  isOwner: undefined,
  openAbuseReports,
});

export const toAbuseReport = (r) => ({
  id: r._id,
  status: r.status,
  reason: r.reason,
  details: r.details,
  reporter: userRef(r.reporter),
  item: r.item && r.item.title !== undefined ? { id: r.item._id, title: r.item.title, type: r.item.type, status: r.item.status } : { id: r.item },
  resolutionNote: r.resolutionNote,
  resolvedAt: r.resolvedAt,
  createdAt: r.createdAt,
});

export const toAuditLog = (l) => ({
  id: l._id,
  action: l.action,
  targetType: l.targetType,
  targetId: l.targetId,
  summary: l.summary,
  actor: userRef(l.actor),
  createdAt: l.createdAt,
});

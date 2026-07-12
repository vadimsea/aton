/** Преобразование строк Prisma в объекты, совместимые с прежним JSON API. */

function ensureLists(user) {
  if (!user || typeof user !== "object") return;
  if (!Array.isArray(user.friends)) user.friends = [];
  if (!Array.isArray(user.blocked)) user.blocked = [];
  if (!Array.isArray(user.friendRequestsIn)) user.friendRequestsIn = [];
  if (!Array.isArray(user.friendRequestsOut)) user.friendRequestsOut = [];
}

function ensureVerificationFlags(user) {
  if (!user || typeof user !== "object") return;
  if (user.isVerified === undefined) user.isVerified = false;
  if (user.isSuperAdmin === undefined) user.isSuperAdmin = false;
}

function normalizePeerAliases(raw) {
  if (raw == null) return {};
  if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    try {
      const o = JSON.parse(raw);
      return typeof o === "object" && o !== null && !Array.isArray(o) ? o : {};
    } catch {
      return {};
    }
  }
  return {};
}

function userFromPrismaRow(pg) {
  const friends = Array.isArray(pg.friends) ? pg.friends : [];
  const blocked = Array.isArray(pg.blocked) ? pg.blocked : [];
  const friendRequestsIn = Array.isArray(pg.friendRequestsIn) ? pg.friendRequestsIn : [];
  const friendRequestsOut = Array.isArray(pg.friendRequestsOut) ? pg.friendRequestsOut : [];
  return {
    id: pg.id,
    email: pg.email,
    username: pg.username,
    displayName: pg.displayName,
    passwordHash: pg.passwordHash,
    publicId: pg.publicId,
    bio: pg.bio ?? "",
    avatarDataUrl: pg.avatarDataUrl,
    sessionToken: pg.sessionToken,
    createdAt: pg.createdAt ? new Date(pg.createdAt).toISOString() : undefined,
    lastSeen: pg.lastSeen ? new Date(pg.lastSeen).toISOString() : null,
    friends,
    blocked,
    friendRequestsIn,
    friendRequestsOut,
    verified: pg.verified,
    verifyToken: pg.verifyToken,
    resetToken: pg.resetToken,
    resetTokenExp: pg.resetTokenExp ? new Date(pg.resetTokenExp).getTime() : null,
    isVerified: pg.isVerified,
    isSuperAdmin: pg.isSuperAdmin,
    peerAliases: normalizePeerAliases(pg.peerAliases),
  };
}

function chatMembersAdmins(c) {
  let members = c.members;
  let admins = c.admins;
  if (typeof members === "string") {
    try {
      members = JSON.parse(members);
    } catch {
      members = [];
    }
  }
  if (typeof admins === "string") {
    try {
      admins = JSON.parse(admins);
    } catch {
      admins = [];
    }
  }
  return {
    members: Array.isArray(members) ? members : [],
    admins: Array.isArray(admins) ? admins : [],
  };
}

function chatFromPrismaRow(c) {
  const { members, admins } = chatMembersAdmins(c);
  return {
    id: c.id,
    type: c.type,
    title: c.title,
    description: c.description,
    owner: c.owner,
    ownerId: c.ownerId,
    visibility: c.visibility === "private" ? "private" : "public",
    inviteToken: c.inviteToken,
    verified: c.verified === undefined ? false : c.verified,
    avatarDataUrl: c.avatarDataUrl,
    createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : undefined,
    members,
    admins,
  };
}

/**
 * @param {object} m — строка Message из Prisma (можно без imageDataUrl/audioDataUrl при select).
 * @param {{ omitMedia?: boolean }} [opts] — если omitMedia, обнулить медиа (редко нужно при отдельном select).
 */
function messageFromPrismaRow(m, opts = {}) {
  const omitMedia = opts.omitMedia === true;
  let reactions = m.reactions;
  if (typeof reactions === "string") {
    try {
      reactions = JSON.parse(reactions);
    } catch {
      reactions = [];
    }
  }
  let replyTo = m.replyTo;
  if (typeof replyTo === "string") {
    try {
      replyTo = JSON.parse(replyTo);
    } catch {
      replyTo = null;
    }
  }
  const st = m.status;
  const img = omitMedia ? null : m.imageDataUrl ?? null;
  const aud = omitMedia ? null : m.audioDataUrl ?? null;
  return {
    id: m.id,
    chatId: m.chatId,
    from: m.senderUsername,
    senderUsername: m.senderUsername,
    senderDisplayName: m.senderDisplayName ?? undefined,
    senderAvatarDataUrl: m.senderAvatarDataUrl ?? undefined,
    to: m.recipientUsername,
    recipientUsername: m.recipientUsername,
    type: m.type,
    text: m.text ?? "",
    imageDataUrl: img,
    audioDataUrl: aud,
    time: m.createdAt ? new Date(m.createdAt).toISOString() : undefined,
    createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : undefined,
    updatedAt: m.updatedAt ? new Date(m.updatedAt).toISOString() : null,
    editedAt: m.editedAt ? new Date(m.editedAt).toISOString() : null,
    replyTo: replyTo == null ? null : replyTo,
    pinned: Boolean(m.pinned),
    reactions: Array.isArray(reactions) ? reactions : [],
    status: st === "delivered" || st === "read" || st === "sent" ? st : "sent",
  };
}

async function generateUniquePublicId(prisma, baseUsername) {
  const normalized = (baseUsername || "user").toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const base = normalized && normalized.length >= 3 ? normalized : "aton";
  let candidate = base;
  let counter = 1;
  for (;;) {
    const ex = await prisma.user.findUnique({ where: { publicId: candidate } });
    if (!ex) return candidate;
    counter += 1;
    candidate = `${base}${counter}`;
  }
}

module.exports = {
  ensureLists,
  ensureVerificationFlags,
  userFromPrismaRow,
  chatFromPrismaRow,
  chatMembersAdmins,
  messageFromPrismaRow,
  generateUniquePublicId,
};

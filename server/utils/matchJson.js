const mongoose = require('mongoose');

function matchHostIdString(doc) {
  if (!doc.hostId) return undefined;
  const h = doc.hostId;
  if (h && typeof h === 'object' && !(h instanceof mongoose.Types.ObjectId)) {
    return h._id ? h._id.toString() : String(h.id || '');
  }
  return h.toString();
}

function matchJsonWithHost(doc, options = {}) {
  const viewerUserId = options.viewerUserId;
  const j = doc.toJSON();
  const hostIdStr = matchHostIdString(doc);
  const pids = doc.participantIds || [];
  const legacy = Number(j.currentPlayers ?? 0);
  const cp = Array.isArray(pids) && pids.length > 0 ? pids.length : legacy;

  let viewerJoined = false;
  if (
    viewerUserId &&
    mongoose.Types.ObjectId.isValid(String(viewerUserId)) &&
    Array.isArray(pids)
  ) {
    const v = new mongoose.Types.ObjectId(String(viewerUserId));
    viewerJoined = pids.some((p) => {
      if (!p) return false;
      // Khi populate('participantIds'), p có thể là document user.
      if (typeof p === 'object' && p._id) return String(p._id) === String(v);
      if (typeof p === 'object' && p.equals) return p.equals(v);
      return String(p) === String(viewerUserId);
    });
  }

  let host = null;
  if (doc.populated('hostId') && doc.hostId) {
    const h = doc.hostId.toJSON();
    host = {
      id: h.id,
      name: h.name || h.username || 'Host',
      username: h.username,
      avatar: h.avatar,
      matchesPlayed: h.stats?.matchesPlayed ?? 0,
      winRate: h.stats?.winRate ?? 50,
    };
  }

  const participants = Array.isArray(doc.participantIds)
    ? doc.participantIds.map((u) => {
        if (!u) return null;
        if (typeof u === 'object' && u._id) {
          const uj = typeof u.toJSON === 'function' ? u.toJSON() : u;
          return {
            id: uj.id ?? String(uj._id),
            name: uj.name || uj.username,
            username: uj.username,
            avatar: uj.avatar,
          };
        }
        return { id: u.toString() };
      }).filter(Boolean)
    : [];

  const winners = Array.isArray(doc.winners)
    ? doc.winners.map((w) => {
        if (!w) return null;
        if (typeof w === 'object' && w._id) return w._id.toString();
        if (typeof w === 'object' && w.toString) return w.toString();
        return null;
      }).filter(Boolean)
    : [];

  delete j.hostId;
  delete j.participantIds;
  delete j.winners;
  return {
    ...j,
    host,
    hostId: hostIdStr,
    currentPlayers: cp,
    viewerJoined,
    participants,
    winners,
  };
}

module.exports = {
  matchHostIdString,
  matchJsonWithHost,
};

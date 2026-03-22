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
    viewerJoined = pids.some((p) => p.equals(v));
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
  delete j.hostId;
  delete j.participantIds;
  return { ...j, host, hostId: hostIdStr, currentPlayers: cp, viewerJoined };
}

module.exports = {
  matchHostIdString,
  matchJsonWithHost,
};

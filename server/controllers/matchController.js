const mongoose = require('mongoose');
const User = require('../models/User');
const Match = require('../models/Match');
const { matchJsonWithHost } = require('../utils/matchJson');

function parseTimeToMinutesRange(timeStr) {
  const s = String(timeStr || '').trim();
  if (!s) return null;

  const range = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(s);
  if (range) {
    const startH = Number(range[1]);
    const startM = Number(range[2]);
    const endH = Number(range[3]);
    const endM = Number(range[4]);
    const start = startH * 60 + startM;
    const end = endH * 60 + endM;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    return { start, end };
  }

  const one = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (one) {
    const startH = Number(one[1]);
    const startM = Number(one[2]);
    const start = startH * 60 + startM;
    const end = start + 60;
    if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
    return { start, end };
  }

  return null;
}

function rangesOverlap(a, b) {
  if (!a || !b) return false;
  return a.start < b.end && b.start < a.end;
}

async function listMatches(_req, res) {
  try {
    const matches = await Match.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('hostId', 'name username avatar stats')
      .populate('participantIds', 'name username avatar');
    return res.json(matches.map((m) => matchJsonWithHost(m)));
  } catch (error) {
    console.error('❌ GET /api/matches:', error);
    return res.status(500).json({ error: 'Không lấy được danh sách trận' });
  }
}

async function listMine(req, res) {
  try {
    const userId = req.query.userId || req.query.hostId;
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ error: 'Thiếu hoặc sai userId (hoặc hostId)' });
    }
    const uid = new mongoose.Types.ObjectId(String(userId));
    const matches = await Match.find({
      $or: [{ hostId: uid }, { participantIds: uid }],
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('hostId', 'name username avatar stats')
      .populate('participantIds', 'name username avatar');
    const viewer = String(userId);
    return res.json(
      matches.map((m) => matchJsonWithHost(m, { viewerUserId: viewer })),
    );
  } catch (error) {
    console.error('❌ GET /api/matches/mine', error);
    return res.status(500).json({ error: 'Không lấy được trận của bạn' });
  }
}

async function getMatch(req, res) {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID không hợp lệ' });
    }
    const doc = await Match.findById(id)
      .populate('hostId', 'name username avatar stats')
      .populate('participantIds', 'name username avatar');
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy trận' });
    }
    const viewerUserId = req.query.userId;
    return res.json(
      matchJsonWithHost(doc, {
        viewerUserId:
          viewerUserId && mongoose.Types.ObjectId.isValid(String(viewerUserId))
            ? String(viewerUserId)
            : undefined,
      }),
    );
  } catch (error) {
    console.error('❌ GET /api/matches/:id', error);
    return res.status(500).json({ error: 'Không lấy được trận' });
  }
}

async function checkJoinMatch(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID trận không hợp lệ' });
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ error: 'Thiếu hoặc sai userId' });
    }

    const doc = await Match.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy trận' });
    }
    if ((doc.status ?? 'active') !== 'active') {
      return res.status(400).json({ error: 'Trận này không còn mở để tham gia' });
    }

    const uid = new mongoose.Types.ObjectId(String(userId));
    const docTime = parseTimeToMinutesRange(doc.time);

    const alreadyJoined = Array.isArray(doc.participantIds)
      ? doc.participantIds.some((p) => p.equals(uid))
      : false;
    if (alreadyJoined) {
      return res.json({
        allow: true,
        reason: 'none',
        alreadyJoined: true,
        conflicts: [],
      });
    }

    const conflicts = await Match.find({
      _id: { $ne: doc._id },
      date: doc.date,
      $and: [
        { $or: [{ status: 'active' }, { status: { $exists: false } }] },
        { $or: [{ hostId: uid }, { participantIds: uid }] },
      ],
    }).select('title time');

    const conflictsWithOverlap = conflicts
      .map((m) => {
        const mTime = parseTimeToMinutesRange(m.time);
        return {
          id: m._id.toString(),
          title: m.title,
          time: m.time,
          overlap: rangesOverlap(docTime, mTime),
        };
      })
      .filter(Boolean);

    const overlapping = conflictsWithOverlap.filter((x) => x.overlap);
    if (overlapping.length > 0) {
      return res.json({
        allow: false,
        reason: 'overlap',
        conflicts: overlapping,
      });
    }

    if (conflictsWithOverlap.length > 0) {
      return res.json({
        allow: true,
        reason: 'hasOtherMatch',
        conflicts: conflictsWithOverlap,
      });
    }

    return res.json({ allow: true, reason: 'none', conflicts: [] });
  } catch (error) {
    console.error('❌ POST /api/matches/:id/join/check', error);
    return res.status(500).json({ error: 'Không thể kiểm tra lịch tham gia' });
  }
}

async function joinMatch(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID trận không hợp lệ' });
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ error: 'Thiếu hoặc sai userId' });
    }

    const doc = await Match.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy trận' });
    }
    if ((doc.status ?? 'active') !== 'active') {
      return res.status(400).json({ error: 'Trận này không còn mở để tham gia' });
    }

    const uid = new mongoose.Types.ObjectId(String(userId));
    const pids = doc.participantIds || [];
    const used = pids.length > 0 ? pids.length : Number(doc.currentPlayers ?? 0);

    if (pids.some((p) => p.equals(uid))) {
      await doc.populate('hostId', 'name username avatar stats');
      return res.json(matchJsonWithHost(doc, { viewerUserId: String(userId) }));
    }

    // Chặn trùng khung giờ với các trận khác trong cùng ngày mà user đang liên quan (host hoặc participant).
    const docTime = parseTimeToMinutesRange(doc.time);
    if (docTime) {
      const conflicts = await Match.find({
        _id: { $ne: doc._id },
        date: doc.date,
        $and: [
          { $or: [{ status: 'active' }, { status: { $exists: false } }] },
          { $or: [{ hostId: uid }, { participantIds: uid }] },
        ],
      }).select('time');

      const overlapFound = conflicts.some((m) =>
        rangesOverlap(docTime, parseTimeToMinutesRange(m.time)),
      );
      if (overlapFound) {
        return res.status(400).json({
          error: 'Bạn đã có trận trùng khung giờ trong ngày này. Không thể tham gia.',
        });
      }
    }

    if (used >= doc.maxPlayers) {
      return res.status(400).json({ error: 'Trận đã đủ người' });
    }

    doc.participantIds = [...pids, uid];
    doc.currentPlayers = doc.participantIds.length;
    await doc.save();
    await doc.populate('hostId', 'name username avatar stats');
    await doc.populate('participantIds', 'name username avatar');
    return res.json(matchJsonWithHost(doc, { viewerUserId: String(userId) }));
  } catch (error) {
    console.error('❌ POST /api/matches/:id/join', error);
    return res.status(500).json({ error: 'Không tham gia được trận' });
  }
}

async function leaveMatch(req, res) {
  try {
    const { id } = req.params;
    const { userId } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID trận không hợp lệ' });
    }
    if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
      return res.status(400).json({ error: 'Thiếu hoặc sai userId' });
    }

    const doc = await Match.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy trận' });
    }
    if ((doc.status ?? 'active') !== 'active') {
      return res.status(400).json({ error: 'Trận này không còn mở để rời' });
    }

    const uid = new mongoose.Types.ObjectId(String(userId));
    const pids = doc.participantIds || [];
    const had = pids.some((p) => p.equals(uid));

    if (!had) {
      return res.status(400).json({ error: 'Bạn chưa tham gia trận này' });
    }

    doc.participantIds = pids.filter((p) => !p.equals(uid));
    doc.currentPlayers = doc.participantIds.length;

    await doc.save();
    await doc.populate('hostId', 'name username avatar stats');
    await doc.populate('participantIds', 'name username avatar');
    return res.json(matchJsonWithHost(doc, { viewerUserId: String(userId) }));
  } catch (error) {
    console.error('❌ POST /api/matches/:id/leave', error);
    return res.status(500).json({ error: 'Không rời trận được' });
  }
}

async function patchMatch(req, res) {
  try {
    const { id } = req.params;
    const {
      hostId,
      sport,
      title,
      location,
      date,
      time,
      maxPlayers,
      minSkillLevel,
      description,
      rules,
      status,
      winners,
      cancelReason,
    } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID không hợp lệ' });
    }
    if (!hostId || !mongoose.Types.ObjectId.isValid(String(hostId))) {
      return res.status(400).json({ error: 'Thiếu hoặc sai hostId' });
    }

    const doc = await Match.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy trận' });
    }
    const prevStatus = doc.status;
    if (!doc.hostId.equals(new mongoose.Types.ObjectId(String(hostId)))) {
      return res.status(403).json({ error: 'Chỉ host mới được sửa trận' });
    }

    const pids = doc.participantIds || [];
    const used = pids.length > 0 ? pids.length : Number(doc.currentPlayers ?? 0);
    const participantIdStrs = (doc.participantIds || []).map((p) => String(p));

    if (status !== undefined) {
      const next = String(status);
      if (!['active', 'finished', 'cancelled'].includes(next)) {
        return res.status(400).json({ error: 'Trạng thái không hợp lệ' });
      }

      if (next === 'finished') {
        if (!Array.isArray(winners) || winners.length === 0) {
          return res.status(400).json({ error: 'Kết thúc trận cần chọn người thắng' });
        }
        const winnerIds = winners.map((w) => String(w).trim());
        for (const wid of winnerIds) {
          if (!mongoose.Types.ObjectId.isValid(wid)) {
            return res.status(400).json({ error: 'Danh sách người thắng không hợp lệ' });
          }
        }
        if (participantIdStrs.length === 0) {
          return res.status(400).json({ error: 'Trận chưa có người tham gia' });
        }
        const notInMatch = winnerIds.filter((wid) => !participantIdStrs.includes(wid));
        if (notInMatch.length > 0) {
          return res.status(400).json({ error: 'Người thắng phải thuộc danh sách người tham gia' });
        }

        doc.status = 'finished';
        doc.winners = winnerIds.map((wid) => new mongoose.Types.ObjectId(wid));
        doc.cancelReason = '';
      } else if (next === 'cancelled') {
        const reason = String(cancelReason || '').trim();
        if (!reason || reason.length < 5) {
          return res.status(400).json({ error: 'Hủy trận cần nhập lý do (ít nhất 5 ký tự)' });
        }
        doc.status = 'cancelled';
        doc.winners = [];
        doc.cancelReason = reason;
      } else {
        // active
        doc.status = 'active';
        doc.winners = [];
        doc.cancelReason = '';
      }
    }

    if (sport !== undefined) {
      const sportTrim = String(sport || '').trim();
      if (!sportTrim) {
        return res.status(400).json({ error: 'Vui lòng chọn môn thể thao' });
      }
      doc.sport = sportTrim;
    }
    if (title !== undefined) {
      const titleTrim = String(title || '').trim();
      if (titleTrim.length < 2) {
        return res.status(400).json({ error: 'Tiêu đề cần ít nhất 2 ký tự' });
      }
      doc.title = titleTrim;
    }
    if (location !== undefined) {
      const locationTrim = String(location || '').trim();
      if (!locationTrim) {
        return res.status(400).json({ error: 'Vui lòng nhập địa điểm' });
      }
      doc.location = locationTrim;
    }
    if (date !== undefined) {
      const dateStr = String(date || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return res.status(400).json({ error: 'Ngày không hợp lệ (dùng yyyy-mm-dd)' });
      }
      doc.date = dateStr;
    }
    if (time !== undefined) {
      doc.time = String(time || '').trim();
    }
    if (maxPlayers !== undefined) {
      const maxN = Number(maxPlayers);
      if (!Number.isFinite(maxN) || maxN < 1 || maxN > 999) {
        return res.status(400).json({ error: 'Số người phải từ 1 đến 999' });
      }
      const rounded = Math.round(maxN);
      if (rounded < used) {
        return res.status(400).json({
          error: `Số người tối đa không được nhỏ hơn số người đã tham gia (${used})`,
        });
      }
      doc.maxPlayers = rounded;
    }
    if (minSkillLevel !== undefined) {
      doc.minSkillLevel = String(minSkillLevel || '').trim() || 'Tất Cả';
    }
    if (description !== undefined) {
      doc.description = String(description || '').trim();
    }
    if (rules !== undefined) {
      doc.rules = String(rules || '').trim();
    }

    await doc.save();

    // Nếu host chuyển trận từ active -> finished thì cập nhật thống kê tất cả người tham gia.
    // - matchesPlayed: tăng 1 cho host + mọi participant trong trận.
    // - matchesWon/winRate: tăng nếu user nằm trong winners.
    if (doc.status === 'finished' && prevStatus !== 'finished') {
      const winnerSet = new Set(
        (Array.isArray(doc.winners) ? doc.winners : []).map((w) => String(w)),
      );

      const docDurationHours = (() => {
        const r = parseTimeToMinutesRange(doc.time);
        if (!r) return 0;
        const hours = (r.end - r.start) / 60;
        return Math.round(hours * 10) / 10;
      })();

      const participantIdSet = new Set(
        [
          ...((doc.participantIds || []).map((p) => String(p)) || []),
          String(doc.hostId),
        ].filter(Boolean),
      );

      const userIds = Array.from(participantIdSet);
      const users = await User.find({ _id: { $in: userIds } });

      for (const u of users) {
        const uid = String(u._id);
        const played = Number(u.stats?.matchesPlayed ?? 0);
        const won = Number(u.stats?.matchesWon ?? 0);

        const newPlayed = played + 1;
        const newWon = won + (winnerSet.has(uid) ? 1 : 0);
        const newWinRate =
          newPlayed > 0 ? Math.round((newWon / newPlayed) * 100) : 0;

        u.stats.matchesPlayed = newPlayed;
        u.stats.matchesWon = newWon;
        u.stats.winRate = newWinRate;
        if (docDurationHours > 0) {
          const curHours = Number(u.stats?.hoursActive ?? 0);
          u.stats.hoursActive = curHours + docDurationHours;
        }
        await u.save();
      }
    }

    await doc.populate('hostId', 'name username avatar stats');
    await doc.populate('participantIds', 'name username avatar');
    return res.json(matchJsonWithHost(doc, { viewerUserId: String(hostId) }));
  } catch (error) {
    console.error('❌ PATCH /api/matches/:id', error);
    return res.status(500).json({ error: 'Cập nhật trận thất bại' });
  }
}

async function deleteMatch(req, res) {
  try {
    const { id } = req.params;
    const { hostId } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID không hợp lệ' });
    }
    if (!hostId || !mongoose.Types.ObjectId.isValid(String(hostId))) {
      return res.status(400).json({ error: 'Thiếu hoặc sai hostId' });
    }

    const doc = await Match.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy trận' });
    }
    if (!doc.hostId.equals(new mongoose.Types.ObjectId(String(hostId)))) {
      return res.status(403).json({ error: 'Chỉ host mới được xóa trận' });
    }

    await Match.findByIdAndDelete(id);
    return res.status(204).send();
  } catch (error) {
    console.error('❌ DELETE /api/matches/:id', error);
    return res.status(500).json({ error: 'Xóa trận thất bại' });
  }
}

async function createMatch(req, res) {
  try {
    const {
      hostId,
      sport,
      title,
      location,
      date,
      time,
      maxPlayers,
      minSkillLevel,
      description,
      rules,
    } = req.body;

    if (!hostId || !mongoose.Types.ObjectId.isValid(String(hostId))) {
      return res.status(400).json({ error: 'Thiếu hoặc sai hostId (người tạo trận)' });
    }

    const host = await User.findById(hostId);
    if (!host) {
      return res.status(400).json({ error: 'Không tìm thấy người dùng' });
    }

    const sportTrim = String(sport || '').trim();
    if (!sportTrim) {
      return res.status(400).json({ error: 'Vui lòng chọn môn thể thao' });
    }

    const titleTrim = String(title || '').trim();
    if (titleTrim.length < 2) {
      return res.status(400).json({ error: 'Tiêu đề cần ít nhất 2 ký tự' });
    }

    const locationTrim = String(location || '').trim();
    if (!locationTrim) {
      return res.status(400).json({ error: 'Vui lòng nhập địa điểm' });
    }

    const dateStr = String(date || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return res.status(400).json({ error: 'Ngày không hợp lệ (dùng yyyy-mm-dd)' });
    }

    const maxN = Number(maxPlayers);
    if (!Number.isFinite(maxN) || maxN < 1 || maxN > 999) {
      return res.status(400).json({ error: 'Số người phải từ 1 đến 999' });
    }

    const minSkillTrim = String(minSkillLevel || '').trim() || 'Tất Cả';

    const match = await Match.create({
      hostId,
      sport: sportTrim,
      title: titleTrim,
      location: locationTrim,
      date: dateStr,
      time: String(time || '').trim(),
      maxPlayers: Math.round(maxN),
      minSkillLevel: minSkillTrim,
      description: String(description || '').trim(),
      rules: String(rules || '').trim(),
    });

    console.log(`✅ Match created: ${match.id} by host ${hostId}`);
    return res.status(201).json(match.toJSON());
  } catch (error) {
    console.error('❌ POST /api/matches:', error);
    return res.status(500).json({ error: 'Tạo trận đấu thất bại' });
  }
}

module.exports = {
  listMatches,
  listMine,
  getMatch,
  checkJoinMatch,
  joinMatch,
  leaveMatch,
  patchMatch,
  deleteMatch,
  createMatch,
};

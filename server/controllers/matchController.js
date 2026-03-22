const mongoose = require('mongoose');
const User = require('../models/User');
const Match = require('../models/Match');
const { matchJsonWithHost } = require('../utils/matchJson');

async function listMatches(_req, res) {
  try {
    const matches = await Match.find()
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('hostId', 'name username avatar stats');
    return res.json(matches.map((m) => matchJsonWithHost(m)));
  } catch (error) {
    console.error('❌ GET /api/matches:', error);
    return res.status(500).json({ error: 'Không lấy được danh sách trận' });
  }
}

async function listMine(req, res) {
  try {
    const hostId = req.query.hostId;
    if (!hostId || !mongoose.Types.ObjectId.isValid(String(hostId))) {
      return res.status(400).json({ error: 'Thiếu hoặc sai hostId' });
    }
    const matches = await Match.find({ hostId })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate('hostId', 'name username avatar stats');
    return res.json(matches.map((m) => matchJsonWithHost(m)));
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
    const doc = await Match.findById(id).populate('hostId', 'name username avatar stats');
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

    const uid = new mongoose.Types.ObjectId(String(userId));
    const pids = doc.participantIds || [];
    const used = pids.length > 0 ? pids.length : Number(doc.currentPlayers ?? 0);

    if (pids.some((p) => p.equals(uid))) {
      await doc.populate('hostId', 'name username avatar stats');
      return res.json(matchJsonWithHost(doc, { viewerUserId: String(userId) }));
    }

    if (used >= doc.maxPlayers) {
      return res.status(400).json({ error: 'Trận đã đủ người' });
    }

    doc.participantIds = [...pids, uid];
    doc.currentPlayers = doc.participantIds.length;
    await doc.save();
    await doc.populate('hostId', 'name username avatar stats');
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
    if (!doc.hostId.equals(new mongoose.Types.ObjectId(String(hostId)))) {
      return res.status(403).json({ error: 'Chỉ host mới được sửa trận' });
    }

    const pids = doc.participantIds || [];
    const used = pids.length > 0 ? pids.length : Number(doc.currentPlayers ?? 0);

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
    await doc.populate('hostId', 'name username avatar stats');
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
  joinMatch,
  leaveMatch,
  patchMatch,
  deleteMatch,
  createMatch,
};

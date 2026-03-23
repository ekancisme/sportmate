const mongoose = require('mongoose');

const User = require('../models/User');
const Match = require('../models/Match');
const Venue = require('../models/Venue');
const { matchJsonWithHost } = require('../utils/matchJson');

function assertValidObjectId(id, name = 'id') {
  if (!mongoose.Types.ObjectId.isValid(String(id))) {
    const err = new Error(`Sai ${name}`);
    err.statusCode = 400;
    throw err;
  }
}

async function getStats(_req, res) {
  try {
    const [usersCount, matchesCount, venuesPending, venuesActive, venuesRejected, venuesApproved] =
      await Promise.all([
        User.countDocuments(),
        Match.countDocuments(),
        Venue.countDocuments({ status: 'pending' }),
        Venue.countDocuments({ status: 'active' }),
        Venue.countDocuments({ status: 'rejected' }),
        Venue.countDocuments({ status: 'approved' }),
      ]);

    return res.json({
      usersCount,
      matchesCount,
      venues: {
        pending: venuesPending,
        active: venuesActive + venuesApproved,
        rejected: venuesRejected,
      },
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ GET /api/admin/stats', error);
    return res.status(500).json({ error: 'Không tải được thống kê' });
  }
}

async function listUsers(_req, res) {
  try {
    const users = await User.find()
      .select('name username role isBanned stats avatar location bio email phone age sports schedule')
      .sort({ createdAt: -1 })
      .lean();

    return res.json(
      users.map((u) => ({
        id: u._id.toString(),
        name: u.name || '',
        username: u.username,
        role: u.role,
        isBanned: !!u.isBanned,
        avatar: u.avatar,
        email: u.email || '',
        phone: u.phone || '',
        age: u.age,
        location: u.location,
        bio: u.bio || '',
        sports: Array.isArray(u.sports) ? u.sports : [],
        schedule: Array.isArray(u.schedule) ? u.schedule : [],
        stats: u.stats ?? {},
      })),
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ GET /api/admin/users', error);
    return res.status(500).json({ error: 'Không tải được danh sách user' });
  }
}

async function updateUserRole(req, res) {
  try {
    const { id } = req.params;
    const { role } = req.body || {};
    assertValidObjectId(id, 'userId');

    const nextRole = String(role || '').trim();
    if (!['user', 'admin'].includes(nextRole)) {
      return res.status(400).json({ error: 'role không hợp lệ' });
    }

    const user = await User.findByIdAndUpdate(
      id,
      { role: nextRole },
      { new: true },
    );

    if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });
    return res.json(user.toJSON());
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ PATCH /api/admin/users/:id', error);
    const statusCode = error?.statusCode ?? 500;
    return res.status(statusCode).json({ error: error?.message || 'Cập nhật thất bại' });
  }
}

async function updateUserBan(req, res) {
  try {
    const { id } = req.params;
    const { isBanned } = req.body || {};
    assertValidObjectId(id, 'userId');
    if (typeof isBanned !== 'boolean') {
      return res.status(400).json({ error: 'isBanned phải là boolean' });
    }

    const user = await User.findByIdAndUpdate(id, { isBanned }, { new: true });
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });
    return res.json(user.toJSON());
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ PATCH /api/admin/users/:id/ban', error);
    const statusCode = error?.statusCode ?? 500;
    return res.status(statusCode).json({ error: error?.message || 'Cập nhật ban thất bại' });
  }
}

function allowedVenueStatus(s) {
  const x = String(s || '').trim();
  if (!['pending', 'active', 'approved', 'rejected'].includes(x)) return null;
  if (x === 'approved') return 'active';
  return x;
}

async function assertAdminUser(adminId) {
  assertValidObjectId(adminId, 'adminId');
  const admin = await User.findById(String(adminId)).select('role');
  if (!admin || admin.role !== 'admin') {
    const err = new Error('Không đủ quyền Admin');
    err.statusCode = 403;
    throw err;
  }
}

async function listVenues(req, res) {
  try {
    const { status } = req.query || {};
    const statusVal = status ? allowedVenueStatus(status) : null;
    const filter =
      statusVal === 'active'
        ? { status: { $in: ['active', 'approved'] } }
        : statusVal
          ? { status: statusVal }
          : {};

    const venues = await Venue.find(filter).sort({ createdAt: -1 }).lean();
    return res.json(
      venues.map((v) => ({
        ...v,
        id: v._id.toString(),
        _id: undefined,
        status: v.status === 'approved' ? 'active' : v.status,
      })),
    );
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ GET /api/admin/venues', error);
    return res.status(500).json({ error: 'Không tải được sân cho thuê' });
  }
}

async function listPendingVenues(req, res) {
  req.query.status = 'pending';
  return listVenues(req, res);
}

async function createVenue(req, res) {
  try {
    const {
      ownerId,
      name,
      address,
      sport,
      description,
      pricePerHour,
    } = req.body || {};

    const nameTrim = String(name || '').trim();
    if (nameTrim.length < 2) {
      return res.status(400).json({ error: 'Tên sân không hợp lệ' });
    }

    const price = Number(pricePerHour);
    if (!Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: 'pricePerHour không hợp lệ' });
    }

    let ownerObjectId = undefined;
    if (ownerId != null && ownerId !== '') {
      assertValidObjectId(ownerId, 'ownerId');
      ownerObjectId = new mongoose.Types.ObjectId(String(ownerId));
    }

    const venue = await Venue.create({
      ownerId: ownerObjectId,
      name: nameTrim,
      address: String(address || '').trim(),
      sport: String(sport || '').trim(),
      description: String(description || '').trim(),
      pricePerHour: price,
      status: 'pending',
      rejectReason: '',
    });

    return res.status(201).json(venue.toJSON());
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ POST /api/admin/venues', error);
    const statusCode = error?.statusCode ?? 500;
    return res.status(statusCode).json({ error: error?.message || 'Tạo sân thất bại' });
  }
}

async function updateVenue(req, res) {
  try {
    const { id } = req.params;
    assertValidObjectId(id, 'venueId');

    const {
      ownerId,
      name,
      address,
      sport,
      description,
      pricePerHour,
      status,
      rejectReason,
    } = req.body || {};

    const update = {};

    if (name !== undefined) update.name = String(name).trim();
    if (address !== undefined) update.address = String(address).trim();
    if (sport !== undefined) update.sport = String(sport).trim();
    if (description !== undefined) update.description = String(description).trim();

    if (pricePerHour !== undefined) {
      const p = Number(pricePerHour);
      if (!Number.isFinite(p) || p < 0) return res.status(400).json({ error: 'pricePerHour không hợp lệ' });
      update.pricePerHour = p;
    }

    if (ownerId !== undefined) {
      if (ownerId == null || ownerId === '') {
        update.ownerId = undefined;
      } else {
        assertValidObjectId(ownerId, 'ownerId');
        update.ownerId = new mongoose.Types.ObjectId(String(ownerId));
      }
    }

    if (status !== undefined) {
      const st = allowedVenueStatus(status);
      if (!st) return res.status(400).json({ error: 'status không hợp lệ' });
      update.status = st;
    }

    if (rejectReason !== undefined) {
      update.rejectReason = String(rejectReason || '').trim();
    }

    const venue = await Venue.findByIdAndUpdate(id, update, { new: true });
    if (!venue) return res.status(404).json({ error: 'Không tìm thấy sân' });

    return res.json(venue.toJSON());
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ PATCH /api/admin/venues/:id', error);
    const statusCode = error?.statusCode ?? 500;
    return res.status(statusCode).json({ error: error?.message || 'Cập nhật thất bại' });
  }
}

async function approveVenue(req, res) {
  try {
    const { id } = req.params;
    assertValidObjectId(id, 'venueId');

    const venue = await Venue.findByIdAndUpdate(
      id,
      { status: 'active', rejectReason: '' },
      { new: true },
    );
    if (!venue) return res.status(404).json({ error: 'Không tìm thấy sân' });
    return res.json(venue.toJSON());
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ PATCH /api/admin/venues/:id/approve', error);
    const statusCode = error?.statusCode ?? 500;
    return res.status(statusCode).json({ error: error?.message || 'Duyệt thất bại' });
  }
}

async function rejectVenue(req, res) {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};
    assertValidObjectId(id, 'venueId');

    const venue = await Venue.findByIdAndUpdate(
      id,
      { status: 'rejected', rejectReason: String(reason || '').trim() },
      { new: true },
    );
    if (!venue) return res.status(404).json({ error: 'Không tìm thấy sân' });
    return res.json(venue.toJSON());
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ PATCH /api/admin/venues/:id/reject', error);
    const statusCode = error?.statusCode ?? 500;
    return res.status(statusCode).json({ error: error?.message || 'Từ chối thất bại' });
  }
}

async function patchAdminMatch(req, res) {
  try {
    const { id } = req.params;
    const {
      adminId,
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

    await assertAdminUser(adminId);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID không hợp lệ' });
    }

    const doc = await Match.findById(id);
    if (!doc) {
      return res.status(404).json({ error: 'Không tìm thấy trận' });
    }

    const prevStatus = doc.status;

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

        const participantIdStrs = (doc.participantIds || []).map((p) => String(p));
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
        doc.status = 'active';
        doc.winners = [];
        doc.cancelReason = '';
      }
    }

    if (sport !== undefined) {
      const sportTrim = String(sport || '').trim();
      if (!sportTrim) return res.status(400).json({ error: 'Vui lòng chọn môn thể thao' });
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
      if (!locationTrim) return res.status(400).json({ error: 'Vui lòng nhập địa điểm' });
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
      const pids = doc.participantIds || [];
      const used = pids.length > 0 ? pids.length : Number(doc.currentPlayers ?? 0);
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

    if (doc.status === 'finished' && prevStatus !== 'finished') {
      const winnerSet = new Set((Array.isArray(doc.winners) ? doc.winners : []).map((w) => String(w)));

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
        const newWinRate = newPlayed > 0 ? Math.round((newWon / newPlayed) * 100) : 0;

        u.stats.matchesPlayed = newPlayed;
        u.stats.matchesWon = newWon;
        u.stats.winRate = newWinRate;
        await u.save();
      }
    }

    await doc.populate('hostId', 'name username avatar stats');
    await doc.populate('participantIds', 'name username avatar');

    return res.json(matchJsonWithHost(doc, { viewerUserId: String(adminId) }));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ PATCH /api/admin/matches/:id', error);
    const statusCode = error?.statusCode ?? 500;
    return res.status(statusCode).json({ error: error?.message || 'Cập nhật trận thất bại' });
  }
}

module.exports = {
  getStats,
  listUsers,
  updateUserRole,
  updateUserBan,
  listVenues,
  listPendingVenues,
  createVenue,
  updateVenue,
  approveVenue,
  rejectVenue,
  patchAdminMatch,
};


const mongoose = require('mongoose');

const Court = require('../models/Court');
const User = require('../models/User');
const Match = require('../models/Match');
const Venue = require('../models/Venue');
const Report = require('../models/Report');
const { sendMail } = require('../utils/mail');
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
    const [
      usersCount,
      matchesCount,
      venuesPending,
      venuesActive,
      venuesRejected,
      venuesApproved,
      courtsPending,
      courtsActive,
      courtsRejected,
    ] = await Promise.all([
      User.countDocuments(),
      Match.countDocuments(),
      Venue.countDocuments({ status: 'pending' }),
      Venue.countDocuments({ status: 'active' }),
      Venue.countDocuments({ status: 'rejected' }),
      Venue.countDocuments({ status: 'approved' }),
      Court.countDocuments({ approvalStatus: 'pending' }),
      Court.countDocuments({ approvalStatus: 'active' }),
      Court.countDocuments({ approvalStatus: 'rejected' }),
    ]);

    return res.json({
      usersCount,
      matchesCount,
      venues: {
        pending: venuesPending,
        active: venuesActive + venuesApproved,
        rejected: venuesRejected,
      },
      courts: {
        pending: courtsPending,
        active: courtsActive,
        rejected: courtsRejected,
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

    const uid = new mongoose.Types.ObjectId(String(id));

    const user = await User.findByIdAndUpdate(
      id,
      {
        isBanned,
        ...(isBanned ? { schedule: [] } : {}),
      },
      { new: true },
    );
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });

    if (isBanned) await applyBanConsequences(uid);

    return res.json(user.toJSON());
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ PATCH /api/admin/users/:id/ban', error);
    const statusCode = error?.statusCode ?? 500;
    return res.status(statusCode).json({ error: error?.message || 'Cập nhật ban thất bại' });
  }
}

async function applyBanConsequences(uid) {
  // Gỡ user bị ban khỏi tất cả trận đã tham gia.
  const joinedMatches = await Match.find({ participantIds: uid }).select(
    '_id participantIds winners currentPlayers',
  );
  for (const m of joinedMatches) {
    const nextParticipants = (m.participantIds || []).filter((p) => !p.equals(uid));
    const nextWinners = (m.winners || []).filter((w) => !w.equals(uid));
    m.participantIds = nextParticipants;
    m.winners = nextWinners;
    m.currentPlayers = nextParticipants.length;
    await m.save();
  }

  // Nếu là host của trận đang mở, hủy trận để tránh user bị ban vẫn đứng host.
  await Match.updateMany(
    { hostId: uid, status: 'active' },
    {
      $set: {
        status: 'cancelled',
        winners: [],
        cancelReason: 'Trận bị hủy do tài khoản host đã bị khóa bởi quản trị viên',
      },
    },
  );
}

function reportToJson(r) {
  return {
    id: String(r._id),
    reason: r.reason || '',
    status: r.status || 'pending',
    warningSentAt: r.warningSentAt || null,
    warningNote: r.warningNote || '',
    resolvedAt: r.resolvedAt || null,
    resolvedAction: r.resolvedAction || '',
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    match: r.matchId
      ? {
          id: String(r.matchId._id || r.matchId.id || ''),
          title: r.matchId.title || '',
          date: r.matchId.date || '',
          time: r.matchId.time || '',
        }
      : null,
    reporter: r.reporterHostId
      ? {
          id: String(r.reporterHostId._id || r.reporterHostId.id || ''),
          name: r.reporterHostId.name || r.reporterHostId.username || '',
          username: r.reporterHostId.username || '',
          email: r.reporterHostId.email || '',
        }
      : null,
    reportedUser: r.reportedUserId
      ? {
          id: String(r.reportedUserId._id || r.reportedUserId.id || ''),
          name: r.reportedUserId.name || r.reportedUserId.username || '',
          username: r.reportedUserId.username || '',
          email: r.reportedUserId.email || '',
          isBanned: !!r.reportedUserId.isBanned,
        }
      : null,
  };
}

async function listReports(_req, res) {
  try {
    const reports = await Report.find()
      .sort({ createdAt: -1 })
      .populate('matchId', 'title date time')
      .populate('reporterHostId', 'name username email')
      .populate('reportedUserId', 'name username email isBanned')
      .limit(200);
    return res.json(reports.map(reportToJson));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ GET /api/admin/reports', error);
    return res.status(500).json({ error: 'Không tải được danh sách report' });
  }
}

async function getReportDetail(req, res) {
  try {
    const { id } = req.params;
    assertValidObjectId(id, 'reportId');
    const report = await Report.findById(id)
      .populate('matchId', 'title date time')
      .populate('reporterHostId', 'name username email')
      .populate('reportedUserId', 'name username email isBanned');
    if (!report) return res.status(404).json({ error: 'Không tìm thấy report' });
    return res.json(reportToJson(report));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ GET /api/admin/reports/:id', error);
    const statusCode = error?.statusCode ?? 500;
    return res.status(statusCode).json({ error: error?.message || 'Không tải được chi tiết report' });
  }
}

async function sendWarningForReport(req, res) {
  try {
    const { id } = req.params;
    assertValidObjectId(id, 'reportId');

    const report = await Report.findById(id)
      .populate('matchId', 'title date time')
      .populate('reporterHostId', 'name username')
      .populate('reportedUserId', 'name username email isBanned');
    if (!report) return res.status(404).json({ error: 'Không tìm thấy report' });
    if (!report.reportedUserId?.email) {
      return res.status(400).json({ error: 'User bị report chưa có email để gửi cảnh báo' });
    }

    const warningLevel = 1;
    const reportedName = report.reportedUserId?.name || report.reportedUserId?.username || 'Bạn';
    const matchTitle = report.matchId?.title || 'không rõ';
    const reasonText = report.reason || 'Không có';
    const mailText =
      `Xin chào ${reportedName},\n\n` +
      `Đây là CẢNH BÁO LẦN ${warningLevel} từ quản trị viên SportMate.\n` +
      `Hệ thống ghi nhận report liên quan đến hành vi của bạn trong trận "${matchTitle}".\n\n` +
      `Lý do report:\n- ${reasonText}\n\n` +
      `Vui lòng tuân thủ quy định cộng đồng và ứng xử văn minh khi tham gia hoạt động trên SportMate.\n` +
      `Nếu tiếp tục vi phạm, tài khoản của bạn có thể bị hạn chế hoặc khóa vĩnh viễn.\n\n` +
      `Trân trọng,\n` +
      `Đội ngũ SportMate`;
    const mailHtml =
      `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">` +
      `<p>Xin chào <strong>${reportedName}</strong>,</p>` +
      `<p>Đây là <strong>CẢNH BÁO LẦN ${warningLevel}</strong> từ quản trị viên SportMate.</p>` +
      `<p>Hệ thống ghi nhận report liên quan đến hành vi của bạn trong trận <strong>"${matchTitle}"</strong>.</p>` +
      `<p><strong>Lý do report:</strong><br/>- ${reasonText}</p>` +
      `<p>Vui lòng tuân thủ quy định cộng đồng và ứng xử văn minh khi tham gia hoạt động trên SportMate.</p>` +
      `<p>Nếu tiếp tục vi phạm, tài khoản của bạn có thể bị hạn chế hoặc khóa vĩnh viễn.</p>` +
      `<p>Trân trọng,<br/><strong>Đội ngũ SportMate</strong></p>` +
      `</div>`;

    await sendMail({
      to: report.reportedUserId.email,
      subject: `SportMate - Cảnh báo lần ${warningLevel}`,
      text: mailText,
      html: mailHtml,
    });

    report.warningSentAt = new Date();
    report.warningNote = `Cảnh báo lần ${warningLevel} đã gửi tự động theo lý do report`;
    if (report.status === 'pending') report.status = 'reviewed';
    report.resolvedAction = report.resolvedAction || 'warned';
    await report.save();

    return res.json({
      ok: true,
      message: 'Gửi cảnh báo qua email thành công',
      report: reportToJson(report),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ POST /api/admin/reports/:id/warn', error);
    const statusCode = error?.statusCode ?? 500;
    return res.status(statusCode).json({ error: error?.message || 'Không gửi được cảnh báo' });
  }
}

async function banUserByReport(req, res) {
  try {
    const { id } = req.params;
    assertValidObjectId(id, 'reportId');

    const report = await Report.findById(id)
      .populate('matchId', 'title date time')
      .populate('reporterHostId', 'name username email')
      .populate('reportedUserId', 'name username email isBanned');
    if (!report) return res.status(404).json({ error: 'Không tìm thấy report' });
    if (!report.reportedUserId?._id) {
      return res.status(400).json({ error: 'User bị report không hợp lệ' });
    }

    const uid = new mongoose.Types.ObjectId(String(report.reportedUserId._id));
    if (!report.reportedUserId.isBanned) {
      await User.findByIdAndUpdate(uid, { isBanned: true, schedule: [] }, { new: true });
      await applyBanConsequences(uid);
    }

    report.status = 'resolved';
    report.resolvedAt = new Date();
    report.resolvedAction = 'banned';
    await report.save();

    const refreshed = await Report.findById(id)
      .populate('matchId', 'title date time')
      .populate('reporterHostId', 'name username email')
      .populate('reportedUserId', 'name username email isBanned');

    return res.json(reportToJson(refreshed));
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('❌ POST /api/admin/reports/:id/ban', error);
    const statusCode = error?.statusCode ?? 500;
    return res.status(statusCode).json({ error: error?.message || 'Không ban được user từ report' });
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
  listReports,
  getReportDetail,
  sendWarningForReport,
  banUserByReport,
  patchAdminMatch,
};


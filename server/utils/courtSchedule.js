function padTime(value) {
  return String(value).padStart(2, '0');
}

function parseClockToMinutes(value) {
  if (!/^\d{2}:\d{2}$/.test(String(value || ''))) return null;
  const [hours, minutes] = String(value).split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function formatMinutesToClock(totalMinutes) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${padTime(hours)}:${padTime(minutes)}`;
}

function isValidDateKey(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function todayDateKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = padTime(now.getMonth() + 1);
  const day = padTime(now.getDate());
  return `${year}-${month}-${day}`;
}

function normalizeCourtHours({ openTime, closeTime, slotMinutes }) {
  const parsedOpen = parseClockToMinutes(openTime) ?? 6 * 60;
  const parsedClose = parseClockToMinutes(closeTime) ?? 22 * 60;
  const normalizedSlot = Number.isFinite(Number(slotMinutes)) ? Number(slotMinutes) : 60;
  const safeSlotMinutes = normalizedSlot > 0 ? normalizedSlot : 60;

  return {
    openMinutes: parsedOpen,
    closeMinutes: parsedClose > parsedOpen ? parsedClose : parsedOpen + safeSlotMinutes,
    openTime: formatMinutesToClock(parsedOpen),
    closeTime: formatMinutesToClock(parsedClose > parsedOpen ? parsedClose : parsedOpen + safeSlotMinutes),
    slotMinutes: safeSlotMinutes,
  };
}

function buildCourtSlots(config) {
  const hours = normalizeCourtHours(config);
  const slots = [];

  for (
    let startMinutes = hours.openMinutes;
    startMinutes + hours.slotMinutes <= hours.closeMinutes;
    startMinutes += hours.slotMinutes
  ) {
    const endMinutes = startMinutes + hours.slotMinutes;
    slots.push({
      startMinutes,
      endMinutes,
      startTime: formatMinutesToClock(startMinutes),
      endTime: formatMinutesToClock(endMinutes),
    });
  }

  return slots;
}

module.exports = {
  buildCourtSlots,
  formatMinutesToClock,
  isValidDateKey,
  normalizeCourtHours,
  parseClockToMinutes,
  todayDateKey,
};

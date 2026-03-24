/**
 * Migration script: Set approvalStatus = 'active' cho tất cả Court
 * chưa có field approvalStatus (dữ liệu cũ).
 *
 * Chạy: node server/scripts/migrateCourtsApproval.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ Thiếu MONGODB_URI trong .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('✅ Đã kết nối MongoDB');

  const result = await mongoose.connection.db.collection('courts').updateMany(
    { approvalStatus: { $exists: false } },
    { $set: { approvalStatus: 'active', rejectReason: '' } },
  );

  console.log(`✅ Migration hoàn tất:`);
  console.log(`   - Matched:  ${result.matchedCount} sân`);
  console.log(`   - Modified: ${result.modifiedCount} sân`);

  await mongoose.disconnect();
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Migration thất bại:', err);
  process.exit(1);
});

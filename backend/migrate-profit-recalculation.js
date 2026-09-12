/**
 * MIGRATION: Recalculate agentPaidAmount, agentCommissionAmount, grossProfit, netProfit
 * =======================================================================================
 * Lý do: Công thức hoa hồng đại lý đã được PO xác nhận thay đổi ngày 15/03/2026.
 *
 * CÔNG THỨC CŨ (trước 15/03/2026):
 *   agentCommissionAmount = COD - agentQuote×qty - shippingFee  ← sai: phí ship bị trừ vào HH đại lý
 *   grossProfit (external) = agentQuote×qty - supplierCost - returnFee  ← thiếu shippingFee
 *
 * CÔNG THỨC MỚI (xác nhận 15/03/2026):
 *   agentCommissionAmount = COD - agentQuote×qty  ← phí ship công ty tự chịu
 *   grossProfit (external) = agentQuote×qty - supplierCost - shippingFee - returnFee  ← đúng
 *
 * DELTA: các đơn cũ bị thiếu -shippingFee trong grossProfit, và agentCommissionAmount bao gồm cả shippingFee.
 *
 * SCOPE: Chỉ tác động đến đơn có EXTERNAL AGENT và đã trigger payment status.
 *
 * CÁCH CHẠY:
 *   node migrate-profit-recalculation.js           ← dry run (hiển thị impact, không ghi DB)
 *   node migrate-profit-recalculation.js --force   ← ghi thật vào DB
 *
 * QUAN TRỌNG: Backup DB trước khi chạy --force!
 */

const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/smarterp-dev';

const IS_FORCE = process.argv.includes('--force');
const BATCH_SIZE = 100;

// Trạng thái kích hoạt tính lợi nhuận (payment trigger statuses)
// Phải khớp với OrderStatus enum trong constants/test-order2.constants.ts
const PAYMENT_TRIGGER_STATUSES = ['Giao thành công', 'Hàng hoàn', 'Boom'];

// Trạng thái hoàn hàng
const RETURN_STATUSES = ['Hàng hoàn', 'Boom'];

// ─── Fetch payment trigger statuses from DB (dynamic config) ────────────────

async function getPaymentTriggerStatuses(db) {
  try {
    const configs = await db
      .collection('orderstatusconfigs')
      .find({ isPaymentTrigger: true, isActive: { $ne: false } })
      .project({ name: 1 })
      .toArray();
    if (configs.length > 0) {
      const names = configs.map(c => c.name);
      console.log(`📋 Dynamic payment trigger statuses from DB: ${names.join(', ')}`);
      return names;
    }
  } catch (e) {
    // collection may not exist
  }
  console.log(`📋 Using fallback payment trigger statuses: ${PAYMENT_TRIGGER_STATUSES.join(', ')}`);
  return PAYMENT_TRIGGER_STATUSES;
}

async function getReturnStatuses(db) {
  try {
    const configs = await db
      .collection('orderstatusconfigs')
      .find({ isReturn: true, isActive: { $ne: false } })
      .project({ name: 1 })
      .toArray();
    if (configs.length > 0) {
      const names = configs.map(c => c.name);
      console.log(`📋 Dynamic return statuses from DB: ${names.join(', ')}`);
      return names;
    }
  } catch (e) {
    // ignore
  }
  console.log(`📋 Using fallback return statuses: ${RETURN_STATUSES.join(', ')}`);
  return RETURN_STATUSES;
}

// ─── Recalculation logic (mirrors TypeScript service logic) ─────────────────

/**
 * Tính agentCommissionAmount theo công thức MỚI
 * NEW: COD - agentQuote×qty (không trừ shippingFee)
 * Return orders: 0 - agentQuote×qty (clawback)
 */
function calcAgentCommission(order, isReturn) {
  const agentQuote = order.agentQuote || 0;
  const quantity = order.quantity || 1;
  const codAmount = order.codAmount || 0;

  if (isReturn) {
    return 0 - (agentQuote * quantity);
  } else {
    return codAmount - (agentQuote * quantity);
  }
}

/**
 * Tính grossProfit theo công thức MỚI
 * External agent: effectiveCOD - supplierCost - shippingFee - returnFee - agentCommission
 * Internal/no agent: effectiveCOD - supplierCost - shippingFee - returnFee
 *
 * Với external agent:
 *   = COD - (COD - agentQuote×qty) - supplierCost - ship - returnFee
 *   = agentQuote×qty - supplierCost - ship - returnFee
 */
function calcGrossProfit(order, isReturn, agentCommission) {
  const quantity = order.quantity || 1;
  const shippingFee = order.shippingFee || 0;
  const returnFee = order.returnFee || 0;
  const supplierQuote = order.supplierQuote || 0;
  const codAmount = order.codAmount || 0;

  const isReturnable = order.supplierIsReturnableSnapshot !== false; // default true
  const supplierCost = (isReturn && isReturnable) ? 0 : (supplierQuote * quantity);
  const effectiveCod = isReturn ? 0 : codAmount;

  return effectiveCod - supplierCost - shippingFee - returnFee - agentCommission;
}

// ─── Main migration ──────────────────────────────────────────────────────────

async function migrate() {
  console.log('\n══════════════════════════════════════════════════════════════');
  console.log('  MIGRATION: Profit Recalculation (Agent Commission Fix)');
  console.log(`  Mode: ${IS_FORCE ? '🔴 FORCE (writing to DB)' : '🟡 DRY RUN (preview only)'}`);
  console.log('══════════════════════════════════════════════════════════════\n');

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  console.log('✅ Connected to MongoDB\n');

  const db = mongoose.connection.db;
  const ordersCol = db.collection('testorder2s');
  const usersCol = db.collection('users');

  const paymentTriggerStatuses = await getPaymentTriggerStatuses(db);
  const returnStatuses = await getReturnStatuses(db);

  // ── Step 1: Find all external agents ────────────────────────────────────────
  const externalAgents = await usersCol
    .find({ role: 'external_agent' }, { projection: { _id: 1 } })
    .toArray();
  const externalAgentIds = externalAgents.map(a => a._id);

  if (externalAgentIds.length === 0) {
    console.log('⚠️  No external agents found in system. Migration not needed.');
    await mongoose.disconnect();
    return;
  }
  console.log(`👥 Found ${externalAgentIds.length} external agent(s)\n`);

  // ── Step 2: Find affected orders ─────────────────────────────────────────────
  // Orders that:
  // - Have an agentId (linked to external agent)
  // - Have reached a payment trigger status (grossProfit was calculated)
  // No date filter — we rely on per-order delta check to skip already-correct orders
  const affectedQuery = {
    agentId: { $exists: true, $ne: null, $in: externalAgentIds },
    orderStatus: { $in: paymentTriggerStatuses },
    isActive: { $ne: false },
  };

  const totalCount = await ordersCol.countDocuments(affectedQuery);
  console.log(`📦 Total orders matching query (payment-triggered, external agent): ${totalCount}\n`);

  if (totalCount === 0) {
    console.log('✅ No orders to migrate.');
    await mongoose.disconnect();
    return;
  }

  // ── Step 3: Process in batches ───────────────────────────────────────────────
  let processed = 0;
  let skipped = 0;
  let needsUpdate = 0;
  let skip = 0;

  const bulkOps = [];
  const sampleChanges = [];

  console.log(`Processing in batches of ${BATCH_SIZE}...\n`);

  while (true) {
    const batch = await ordersCol
      .find(affectedQuery)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(BATCH_SIZE)
      .toArray();

    if (batch.length === 0) break;

    for (const order of batch) {
      processed++;
      const isReturn = returnStatuses.includes(order.orderStatus);

      // Calculate new values
      const newAgentCommission = calcAgentCommission(order, isReturn);
      const newGrossProfit = calcGrossProfit(order, isReturn, newAgentCommission);
      const advertisingCost = order.advertisingCost || 0;
      const laborCostAllocation = order.laborCostAllocation || 0;
      const otherCostAllocation = order.otherCostAllocation || 0;
      const newNetProfit = newGrossProfit - advertisingCost - laborCostAllocation - otherCostAllocation;

      // Compare with stored values
      const storedAgentCommission = order.agentCommissionAmount ?? null;
      const storedGrossProfit = order.grossProfit ?? 0;
      const storedNetProfit = order.netProfit ?? 0;

      const commissionDelta = storedAgentCommission !== null
        ? Math.abs(newAgentCommission - storedAgentCommission)
        : Math.abs(newAgentCommission - (order.agentPaidAmount || 0));
      const grossProfitDelta = Math.abs(newGrossProfit - storedGrossProfit);

      // Skip if already correct (within 1 VND rounding tolerance)
      if (grossProfitDelta < 1 && commissionDelta < 1) {
        skipped++;
        continue;
      }

      needsUpdate++;

      // Build update fields
      const updateFields = {
        agentCommissionAmount: newAgentCommission,
        grossProfit: newGrossProfit,
        netProfit: newNetProfit,
      };

      // Only update agentPaidAmount if not yet paid (to preserve actual cash flow audit trail)
      if (order.agentPaymentStatus !== 'paid') {
        updateFields.agentPaidAmount = newAgentCommission;
      }

      // Recalculate realizedGrossProfit / realizedNetProfit if order was already realized
      // but realizedAt is very recent (same day as migration) → skip, already correct
      if (order.realizedAt) {
        const supplierPaidAmount = order.supplierPaidAmount || 0;
        // Use the agentPaidAmount that will actually be in effect after migration
        const effectiveAgentPaidAmount = order.agentPaymentStatus === 'paid'
          ? (order.agentPaidAmount || 0)   // Already paid - don't change cash flow
          : newAgentCommission;             // Not yet paid - use new formula
        const newRealizedGross = supplierPaidAmount - effectiveAgentPaidAmount;
        const newRealizedNet = newRealizedGross - advertisingCost - laborCostAllocation - otherCostAllocation;

        const realizedDelta = Math.abs(newRealizedGross - (order.realizedGrossProfit || 0));
        if (realizedDelta >= 1) {
          updateFields.realizedGrossProfit = newRealizedGross;
          updateFields.realizedNetProfit = newRealizedNet;
        }
      }

      // Capture sample for preview (first 5)
      if (sampleChanges.length < 5) {
        sampleChanges.push({
          orderId: order._id.toString(),
          orderStatus: order.orderStatus,
          agentPaymentStatus: order.agentPaymentStatus,
          stored: {
            agentCommissionAmount: storedAgentCommission,
            grossProfit: storedGrossProfit,
            netProfit: storedNetProfit,
          },
          new: {
            agentCommissionAmount: newAgentCommission,
            grossProfit: newGrossProfit,
            netProfit: newNetProfit,
          },
          delta: {
            agentCommission: +(newAgentCommission - (storedAgentCommission ?? 0)).toFixed(0),
            grossProfit: +(newGrossProfit - storedGrossProfit).toFixed(0),
            netProfit: +(newNetProfit - storedNetProfit).toFixed(0),
          },
        });
      }

      if (IS_FORCE) {
        bulkOps.push({
          updateOne: {
            filter: { _id: order._id },
            update: { $set: updateFields },
          },
        });
      }
    }

    skip += batch.length;
    process.stdout.write(`\r  Checked: ${processed}/${totalCount} | Needs update: ${needsUpdate} | Skipped (already correct): ${skipped}`);

    if (!IS_FORCE && batch.length < BATCH_SIZE) break;

    // Execute bulk writes in chunks of 500
    if (IS_FORCE && bulkOps.length >= 500) {
      await ordersCol.bulkWrite(bulkOps, { ordered: false });
      console.log(`\n  💾 Written batch of ${bulkOps.length} updates`);
      bulkOps.length = 0;
    }
  }

  // Final bulk write
  if (IS_FORCE && bulkOps.length > 0) {
    await ordersCol.bulkWrite(bulkOps, { ordered: false });
    console.log(`\n  💾 Written final batch of ${bulkOps.length} updates`);
  }

  console.log('\n\n══════════════════════════════════════════════════════════════');
  console.log('  MIGRATION SUMMARY');
  console.log('══════════════════════════════════════════════════════════════');
  console.log(`  Total orders checked  : ${processed}`);
  console.log(`  Already correct       : ${skipped}`);
  console.log(`  Require update        : ${needsUpdate}`);
  if (IS_FORCE) {
    console.log(`  ✅ Updated in DB      : ${needsUpdate}`);
  } else {
    console.log(`  (DRY RUN — no changes written)`);
  }
  console.log('');

  if (sampleChanges.length > 0) {
    console.log('📋 Sample changes (first 5):');
    for (const s of sampleChanges) {
      console.log(`\n  Order: ${s.orderId}  [${s.orderStatus}] agentPay=${s.agentPaymentStatus}`);
      console.log(`    agentCommissionAmount : ${s.stored.agentCommissionAmount} → ${s.new.agentCommissionAmount}  (Δ${s.delta.agentCommission > 0 ? '+' : ''}${s.delta.agentCommission} VNĐ)`);
      console.log(`    grossProfit           : ${s.stored.grossProfit} → ${s.new.grossProfit}  (Δ${s.delta.grossProfit > 0 ? '+' : ''}${s.delta.grossProfit} VNĐ)`);
      console.log(`    netProfit             : ${s.stored.netProfit} → ${s.new.netProfit}  (Δ${s.delta.netProfit > 0 ? '+' : ''}${s.delta.netProfit} VNĐ)`);
    }
  }

  console.log('\n══════════════════════════════════════════════════════════════');
  if (!IS_FORCE && needsUpdate > 0) {
    console.log('\n  ⚠️  Run with --force to apply changes:');
    console.log('     node migrate-profit-recalculation.js --force\n');
  } else if (IS_FORCE) {
    console.log('\n  ✅ Migration complete!\n');
    console.log('  💡 Next steps:');
    console.log('     1. Restart backend to flush Finance caches');
    console.log('     2. Verify CFO dashboard numbers');
    console.log('     3. Check agent receivable statements\n');
  }

  await mongoose.disconnect();
  console.log('🔌 Disconnected from MongoDB');
}

migrate().catch(err => {
  console.error('\n❌ Migration failed:', err.message);
  process.exit(1);
});

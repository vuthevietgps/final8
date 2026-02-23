// Populate demo agent quotes for all existing products and active agents
// Usage: node scripts/generate-agent-quotes.js

const { MongoClient, ObjectId } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';
const AGENT_ROLES = ['internal_agent', 'external_agent', 'internal_supplier', 'external_supplier'];
const APPROVED_STATUS = 'Đã duyệt';

function calcPrice(baseCost, role) {
  const safeBase = baseCost > 0 ? baseCost : 100000; // fallback when product cost is missing
  const markupMap = {
    internal_agent: 0.12,
    external_agent: 0.22,
    internal_supplier: 0.1,
    external_supplier: 0.18
  };
  const markup = markupMap[role] ?? 0.2;
  const raw = Math.round(safeBase * (1 + markup));
  return Math.max(raw, safeBase + 10000); // keep a minimum margin over cost
}

async function main() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const products = await db
      .collection('products')
      .find({ status: { $in: ['Hoạt động', 'Tạm dừng'] } })
      .project({ name: 1, importPrice: 1, shippingCost: 1, packagingCost: 1 })
      .toArray();

    const agents = await db
      .collection('users')
      .find({ role: { $in: AGENT_ROLES }, isActive: { $ne: false } })
      .project({ fullName: 1, email: 1, role: 1 })
      .toArray();

    if (!products.length) {
      console.log('⚠️  No products found. Aborting.');
      return;
    }

    if (!agents.length) {
      console.log('⚠️  No agents found (roles: internal/external agent or supplier). Aborting.');
      return;
    }

    const quotesCol = db.collection('quotes');
    const summary = { inserted: 0, updated: 0, products: products.length, agents: agents.length };

    const validFrom = new Date();
    validFrom.setHours(0, 0, 0, 0);
    const validUntil = new Date(validFrom.getTime() + 180 * 24 * 60 * 60 * 1000); // ~6 months

    for (const product of products) {
      const baseCost = (product.importPrice || 0) + (product.shippingCost || 0) + (product.packagingCost || 0);
      const productName = product.name || 'Unnamed Product';

      for (const agent of agents) {
        const unitPrice = calcPrice(baseCost, agent.role);
        const agentName = agent.fullName || agent.email || 'Unnamed Agent';

        const existing = await quotesCol.findOne({
          productId: product._id,
          agentId: agent._id,
          isActive: { $ne: false }
        });

        const doc = {
          productId: product._id,
          agentId: agent._id,
          product: productName,
          agentName,
          unitPrice,
          status: APPROVED_STATUS,
          validFrom,
          validUntil,
          notes: `Demo quote auto-generated for ${agentName}`,
          isActive: true,
          updatedAt: new Date()
        };

        if (existing) {
          await quotesCol.updateOne({ _id: existing._id }, { $set: doc });
          summary.updated += 1;
        } else {
          await quotesCol.insertOne({ ...doc, _id: new ObjectId(), createdAt: new Date() });
          summary.inserted += 1;
        }
      }
    }

    console.log('📊 Agent quote generation done:');
    console.log(`   Products scanned : ${summary.products}`);
    console.log(`   Agents processed : ${summary.agents}`);
    console.log(`   Quotes inserted  : ${summary.inserted}`);
    console.log(`   Quotes updated   : ${summary.updated}`);
    console.log('\nRun completed.');
  } catch (err) {
    console.error('❌ Error while generating agent quotes:', err.message);
  } finally {
    await client.close();
    console.log('🔌 MongoDB connection closed');
  }
}

main();

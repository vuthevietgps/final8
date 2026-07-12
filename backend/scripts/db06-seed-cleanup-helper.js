const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const DEFAULT_TAG = 'db06';
const TARGET_ORDER_COUNT = 240;
const PROTECTED_ORDER_COUNT = 36;
const TARGET_OTHER_COST_COUNT = 120;
const PROTECTED_OTHER_COST_COUNT = 24;
const TARGET_CHAT_RECENT_COUNT = 160;
const TARGET_CHAT_AGED_COUNT = 24;
const PROTECTED_CHAT_RECENT_COUNT = 48;
const TARGET_MEDIA_COUNT = 18;
const PROTECTED_MEDIA_COUNT = 6;
const TARGET_MEDIA_ORPHAN_COUNT = 8;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PUBLIC_BASE = '/media';

function stateFilePath(tag) {
  return path.join(__dirname, `.db06-seed-state-${tag}.json`);
}

function slugifyTag(tag) {
  return String(tag || DEFAULT_TAG)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || DEFAULT_TAG;
}

function loadMongoUri() {
  const fromEnv = String(process.env.MONGODB_URI || '').trim();
  if (fromEnv) {
    return fromEnv.replace(/^['"]|['"]$/g, '');
  }

  const candidates = [
    path.resolve(__dirname, '..', '.env'),
    path.resolve(__dirname, '..', '..', '.env'),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    const envContent = fs.readFileSync(candidate, 'utf8');
    const match = envContent.match(/^\s*MONGODB_URI\s*=\s*(.+)\s*$/m);
    if (match && match[1]) {
      return match[1].trim().replace(/^['"]|['"]$/g, '');
    }
  }

  throw new Error('MONGODB_URI is required for DB-06 seed cleanup helper.');
}

function loadMediaDir(tag) {
  const explicit = process.env.DB06_MEDIA_DIR || process.env.MEDIA_DIR;
  const resolved = explicit
    ? path.resolve(explicit)
    : path.resolve(
    path.resolve(__dirname, '..', '..'),
    'tests',
    'backend',
    'artifacts',
    'results',
    `tmp-db06-media-${slugifyTag(tag)}`,
  );
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

function loadState(tag) {
  const file = stateFilePath(tag);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    throw new Error(`Failed to parse DB-06 state file ${file}: ${error.message}`);
  }
}

function saveState(tag, state) {
  fs.writeFileSync(stateFilePath(tag), JSON.stringify(state, null, 2), 'utf8');
}

function deleteState(tag) {
  const file = stateFilePath(tag);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

function toObjectId(value) {
  return value instanceof mongoose.Types.ObjectId ? value : new mongoose.Types.ObjectId(value);
}

async function withDb(work) {
  await mongoose.connect(loadMongoUri(), { serverSelectionTimeoutMS: 15000 });
  try {
    return await work(mongoose.connection.db);
  } finally {
    await mongoose.disconnect();
  }
}

function collectionMap(db) {
  return {
    orders: db.collection('ordertest2'),
    otherCosts: db.collection('othercosts'),
    chatMessages: db.collection('chatmessages'),
    conversations: db.collection('conversations'),
    media: db.collection('media'),
    fanpages: db.collection('fanpages'),
  };
}

function makeNamespaces(tag) {
  const slug = slugifyTag(tag);
  return {
    tag: slug,
    target: {
      slug: `db06-target-${slug}`,
      adGroupId: `DB06-TARGET-ADG-${slug}`.slice(0, 50),
      customerPrefix: `DB06 TARGET ${slug}`,
      otherCostNote: `DB06 TARGET ${slug}`,
      senderPrefix: `db06-target-${slug}`,
      mediaTag: `db06-target-${slug}`,
      fanpagePageId: `DB06-TARGET-PAGE-${slug}`.slice(0, 50),
      fanpageName: `DB06 Target Fanpage ${slug}`,
    },
    protected: {
      slug: `db06-protected-${slug}`,
      adGroupId: `DB06-PROTECTED-ADG-${slug}`.slice(0, 50),
      customerPrefix: `DB06 PROTECTED ${slug}`,
      otherCostNote: `DB06 PROTECTED ${slug}`,
      senderPrefix: `db06-protected-${slug}`,
      mediaTag: `db06-protected-${slug}`,
      fanpagePageId: `DB06-PROTECTED-PAGE-${slug}`.slice(0, 50),
      fanpageName: `DB06 Protected Fanpage ${slug}`,
    },
  };
}

function makeMediaEntry(mediaDir, fileName, contentSeed) {
  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const folder = path.join(mediaDir, year, month);
  fs.mkdirSync(folder, { recursive: true });
  const absPath = path.join(folder, fileName);
  fs.writeFileSync(absPath, Buffer.from(`DB06:${contentSeed}:${fileName}`, 'utf8'));
  return {
    absPath,
    url: `${PUBLIC_BASE}/${year}/${month}/${fileName}`.replace(/\\/g, '/'),
    fileName,
  };
}

function buildOrderDocs(namespace, count, baseDate) {
  return Array.from({ length: count }, (_, index) => {
    const orderDate = new Date(baseDate.getTime() - index * 30000);
    return {
      _id: new mongoose.Types.ObjectId(),
      customerName: `${namespace.customerPrefix} ORDER ${String(index + 1).padStart(3, '0')}`,
      quantity: 1 + (index % 3),
      adGroupId: namespace.adGroupId,
      isActive: true,
      productionStatus: 'QA-DB06-SEEDED',
      orderStatus: 'QA-DB06-OPEN',
      serviceDetails: `${namespace.slug} service payload ${index + 1}`,
      receiverAddress: `${namespace.slug} address ${index + 1}`,
      depositAmount: 0,
      codAmount: 120000 + (index * 700),
      manualPayment: 0,
      shippingFee: 15000,
      returnFee: 7000,
      orderDate,
      createdAt: orderDate,
      updatedAt: orderDate,
    };
  });
}

function buildOtherCostDocs(namespace, count, baseDate) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(baseDate.getTime() - index * 60000);
    const dueDate = new Date(baseDate.getTime() + ((index % 14) * MS_PER_DAY));
    return {
      _id: new mongoose.Types.ObjectId(),
      date,
      dueDate,
      amount: 250000 + (index * 5000),
      category: index % 2 === 0 ? 'utilities' : 'tools',
      notes: `${namespace.otherCostNote} COST ${String(index + 1).padStart(3, '0')}`,
      isConfirmed: index % 5 === 0,
      confirmedAt: index % 5 === 0 ? date : undefined,
      createdAt: date,
      updatedAt: date,
    };
  });
}

function buildChatDocs(namespace, fanpageId, recentCount, agedCount, baseDate) {
  const recentMessages = [];
  const recentConversations = new Map();

  for (let index = 0; index < recentCount; index++) {
    const senderPsid = `${namespace.senderPrefix}-recent-${String((index % 8) + 1).padStart(2, '0')}`;
    const createdAt = new Date(baseDate.getTime() - index * 15000);
    recentMessages.push({
      _id: new mongoose.Types.ObjectId(),
      fanpageId,
      senderPsid,
      direction: index % 2 === 0 ? 'in' : 'out',
      content: `${namespace.slug} recent chat ${index + 1}`,
      sourcePlatform: 'facebook',
      platformMessageId: `${namespace.slug}:message:recent:${index + 1}`,
      platformEventKey: `${namespace.slug}:recent:${index + 1}`,
      deliveryStatus: 'sent',
      receivedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    });

    if (!recentConversations.has(senderPsid)) {
      recentConversations.set(senderPsid, {
        _id: new mongoose.Types.ObjectId(),
        fanpageId,
        senderPsid,
        totalMessages: 0,
        inboundCount: 0,
        outboundCount: 0,
        awaitingCount: 0,
        autoAiEnabled: true,
        needsHuman: false,
        hasAwaitingHuman: false,
        archived: false,
        createdAt,
        updatedAt: createdAt,
      });
    }

    const conversation = recentConversations.get(senderPsid);
    conversation.totalMessages += 1;
    if (index % 2 === 0) conversation.inboundCount += 1;
    else conversation.outboundCount += 1;
    conversation.lastMessageSnippet = `${namespace.slug} recent chat ${index + 1}`.slice(0, 120);
    conversation.lastDirection = index % 2 === 0 ? 'in' : 'out';
    conversation.lastMessageAt = createdAt;
    conversation.updatedAt = createdAt;
  }

  const agedMessages = [];
  for (let index = 0; index < agedCount; index++) {
    const createdAt = new Date(baseDate.getTime() - (95 * MS_PER_DAY) - index * 1000);
    agedMessages.push({
      _id: new mongoose.Types.ObjectId(),
      fanpageId,
      senderPsid: `${namespace.senderPrefix}-aged-${String((index % 4) + 1).padStart(2, '0')}`,
      direction: 'in',
      content: `${namespace.slug} aged chat ${index + 1}`,
      sourcePlatform: 'facebook',
      platformMessageId: `${namespace.slug}:message:aged:${index + 1}`,
      platformEventKey: `${namespace.slug}:aged:${index + 1}`,
      deliveryStatus: 'sent',
      receivedAt: createdAt,
      createdAt,
      updatedAt: createdAt,
    });
  }

  return {
    messages: [...recentMessages, ...agedMessages],
    conversations: Array.from(recentConversations.values()),
    agedMessageIds: agedMessages.map((doc) => String(doc._id)),
  };
}

function buildMediaDocs(namespace, fanpageId, count, mediaDir) {
  const docs = [];
  const filePaths = [];
  for (let index = 0; index < count; index++) {
    const fileName = `${namespace.mediaTag}-backed-${String(index + 1).padStart(2, '0')}.jpg`;
    const fileInfo = makeMediaEntry(mediaDir, fileName, namespace.slug);
    filePaths.push(fileInfo.absPath);
    docs.push({
      _id: new mongoose.Types.ObjectId(),
      url: fileInfo.url,
      path: fileInfo.absPath,
      filename: fileInfo.fileName,
      mimeType: 'image/jpeg',
      ext: 'jpg',
      size: fs.statSync(fileInfo.absPath).size,
      fanpageId,
      tags: ['db06', namespace.mediaTag],
      alt: `${namespace.slug} backed media ${index + 1}`,
      sourceType: 'gallery',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
  return { docs, filePaths };
}

function buildOrphanFiles(namespace, count, mediaDir) {
  const filePaths = [];
  for (let index = 0; index < count; index++) {
    const fileName = `${namespace.mediaTag}-orphan-${String(index + 1).padStart(2, '0')}.jpg`;
    const fileInfo = makeMediaEntry(mediaDir, fileName, `${namespace.slug}-orphan`);
    filePaths.push(fileInfo.absPath);
  }
  return filePaths;
}

async function setup(tag = DEFAULT_TAG) {
  const normalizedTag = slugifyTag(tag);
  const existingState = loadState(normalizedTag);
  if (existingState) {
    throw new Error(`State already exists for tag ${normalizedTag}. Run teardown-all first.`);
  }

  const namespaces = makeNamespaces(normalizedTag);
  const mediaDir = loadMediaDir(normalizedTag);
  const baseDate = new Date();

  return withDb(async (db) => {
    const collections = collectionMap(db);

    const targetFanpageId = new mongoose.Types.ObjectId();
    const protectedFanpageId = new mongoose.Types.ObjectId();
    const fanpages = [
      {
        _id: targetFanpageId,
        pageId: namespaces.target.fanpagePageId,
        name: namespaces.target.fanpageName,
        status: 'active',
        aiEnabled: false,
        createdAt: baseDate,
        updatedAt: baseDate,
      },
      {
        _id: protectedFanpageId,
        pageId: namespaces.protected.fanpagePageId,
        name: namespaces.protected.fanpageName,
        status: 'active',
        aiEnabled: false,
        createdAt: baseDate,
        updatedAt: baseDate,
      },
    ];

    const targetOrders = buildOrderDocs(namespaces.target, TARGET_ORDER_COUNT, baseDate);
    const protectedOrders = buildOrderDocs(namespaces.protected, PROTECTED_ORDER_COUNT, baseDate);
    const targetOtherCosts = buildOtherCostDocs(namespaces.target, TARGET_OTHER_COST_COUNT, baseDate);
    const protectedOtherCosts = buildOtherCostDocs(namespaces.protected, PROTECTED_OTHER_COST_COUNT, baseDate);
    const targetChats = buildChatDocs(namespaces.target, targetFanpageId, TARGET_CHAT_RECENT_COUNT, TARGET_CHAT_AGED_COUNT, baseDate);
    const protectedChats = buildChatDocs(namespaces.protected, protectedFanpageId, PROTECTED_CHAT_RECENT_COUNT, 0, baseDate);
    const targetMedia = buildMediaDocs(namespaces.target, targetFanpageId, TARGET_MEDIA_COUNT, mediaDir);
    const protectedMedia = buildMediaDocs(namespaces.protected, protectedFanpageId, PROTECTED_MEDIA_COUNT, mediaDir);
    const targetOrphanFiles = buildOrphanFiles(namespaces.target, TARGET_MEDIA_ORPHAN_COUNT, mediaDir);
    const state = {
      tag: normalizedTag,
      mediaDir,
      createdAt: new Date().toISOString(),
      namespace: {
        target: namespaces.target,
        protected: namespaces.protected,
      },
      ids: {
        target: {
          fanpages: [String(targetFanpageId)],
          orders: targetOrders.map((doc) => String(doc._id)),
          otherCosts: targetOtherCosts.map((doc) => String(doc._id)),
          chatMessages: targetChats.messages.map((doc) => String(doc._id)),
          agedChatMessages: targetChats.agedMessageIds,
          conversations: targetChats.conversations.map((doc) => String(doc._id)),
          media: targetMedia.docs.map((doc) => String(doc._id)),
        },
        protected: {
          fanpages: [String(protectedFanpageId)],
          orders: protectedOrders.map((doc) => String(doc._id)),
          otherCosts: protectedOtherCosts.map((doc) => String(doc._id)),
          chatMessages: protectedChats.messages.map((doc) => String(doc._id)),
          agedChatMessages: [],
          conversations: protectedChats.conversations.map((doc) => String(doc._id)),
          media: protectedMedia.docs.map((doc) => String(doc._id)),
        },
      },
      files: {
        targetBacked: targetMedia.filePaths,
        protectedBacked: protectedMedia.filePaths,
        targetOrphans: targetOrphanFiles,
      },
      expected: {
        target: {
          orders: TARGET_ORDER_COUNT,
          otherCosts: TARGET_OTHER_COST_COUNT,
          recentChatMessages: TARGET_CHAT_RECENT_COUNT,
          agedChatMessages: TARGET_CHAT_AGED_COUNT,
          conversations: targetChats.conversations.length,
          media: TARGET_MEDIA_COUNT,
          orphanFiles: TARGET_MEDIA_ORPHAN_COUNT,
        },
        protected: {
          orders: PROTECTED_ORDER_COUNT,
          otherCosts: PROTECTED_OTHER_COST_COUNT,
          recentChatMessages: PROTECTED_CHAT_RECENT_COUNT,
          agedChatMessages: 0,
          conversations: protectedChats.conversations.length,
          media: PROTECTED_MEDIA_COUNT,
          orphanFiles: 0,
        },
      },
    };

    const deleteByIds = async (collection, ids) => {
      if (!Array.isArray(ids) || !ids.length) return;
      await collection.deleteMany({ _id: { $in: ids.map((id) => toObjectId(id)) } });
    };

    try {
      await collections.fanpages.insertMany(fanpages);
      await collections.orders.insertMany([...targetOrders, ...protectedOrders]);
      await collections.otherCosts.insertMany([...targetOtherCosts, ...protectedOtherCosts]);
      await collections.chatMessages.insertMany([...targetChats.messages, ...protectedChats.messages]);
      await collections.conversations.insertMany([...targetChats.conversations, ...protectedChats.conversations]);
      await collections.media.insertMany([...targetMedia.docs, ...protectedMedia.docs]);
      saveState(normalizedTag, state);
    } catch (error) {
      await Promise.allSettled([
        deleteByIds(collections.media, [...state.ids.target.media, ...state.ids.protected.media]),
        deleteByIds(collections.conversations, [...state.ids.target.conversations, ...state.ids.protected.conversations]),
        deleteByIds(collections.chatMessages, [...state.ids.target.chatMessages, ...state.ids.protected.chatMessages]),
        deleteByIds(collections.otherCosts, [...state.ids.target.otherCosts, ...state.ids.protected.otherCosts]),
        deleteByIds(collections.orders, [...state.ids.target.orders, ...state.ids.protected.orders]),
        deleteByIds(collections.fanpages, [...state.ids.target.fanpages, ...state.ids.protected.fanpages]),
      ]);

      for (const filePath of [...state.files.targetBacked, ...state.files.protectedBacked, ...state.files.targetOrphans]) {
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        } catch {}
      }

      deleteState(normalizedTag);
      throw error;
    }

    return {
      action: 'setup',
      tag: normalizedTag,
      mediaDir,
      expected: state.expected,
    };
  });
}

async function summary(tag = DEFAULT_TAG) {
  const normalizedTag = slugifyTag(tag);
  const state = loadState(normalizedTag);
  if (!state) {
    throw new Error(`No state found for tag ${normalizedTag}.`);
  }

  return withDb(async (db) => {
    const collections = collectionMap(db);
    const target = state.ids.target;
    const protectedNs = state.ids.protected;

    const countByIds = async (collection, ids) => {
      if (!Array.isArray(ids) || !ids.length) return 0;
      return collection.countDocuments({ _id: { $in: ids.map((id) => toObjectId(id)) } });
    };

    const fileCount = (paths) => Array.isArray(paths) ? paths.filter((entry) => fs.existsSync(entry)).length : 0;
    const chatIndexes = await collections.chatMessages.indexes();
    const ttlIndex = chatIndexes.find(
      (entry) => entry.key && entry.key.createdAt === 1 && entry.expireAfterSeconds !== undefined,
    );

    return {
      action: 'summary',
      tag: normalizedTag,
      mediaDir: state.mediaDir,
      ttlIndexSeconds: ttlIndex ? ttlIndex.expireAfterSeconds : null,
      target: {
        orders: await countByIds(collections.orders, target.orders),
        otherCosts: await countByIds(collections.otherCosts, target.otherCosts),
        chatMessages: await countByIds(collections.chatMessages, target.chatMessages),
        agedChatMessages: await countByIds(collections.chatMessages, target.agedChatMessages),
        conversations: await countByIds(collections.conversations, target.conversations),
        mediaDocs: await countByIds(collections.media, target.media),
        backedFiles: fileCount(state.files.targetBacked),
        orphanFiles: fileCount(state.files.targetOrphans),
      },
      protected: {
        orders: await countByIds(collections.orders, protectedNs.orders),
        otherCosts: await countByIds(collections.otherCosts, protectedNs.otherCosts),
        chatMessages: await countByIds(collections.chatMessages, protectedNs.chatMessages),
        agedChatMessages: await countByIds(collections.chatMessages, protectedNs.agedChatMessages),
        conversations: await countByIds(collections.conversations, protectedNs.conversations),
        mediaDocs: await countByIds(collections.media, protectedNs.media),
        backedFiles: fileCount(state.files.protectedBacked),
      },
      expected: state.expected,
    };
  });
}

async function teardownTarget(tag = DEFAULT_TAG) {
  const normalizedTag = slugifyTag(tag);
  const state = loadState(normalizedTag);
  if (!state) {
    throw new Error(`No state found for tag ${normalizedTag}.`);
  }

  return withDb(async (db) => {
    const collections = collectionMap(db);
    const target = state.ids.target;

    const deleteByIds = async (collection, ids) => {
      if (!Array.isArray(ids) || !ids.length) return 0;
      const result = await collection.deleteMany({ _id: { $in: ids.map((id) => toObjectId(id)) } });
      return result.deletedCount || 0;
    };

    const summaryResult = {
      action: 'teardown-target',
      tag: normalizedTag,
      deleted: {
        media: await deleteByIds(collections.media, target.media),
        conversations: await deleteByIds(collections.conversations, target.conversations),
        chatMessages: await deleteByIds(collections.chatMessages, target.chatMessages),
        otherCosts: await deleteByIds(collections.otherCosts, target.otherCosts),
        orders: await deleteByIds(collections.orders, target.orders),
        fanpages: await deleteByIds(collections.fanpages, target.fanpages),
      },
      files: {
        targetBackedRemoved: 0,
        targetOrphansRemoved: 0,
      },
    };

    for (const filePath of state.files.targetBacked || []) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        summaryResult.files.targetBackedRemoved += 1;
      }
    }
    for (const filePath of state.files.targetOrphans || []) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        summaryResult.files.targetOrphansRemoved += 1;
      }
    }

    state.ids.target = {
      fanpages: [],
      orders: [],
      otherCosts: [],
      chatMessages: [],
      agedChatMessages: [],
      conversations: [],
      media: [],
    };
    state.files.targetBacked = [];
    state.files.targetOrphans = [];
    saveState(normalizedTag, state);

    return summaryResult;
  });
}

async function teardownAll(tag = DEFAULT_TAG) {
  const normalizedTag = slugifyTag(tag);
  const state = loadState(normalizedTag);
  if (!state) {
    return {
      action: 'teardown-all',
      tag: normalizedTag,
      removed: false,
      message: 'No state found.',
    };
  }

  await teardownTarget(normalizedTag);

  return withDb(async (db) => {
    const collections = collectionMap(db);
    const protectedNs = state.ids.protected;

    const deleteByIds = async (collection, ids) => {
      if (!Array.isArray(ids) || !ids.length) return 0;
      const result = await collection.deleteMany({ _id: { $in: ids.map((id) => toObjectId(id)) } });
      return result.deletedCount || 0;
    };

    const summaryResult = {
      action: 'teardown-all',
      tag: normalizedTag,
      deleted: {
        media: await deleteByIds(collections.media, protectedNs.media),
        conversations: await deleteByIds(collections.conversations, protectedNs.conversations),
        chatMessages: await deleteByIds(collections.chatMessages, protectedNs.chatMessages),
        otherCosts: await deleteByIds(collections.otherCosts, protectedNs.otherCosts),
        orders: await deleteByIds(collections.orders, protectedNs.orders),
        fanpages: await deleteByIds(collections.fanpages, protectedNs.fanpages),
      },
      files: {
        protectedBackedRemoved: 0,
      },
    };

    for (const filePath of state.files.protectedBacked || []) {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        summaryResult.files.protectedBackedRemoved += 1;
      }
    }

    try {
      if (state.mediaDir && fs.existsSync(state.mediaDir)) {
        fs.rmSync(state.mediaDir, { recursive: true, force: true });
      }
    } catch (error) {
      summaryResult.mediaDirCleanupWarning = String(error?.message || error);
    }

    deleteState(normalizedTag);
    return summaryResult;
  });
}

async function main() {
  const action = String(process.argv[2] || 'summary').trim().toLowerCase();
  const tag = process.argv[3] || DEFAULT_TAG;

  if (!['setup', 'summary', 'teardown-target', 'teardown-all'].includes(action)) {
    throw new Error(
      'Usage: node scripts/db06-seed-cleanup-helper.js <setup|summary|teardown-target|teardown-all> [tag]',
    );
  }

  let result;
  if (action === 'setup') {
    result = await setup(tag);
  } else if (action === 'summary') {
    result = await summary(tag);
  } else if (action === 'teardown-target') {
    result = await teardownTarget(tag);
  } else {
    result = await teardownAll(tag);
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
});

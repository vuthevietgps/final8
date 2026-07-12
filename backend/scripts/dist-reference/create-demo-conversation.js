"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const chat_message_schema_1 = require("./chat-message/schemas/chat-message.schema");
const conversation_schema_1 = require("./chat-message/schemas/conversation.schema");
try {
    require('dotenv').config();
}
catch (_a) { }
const DEFAULT_CONN = process.env.MONGODB_URI;
const MONGO = process.env.MONGODB_URI || DEFAULT_CONN;
async function run() {
    await mongoose_1.default.connect(MONGO);
    const ChatMessageModel = mongoose_1.default.model(chat_message_schema_1.ChatMessage.name, chat_message_schema_1.ChatMessageSchema);
    const ConversationModel = mongoose_1.default.model(conversation_schema_1.Conversation.name, conversation_schema_1.ConversationSchema);
    const fanpageId = new mongoose_1.Types.ObjectId();
    const senderPsid = 'PSID_DEMO_001';
    await ChatMessageModel.deleteMany({ fanpageId, senderPsid });
    await ConversationModel.deleteMany({ fanpageId, senderPsid });
    const now = Date.now();
    const msgs = [
        { direction: 'in', content: 'Chào shop, mẫu áo X còn không?', receivedAt: new Date(now - 1000 * 60 * 15), awaitingHuman: false },
        { direction: 'out', content: 'Chào bạn! Mẫu X còn đủ size S/M/L nhé.', receivedAt: new Date(now - 1000 * 60 * 14) },
        { direction: 'in', content: 'Giá bao nhiêu và có màu đen không?', receivedAt: new Date(now - 1000 * 60 * 12), awaitingHuman: true },
        { direction: 'out', content: 'Áo X giá 249k, màu đen còn S và M.', receivedAt: new Date(now - 1000 * 60 * 11) },
        { direction: 'in', content: 'Ship về Hà Nội mất bao lâu?', receivedAt: new Date(now - 1000 * 60 * 9) },
        { direction: 'out', content: 'Nội thành HN khoảng 1-2 ngày bạn nhé.', receivedAt: new Date(now - 1000 * 60 * 8) },
        { direction: 'in', content: 'Ok mình đặt 1 cái size M.', receivedAt: new Date(now - 1000 * 60 * 6) },
        { direction: 'out', content: 'Đã ghi nhận đơn, mình gửi link thanh toán nè.', receivedAt: new Date(now - 1000 * 60 * 5), isClosing: true },
    ];
    for (const m of msgs) {
        await ChatMessageModel.create(Object.assign({ fanpageId, senderPsid }, m));
    }
    const all = await ChatMessageModel.find({ fanpageId, senderPsid }).sort({ createdAt: 1 }).lean();
    let inbound = 0, outbound = 0, awaiting = 0;
    let firstAwait;
    const last = all[all.length - 1];
    for (const m of all) {
        if (m.direction === 'in')
            inbound++;
        else
            outbound++;
        if (m.awaitingHuman) {
            awaiting++;
            if (!firstAwait)
                firstAwait = m.createdAt;
        }
    }
    await ConversationModel.updateOne({ fanpageId, senderPsid }, { $set: {
            totalMessages: all.length,
            inboundCount: inbound,
            outboundCount: outbound,
            awaitingCount: awaiting,
            hasAwaitingHuman: awaiting > 0,
            needsHuman: awaiting > 0,
            firstAwaitingAt: firstAwait || null,
            lastMessageSnippet: (last.content || '').slice(0, 120),
            lastDirection: last.direction,
            lastMessageAt: last.createdAt,
        }, $setOnInsert: { fanpageId, senderPsid } }, { upsert: true });
    console.log('Demo conversation created.');
    console.log({ fanpageId: fanpageId.toHexString(), senderPsid });
    await mongoose_1.default.disconnect();
}
run().catch(e => { console.error(e); process.exit(1); });
//# sourceMappingURL=create-demo-conversation.js.map

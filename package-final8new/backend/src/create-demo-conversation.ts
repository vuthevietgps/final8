/**
 * Script: create-demo-conversation.ts
 * Mục đích: Tạo nhanh dữ liệu mẫu cho 1 fanpage + chuỗi hội thoại để test UI Conversations.
 * Chạy: npx ts-node -r tsconfig-paths/register src/create-demo-conversation.ts
 */
import mongoose, { Types } from 'mongoose';
import { ChatMessageSchema, ChatMessage } from './chat-message/schemas/chat-message.schema';
import { ConversationSchema, Conversation } from './chat-message/schemas/conversation.schema';
// (Optional) load env if running with dotenv; skip if not installed.
try { require('dotenv').config(); } catch {}

const DEFAULT_CONN = 'mongodb+srv://dinhvigps07:zn0dOrNeZH2yx2yO@smarterp-dev.khsfdta.mongodb.net/management-system';
const MONGO = process.env.MONGODB_URI || DEFAULT_CONN;

async function run(){
  await mongoose.connect(MONGO);
  const ChatMessageModel = mongoose.model(ChatMessage.name, ChatMessageSchema);
  const ConversationModel = mongoose.model(Conversation.name, ConversationSchema);

  const fanpageId = new Types.ObjectId(); // hoặc thay bằng 1 id fanpage có sẵn nếu cần
  const senderPsid = 'PSID_DEMO_001';

  // Xóa dữ liệu cũ (demo same keys)
  await ChatMessageModel.deleteMany({ fanpageId, senderPsid });
  await ConversationModel.deleteMany({ fanpageId, senderPsid });

  const now = Date.now();
  const msgs: any[] = [
    { direction: 'in',  content: 'Chào shop, mẫu áo X còn không?', receivedAt: new Date(now - 1000*60*15), awaitingHuman: false },
    { direction: 'out', content: 'Chào bạn! Mẫu X còn đủ size S/M/L nhé.', receivedAt: new Date(now - 1000*60*14) },
    { direction: 'in',  content: 'Giá bao nhiêu và có màu đen không?', receivedAt: new Date(now - 1000*60*12), awaitingHuman: true },
    { direction: 'out', content: 'Áo X giá 249k, màu đen còn S và M.', receivedAt: new Date(now - 1000*60*11) },
    { direction: 'in',  content: 'Ship về Hà Nội mất bao lâu?', receivedAt: new Date(now - 1000*60*9) },
    { direction: 'out', content: 'Nội thành HN khoảng 1-2 ngày bạn nhé.', receivedAt: new Date(now - 1000*60*8) },
    { direction: 'in',  content: 'Ok mình đặt 1 cái size M.', receivedAt: new Date(now - 1000*60*6) },
    { direction: 'out', content: 'Đã ghi nhận đơn, mình gửi link thanh toán nè.', receivedAt: new Date(now - 1000*60*5), isClosing: true },
  ];

  for(const m of msgs){
    await ChatMessageModel.create({ fanpageId, senderPsid, ...m });
  }

  // Gọi lại tính toán conversation bằng cách insert 1 message giả (hoặc tự tính lại manual)
  // Ở service thật đã có logic upsert, nhưng chúng ta mô phỏng recompute nhanh ở đây.
  const all = await ChatMessageModel.find({ fanpageId, senderPsid }).sort({ createdAt: 1 }).lean();
  let inbound=0, outbound=0, awaiting=0; let firstAwait: any; const last = all[all.length-1];
  for(const m of all){
    if(m.direction==='in') inbound++; else outbound++;
  if(m.awaitingHuman){ awaiting++; if(!firstAwait) firstAwait = (m as any).createdAt; }
  }
  await ConversationModel.updateOne(
    { fanpageId, senderPsid },
    { $set: {
        totalMessages: all.length,
        inboundCount: inbound,
        outboundCount: outbound,
        awaitingCount: awaiting,
        hasAwaitingHuman: awaiting>0,
        needsHuman: awaiting>0,
        firstAwaitingAt: firstAwait || null,
        lastMessageSnippet: (last.content||'').slice(0,120),
        lastDirection: last.direction,
  lastMessageAt: (last as any).createdAt,
      } , $setOnInsert: { fanpageId, senderPsid } },
    { upsert: true }
  );

  console.log('Demo conversation created.');
  console.log({ fanpageId: fanpageId.toHexString(), senderPsid });
  await mongoose.disconnect();
}

run().catch(e=>{ console.error(e); process.exit(1); });

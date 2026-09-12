import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AiOperatorSessionService } from './ai-operator.session.service';
import { AiOperatorSession } from './schemas/ai-operator-session.schema';
import { AiOperatorMessage } from './schemas/ai-operator-message.schema';

describe('AI Operator conversation business contracts', () => {
  const ownerId = '507f1f77bcf86cd799439011';
  const otherId = '507f1f77bcf86cd799439012';
  const sessionId = '507f1f77bcf86cd799439013';
  const messageId = '507f1f77bcf86cd799439014';
  const owner = { id: ownerId, role: 'unknown-role', fullName: 'Local owner' };
  const admin = { id: otherId, role: 'director' };
  const query = (result: any) => {
    const promise = Promise.resolve(result);
    return { lean: jest.fn(() => promise), sort: jest.fn().mockReturnThis(), limit: jest.fn().mockReturnThis(), then: promise.then.bind(promise) };
  };
  let service: AiOperatorSessionService;
  let session: any;
  let sessionModel: any;
  let messageModel: any;

  beforeEach(() => {
    session = { _id: new Types.ObjectId(sessionId), userId: new Types.ObjectId(ownerId), status: 'active', windowDays: 7 };
    sessionModel = Object.assign(jest.fn().mockImplementation(data => ({ save: jest.fn().mockResolvedValue({ _id: session._id, ...data }) })), {
      findById: jest.fn(() => query(session)),
      find: jest.fn(() => query([session])),
      findByIdAndUpdate: jest.fn(() => query(session)),
      countDocuments: jest.fn().mockResolvedValue(1),
      aggregate: jest.fn().mockResolvedValue([]),
    });
    messageModel = {
      find: jest.fn(() => query([])),
      findById: jest.fn(() => query({ _id: messageId, sessionId, role: 'assistant' })),
      findByIdAndUpdate: jest.fn(() => query({ _id: messageId, sessionId, role: 'assistant' })),
      insertMany: jest.fn().mockResolvedValue([{ _id: messageId, role: 'assistant' }]),
      countDocuments: jest.fn().mockResolvedValue(0),
      aggregate: jest.fn().mockResolvedValue([]),
    };
    const tokens: any[] = Reflect.getMetadata('design:paramtypes', AiOperatorSessionService);
    const overrides: { index: number; param: string }[] = Reflect.getMetadata('self:paramtypes', AiOperatorSessionService) || [];
    const args = tokens.map((_, index) => {
      const token = overrides.find(item => item.index === index)?.param;
      if (token === getModelToken(AiOperatorSession.name)) return sessionModel;
      if (token === getModelToken(AiOperatorMessage.name)) return messageModel;
      return {};
    });
    service = new (AiOperatorSessionService as any)(...args);
  });

  it('creates an active session with the authenticated owner and normalized title', async () => {
    const result = await service.createSession(owner, { title: '  Local   session  ', role: 'director' });
    expect(sessionModel).toHaveBeenCalledWith(expect.objectContaining({ userId: new Types.ObjectId(ownerId), userRole: 'unknown-role', title: 'Local session', status: 'active', messageCount: 0, windowDays: 7 }));
    expect(result.session._id).toBe(sessionId);
  });

  it('scopes all=true to the owner without management permission and caps the limit', async () => {
    const result = await service.listSessions(owner, { all: true, limit: 999, status: 'archived' });
    expect(result.scope).toBe('own');
    expect(sessionModel.find).toHaveBeenCalledWith({ userId: new Types.ObjectId(ownerId), status: 'archived' });
    expect(sessionModel.find.mock.results[0].value.limit).toHaveBeenCalledWith(100);
  });

  it('allows management to list all sessions only when explicitly requested', async () => {
    expect((await service.listSessions(admin, { all: '1' })).scope).toBe('all');
    expect(sessionModel.find).toHaveBeenLastCalledWith({});
    expect((await service.listSessions(admin)).scope).toBe('own');
    expect(sessionModel.find).toHaveBeenLastCalledWith({ userId: new Types.ObjectId(otherId) });
  });

  it('blocks foreign readers before fetching messages but permits management read access', async () => {
    await expect(service.getSessionDetail({ id: otherId, role: 'unknown-role' }, sessionId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(messageModel.find).not.toHaveBeenCalled();
    await service.getSessionDetail(admin, sessionId, { limit: 999 });
    expect(messageModel.find).toHaveBeenCalledWith({ sessionId: session._id });
    expect(messageModel.find.mock.results[0].value.limit).toHaveBeenCalledWith(200);
  });

  it('does not grant management write access to a foreign session', async () => {
    await expect(service.updateSession(admin, sessionId, { title: 'Changed' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(sessionModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('rejects writes to an archived session even by its owner', async () => {
    session.status = 'archived';
    await expect(service.updateSession(owner, sessionId, { status: 'active' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(service['persistChatTurn'](owner, sessionId, 'Question', {})).rejects.toBeInstanceOf(BadRequestException);
    expect(messageModel.insertMany).not.toHaveBeenCalled();
  });

  it('keeps no-op updates read-only and normalizes accepted titles', async () => {
    await service.updateSession(owner, sessionId, { status: 'invalid' });
    expect(sessionModel.findByIdAndUpdate).not.toHaveBeenCalled();
    await service.updateSession(owner, sessionId, { title: '  New   title ', status: 'archived' });
    expect(sessionModel.findByIdAndUpdate).toHaveBeenCalledWith(session._id, { $set: { title: 'New title', status: 'archived' } }, { new: true });
  });

  it('preserves invalid-id and missing-session errors', async () => {
    await expect(service.getSessionDetail(owner, 'invalid')).rejects.toBeInstanceOf(BadRequestException);
    expect(sessionModel.findById).not.toHaveBeenCalled();
    sessionModel.findById.mockReturnValue(query(null));
    await expect(service.getSessionDetail(owner, sessionId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects feedback on user messages without writing either model', async () => {
    messageModel.findById.mockReturnValue(query({ _id: messageId, sessionId, role: 'user' }));
    await expect(service.submitMessageFeedback(owner, messageId, { rating: 'down' })).rejects.toBeInstanceOf(BadRequestException);
    expect(messageModel.findByIdAndUpdate).not.toHaveBeenCalled();
    expect(sessionModel.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it('preserves negative feedback flags and management review access', async () => {
    await service.submitMessageFeedback(admin, messageId, { rating: 'down', tags: ['Missing Data'], reason: '  Local   reason ' });
    expect(messageModel.findByIdAndUpdate).toHaveBeenCalledWith(new Types.ObjectId(messageId), { $set: { feedback: expect.objectContaining({ rating: 'down', reason: 'Local reason', tags: ['missing_data'], reviewedBy: new Types.ObjectId(otherId) }) } }, { new: true });
    expect(sessionModel.findByIdAndUpdate).toHaveBeenCalledWith(session._id, expect.objectContaining({
      $set: { quality: expect.objectContaining({ needsReview: true, lastFeedbackRating: 'down' }) },
      $addToSet: { analysisFlags: { $each: ['needs_review', 'bad_answer', 'missing_data'] }, tags: { $each: ['missing_data'] } },
    }));
  });

  it('preserves previous review values when omitted and merges follow-up flags', async () => {
    session.quality = { score: 4, improvementPriority: 'low' };
    await service.reviewSession(admin, sessionId, { outcome: 'needs_followup', tags: ['Review'] });
    expect(sessionModel.findByIdAndUpdate).toHaveBeenCalledWith(session._id, {
      $set: { quality: expect.objectContaining({ reviewed: true, score: 4, improvementPriority: 'low', outcome: 'needs_followup' }) },
      $addToSet: { analysisFlags: { $each: ['review', 'needs_followup'] }, tags: { $each: ['review'] } },
    }, { new: true });
  });

  it('does not persist anonymous chat turns', async () => {
    expect(await service['persistChatTurn'](undefined, undefined, 'Question', {})).toBeNull();
    expect(sessionModel).not.toHaveBeenCalled();
    expect(messageModel.insertMany).not.toHaveBeenCalled();
  });

  it('keeps analytics scoped to the owner, with date filters and capped backlog size', async () => {
    const from = new Date('2026-09-01T00:00:00Z');
    const result = await service.getConversationAnalytics(owner, { all: true, from: from.toISOString(), to: 'invalid', limit: 999 });
    expect(result.scope).toBe('own');
    expect(result.to).toBeNull();
    expect(sessionModel.countDocuments).toHaveBeenCalledWith({ userId: new Types.ObjectId(ownerId), lastMessageAt: { $gte: from } });
    expect(messageModel.countDocuments).toHaveBeenCalledWith({ userId: new Types.ObjectId(ownerId), createdAt: { $gte: from } });
    expect(messageModel.aggregate.mock.calls[0][0][0]).toEqual({ $match: { userId: new Types.ObjectId(ownerId), createdAt: { $gte: from }, role: 'assistant' } });
    expect(messageModel.find.mock.results[0].value.limit).toHaveBeenCalledWith(50);
  });

  it('allows explicitly requested management analytics across owners', async () => {
    const result = await service.getConversationAnalytics(admin, { all: 'true' });
    expect(result.scope).toBe('all');
    expect(sessionModel.countDocuments).toHaveBeenCalledWith({});
    expect(messageModel.aggregate.mock.calls[0][0][0]).toEqual({ $match: { role: 'assistant' } });
  });

  it('stores a user/assistant pair and increments the existing session by two', async () => {
    const response = { answer: 'Local answer', route: { intent: 'orders' }, recommendations: [], context: { windowDays: 14 } };
    const result = await service['persistChatTurn'](owner, sessionId, 'Local question', response);
    const messages = messageModel.insertMany.mock.calls[0][0];
    expect(messages).toHaveLength(2);
    expect(messages[0]).toEqual(expect.objectContaining({ role: 'user', content: 'Local question', sessionId: session._id }));
    expect(messages[1]).toEqual(expect.objectContaining({ role: 'assistant', content: 'Local answer', sessionId: session._id }));
    expect(sessionModel.findByIdAndUpdate).toHaveBeenCalledWith(session._id, expect.objectContaining({ $inc: { messageCount: 2 }, $set: expect.objectContaining({ windowDays: 14, tags: ['orders'] }) }), { new: true });
    expect(result.assistantMessageId).toBe(messageId);
  });
});

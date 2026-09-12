import { BadRequestException } from '@nestjs/common';
import { Types } from 'mongoose';
import { conversionTypesExpression } from './tracking-conversion';

const conversions = ['phone', 'zalo', 'inbox', 'contact', 'form_submit'];
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Match raw visit evidence first. Only perform CRM/event joins before paging when needed. */
export function trackingListQuery(query: Record<string, string> = {}) {
  const allowed = ['page', 'pageSize', 'search', 'ip', 'landing', 'from', 'to', 'provider', 'account', 'campaign', 'adGroup', 'sourceId', 'agentId', 'productId', 'categoryId', 'status', 'type', 'conversion', 'order', 'timeField', 'confidence', 'followUp', 'contactChannel'];
  for (const [key, value] of Object.entries(query)) {
    if (!allowed.includes(key) || typeof value !== 'string' || value.length > 200) throw new BadRequestException('Bộ lọc không hợp lệ');
  }
  const page = Number(query.page || 1), pageSize = Number(query.pageSize || 25);
  if (!Number.isInteger(page) || page < 1 || page > 100000 || ![25, 50, 100].includes(pageSize)) throw new BadRequestException('Trang không hợp lệ');
  for (const [key, values] of Object.entries({ provider: ['google', 'facebook', 'tiktok', 'unknown'], status: ['new', 'noted', 'confirmed', 'cancelled'], type: ['click', 'conversion'], conversion: conversions, order: ['pending', 'created'], timeField: ['visit', 'conversion', 'contact'], confidence: ['unknown', 'approximate', 'verified'], followUp: ['due', 'upcoming', 'none'], contactChannel: conversions })) {
    if (query[key] && !values.includes(query[key])) throw new BadRequestException(`Bộ lọc ${key} không hợp lệ`);
  }
  const match: any = {};
  for (const [key, path] of Object.entries({ ip: 'ipAddress', provider: 'ads.provider', account: 'ads.accountId', campaign: 'ads.campaignId', adGroup: 'ads.adGroupId' })) {
    if (query[key]?.trim()) match[path] = query[key].trim();
  }
  const ids: any = {};
  for (const key of ['sourceId', 'agentId', 'productId', 'categoryId']) {
    if (query[key]) {
      if (!/^[a-f\d]{24}$/i.test(query[key])) throw new BadRequestException(`Bộ lọc ${key} không hợp lệ`);
      ids[key] = new Types.ObjectId(query[key]);
    }
  }
  if (ids.sourceId) match.sourceId = ids.sourceId;
  if (query.landing?.trim()) match.$or = ['landingHost', 'landingPath', 'landingName'].map(key => ({ [key]: { $regex: escape(query.landing.trim()), $options: 'i' } }));
  const dates: any = {};
  for (const key of ['from', 'to']) {
    if (!query[key]) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(query[key]) || !Number.isFinite(Date.parse(query[key])) || new Date(query[key]).toISOString().slice(0, 10) !== query[key]) throw new BadRequestException('Ngày lọc không hợp lệ');
    const date = new Date(`${query[key]}T00:00:00+07:00`);
    if (key === 'to') date.setTime(date.getTime() + 86400000);
    dates[key === 'from' ? '$gte' : '$lt'] = date;
  }
  if (dates.$gte && dates.$lt && dates.$gte >= dates.$lt) throw new BadRequestException('Ngày bắt đầu phải trước ngày kết thúc');
  if (Object.keys(dates).length && (!query.timeField || query.timeField === 'visit')) match.occurredAt = dates;

  const leadJoin: any[] = [
    { $lookup: { from: 'tracking_crm_leads', localField: '_id', foreignField: 'visitId', pipeline: [{ $project: { operationLock: 0 } }], as: 'leadRows' } },
    { $set: { lead: { $arrayElemAt: ['$leadRows', 0] } } },
  ];
  const linkJoin: any[] = [{ $lookup: { from: 'tracking_crm_order_links', localField: 'lead._id', foreignField: 'leadId', as: 'linkRows' } }];
  const eventJoin: any[] = [
    { $lookup: { from: 'tracking_crm_events', let: { source: '$sourceId', visit: '$externalVisitId' }, pipeline: [
      { $match: { $expr: { $and: [{ $eq: ['$sourceId', '$$source'] }, { $eq: ['$externalVisitId', '$$visit'] }] }, eventType: { $in: conversions } } },
      { $group: { _id: '$eventType', lastAt: { $max: '$occurredAt' } } },
    ], as: 'conversionRows' } },
    { $set: { conversionTypes: conversionTypesExpression, lastConversionAt: { $max: '$conversionRows.lastAt' } } },
  ];
  const productJoin: any[] = [
    { $lookup: { from: 'products', localField: 'lead.productId', foreignField: '_id', pipeline: [{ $project: { name: 1, categoryId: 1 } }], as: 'productRows' } },
    { $set: { product: { $arrayElemAt: ['$productRows', 0] } } },
    { $lookup: { from: 'productcategories', localField: 'product.categoryId', foreignField: '_id', pipeline: [{ $project: { name: 1 } }], as: 'categoryRows' } },
  ];
  const needLead = !!(query.agentId || query.productId || query.categoryId || query.status || query.order || query.confidence || query.followUp || query.contactChannel || query.timeField === 'contact' || query.search?.trim());
  const needEvent = !!(query.type || query.conversion);
  const pipeline: any[] = [{ $match: match }, { $sort: { occurredAt: -1, _id: -1 } }];
  if (needLead) pipeline.push(...leadJoin);
  const crmMatch: any = {};
  if (ids.agentId) crmMatch['lead.agentId'] = ids.agentId;
  if (ids.productId) crmMatch['lead.productId'] = ids.productId;
  if (query.contactChannel) crmMatch['lead.contactChannel'] = query.contactChannel;
  if (query.confidence === 'unknown') crmMatch['lead.matchConfidence'] = { $in: [null, 'unknown'] };
  else if (query.confidence) crmMatch['lead.matchConfidence'] = query.confidence;
  if (query.timeField === 'contact' && Object.keys(dates).length) crmMatch['lead.contactedAt'] = dates;
  if (query.followUp === 'none') crmMatch['lead.nextFollowUpAt'] = null;
  else if (query.followUp) {
    crmMatch['lead.nextFollowUpAt'] = query.followUp === 'due' ? { $ne: null, $lte: new Date() } : { $gt: new Date() };
    crmMatch['lead.status'] = 'noted';
  }
  if (query.status === 'new') crmMatch['lead._id'] = { $exists: false };
  else if (query.status) crmMatch['lead.status'] = query.status;
  if (query.search?.trim()) crmMatch.$or = ['ipAddress', 'landingHost', 'landingName', 'ads.clickId', 'ads.adGroupId', 'lead.customerName', 'lead.phone', 'lead.agentNameSnapshot'].map(key => ({ [key]: { $regex: escape(query.search.trim()), $options: 'i' } }));
  if (query.followUp && query.followUp !== 'none' && query.status && query.status !== 'noted') crmMatch['lead.status'] = { $in: [] };
  if (Object.keys(crmMatch).length) pipeline.push({ $match: crmMatch });
  if (query.categoryId) pipeline.push(...productJoin, { $match: { 'product.categoryId': ids.categoryId } });
  if (query.order) pipeline.push(...linkJoin, { $match: { 'linkRows.0': { $exists: query.order === 'created' } } });
  if (needEvent) {
    pipeline.push(...eventJoin);
    if (query.type) pipeline.push({ $match: { 'conversionTypes.0': { $exists: query.type === 'conversion' } } });
    if (query.conversion) pipeline.push({ $match: { conversionTypes: query.conversion } });
  }
  if (query.timeField === 'conversion' && Object.keys(dates).length) {
    pipeline.push({ $lookup: { from: 'tracking_crm_events', let: { source: '$sourceId', visit: '$externalVisitId' }, pipeline: [
      { $match: { $expr: { $and: [{ $eq: ['$sourceId', '$$source'] }, { $eq: ['$externalVisitId', '$$visit'] }] },
        occurredAt: dates, eventType: query.conversion || { $in: conversions } } }, { $limit: 1 }, { $project: { _id: 1 } },
    ], as: 'matchingConversions' } }, { $match: { 'matchingConversions.0': { $exists: true } } });
  }
  pipeline.push({ $facet: {
    total: [{ $count: 'value' }],
    items: [
      { $skip: (page - 1) * pageSize }, { $limit: pageSize },
      ...(!needLead ? leadJoin : []), ...(!query.order ? linkJoin : []),
      ...(!needEvent ? eventJoin : []), ...(!query.categoryId ? productJoin : []),
      { $project: { sourceId: 1, externalVisitId: 1, occurredAt: 1, landingHost: 1, landingPath: 1, landingName: 1, ads: 1, ipAddress: 1, country: 1, engagement: 1, engagementObservedAt: 1, lead: 1, conversionTypes: 1, lastConversionAt: 1, product: 1, categoryRows: 1, linkRows: 1 } },
    ],
  } });
  return { pipeline, page, pageSize };
}

import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import fetch from 'node-fetch';
import { buildAiAssistantQualityDirectives } from '../common/ai-assistant-quality';
import { OpenAIConfigService } from '../openai-config/openai-config.service';
import { Product, ProductDocument } from './schemas/product.schema';

export interface ImageAnalysis {
  objects: string[];
  colors: string[];
  features: string[];
  keywords: string[];
  description: string;
  confidence: number;
  visibleAttributes?: string[];
  inferredAttributes?: string[];
  evidence?: string[];
  warnings?: string[];
  qualityScore?: number;
}

export interface ProductRecommendation {
  product: ProductDocument;
  matchScore: number;
  matchReasons: string[];
}

@Injectable()
export class VisionAIService {
  private readonly logger = new Logger(VisionAIService.name);

  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    private openaiConfigService: OpenAIConfigService,
  ) {}

  private pickVisionModel(configuredModel?: string): string {
    const model = String(configuredModel || '').trim();
    const visionCapable = new Set([
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'gpt-4-vision-preview',
    ]);
    return visionCapable.has(model) ? model : 'gpt-4o-mini';
  }

  private normalizeText(value: unknown): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private clampConfidence(value: unknown, fallback = 0.45): number {
    const num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.max(0, Math.min(1, Math.round(num * 100) / 100));
  }

  private textList(value: unknown, limit = 12): string[] {
    if (!Array.isArray(value)) return [];
    return value
      .map((item) => String(item || '').trim())
      .filter(Boolean)
      .slice(0, limit);
  }

  private extractJsonObject(content: string): Record<string, any> {
    const clean = String(content || '').replace(/```json\n?|\n?```/g, '').trim();
    try {
      return JSON.parse(clean);
    } catch {
      const start = clean.indexOf('{');
      const end = clean.lastIndexOf('}');
      if (start >= 0 && end > start) {
        return JSON.parse(clean.slice(start, end + 1));
      }
      throw new Error('Vision AI response was not valid JSON');
    }
  }

  private normalizeAnalysis(raw: Record<string, any>, warnings: string[] = []): ImageAnalysis {
    const evidence = this.textList(raw.evidence, 8);
    const visibleAttributes = this.textList(raw.visibleAttributes || raw.visible_attributes, 10);
    const inferredAttributes = this.textList(raw.inferredAttributes || raw.inferred_attributes, 8);
    let confidence = this.clampConfidence(raw.confidence, evidence.length ? 0.65 : 0.45);
    if (!evidence.length && confidence > 0.55) confidence = 0.55;

    const normalized: ImageAnalysis = {
      objects: this.textList(raw.objects, 10),
      colors: this.textList(raw.colors, 8),
      features: this.textList(raw.features, 12),
      keywords: this.textList(raw.keywords, 16),
      description: String(raw.description || '').trim() || 'Can cap nhat mo ta thu cong vi Vision AI khong tao duoc mo ta dang tin cay.',
      confidence,
      visibleAttributes,
      inferredAttributes,
      evidence,
      warnings: [...warnings],
      qualityScore: Math.round(confidence * 100),
    };

    if (!normalized.objects.length) normalized.warnings?.push('No clear product object was detected.');
    if (!normalized.evidence?.length) normalized.warnings?.push('No field-level visual evidence returned by model.');
    return normalized;
  }

  private fallbackAnalysis(reason: string): ImageAnalysis {
    return this.normalizeAnalysis(
      {
        objects: ['product'],
        colors: [],
        features: [],
        keywords: ['product'],
        description: 'Can cap nhat mo ta thu cong vi Vision AI chua co ket qua dang tin cay.',
        confidence: 0.1,
        evidence: [],
        visibleAttributes: [],
        inferredAttributes: [],
      },
      [reason],
    );
  }

  async analyzeProductImage(imageUrl: string, configId?: string): Promise<ImageAnalysis> {
    try {
      const config = configId
        ? await this.openaiConfigService.findOne(configId)
        : await this.openaiConfigService.pickConfig({ purpose: 'general' });

      if (!config || config.status !== 'active' || !config.apiKey || config.apiKey === 'placeholder-key') {
        throw new Error('No valid OpenAI configuration found');
      }

      const prompt = [
        'Analyze the product image and return JSON only.',
        'Required JSON keys: objects, colors, features, keywords, description, confidence, visibleAttributes, inferredAttributes, evidence, warnings.',
        'Use Vietnamese for user-facing description and keywords when possible.',
        'Only include brand, material, origin, quality grade, stock, or price if it is visibly supported by the image.',
        'Put directly visible facts in visibleAttributes and marketing/inference text in inferredAttributes.',
        'Each evidence item must explain which visible cue supports the field.',
        'confidence must be 0..1 and must be low when the image is unclear or evidence is weak.',
        buildAiAssistantQualityDirectives('vision'),
      ].join('\n');

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: this.pickVisionModel(config.model),
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          }],
          response_format: { type: 'json_object' },
          max_tokens: Math.min(1200, Math.max(300, Number(config.maxTokens || 800))),
          temperature: Math.max(0, Math.min(1, Number(config.temperature ?? 0.2))),
        }),
      });

      if (!response.ok) {
        const errorData: any = await response.json().catch(() => ({}));
        throw new Error(`OpenAI Vision API error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error('No content returned from OpenAI Vision API');

      return this.normalizeAnalysis(this.extractJsonObject(content));
    } catch (error: any) {
      this.logger.error('Vision AI analysis failed', error?.message || error);
      return this.fallbackAnalysis(String(error?.message || 'Vision AI analysis failed').slice(0, 200));
    }
  }

  async findSimilarProducts(
    query: string,
    fanpageId: string,
    limit: number = 5,
  ): Promise<ProductRecommendation[]> {
    try {
      const queryKeywords = this.extractKeywords(query);
      if (!queryKeywords.length) return [];

      const products = await this.productModel.find({
        'fanpageVariations.fanpageId': fanpageId,
        'fanpageVariations.isActive': true,
      })
        .populate('categoryId', 'name')
        .lean();

      const scoredProducts: ProductRecommendation[] = [];
      for (const product of products) {
        const matchScore = this.calculateMatchScore(product as any, queryKeywords);
        if (matchScore > 0) {
          scoredProducts.push({
            product: product as unknown as ProductDocument,
            matchScore,
            matchReasons: this.getMatchReasons(product as any, queryKeywords),
          });
        }
      }

      return scoredProducts
        .sort((a, b) => {
          const aVars = ((a.product as any).fanpageVariations || []) as any[];
          const bVars = ((b.product as any).fanpageVariations || []) as any[];
          const priorityA = aVars.find((v) => String(v.fanpageId) === fanpageId)?.priority || 0;
          const priorityB = bVars.find((v) => String(v.fanpageId) === fanpageId)?.priority || 0;
          if (priorityA !== priorityB) return priorityB - priorityA;
          return b.matchScore - a.matchScore;
        })
        .slice(0, Math.max(1, Math.min(20, Number(limit) || 5)));
    } catch (error: any) {
      this.logger.error('Product search failed', error?.message || error);
      return [];
    }
  }

  async generateProductDescription(images: any[]): Promise<string> {
    if (!images?.length) return '';

    const allKeywords = new Set<string>();
    const allFeatures = new Set<string>();
    const allColors = new Set<string>();

    images.forEach((img) => {
      img.aiAnalysis?.keywords?.forEach((k: string) => allKeywords.add(k));
      img.aiAnalysis?.features?.forEach((f: string) => allFeatures.add(f));
      img.aiAnalysis?.colors?.forEach((c: string) => allColors.add(c));
    });

    const parts: string[] = [];
    if (allFeatures.size) parts.push(`Tinh nang nhin thay: ${Array.from(allFeatures).join(', ')}.`);
    if (allColors.size) parts.push(`Mau sac: ${Array.from(allColors).join(', ')}.`);
    if (allKeywords.size) parts.push(`Tu khoa: ${Array.from(allKeywords).slice(0, 12).join(', ')}.`);
    return parts.join(' ').trim();
  }

  private extractKeywords(text: string): string[] {
    const normalized = this.normalizeText(text);
    const productKeywords = [
      'dien thoai', 'phone', 'iphone', 'samsung', 'oppo', 'vivo', 'xiaomi',
      'laptop', 'may tinh', 'computer', 'macbook', 'dell', 'hp', 'asus',
      'tai nghe', 'headphone', 'airpods', 'speaker', 'loa',
      'op lung', 'case', 'bao da', 'mieng dan', 'cuong luc',
      'sac', 'charger', 'cable', 'cap', 'pin', 'battery',
      'dong ho', 'watch', 'smart watch',
      'quan ao', 'ao', 'quan', 'dress', 'shirt', 'pants',
      'giay', 'dep', 'shoes', 'sneaker', 'sandal',
      'tui', 'bag', 'backpack', 'wallet', 'vi',
      'my pham', 'cosmetic', 'skincare', 'makeup',
      'den', 'trang', 'do', 'xanh', 'vang', 'hong', 'tim', 'nau',
      'black', 'white', 'red', 'blue', 'green', 'yellow', 'pink',
    ];

    const words = normalized
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2);

    const directMatches = words.filter((word) =>
      productKeywords.some((keyword) => keyword.includes(word) || word.includes(keyword)),
    );
    return Array.from(new Set([...directMatches, ...words.slice(0, 8)]));
  }

  private calculateMatchScore(product: any, queryKeywords: string[]): number {
    let score = 0;
    const name = this.normalizeText(product.name);
    const searchFields = [
      name,
      this.normalizeText(product.aiDescription),
      ...(product.searchKeywords || []).map((k: string) => this.normalizeText(k)),
      ...(product.images || []).flatMap((img: any) =>
        img.aiAnalysis?.keywords?.map((k: string) => this.normalizeText(k)) || [],
      ),
    ];
    const allSearchText = searchFields.join(' ');

    queryKeywords.forEach((keyword) => {
      const normalizedKeyword = this.normalizeText(keyword);
      if (!normalizedKeyword) return;
      if (name.includes(normalizedKeyword)) score += 10;
      else if ((product.searchKeywords || []).some((k: string) => this.normalizeText(k).includes(normalizedKeyword))) score += 5;
      else if (allSearchText.includes(normalizedKeyword)) score += 2;
      else if (normalizedKeyword.length >= 4 && allSearchText.includes(normalizedKeyword.slice(0, -1))) score += 1;
    });

    return score;
  }

  private getMatchReasons(product: any, queryKeywords: string[]): string[] {
    const reasons: string[] = [];
    const name = this.normalizeText(product.name);
    queryKeywords.forEach((keyword) => {
      const normalizedKeyword = this.normalizeText(keyword);
      if (name.includes(normalizedKeyword)) reasons.push(`Name match: "${keyword}"`);
      else if ((product.searchKeywords || []).some((k: string) => this.normalizeText(k).includes(normalizedKeyword))) reasons.push(`Keyword match: "${keyword}"`);
    });
    return reasons.slice(0, 3);
  }
}

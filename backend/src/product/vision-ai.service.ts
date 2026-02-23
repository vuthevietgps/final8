/**
 * File: vision-ai.service.ts
 * Mục đích: Service tích hợp OpenAI Vision API để phân tích ảnh sản phẩm
 * Chức năng: Analyze images, extract keywords, generate descriptions
 */
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { OpenAIConfigService } from '../openai-config/openai-config.service';
import fetch from 'node-fetch';

export interface ImageAnalysis {
  objects: string[];
  colors: string[];
  features: string[];
  keywords: string[];
  description: string;
  confidence: number;
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

  /**
   * Analyze product image using OpenAI Vision API
   */
  async analyzeProductImage(imageUrl: string, configId?: string): Promise<ImageAnalysis> {
    try {
      // Get OpenAI configuration
      const config = configId 
        ? await this.openaiConfigService.findOne(configId)
        : await this.openaiConfigService.pickConfig({});

      if (!config || !config.apiKey || config.apiKey === 'placeholder-key') {
        throw new Error('No valid OpenAI configuration found');
      }

      const prompt = `
      Phân tích sản phẩm trong ảnh này và trả về JSON với format chính xác sau:
      {
        "objects": ["tên_đối_tượng_1", "tên_đối_tượng_2"],
        "colors": ["màu_1", "màu_2"],
        "features": ["tính_năng_1", "tính_năng_2"],
        "keywords": ["từ_khóa_1", "từ_khóa_2"],
        "description": "Mô tả chi tiết sản phẩm bằng tiếng Việt",
        "confidence": 0.85
      }
      
      Hãy tập trung vào:
      - Nhận diện chính xác sản phẩm và thương hiệu
      - Màu sắc chủ đạo
      - Tính năng đặc biệt có thể nhìn thấy
      - Từ khóa tìm kiếm phổ biến
      - Mô tả hấp dẫn cho bán hàng
      `;

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-4-vision-preview',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } }
            ]
          }],
          max_tokens: 800,
          temperature: 0.3
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenAI Vision API error: ${errorData.error?.message || 'Unknown error'}`);
      }

      const data: any = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('No content returned from OpenAI Vision API');
      }

      // Parse JSON response
      const cleanContent = content.replace(/```json\n?|\n?```/g, '').trim();
      const analysis: ImageAnalysis = JSON.parse(cleanContent);

      // Validate and set defaults
      return {
        objects: Array.isArray(analysis.objects) ? analysis.objects : [],
        colors: Array.isArray(analysis.colors) ? analysis.colors : [],
        features: Array.isArray(analysis.features) ? analysis.features : [],
        keywords: Array.isArray(analysis.keywords) ? analysis.keywords : [],
        description: analysis.description || 'Không thể tạo mô tả',
        confidence: typeof analysis.confidence === 'number' ? analysis.confidence : 0.7
      };

    } catch (error) {
      this.logger.error('Vision AI analysis failed', error.message);
      
      // Return fallback analysis
      return {
        objects: ['sản phẩm'],
        colors: ['đa màu'],
        features: ['chất lượng cao'],
        keywords: ['sản phẩm', 'chất lượng'],
        description: 'Sản phẩm chất lượng cao - cần cập nhật mô tả thủ công',
        confidence: 0.1
      };
    }
  }

  /**
   * Find similar products based on text description or keywords
   */
  async findSimilarProducts(
    query: string, 
    fanpageId: string,
    limit: number = 5
  ): Promise<ProductRecommendation[]> {
    try {
      // Extract keywords from query
      const queryKeywords = this.extractKeywords(query.toLowerCase());
      
      if (queryKeywords.length === 0) {
        return [];
      }

      this.logger.debug('Finding products with keywords:', queryKeywords);

      // Build search query
      const searchQuery: any = {
        'fanpageVariations.fanpageId': fanpageId,
        'fanpageVariations.isActive': true,
        status: 'Hoạt động'
      };

      // Multi-field search with scoring
      const products = await this.productModel.find(searchQuery)
        .populate('categoryId', 'name')
        .lean();

      // Score products based on keyword matching
      const scoredProducts: ProductRecommendation[] = [];

      for (const product of products) {
        const matchScore = this.calculateMatchScore(product as any, queryKeywords);
        
        if (matchScore > 0) {
          const matchReasons = this.getMatchReasons(product as any, queryKeywords);
          
          scoredProducts.push({
            product: product as unknown as ProductDocument,
            matchScore,
            matchReasons
          });
        }
      }

      // Sort by score and priority
      return scoredProducts
        .sort((a, b) => {
          const priorityA = a.product.fanpageVariations
            .find(v => v.fanpageId.toString() === fanpageId)?.priority || 0;
          const priorityB = b.product.fanpageVariations
            .find(v => v.fanpageId.toString() === fanpageId)?.priority || 0;
            
          // First by priority, then by match score
          if (priorityA !== priorityB) return priorityB - priorityA;
          return b.matchScore - a.matchScore;
        })
        .slice(0, limit);

    } catch (error) {
      this.logger.error('Product search failed', error.message);
      return [];
    }
  }

  /**
   * Generate comprehensive product description from multiple images
   */
  async generateProductDescription(images: any[]): Promise<string> {
    if (!images || images.length === 0) {
      return '';
    }

    // Combine all AI analyses
    const allKeywords = new Set<string>();
    const allFeatures = new Set<string>();
    const allColors = new Set<string>();

    images.forEach(img => {
      if (img.aiAnalysis) {
        img.aiAnalysis.keywords?.forEach((k: string) => allKeywords.add(k));
        img.aiAnalysis.features?.forEach((f: string) => allFeatures.add(f));
        img.aiAnalysis.colors?.forEach((c: string) => allColors.add(c));
      }
    });

    // Generate description
    let description = '';
    
    if (allFeatures.size > 0) {
      description += `Tính năng: ${Array.from(allFeatures).join(', ')}. `;
    }
    
    if (allColors.size > 0) {
      description += `Màu sắc: ${Array.from(allColors).join(', ')}. `;
    }

    return description.trim();
  }

  /**
   * Extract keywords from text using simple NLP
   */
  private extractKeywords(text: string): string[] {
    // Vietnamese product-related keywords
    const productKeywords = [
      'điện thoại', 'phone', 'iphone', 'samsung', 'oppo', 'vivo', 'xiaomi',
      'laptop', 'máy tính', 'computer', 'macbook', 'dell', 'hp', 'asus',
      'tai nghe', 'headphone', 'airpods', 'speaker', 'loa',
      'ốp lưng', 'case', 'bao da', 'miếng dán', 'cường lực',
      'sạc', 'charger', 'cable', 'cáp', 'pin', 'battery',
      'đồng hồ', 'watch', 'apple watch', 'smart watch',
      'quần áo', 'áo', 'quần', 'dress', 'shirt', 'pants',
      'giày', 'dép', 'shoes', 'sneaker', 'sandal',
      'túi', 'bag', 'backpack', 'wallet', 'ví',
      'mỹ phẩm', 'cosmetic', 'skincare', 'makeup',
      'đen', 'trắng', 'đỏ', 'xanh', 'vàng', 'hồng', 'tím', 'nâu',
      'black', 'white', 'red', 'blue', 'green', 'yellow', 'pink'
    ];

    const words = text.toLowerCase()
      .replace(/[^\w\sáàảãạăắằẳẵặâấầẩẫậéèẻẽẹêếềểễệíìỉĩịóòỏõọôốồổỗộơớờởỡợúùủũụưứừửữựýỳỷỹỵđ]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    return words.filter(word => 
      productKeywords.some(keyword => 
        keyword.includes(word) || word.includes(keyword)
      )
    );
  }

  /**
   * Calculate match score between product and query keywords
   */
  private calculateMatchScore(product: any, queryKeywords: string[]): number {
    let score = 0;
    const searchFields = [
      product.name?.toLowerCase() || '',
      product.aiDescription?.toLowerCase() || '',
      ...(product.searchKeywords || []).map((k: string) => k.toLowerCase()),
      ...(product.images || []).flatMap((img: any) => 
        img.aiAnalysis?.keywords?.map((k: string) => k.toLowerCase()) || []
      )
    ];

    const allSearchText = searchFields.join(' ');

    queryKeywords.forEach(keyword => {
      // Exact match in name (highest score)
      if (product.name?.toLowerCase().includes(keyword)) {
        score += 10;
      }
      // Match in search keywords
      else if (product.searchKeywords?.some((k: string) => k.toLowerCase().includes(keyword))) {
        score += 5;
      }
      // Match in AI analysis
      else if (allSearchText.includes(keyword)) {
        score += 2;
      }
      // Partial match
      else if (allSearchText.includes(keyword.substring(0, Math.max(3, keyword.length - 1)))) {
        score += 1;
      }
    });

    return score;
  }

  /**
   * Get human-readable match reasons
   */
  private getMatchReasons(product: any, queryKeywords: string[]): string[] {
    const reasons: string[] = [];

    queryKeywords.forEach(keyword => {
      if (product.name?.toLowerCase().includes(keyword)) {
        reasons.push(`Khớp tên sản phẩm: "${keyword}"`);
      } else if (product.searchKeywords?.some((k: string) => k.toLowerCase().includes(keyword))) {
        reasons.push(`Khớp từ khóa: "${keyword}"`);
      }
    });

    return reasons.slice(0, 3); // Limit to 3 reasons
  }
}

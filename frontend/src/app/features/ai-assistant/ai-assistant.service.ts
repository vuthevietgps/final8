import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ErpApiCatalogItem {
  domain: string;
  purpose: string;
  readEndpoints?: string[];
  writeEndpoints?: string[];
  aiUseCases?: string[];
  guardrails?: string[];
}

export interface RolePlaybook {
  role: string;
  title: string;
  summary: string;
  dailyQuestions?: string[];
  frequentScenarios?: string[];
  recommendedModules?: string[];
  allowedAiActions?: string[];
  restrictedAiActions?: string[];
}

export interface ScenarioWorkflow {
  scenarioId: string;
  roles?: string[];
  title: string;
  trigger: string;
  goal: string;
  readApis?: string[];
  writeApis?: string[];
  apiSufficiency?: 'sufficient' | 'partial' | 'missing';
  missingDataOrApi?: string[];
  executionMode?: 'read_only' | 'approval_required' | 'manual_handoff';
  approvalRequired?: boolean;
  guardrails?: string[];
}

export interface TokenManagementGuide {
  purpose: string;
  aiTokenRoutes: Array<{ route: string; permission: string; meaning: string }>;
  lifecycle: string[];
  guardrails: string[];
}

export interface AiOperatorRecommendation {
  id?: string;
  type?: string;
  priority?: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  reason: string;
  proposedAction?: string;
  requiresApproval?: boolean;
  riskLevel?: 'low' | 'medium' | 'high';
  source?: { module?: string; id?: string; linkTo?: string };
}

export interface AiOperatorSession {
  _id: string;
  userId: string;
  userRole?: string;
  userName?: string;
  title: string;
  status: 'active' | 'archived';
  messageCount: number;
  lastIntent?: string | null;
  lastScenarioId?: string | null;
  lastMessageAt?: string | null;
  windowDays?: number;
  tags?: string[];
  quality?: any;
  analysisFlags?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface AiOperatorMessageFeedback {
  rating: 'up' | 'down' | 'neutral';
  reason?: string | null;
  correction?: string | null;
  expectedIntent?: string | null;
  expectedScenarioId?: string | null;
  tags?: string[];
  reviewedAt?: string;
}

export interface AiOperatorAgentTraceStep {
  agent: string;
  status: 'ok' | 'warn' | 'blocked' | 'skipped';
  summary: string;
  inputs?: string[];
  outputs?: string[];
  guardrails?: string[];
}

export interface AiOperatorAgentTrace {
  mode: 'read_only' | 'approval_only';
  generatedAt: string;
  traceId: string;
  steps: AiOperatorAgentTraceStep[];
}

export interface AiOperatorStoredMessage {
  _id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  modelUsed?: string | null;
  intent?: string | null;
  scenarioId?: string | null;
  route?: any;
  contextSummary?: any;
  recommendations?: AiOperatorRecommendation[];
  qualitySignals?: any;
  agentTrace?: AiOperatorAgentTrace | null;
  feedback?: AiOperatorMessageFeedback | null;
  createdAt?: string;
}

export interface AiOperatorKnowledgeResponse {
  success: boolean;
  generatedAt: string;
  role: string | null;
  auth?: {
    userId: string | null;
    role: string | null;
    requestedRole?: string | null;
    fullName?: string | null;
    permissions: string[];
  };
  apiCatalog: ErpApiCatalogItem[];
  rolePlaybooks: RolePlaybook[];
  scenarioWorkflows: ScenarioWorkflow[];
  tokenManagement: TokenManagementGuide;
  guardrails: string[];
  workflowAudit?: any;
}

export interface AiOperatorTokenStatusResponse {
  success: boolean;
  generatedAt: string;
  status: {
    totalOpenAIConfigs: number;
    activeOpenAIConfigs: number;
    defaultOpenAIConfigs: number;
    byPurpose?: {
      adminAssistant: { total: number; active: number; default: number };
      customerChatbot: { total: number; active: number; default: number };
      general: { total: number; active: number; default: number };
    };
    configs: Array<{
      _id: string;
      name: string;
      purpose?: 'admin-assistant' | 'customer-chatbot' | 'general';
      model: string;
      apiKey?: string;
      scopeType: string;
      status?: string;
      isDefault?: boolean;
      updatedAt?: string;
    }>;
  };
  guide: TokenManagementGuide;
}

export interface AiOperatorChatResponse {
  success: boolean;
  mode: string;
  generatedAt: string;
  role: string | null;
  auth?: {
    userId: string | null;
    role: string | null;
    requestedRole?: string | null;
    fullName?: string | null;
    permissions: string[];
  };
  modelUsed: string | null;
  answer: string;
  recommendations: AiOperatorRecommendation[];
  knowledge: AiOperatorKnowledgeResponse;
  assistantQuality?: any;
  agentTrace?: AiOperatorAgentTrace | null;
  route?: {
    intent: string;
    scenarioId?: string | null;
    scenarioTitle?: string | null;
    apiSufficiency?: string | null;
    executionMode?: string | null;
    approvalRequired?: boolean;
    reason: string;
  };
  context?: any;
  snapshot: any;
  sessionId?: string | null;
  assistantMessageId?: string | null;
  userMessageId?: string | null;
  note: string;
}

@Injectable({ providedIn: 'root' })
export class AiAssistantService {
  private readonly baseUrl = `${environment.apiUrl}/ai-operator`;

  constructor(private readonly http: HttpClient) {}

  getKnowledge(role?: string): Observable<AiOperatorKnowledgeResponse> {
    let params = new HttpParams();
    if (role) params = params.set('role', role);
    return this.http.get<AiOperatorKnowledgeResponse>(`${this.baseUrl}/knowledge`, { params });
  }

  getTokenManagement(): Observable<AiOperatorTokenStatusResponse> {
    return this.http.get<AiOperatorTokenStatusResponse>(`${this.baseUrl}/token-management`);
  }

  listSessions(limit = 30): Observable<{ success: boolean; scope: string; sessions: AiOperatorSession[] }> {
    const params = new HttpParams().set('limit', String(limit)).set('status', 'active');
    return this.http.get<{ success: boolean; scope: string; sessions: AiOperatorSession[] }>(`${this.baseUrl}/sessions`, { params });
  }

  getSession(sessionId: string): Observable<{ success: boolean; session: AiOperatorSession; messages: AiOperatorStoredMessage[] }> {
    return this.http.get<{ success: boolean; session: AiOperatorSession; messages: AiOperatorStoredMessage[] }>(`${this.baseUrl}/sessions/${sessionId}`);
  }

  createSession(title?: string): Observable<{ success: boolean; session: AiOperatorSession }> {
    return this.http.post<{ success: boolean; session: AiOperatorSession }>(`${this.baseUrl}/sessions`, { title });
  }

  updateSession(sessionId: string, body: Partial<Pick<AiOperatorSession, 'title' | 'status'>>): Observable<{ success: boolean; session: AiOperatorSession }> {
    return this.http.patch<{ success: boolean; session: AiOperatorSession }>(`${this.baseUrl}/sessions/${sessionId}`, body);
  }

  submitMessageFeedback(
    messageId: string,
    body: {
      rating: 'up' | 'down' | 'neutral';
      reason?: string;
      correction?: string;
      expectedIntent?: string;
      expectedScenarioId?: string;
      tags?: string[];
    },
  ): Observable<{ success: boolean; message: AiOperatorStoredMessage; sessionId: string }> {
    return this.http.post<{ success: boolean; message: AiOperatorStoredMessage; sessionId: string }>(
      `${this.baseUrl}/messages/${messageId}/feedback`,
      body,
    );
  }

  getConversationAnalytics(params?: { from?: string; to?: string; limit?: number; all?: boolean }): Observable<any> {
    let httpParams = new HttpParams();
    if (params?.from) httpParams = httpParams.set('from', params.from);
    if (params?.to) httpParams = httpParams.set('to', params.to);
    if (params?.limit) httpParams = httpParams.set('limit', String(params.limit));
    if (params?.all) httpParams = httpParams.set('all', 'true');
    return this.http.get<any>(`${this.baseUrl}/analytics/summary`, { params: httpParams });
  }

  getWorkflowQuality(role?: string): Observable<any> {
    let params = new HttpParams();
    if (role) params = params.set('role', role);
    return this.http.get<any>(`${this.baseUrl}/workflow-quality`, { params });
  }

  chat(
    message: string,
    role: string,
    windowDays: number,
    scenarioId?: string,
    intent?: string,
    sessionId?: string | null,
  ): Observable<AiOperatorChatResponse> {
    return this.http.post<AiOperatorChatResponse>(`${this.baseUrl}/chat`, {
      message,
      role,
      windowDays,
      scenarioId,
      intent,
      sessionId,
    });
  }
}

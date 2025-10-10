/** Service quản lý Chat Messages (frontend) */
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

export interface ChatMessage {
  _id: string;
  fanpageId: string;
  senderPsid: string;
  direction: 'in'|'out';
  content: string;
  messageType?: string;
  adGroupId?: string;
  aiModelUsed?: string;
  isAI?: boolean;
  isClarify?: boolean;
  isSuggestion?: boolean;
  isClosing?: boolean;
  awaitingHuman?: boolean;
  receivedAt?: string;
  createdAt?: string;
}

export interface ConversationSummary {
  fanpageId: string | {pageId: string; name: string; _id: string};
  senderPsid: string;
  totalMessages: number;
  inboundCount: number;
  outboundCount: number;
  awaitingCount: number;
  lastMessageSnippet?: string;
  lastDirection?: 'in'|'out';
  lastMessageAt?: string;
  lastAdGroupId?: string;
  needsHuman?: boolean;
  hasAwaitingHuman?: boolean;
  firstAwaitingAt?: string;
  lastResolvedAt?: string;
  autoAiEnabled?: boolean;
  orderCustomerName?: string;
  orderPhone?: string;
}

export interface ConversationListResponse { items: ConversationSummary[]; total: number; page: number; limit: number; totalPages: number; }

@Injectable({ providedIn: 'root' })
export class ChatMessageService {
  private baseUrl = `${environment.apiUrl}/chat-messages`;
  constructor(private http: HttpClient) {}

  // Individual message CRUD methods removed
  // Focus on conversation-level operations

  listConversations(filter: any = {}): Observable<ConversationListResponse> {
    let params = new HttpParams();
    Object.keys(filter).forEach(k=>{ if(filter[k]!==undefined && filter[k]!=='' ) params = params.set(k, filter[k]); });
    return this.http.get<ConversationListResponse>(`${this.baseUrl}/conversations/list/all`, { params });
  }

  getConversation(fanpageId: string, senderPsid: string){
    return this.http.get<{conversation: ConversationSummary; messages: ChatMessage[]}>(`${this.baseUrl}/conversations/${fanpageId}/${senderPsid}`);
  }

  resolveConversation(fanpageId: string, senderPsid: string){
    return this.http.patch<{conversation: ConversationSummary; messages: ChatMessage[]}>(`${this.baseUrl}/conversations/${fanpageId}/${senderPsid}/resolve`, {});
  }
  toggleAutoAI(fanpageId: string, senderPsid: string, enabled: boolean){
    return this.http.patch<{fanpageId: string; senderPsid: string; autoAiEnabled: boolean}>(`${this.baseUrl}/conversations/${fanpageId}/${senderPsid}/auto-ai`, { enabled });
  }
  extractOrder(fanpageId: string, senderPsid: string){
    return this.http.get<any>(`${this.baseUrl}/conversations/${fanpageId}/${senderPsid}/extract-order`);
  }

  // Thực gửi tin ra Facebook Graph API (backend sẽ gọi Graph). Trả về { message, fb, saved }
  sendMessage(fanpageId: string, senderPsid: string, text: string){
    return this.http.post<{message: string; fb: any; saved: ChatMessage}>(`${this.baseUrl}/send`, { fanpageId, senderPsid, text });
  }
}

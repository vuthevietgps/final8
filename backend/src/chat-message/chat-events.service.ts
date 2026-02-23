import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';

export interface ChatEvent {
  type: 'new-message';
  fanpageId: string;
  senderPsid: string;
  direction: 'in' | 'out' | 'system';
  snippet?: string;
  createdAt?: string | Date;
}

@Injectable()
export class ChatEventsService {
  private subject = new Subject<ChatEvent>();

  emit(event: ChatEvent) {
    this.subject.next(event);
  }

  stream(): Observable<ChatEvent> {
    return this.subject.asObservable();
  }
}

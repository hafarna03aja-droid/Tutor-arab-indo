export enum Author {
  USER = 'user',
  TUTOR = 'tutor',
}

export interface ConversationTurn {
  id: string;
  author: Author;
  indonesianText?: string;
  arabicText: string;
}

export enum AppView {
  CONVERSATION = 'conversation',
  BASICS = 'basics',
  TRANSLATOR = 'translator',
}
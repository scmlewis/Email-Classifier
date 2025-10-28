
export interface EmailClassification {
  category: string;
  priority: string;
  suggestedRecipient: string;
  summary: string;
}

export interface ClassifiedEmailHistoryItem {
  id: string;
  timestamp: string;
  emailContent: string;
  classification: EmailClassification;
}

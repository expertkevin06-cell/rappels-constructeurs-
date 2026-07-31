export interface Recall {
  id: string;
  campaignNumber: string;
  title: string;
  manufacturer: string;
  model?: string;
  year?: string;
  category: string;
  publicationDate: string;
  riskDescription: string;
  reason: string;
  remedy?: string;
  aiSourced?: boolean;
  sourceUrl?: string;
}

export interface RecallDataset {
  generatedAt: string;
  source: string;
  count: number;
  recalls: Recall[];
}

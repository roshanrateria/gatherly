export type IdeaCategory =
  | 'theme'
  | 'decor'
  | 'menu'
  | 'entertainment'
  | 'activity'
  | 'invitation'
  | 'gift'
  | 'photo_concept';

export type IdeaCostTier = 'low' | 'medium' | 'high' | 'luxury';

export interface Idea {
  id: string;
  category: IdeaCategory;
  title: string;
  description: string;
  fitExplanation: string;
  estimatedCostTier: IdeaCostTier;
  estimatedAmount?: number;
  requirements: string[];
  status: 'suggested' | 'saved' | 'rejected';
  tags: string[];
}

export interface DiscussionItem {
  id: number;
  parentId: number | null;
  rootId: number;
  depth: number;
  reviewId: number | null;
  authorName: string;
  official: boolean;
  verified: boolean;
  rating: number | null;
  comment: string;
  createdAt: string;
  likeCount: number;
  liked: boolean;
  canDelete: boolean;
  images: { id: string; width: number; height: number }[];
  adminReply: string | null;
  adminRepliedAt: string | null;
}
export interface DiscussionPayload {
  viewer: { name: string; isAdmin: boolean } | null;
  canRate: boolean;
  ownReview: { id: number; rating: number; comment: string; status: string } | null;
  summary: { average: number | null; count: number; distribution: number[] };
  items: DiscussionItem[];
  hasMore: boolean;
  total: number;
}

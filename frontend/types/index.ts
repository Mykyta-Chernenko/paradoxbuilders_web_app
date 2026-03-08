export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  diff?: {
    original: string;
    modified: string;
  };
  status?: "pending" | "accepted" | "rejected" | "error";
  timestamp: Date;
}

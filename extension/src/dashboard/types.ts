export interface Issue {
  id: string;
  created_at: string;
  user_id: string | null;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  url: string;
  ai_analysis?: string;
  screenshot_url?: string | null;   // Public or pre-signed URL stored at insert time
  screenshot_path?: string | null;  // Storage path for generating signed URLs on demand
  browser_info?: {
    screen?: string;
    userAgent?: string;
    language?: string;
    isMobile?: boolean;
  };
  console?: any[];
  network?: any[];
  dom?: string;
}

export type AttendanceStatus = 'yes' | 'maybe' | 'no';
export interface User {
  id: number; name: string; username: string; is_admin: boolean;
  avatar_url: string | null; participant_id: number | null;
}
export interface Attendance {
  mine: AttendanceStatus | null;
  counts: Record<AttendanceStatus, number>;
  people: { participant_id: number; name: string; avatar_url: string | null; status: AttendanceStatus }[];
}
export interface HomeData {
  settings: { event_title: string; event_date: string; event_place: string; contribution_value: number };
  attendance: Attendance;
  vaquinha: { arrecadado: number; gasto: number; saldo: number; pagos: number; total: number };
  recentPosts: { id: number; user_name: string; avatar_url: string | null; content: string; first_image: string | null; created_at: string }[];
  secretSanta: { active: boolean; revealed: boolean };
}
export interface Invite { valid: boolean; label?: string; participant_name?: string | null; reason?: string }

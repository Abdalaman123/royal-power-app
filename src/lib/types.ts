export type TicketStatus = 'pending' | 'in_progress' | 'resolved' | 'cancelled'
export type Priority = 'low' | 'medium' | 'high' | 'critical'

export interface Profile {
  id: string
  email: string | null
  full_name: string | null
  designation: string | null
  phone: string | null
  role: 'user' | 'admin'
  must_change_password: boolean
  notify_new_ticket: boolean
  notify_critical: boolean
  notify_updates: boolean
  notify_cancelled: boolean
}

export interface Department {
  id: string
  name: string
  description: string | null
  is_active: boolean
  sort_order: number
}

export interface Category {
  id: string
  name: string
  description: string | null
  icon: string | null
  is_active: boolean
  sort_order: number
}

export interface EquipmentItem {
  id: string
  category_id: string
  name: string
  description: string | null
  is_active: boolean
  is_available: boolean
  is_other: boolean
  sort_order: number
}

export interface TicketItem {
  id: string
  ticket_id: string
  category_id: string | null
  category_name: string | null
  item_id: string | null
  item_name: string
  is_custom: boolean
  quantity: number
}

export interface Attachment {
  path: string
  name: string
  size: number
  type: string
}

export interface Ticket {
  id: string
  ticket_no: string
  full_name: string
  employee_id: string
  email: string
  department_id: string | null
  department_name: string
  designation: string
  branch: string
  priority: Priority
  status: TicketStatus
  reason: string
  notes: string | null
  attachments: Attachment[]
  admin_remarks: string | null
  resolution_notes: string | null
  assigned_to: string | null
  status_updated_at: string
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export type TicketRow = Ticket & { ticket_items: Pick<TicketItem, 'item_name' | 'quantity'>[] }

export interface ActivityLog {
  id: string
  ticket_id: string
  actor_id: string | null
  actor_name: string | null
  action: string
  from_status: string | null
  to_status: string | null
  message: string | null
  is_public: boolean
  created_at: string
}

export interface NotificationRow {
  id: string
  recipient_id: string
  type: 'new_ticket' | 'critical_ticket' | 'ticket_updated' | 'ticket_cancelled'
  title: string
  message: string | null
  ticket_id: string | null
  is_read: boolean
  created_at: string
}

export interface Sop {
  id: string
  code: string
  title: string
  icon: string
  summary: string
  points: string[]
}

export interface Analytics {
  totals: { total: number; pending: number; in_progress: number; resolved: number; cancelled: number; critical: number }
  by_status: { status: TicketStatus; count: number }[]
  by_priority: { priority: Priority; count: number }[]
  by_department: { name: string; count: number }[]
  top_items: { name: string; requests: number; quantity: number }[]
  monthly: { month: string; total: number; resolved: number }[]
  avg_resolution_hours: number | null
}

export interface TrackResult {
  ok: boolean
  message?: string
  ticket?: {
    ticket_no: string
    status: TicketStatus
    priority: Priority
    full_name: string
    department_name: string
    designation: string
    branch: string
    reason: string
    assigned_to: string | null
    resolution_notes: string | null
    created_at: string
    status_updated_at: string
  }
  items?: { item_name: string; category_name: string | null; quantity: number }[]
  history?: { action: string; from_status: string | null; to_status: string | null; message: string | null; created_at: string }[]
}

export interface OfficeUser {
  id: string
  employee_id: string
  full_name: string
  email: string | null
  phone: string | null
  department_id: string | null
  department_name: string | null
  designation: string | null
  branch: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Assignment {
  id: string
  user_id: string
  item_id: string | null
  item_name: string
  category_name: string | null
  quantity: number
  serial_no: string | null
  asset_tag: string | null
  ticket_no: string | null
  notes: string | null
  status: 'assigned' | 'returned'
  assigned_at: string
  assigned_by_name: string | null
  returned_at: string | null
  return_notes: string | null
  returned_by_name: string | null
}

export type AssignmentWithUser = Assignment & {
  office_users: Pick<OfficeUser, 'employee_id' | 'full_name' | 'department_name' | 'designation' | 'email' | 'phone'> | null
}

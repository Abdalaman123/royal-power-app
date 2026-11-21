import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import type { Analytics } from '../lib/types'
import { PRIORITY_META, STATUS_META } from '../lib/utils'
import { EmptyState } from './ui'

const TOOLTIP = { borderRadius: 12, border: '1px solid #E2E8F0', boxShadow: '0 8px 24px rgba(56,189,248,0.15)', fontSize: 13 }
const AXIS = { fontSize: 12, fill: '#4A6580' }

export function ChartCard({ title, subtitle, children, empty }: { title: string; subtitle?: string; children: ReactNode; empty?: boolean }) {
  return (
    <div className="glass p-5">
      <h3 className="font-bold">{title}</h3>
      {subtitle && <p className="text-xs text-ink-soft">{subtitle}</p>}
      <div className="mt-4 h-72">
        {empty ? <EmptyState icon={BarChart3} title="No data yet" message="Charts fill in as tickets are submitted." /> : children}
      </div>
    </div>
  )
}

export function StatusDonut({ data }: { data: Analytics['by_status'] }) {
  const rows = data.map((d) => ({ name: STATUS_META[d.status].label, value: d.count, color: STATUS_META[d.status].color }))
  return (
    <ChartCard title="Tickets by Status" subtitle="Share of tickets in each stage" empty={rows.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={rows} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="85%" paddingAngle={3} stroke="none">
            {rows.map((r) => (
              <Cell key={r.name} fill={r.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP} />
          <Legend iconType="circle" />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function DepartmentBar({ data }: { data: Analytics['by_department'] }) {
  const rows = data.slice(0, 10)
  return (
    <ChartCard title="Requests by Department" subtitle="Top departments by ticket count" empty={rows.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
          <XAxis type="number" allowDecimals={false} tick={AXIS} />
          <YAxis type="category" dataKey="name" width={120} tick={AXIS} />
          <Tooltip contentStyle={TOOLTIP} cursor={{ fill: 'rgba(56,189,248,0.08)' }} />
          <Bar dataKey="count" name="Tickets" fill="#38BDF8" radius={[0, 8, 8, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function TopItemsBar({ data }: { data: Analytics['top_items'] }) {
  return (
    <ChartCard title="Most Requested IT Equipment" subtitle="Number of requests containing the item" empty={data.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
          <XAxis type="number" allowDecimals={false} tick={AXIS} />
          <YAxis type="category" dataKey="name" width={130} tick={AXIS} />
          <Tooltip contentStyle={TOOLTIP} cursor={{ fill: 'rgba(56,189,248,0.08)' }} />
          <Bar dataKey="requests" name="Requests" fill="#0EA5E9" radius={[0, 8, 8, 0]} />
          <Bar dataKey="quantity" name="Units" fill="#CBD5E1" radius={[0, 8, 8, 0]} />
          <Legend iconType="circle" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function MonthlyTrend({ data }: { data: Analytics['monthly'] }) {
  const empty = data.every((d) => d.total === 0)
  return (
    <ChartCard title="Monthly Ticket Trends" subtitle="Last 12 months" empty={empty}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -16, right: 8 }}>
          <defs>
            <linearGradient id="gTotal" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#38BDF8" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="gRes" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22C55E" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#22C55E" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis dataKey="month" tick={AXIS} />
          <YAxis allowDecimals={false} tick={AXIS} />
          <Tooltip contentStyle={TOOLTIP} />
          <Legend iconType="circle" />
          <Area type="monotone" dataKey="total" name="Submitted" stroke="#0EA5E9" strokeWidth={2.5} fill="url(#gTotal)" />
          <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#22C55E" strokeWidth={2.5} fill="url(#gRes)" />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

export function PriorityBar({ data }: { data: Analytics['by_priority'] }) {
  const order = ['low', 'medium', 'high', 'critical'] as const
  const rows = order
    .map((p) => ({ name: PRIORITY_META[p].label, count: data.find((d) => d.priority === p)?.count ?? 0, color: PRIORITY_META[p].color }))
  return (
    <ChartCard title="Tickets by Priority" empty={data.length === 0}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ left: -16, right: 8 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
          <XAxis dataKey="name" tick={AXIS} />
          <YAxis allowDecimals={false} tick={AXIS} />
          <Tooltip contentStyle={TOOLTIP} cursor={{ fill: 'rgba(56,189,248,0.08)' }} />
          <Bar dataKey="count" name="Tickets" radius={[8, 8, 0, 0]}>
            {rows.map((r) => (
              <Cell key={r.name} fill={r.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}

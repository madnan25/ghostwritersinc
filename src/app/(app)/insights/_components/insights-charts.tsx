'use client'

import { useMemo } from 'react'
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  Legend,
} from 'recharts'
import type { PostWithPerformance } from '@/lib/queries/posts'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CONTENT_TYPE_LABELS: Record<string, string> = {
  text: 'Text',
  image: 'Image',
  document: 'Document',
}

interface InsightsChartsProps {
  posts: PostWithPerformance[]
}

function SparsePlaceholder({ label }: { label: string }) {
  return (
    <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">Need at least 10 posts with data to show this chart</p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="mb-4 text-sm font-semibold">{title}</h3>
      {children}
    </div>
  )
}

const CHART_TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--foreground))',
  fontSize: '12px',
}

export function InsightsCharts({ posts }: InsightsChartsProps) {
  const engagement = (p: PostWithPerformance) => p.reactions + p.comments_count + p.reposts

  // --- By Pillar ---
  const pillarData = useMemo(() => {
    const map = new Map<string, { name: string; color: string; engagements: number[]; impressions: number[] }>()
    for (const p of posts) {
      if (!p.pillar_id) continue
      if (!map.has(p.pillar_id)) {
        map.set(p.pillar_id, {
          name: p.pillar_name ?? 'Unknown',
          color: p.pillar_color ?? '#6366f1',
          engagements: [],
          impressions: [],
        })
      }
      const entry = map.get(p.pillar_id)!
      entry.engagements.push(engagement(p))
      entry.impressions.push(p.impressions)
    }
    return Array.from(map.values()).map((entry) => ({
      name: entry.name,
      color: entry.color,
      avgEngagement: entry.engagements.length
        ? Math.round(entry.engagements.reduce((s, v) => s + v, 0) / entry.engagements.length)
        : 0,
      avgImpressions: entry.impressions.length
        ? Math.round(entry.impressions.reduce((s, v) => s + v, 0) / entry.impressions.length)
        : 0,
      posts: entry.engagements.length,
    }))
  }, [posts])

  // --- By Content Type ---
  const contentTypeData = useMemo(() => {
    const map = new Map<string, { engagements: number[]; impressions: number[] }>()
    for (const p of posts) {
      if (!map.has(p.content_type)) map.set(p.content_type, { engagements: [], impressions: [] })
      const entry = map.get(p.content_type)!
      entry.engagements.push(engagement(p))
      entry.impressions.push(p.impressions)
    }
    return Array.from(map.entries()).map(([type, data]) => ({
      name: CONTENT_TYPE_LABELS[type] ?? type,
      avgEngagement: data.engagements.length
        ? Math.round(data.engagements.reduce((s, v) => s + v, 0) / data.engagements.length)
        : 0,
      avgImpressions: data.impressions.length
        ? Math.round(data.impressions.reduce((s, v) => s + v, 0) / data.impressions.length)
        : 0,
      posts: data.engagements.length,
    }))
  }, [posts])

  // --- By Day of Week ---
  const dayData = useMemo(() => {
    const map = new Map<number, { engagements: number[]; impressions: number[] }>()
    for (const p of posts) {
      const dateStr = p.published_at ?? p.suggested_publish_at ?? p.created_at
      const day = new Date(dateStr).getDay()
      if (!map.has(day)) map.set(day, { engagements: [], impressions: [] })
      const entry = map.get(day)!
      entry.engagements.push(engagement(p))
      entry.impressions.push(p.impressions)
    }
    return [0, 1, 2, 3, 4, 5, 6].map((day) => {
      const data = map.get(day)
      return {
        name: DAY_NAMES[day],
        avgEngagement: data?.engagements.length
          ? Math.round(data.engagements.reduce((s, v) => s + v, 0) / data.engagements.length)
          : 0,
        avgImpressions: data?.impressions.length
          ? Math.round(data.impressions.reduce((s, v) => s + v, 0) / data.impressions.length)
          : 0,
        posts: data?.engagements.length ?? 0,
      }
    })
  }, [posts])

  // --- Trend Over Time (monthly) ---
  const trendData = useMemo(() => {
    const map = new Map<string, { engagements: number[]; impressions: number[] }>()
    for (const p of posts) {
      const dateStr = p.published_at ?? p.suggested_publish_at ?? p.created_at
      const d = new Date(dateStr)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!map.has(key)) map.set(key, { engagements: [], impressions: [] })
      const entry = map.get(key)!
      entry.engagements.push(engagement(p))
      entry.impressions.push(p.impressions)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        avgEngagement: data.engagements.length
          ? Math.round(data.engagements.reduce((s, v) => s + v, 0) / data.engagements.length)
          : 0,
        avgImpressions: data.impressions.length
          ? Math.round(data.impressions.reduce((s, v) => s + v, 0) / data.impressions.length)
          : 0,
        posts: data.engagements.length,
      }))
  }, [posts])

  const sparse = posts.length < 10

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Performance by Pillar */}
      <ChartCard title="Avg Engagement by Pillar">
        {sparse || pillarData.length === 0 ? (
          <SparsePlaceholder label="Performance by Pillar" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={pillarData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value) => [value, 'Avg engagement']}
              />
              <Bar dataKey="avgEngagement" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                {pillarData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Performance by Content Type */}
      <ChartCard title="Avg Engagement by Content Type">
        {sparse || contentTypeData.length === 0 ? (
          <SparsePlaceholder label="Performance by Content Type" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={contentTypeData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value) => [value, 'Avg engagement']}
              />
              <Bar dataKey="avgEngagement" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Performance by Day of Week */}
      <ChartCard title="Avg Engagement by Day of Week">
        {sparse ? (
          <SparsePlaceholder label="Performance by Day of Week" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dayData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value, name) => [value, name === 'avgEngagement' ? 'Avg engagement' : 'Posts']}
              />
              <Bar dataKey="avgEngagement" fill="#6366f1" radius={[4, 4, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Trend Over Time */}
      <ChartCard title="Engagement Trend Over Time">
        {sparse || trendData.length < 2 ? (
          <SparsePlaceholder label="Engagement Trend Over Time" />
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ top: 0, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                formatter={(value, name) => [
                  value,
                  name === 'avgEngagement' ? 'Avg engagement' : 'Avg impressions',
                ]}
              />
              <Legend
                wrapperStyle={{ fontSize: '11px', color: 'hsl(var(--muted-foreground))' }}
                formatter={(value) => (value === 'avgEngagement' ? 'Avg engagement' : 'Avg impressions')}
              />
              <Line
                type="monotone"
                dataKey="avgEngagement"
                stroke="#6366f1"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="avgImpressions"
                stroke="#22d3ee"
                strokeWidth={2}
                dot={{ r: 3 }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  )
}

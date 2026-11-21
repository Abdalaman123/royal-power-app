import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { PackageSearch, Search } from 'lucide-react'
import { useCatalog } from '../lib/hooks'
import { getIcon } from '../lib/icons'
import { cn } from '../lib/utils'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../components/ui'

export default function EquipmentCatalog() {
  const { categories, items, loading, error, reload } = useCatalog()
  const location = useLocation()
  const initial = (location.state as { categoryId?: string } | null)?.categoryId ?? 'all'
  const [active, setActive] = useState<string>(initial)
  const [q, setQ] = useState('')

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase()
    return categories
      .filter((c) => active === 'all' || c.id === active)
      .map((c) => ({
        category: c,
        items: items.filter(
          (i) => i.category_id === c.id && (!term || i.name.toLowerCase().includes(term) || (i.description ?? '').toLowerCase().includes(term)),
        ),
      }))
      .filter((g) => g.items.length > 0)
  }, [categories, items, active, q])

  return (
    <div>
      <PageHeader title="Equipment Catalog" subtitle="Everything IT can supply. Pick an item to start a request." />

      <div className="glass mb-6 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input className="input pl-10" placeholder="Search equipment…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search equipment" />
        </div>
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Categories">
          {[{ id: 'all', name: 'All categories', icon: null as string | null }, ...categories].map((c) => {
            const Icon = c.id === 'all' ? PackageSearch : getIcon((c as { icon: string | null }).icon)
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={active === c.id}
                onClick={() => setActive(c.id)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition',
                  active === c.id ? 'bg-gradient-to-r from-primary-400 to-primary-600 text-white shadow-md shadow-primary-400/30' : 'bg-white/80 text-ink-soft ring-1 ring-silver-200 hover:bg-primary-50',
                )}
              >
                <Icon className="h-4 w-4" /> {c.name}
              </button>
            )
          })}
        </div>
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="glass">
          <EmptyState icon={PackageSearch} title="No equipment found" message="Try a different search or category." />
        </div>
      ) : (
        <div className="space-y-8">
          {visible.map(({ category, items: list }) => {
            const Icon = getIcon(category.icon)
            return (
              <section key={category.id} aria-labelledby={`c-${category.id}`}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h2 id={`c-${category.id}`} className="text-lg font-bold leading-tight">{category.name}</h2>
                    {category.description && <p className="text-xs text-ink-soft">{category.description}</p>}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {list.map((i) => (
                    <div key={i.id} className={cn('glass flex flex-col justify-between gap-3 p-4', !i.is_available && 'opacity-70')}>
                      <div>
                        <h3 className="font-bold leading-snug">{i.is_other ? 'Other (specify)' : i.name}</h3>
                        {i.description && <p className="mt-1 line-clamp-2 text-xs text-ink-soft">{i.description}</p>}
                      </div>
                      <div className="flex items-center justify-between">
                        <span
                          className={cn(
                            'badge',
                            i.is_available ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-slate-100 text-slate-600 ring-slate-200',
                          )}
                        >
                          {i.is_available ? 'Available' : 'Unavailable'}
                        </span>
                        {i.is_available && (
                          <Link to="/request/new" state={{ categoryId: category.id, itemId: i.id }} className="text-xs font-bold text-primary-700 hover:underline">
                            Request →
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

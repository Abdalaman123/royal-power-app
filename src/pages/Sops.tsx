import { useState } from 'react'
import { BookOpen } from 'lucide-react'
import { useSettings } from '../contexts/SettingsContext'
import { PageHeader } from '../components/ui'
import SopCard from '../components/SopCard'

export default function Sops() {
  const { settings } = useSettings()
  const [expandAll, setExpandAll] = useState(false)

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="IT Standard Operating Procedures"
        subtitle="Company IT rules and best practices. Select a card to read the details."
        actions={
          <button className="btn-secondary" onClick={() => setExpandAll((v) => !v)}>
            <BookOpen className="h-4 w-4" /> {expandAll ? 'Collapse all' : 'Expand all'}
          </button>
        }
      />
      <div className="space-y-4">
        {settings.sops.map((s) => (
          <SopCard key={`${s.id}-${expandAll}`} sop={s} defaultOpen={expandAll} />
        ))}
      </div>
    </div>
  )
}

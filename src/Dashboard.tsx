import { ArrowRight, BookOpen, Check, ClipboardCheck, ClipboardList, Clock3, FilePlus2, Plus, RotateCcw, type LucideIcon } from 'lucide-react'
import { formatDate, formatNumber, statusInfo, type Question, type Status, type Tone } from './data'
import { Bar, PageHeading, StatusPill, TextLink } from './ui'

const metrics: Array<{title: string; icon: LucideIcon; tone: Tone; href: string; status?: Status}> = [
  {title: 'Total Soal', icon: BookOpen, tone: 'blue', href: '#/bank-soal'},
  {title: 'Menunggu Review', icon: Clock3, tone: 'amber', href: '#/review-soal', status: 'review'},
  {title: 'Soal Disetujui', icon: Check, tone: 'green', href: '#/bank-soal?status=approved', status: 'approved'},
  {title: 'Perlu Revisi', icon: RotateCcw, tone: 'red', href: '#/bank-soal?status=revision', status: 'revision'},
]

const actions = [
  {title: 'Buat Soal', description: 'Tulis soal baru atau mulai dari contoh AI.', icon: FilePlus2, tone: 'blue', href: '#/buat-soal'},
  {title: 'Review Soal', description: 'Periksa draf yang menunggu keputusan.', icon: ClipboardCheck, tone: 'amber', href: '#/review-soal'},
  {title: 'Buat Paket Ujian', description: 'Susun paket dari soal yang disetujui.', icon: ClipboardList, tone: 'purple', href: '#/paket-ujian?baru=1'},
]

export function Dashboard({questions, onOpen}: {questions: Question[]; onOpen: (id: string) => void}) {
  const count = (status?: Status) => status ? questions.filter((question) => question.status === status).length : questions.length
  const recent = [...questions].sort((first, second) => second.updated.localeCompare(first.updated)).slice(0, 4)
  const distribution: Status[] = ['approved', 'review', 'revision', 'draft']
  if (count('rejected')) distribution.push('rejected')

  return <>
    <PageHeading title="Dashboard" description="Pantau koleksi soal, antrean review, dan kualitas soal."
      action={<a className="button primary" href="#/buat-soal"><Plus size={18} /> Buat Soal</a>} />

    <section className="metric-grid" aria-label="Ringkasan Bank Soal">
      {metrics.map(({title, icon: Icon, tone, href, status}) => <a className="metric card" href={href} key={title}>
        <span className={`icon-tile tone-${tone}`}><Icon size={21} strokeWidth={1.9} aria-hidden="true" /></span>
        <span className="metric-label">{title}</span>
        <span className="metric-value">{formatNumber(count(status))}</span>
        <ArrowRight className="metric-arrow" size={17} aria-hidden="true" />
      </a>)}
    </section>

    <div className="dashboard-grid">
      <section className="card dashboard-panel">
        <div className="panel-heading"><h2>Aktivitas Terbaru</h2><TextLink href="#/bank-soal">Lihat Bank Soal</TextLink></div>
        <div className="activity-columns"><span>Soal</span><span>Status</span></div>
        <ul className="activity-list">
          {recent.map((question) => <li key={question.id}>
            <button type="button" className="activity-row" onClick={() => onOpen(question.id)}>
              <span className="activity-title"><strong>{question.title}</strong><small>{question.course} <span aria-hidden="true">·</span> {formatDate(question.updated)}</small></span>
              <StatusPill status={question.status} />
            </button>
          </li>)}
        </ul>
      </section>

      <section className="card dashboard-panel">
        <div className="panel-heading"><h2>Distribusi Status Soal</h2></div>
        <ul className="distribution-list">
          {distribution.map((status) => {
            const {label, tone} = statusInfo[status]
            const percent = questions.length ? Math.round(100 * count(status) / questions.length) : 0
            return <li key={status}>
              <div className="bar-label"><span>{label}</span><strong>{percent}%</strong></div>
              <Bar value={percent} tone={tone} />
            </li>
          })}
        </ul>
      </section>
    </div>

    <section className="quick-section">
      <div className="panel-heading"><h2>Aksi Cepat</h2></div>
      <div className="quick-grid">
        {actions.map(({title, description, icon: Icon, tone, href}) => <a className="quick-card card" href={href} key={title}>
          <span className={`icon-tile tone-${tone}`}><Icon size={20} strokeWidth={1.9} aria-hidden="true" /></span>
          <span><strong>{title}</strong><small>{description}</small></span>
          <ArrowRight size={17} className="quick-arrow" aria-hidden="true" />
        </a>)}
      </div>
    </section>
  </>
}

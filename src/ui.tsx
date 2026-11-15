import { ArrowRight, Inbox, X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { statusInfo, type Status, type Tone } from './data'

export function PageHeading({title, description, action}: {title: string; description: string; action?: ReactNode}) {
  return <div className="page-heading">
    <div><h1 id="page-title" tabIndex={-1}>{title}</h1><p>{description}</p></div>
    {action}
  </div>
}

export function Pill({children, tone = 'gray'}: {children: ReactNode; tone?: Tone}) {
  return <span className={`pill tone-${tone}`}><span className="status-dot" />{children}</span>
}

export function StatusPill({status}: {status: Status}) {
  const {label, tone} = statusInfo[status]
  return <Pill tone={tone}>{label}</Pill>
}

export function Empty({title, description, action}: {title: string; description: string; action?: ReactNode}) {
  return <div className="empty">
    <span className="icon-tile tone-gray"><Inbox size={22} aria-hidden="true" /></span>
    <h3>{title}</h3><p>{description}</p>{action}
  </div>
}

export function Dialog({title, children, onClose, wide = false}: {title: string; children: ReactNode; onClose: () => void; wide?: boolean}) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    element?.showModal()
    return () => element?.close()
  }, [])

  return <dialog ref={dialog} className={wide ? 'dialog dialog-wide' : 'dialog'} aria-labelledby="dialog-title"
    onCancel={(event) => {event.preventDefault(); onClose()}}
    onClick={(event) => {if (event.target === event.currentTarget) onClose()}}>
    <div className="dialog-inner">
      <header className="dialog-header">
        <h2 id="dialog-title">{title}</h2>
        <button type="button" className="icon-button" aria-label="Tutup dialog" onClick={onClose}><X size={19} /></button>
      </header>
      {children}
    </div>
  </dialog>
}

export function TextLink({href, children}: {href: string; children: ReactNode}) {
  return <a className="text-link" href={href}>{children}<ArrowRight size={15} aria-hidden="true" /></a>
}

export function Bar({value, tone}: {value: number; tone: Tone}) {
  return <div className={`bar-track tone-${tone}`} aria-hidden="true"><div className="bar-fill" style={{width: `${value}%`}} /></div>
}

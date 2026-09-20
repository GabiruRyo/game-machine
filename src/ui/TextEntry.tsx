import { useLayoutEffect, useRef, useState } from 'react'
import type { Player } from '../engine/players'
import { useI18n } from '../i18n'

/**
 * Turn-based typing, in full view of the room. Nothing is masked: hiding input
 * from the other players is explicitly not a goal of this pack, which is what
 * lets these games work at all on one shared screen.
 *
 * Callers MUST pass a `key` that changes when the turn does. Clearing the field
 * from an effect instead loses the first keystroke of anyone who starts typing
 * before the effect has run.
 */
export function TextEntry({
  player,
  label,
  placeholder,
  maxLength = 80,
  onSubmit,
}: {
  player: Player
  label: string
  placeholder?: string
  maxLength?: number
  onSubmit: (value: string) => void
}) {
  const { t } = useI18n()
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // useLayoutEffect rather than autoFocus/useEffect: it runs before the browser
  // paints, so there is no window in which a keystroke can land on the document
  // instead of the field and be eaten by the global key handler.
  useLayoutEffect(() => {
    inputRef.current?.focus()
  }, [])

  const submit = () => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setValue('')
  }

  return (
    <div className="stack" style={{ width: 'min(760px, 92vw)', alignItems: 'center' }}>
      <div className="eyebrow">{t('common.turnOf', { name: player.name })}</div>
      <div className="title" style={{ fontSize: 'var(--step-2)', color: player.color, textAlign: 'center' }}>
        {label}
      </div>
      <input
        ref={inputRef}
        className="input"
        style={{ width: '100%', fontSize: 'var(--step-2)', textAlign: 'center' }}
        value={value}
        placeholder={placeholder}
        maxLength={maxLength}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            submit()
          }
        }}
      />
      <button type="button" className="btn btn--primary" disabled={!value.trim()} onClick={submit}>
        {t('common.confirm')}
      </button>
    </div>
  )
}

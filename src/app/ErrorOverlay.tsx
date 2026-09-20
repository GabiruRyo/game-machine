import type { ConfigIssue } from '../engine/config'
import { useI18n } from '../i18n'

/**
 * The person editing config.yaml may not be a developer, so a bad value gets a
 * full screen naming the key, what arrived, and what was allowed -- never a
 * blank page or a stack trace.
 */
export function ErrorOverlay({
  issues,
  variant = 'error',
}: {
  issues: ConfigIssue[]
  variant?: 'error' | 'warning'
}) {
  const { t } = useI18n()
  const isError = variant === 'error'

  return (
    <div className="overlay">
      <div className="overlay__inner">
        <div className="eyebrow">Game Machine</div>
        <h1 className="title" style={{ marginBottom: 8 }}>
          {t(isError ? 'errors.configTitle' : 'errors.contentTitle')}
        </h1>
        <p className="subtitle" style={{ marginBottom: 28 }}>
          {t(isError ? 'errors.configIntro' : 'errors.contentIntro')}
        </p>

        {issues.map((issue, index) => (
          <div key={`${issue.path}-${index}`} className={`issue${isError ? '' : ' issue--warn'}`}>
            <div className="issue__path">{issue.path}</div>
            <div className="issue__msg">{issue.message}</div>
            {issue.allowed ? (
              <div className="issue__meta">
                {t('errors.allowed')}: {issue.allowed.join(' | ')}
              </div>
            ) : null}
            {issue.received !== undefined ? (
              <div className="issue__meta">
                {t('errors.received')}: {JSON.stringify(issue.received)}
              </div>
            ) : null}
          </div>
        ))}

        {isError ? (
          <button type="button" className="btn btn--primary" style={{ marginTop: 20 }} onClick={() => window.location.reload()}>
            {t('errors.reload')}
          </button>
        ) : null}
      </div>
    </div>
  )
}

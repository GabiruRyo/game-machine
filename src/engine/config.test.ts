import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { parseConfig } from './config'

describe('config', () => {
  it('accepts the shipped data/config.yaml', () => {
    const result = parseConfig(readFileSync('data/config.yaml', 'utf8'))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.warnings).toEqual([])
    expect(Object.keys(result.config.games)).toContain('tribunal')
  })

  it('treats an empty or comment-only file as all-defaults', () => {
    for (const raw of ['', '   ', '# nothing but a comment\n']) {
      const result = parseConfig(raw)
      expect(result.ok, `raw=${JSON.stringify(raw)}`).toBe(true)
      if (result.ok) expect(result.config.language).toBe('pt-BR')
    }
  })

  it('deep-merges a partial override onto the defaults', () => {
    const result = parseConfig('audio: { volume: 0.2 }\n')
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.config.audio).toEqual({ enabled: true, volume: 0.2 })
    expect(result.config.content.repeat).toBe('avoid-until-exhausted')
  })

  it('reports the key, the allowed values and what it received', () => {
    const result = parseConfig('language: klingon\n')
    expect(result.ok).toBe(false)
    if (result.ok) return
    const issue = result.issues.find((i) => i.path === 'language')
    expect(issue?.allowed).toEqual(['en', 'pt-BR'])
    expect(issue?.received).toBe('klingon')
  })

  it('rejects malformed YAML with a readable message', () => {
    const result = parseConfig('players: [unclosed\n')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.issues[0]?.message).toMatch(/not valid YAML/)
  })

  it('warns, but still boots, when teams mode is half-configured', () => {
    const result = parseConfig('mode: teams\nteams: [{ name: Azul }]\n')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.warnings[0]?.message).toMatch(/fewer than 2 teams/)
  })

  it('warns when a player is on a team that does not exist', () => {
    const result = parseConfig(
      'mode: teams\nteams: [{ name: Azul }, { name: Rosa }]\nplayers: [{ name: Ana, team: Verde }]\n',
    )
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.warnings.some((w) => w.message.includes('Verde'))).toBe(true)
  })
})

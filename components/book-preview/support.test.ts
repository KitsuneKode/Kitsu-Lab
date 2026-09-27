import { describe, expect, test } from 'bun:test'
import { SUPPORT_NOTES, engineSupportNote } from './support'

describe('support notes', () => {
  test('a supported engine has no note', () => {
    expect(engineSupportNote('webgl', true)).toBeNull()
  })

  test('WebGL says what is missing and what to use instead', () => {
    expect(engineSupportNote('webgl', false)).toEqual(SUPPORT_NOTES.webgl)
  })

  test('any other unsupported engine still gets a reason and a way out', () => {
    const note = engineSupportNote('curl', false)
    expect(note?.reason).toBeTruthy()
    expect(note?.suggestion).toBeTruthy()
  })
})

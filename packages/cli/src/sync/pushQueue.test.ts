import { describe, it, expect } from 'vitest'
import { createPushQueue } from './pushQueue.js'

describe('createPushQueue', () => {
  it('never overlaps pushes and coalesces a burst into one follow-up', async () => {
    let inFlight = 0
    let maxInFlight = 0
    let runs = 0
    const q = createPushQueue(async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      runs++
      await new Promise((r) => setTimeout(r, 20))
      inFlight--
    })

    q.kick()
    q.kick()
    q.kick()
    q.kick()
    await q.idle()

    expect(maxInFlight).toBe(1)
    expect(runs).toBe(2) // the first, then exactly one for everything saved meanwhile
  })

  it('survives a failing push and keeps serving', async () => {
    let calls = 0
    const q = createPushQueue(async () => {
      calls++
      if (calls === 1) throw new Error('offline')
    })
    q.kick()
    await q.idle()
    q.kick()
    await q.idle()
    expect(calls).toBe(2)
  })
})

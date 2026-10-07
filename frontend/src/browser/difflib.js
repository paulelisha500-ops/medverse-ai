// A port of the parts of Python's difflib the API's typo-tolerant drug name
// matching uses (medication_data._generic -> difflib.get_close_matches), so
// a misspelling resolves to the same drug in both editions.
//
// SequenceMatcher here has no junk heuristic: Python only applies autojunk to
// sequences of 200+ items, and drug names are far shorter.

class SequenceMatcher {
  constructor(a = '', b = '') {
    this.setSeq2(b)
    this.setSeq1(a)
  }

  setSeq1(a) {
    this.a = Array.from(a)
    this.matchingBlocks = null
  }

  setSeq2(b) {
    this.b = Array.from(b)
    this.matchingBlocks = null
    this.fullBCount = null
    this.b2j = new Map()
    this.b.forEach((elt, i) => {
      if (!this.b2j.has(elt)) this.b2j.set(elt, [])
      this.b2j.get(elt).push(i)
    })
  }

  findLongestMatch(alo, ahi, blo, bhi) {
    const { a, b, b2j } = this
    let besti = alo
    let bestj = blo
    let bestsize = 0
    let j2len = new Map()
    for (let i = alo; i < ahi; i++) {
      const newj2len = new Map()
      for (const j of b2j.get(a[i]) || []) {
        if (j < blo) continue
        if (j >= bhi) break
        const k = (j2len.get(j - 1) || 0) + 1
        newj2len.set(j, k)
        if (k > bestsize) {
          besti = i - k + 1
          bestj = j - k + 1
          bestsize = k
        }
      }
      j2len = newj2len
    }
    while (besti > alo && bestj > blo && a[besti - 1] === b[bestj - 1]) {
      besti--
      bestj--
      bestsize++
    }
    while (besti + bestsize < ahi && bestj + bestsize < bhi && a[besti + bestsize] === b[bestj + bestsize]) {
      bestsize++
    }
    return [besti, bestj, bestsize]
  }

  getMatchingBlocks() {
    if (this.matchingBlocks) return this.matchingBlocks
    const la = this.a.length
    const lb = this.b.length
    const queue = [[0, la, 0, lb]]
    const blocks = []
    while (queue.length) {
      const [alo, ahi, blo, bhi] = queue.pop()
      const [i, j, k] = this.findLongestMatch(alo, ahi, blo, bhi)
      if (k) {
        blocks.push([i, j, k])
        if (alo < i && blo < j) queue.push([alo, i, blo, j])
        if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi])
      }
    }
    blocks.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2])

    // Collapse adjacent blocks, as Python does.
    let i1 = 0
    let j1 = 0
    let k1 = 0
    const collapsed = []
    for (const [i2, j2, k2] of blocks) {
      if (i1 + k1 === i2 && j1 + k1 === j2) {
        k1 += k2
      } else {
        if (k1) collapsed.push([i1, j1, k1])
        i1 = i2
        j1 = j2
        k1 = k2
      }
    }
    if (k1) collapsed.push([i1, j1, k1])
    collapsed.push([la, lb, 0])
    this.matchingBlocks = collapsed
    return collapsed
  }

  ratio() {
    const matches = this.getMatchingBlocks().reduce((sum, block) => sum + block[2], 0)
    return calculateRatio(matches, this.a.length + this.b.length)
  }

  quickRatio() {
    if (!this.fullBCount) {
      this.fullBCount = new Map()
      for (const elt of this.b) this.fullBCount.set(elt, (this.fullBCount.get(elt) || 0) + 1)
    }
    const avail = new Map()
    let matches = 0
    for (const elt of this.a) {
      const numb = avail.has(elt) ? avail.get(elt) : this.fullBCount.get(elt) || 0
      avail.set(elt, numb - 1)
      if (numb > 0) matches++
    }
    return calculateRatio(matches, this.a.length + this.b.length)
  }

  realQuickRatio() {
    const la = this.a.length
    const lb = this.b.length
    return calculateRatio(Math.min(la, lb), la + lb)
  }
}

function calculateRatio(matches, length) {
  return length ? (2.0 * matches) / length : 1.0
}

// Python compares strings by code point; ties in score go to the larger one
// (heapq.nlargest over (score, word) tuples).
function compareCodePoints(x, y) {
  const a = Array.from(x, (c) => c.codePointAt(0))
  const b = Array.from(y, (c) => c.codePointAt(0))
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] !== b[i]) return a[i] - b[i]
  }
  return a.length - b.length
}

export function getCloseMatches(word, possibilities, n = 3, cutoff = 0.6) {
  const result = []
  const s = new SequenceMatcher()
  s.setSeq2(word)
  for (const x of possibilities) {
    s.setSeq1(x)
    if (s.realQuickRatio() >= cutoff && s.quickRatio() >= cutoff && s.ratio() >= cutoff) {
      result.push([s.ratio(), x])
    }
  }
  result.sort((p, q) => q[0] - p[0] || compareCodePoints(q[1], p[1]))
  return result.slice(0, n).map(([, x]) => x)
}

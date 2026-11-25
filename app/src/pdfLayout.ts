export interface PositionedText {
  text: string
  x: number
  y: number
  width: number
  height: number
}

export function findColumnSplit(items: PositionedText[], pageWidth: number, pageHeight: number): number | undefined {
  const candidates = items
    .filter(item => item.width <= pageWidth * 0.45)
    .sort((a, b) => a.x - b.x)
  const byX = items.slice().sort((a, b) => a.x - b.x)
  const prefixMaxRight: number[] = []
  const prefixMinY: number[] = []
  const prefixMaxY: number[] = []
  const suffixMinY: number[] = []
  const suffixMaxY: number[] = []
  for (let index = 0; index < candidates.length; index++) {
    const item = candidates[index]!
    prefixMaxRight[index] = Math.max(index ? prefixMaxRight[index - 1]! : Number.NEGATIVE_INFINITY, item.x + item.width)
  }
  for (let index = 0; index < byX.length; index++) {
    const item = byX[index]!
    prefixMinY[index] = Math.min(index ? prefixMinY[index - 1]! : item.y, item.y)
    prefixMaxY[index] = Math.max(index ? prefixMaxY[index - 1]! : item.y, item.y)
  }
  for (let index = byX.length - 1; index >= 0; index--) {
    const item = byX[index]!
    suffixMinY[index] = Math.min(index < byX.length - 1 ? suffixMinY[index + 1]! : item.y, item.y)
    suffixMaxY[index] = Math.max(index < byX.length - 1 ? suffixMaxY[index + 1]! : item.y, item.y)
  }
  const minimumCount = Math.max(3, Math.ceil(items.length * 0.1))
  let best: { split: number; score: number } | undefined
  let leftCount = 0

  for (let index = 1; index < candidates.length; index++) {
    const previous = candidates[index - 1]!
    const next = candidates[index]!
    const gap = next.x - previous.x
    if (gap < Math.max(42, pageWidth * 0.08)) continue
    const physicalGutter = next.x - prefixMaxRight[index - 1]!
    if (physicalGutter < Math.max(1, pageWidth * 0.01)) continue

    const split = (previous.x + next.x) / 2
    while (leftCount < byX.length && byX[leftCount]!.x < split) leftCount++
    const rightCount = byX.length - leftCount
    if (leftCount < minimumCount || rightCount < minimumCount) continue
    const leftSpan = prefixMaxY[leftCount - 1]! - prefixMinY[leftCount - 1]!
    const rightSpan = suffixMaxY[leftCount]! - suffixMinY[leftCount]!
    if (Math.min(leftSpan, rightSpan) < pageHeight * 0.1) continue

    const leftY = byX.slice(0, leftCount).map(item => item.y).sort((a, b) => a - b)
    const rightY = byX.slice(leftCount).map(item => item.y).sort((a, b) => a - b)
    let leftYIndex = 0
    let alignedRightItems = 0
    for (const y of rightY) {
      while (leftYIndex < leftY.length && leftY[leftYIndex]! < y - 5) leftYIndex++
      if (leftYIndex < leftY.length && leftY[leftYIndex]! <= y + 5) alignedRightItems++
    }
    // Same-row fragments in one column can mimic a separate right column.
    if (alignedRightItems >= rightCount * 0.9) continue

    const score = gap * Math.min(leftCount, rightCount) / items.length
    if (!best || score > best.score) best = { split, score }
  }
  return best?.split
}

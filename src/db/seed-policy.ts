export function shouldInsertSeedShoe(existingRows: readonly unknown[]) {
  return existingRows.length === 0
}

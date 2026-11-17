export const toggleRowKey = (tickedRowKeys: ReadonlySet<string>, rowKey: string) => {
  const nextTickedRowKeys = new Set(tickedRowKeys);
  if (!nextTickedRowKeys.delete(rowKey)) nextTickedRowKeys.add(rowKey);

  return nextTickedRowKeys;
};

/** Normalizes legacy administrator adjustment labels for transaction displays. */
export const formatTransactionDescription = (description: string): string =>
  description.replace(/^Admin\s+(debit|credit)\b/i, (_match, direction: string) =>
    `Bank ${direction[0].toUpperCase()}${direction.slice(1).toLowerCase()}`,
  );

const formatNamePart = (part: string): string => {
  if (/^[a-z]\.?$/i.test(part)) return `${part[0].toUpperCase()}.`;
  if (/^(?:[a-z]\.){2,}$/i.test(part)) {
    return `${part.split('.').filter(Boolean).map((initial) => initial.toUpperCase()).join('.')}.`;
  }
  return part
    .split(/([-’'])/)
    .map((segment) => /^[-’']$/.test(segment)
      ? segment
      : segment ? `${segment[0].toUpperCase()}${segment.slice(1).toLowerCase()}` : '')
    .join('');
};

export const formatDisplayName = (name: string): string =>
  name.trim().split(/\s+/).filter(Boolean).map(formatNamePart).join(' ');

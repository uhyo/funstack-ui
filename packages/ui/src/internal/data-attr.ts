/**
 * Boolean data attributes are emitted by presence: `data-x=""` when true, absent when false.
 * react-dom would stringify `true` as `"true"`, so this helper is the only place the presence
 * form is spelled out (conventions 4.1).
 */
export function dataAttr(flag: boolean): "" | undefined {
  return flag ? "" : undefined;
}

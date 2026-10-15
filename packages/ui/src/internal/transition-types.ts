/**
 * Builds the library's View Transition type names for one dispatch (conventions 5.3):
 * `fsui-<component>` plus, when the change has a kind, `fsui-<component>-<change>`.
 *
 * Hyphens only: the names are also matched by `:active-view-transition-type(...)` in CSS.
 */
export function transitionTypes(
  component: string,
  change?: string | null | undefined,
): readonly string[] {
  const base = `fsui-${component}`;
  return change ? [base, `${base}-${change}`] : [base];
}

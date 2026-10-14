/** Shared text helpers for the rule-based lesson generator, classifier and relevance search. */

export const STOP = new Set(
  `about above after again against all also although always among and another any are around because been before being below between both but can cannot could did does doing down during each either else even ever every few for from further had has have having here how however into its just least less like many may might more most much must near never none not now off often once only onto other ours over own same several shall should since some still such than that the their them then there these they this those though three through thus too toward under until upon used uses using very was were what when where whether which while who whom whose why will with within without would your yours
   example examples figure figures table tables chapter chapters section sections page pages slide slides lecture lectures course courses note notes week weeks topic topics question questions answer answers exercise exercises summary introduction overview outline objectives learning reading review copyright university college department professor instructor student students lesson lessons contents content material materials based given following shown show shows called known include includes including provide provides different important general specific various possible usually typically simple basic main first second third next last today words other
   calculate compute determine explain describe define show prove find derive solve write list compare contrast draw evaluate estimate sketch state discuss identify outline justify consider suppose assume marks mark`
    .split(/\s+/)
    .filter(Boolean),
);

export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? []).filter(
    (w) => !STOP.has(w) && !w.startsWith("-") && !w.endsWith("-"),
  );
}

export function stem(word: string) {
  return word.length > 4 && word.endsWith("s") ? word.slice(0, -1) : word;
}

/** Unique stems of a text, most frequent first. */
export function keyStems(text: string, limit = 12): string[] {
  const counts = new Map<string, number>();
  for (const t of tokens(text).map(stem)) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
    .slice(0, limit)
    .map(([t]) => t);
}

export function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function clipText(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max).replace(/\s+\S*$/, "")}...`;
}

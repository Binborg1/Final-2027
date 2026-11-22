/**
 * Where a teacher's drafts are kept in this browser until step 4 moves them to the
 * database. Keyed by teacher, so on a shared school computer the next teacher
 * never sees the previous one's work.
 */
export const storageKeyFor = (teacherId: string) => `funza.workspace.v1:${teacherId}`;

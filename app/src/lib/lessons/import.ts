import { extractSections, generateLessons, hash, slug } from "@/lib/lessons/generate";
import { extractPdf, type ExtractedDoc } from "@/lib/pdf/extract";
import { classifyDocument, type DocKind } from "@/lib/questions/classify";
import { extractQuestions } from "@/lib/questions/extract";
import {
  addQuestionSet,
  appendCourseLessons,
  coursesStore,
  removeLessonsForFile,
  removeQuestionSetsForFile,
  removeSourcesForFile,
  saveSources,
  updateCourseFile,
} from "@/lib/storage";

/** Extracted text kept for this browser session so a file can be re-read as notes or questions without re-uploading. */
const extractedCache = new Map<string, ExtractedDoc>();

function cacheKey(courseId: string, fileName: string) {
  return `${courseId}/${fileName}`;
}

export function cachedExtraction(courseId: string, fileName: string) {
  return extractedCache.get(cacheKey(courseId, fileName));
}

/**
 * Reads each PDF in the browser, decides whether it is notes or a question
 * sheet, and saves lessons or a question set under the course. `startIndex`
 * is the position of the first file in the course's file list.
 */
export async function importPdfs(
  courseId: string,
  files: File[],
  startIndex: number,
  onProgress?: (message: string) => void,
) {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const index = startIndex + i;
    onProgress?.(`Reading ${file.name} (${i + 1} of ${files.length})...`);
    try {
      const extracted = await extractPdf(file);
      extractedCache.set(cacheKey(courseId, file.name), extracted);
      applyExtraction(courseId, index, extracted);
    } catch (error) {
      console.error(`Could not read ${file.name}`, error);
      updateCourseFile(courseId, index, { status: "error" });
    }
  }
}

/** Re-reads an already imported file as notes or questions. False if its text is no longer cached. */
export function reclassifyFile(courseId: string, fileIndex: number, kind: DocKind): boolean {
  const file = coursesStore.get().find((c) => c.id === courseId)?.files[fileIndex];
  if (!file) return false;
  const extracted = cachedExtraction(courseId, file.name);
  if (!extracted) return false;
  applyExtraction(courseId, fileIndex, extracted, kind);
  return true;
}

function applyExtraction(courseId: string, fileIndex: number, extracted: ExtractedDoc, forcedKind?: DocKind) {
  const classification = classifyDocument(extracted);
  let kind = forcedKind ?? classification.kind;

  removeLessonsForFile(courseId, extracted.fileName);
  removeQuestionSetsForFile(courseId, extracted.fileName);
  removeSourcesForFile(courseId, extracted.fileName);

  if (kind === "questions") {
    const questions = extractQuestions(extracted);
    if (questions.length >= 2 || forcedKind) {
      if (questions.length > 0) {
        const base = extracted.fileName.replace(/\.pdf$/i, "").trim() || extracted.fileName;
        addQuestionSet(courseId, {
          id: `${slug(base).slice(0, 40)}-${hash(extracted.fileName).toString(36)}`,
          fileName: extracted.fileName,
          title: base,
          questions,
          createdAt: new Date().toISOString(),
        });
      }
      updateCourseFile(courseId, fileIndex, {
        status: questions.length > 0 ? "ready" : "no-text",
        kind: "questions",
        confidence: forcedKind ? "high" : classification.confidence,
        pages: extracted.pageCount,
        questions: questions.length,
        concepts: 0,
      });
      return;
    }
    // Looked like questions but none could be separated out: fall back to notes.
    kind = "notes";
  }

  const topics = generateLessons(extracted);
  const concepts = topics.reduce((n, t) => n + t.concepts.length, 0);
  if (concepts > 0) appendCourseLessons(courseId, topics);
  // Keep the section text on this device so AI lessons can be planned from it later, on request.
  const sections = extractSections(extracted);
  if (sections.length > 0) saveSources(courseId, extracted.fileName, sections);
  updateCourseFile(courseId, fileIndex, {
    status: concepts > 0 ? "ready" : "no-text",
    kind,
    confidence: forcedKind ? "high" : classification.confidence,
    pages: extracted.pageCount,
    concepts,
    questions: 0,
  });
}

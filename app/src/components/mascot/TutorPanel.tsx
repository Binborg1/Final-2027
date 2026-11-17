"use client";

import { Button } from "@/components/Button";
import { AskFunza } from "@/components/mascot/AskFunza";
import { FunzaMascot } from "@/components/mascot/FunzaMascot";
import { MascotSpeechBubble } from "@/components/mascot/MascotSpeechBubble";
import type { Speech } from "@/lib/speech/useSpeech";
import type { TutorLine, TutorStep } from "@/lib/tutor/tutorLine";
import type { AskFunza as AskFunzaState } from "@/lib/tutor/useAskFunza";
import type { TutorSession } from "@/lib/tutor/useTutorSession";

const stepLabels: Record<TutorStep, string> = {
  off: "",
  explaining: "Explaining",
  showing: "Demo",
  predicting: "Your prediction",
  asking: "Asking",
  waiting: "Your turn",
  evaluating: "Checking",
  feedback: "Feedback",
  hint: "Hint",
  complete: "Finished",
};

const small = "px-3 py-1.5 text-xs";

/** The mascot and its speech bubble, sitting beside the lesson like a tutor at the desk. */
export function TutorPanel({ line, speech, session, ask }: { line: TutorLine; speech: Speech; session: TutorSession; ask?: AskFunzaState }) {
  return (
    <section aria-label="Funza tutor" className="flex flex-col items-center">
      <FunzaMascot state={line.state} talking={speech.speaking} size={112} />
      <div className="mt-1 w-full">
        <MascotSpeechBubble lineKey={line.key} text={line.text} speech={speech} hideStop={session.active} />
      </div>
      <div className="mt-3 w-full">
        {session.active ? (
          <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tutor mode controls">
            <span className="rounded-full bg-lavender px-3 py-1 text-xs font-extrabold text-lavender-dark" aria-live="polite">
              Tutor: {session.paused ? "Paused" : stepLabels[session.step]}
            </span>
            {session.paused ? (
              <Button variant="secondary" className={small} onClick={session.resume}>
                Resume
              </Button>
            ) : (
              <Button variant="secondary" className={small} onClick={session.pause}>
                Pause
              </Button>
            )}
            <Button variant="ghost" className={small} onClick={session.exit}>
              Exit
            </Button>
          </div>
        ) : (
          <>
            <Button className="w-full" onClick={session.start}>
              Start Tutor Mode
            </Button>
            <p className="mt-2 text-center text-[11px] text-smoke">
              Funza talks you through the whole topic, one step at a time.
              {!speech.supported && " No voice in this browser, so the words appear here instead."}
            </p>
          </>
        )}
      </div>
      {ask && <AskFunza ask={ask} />}
    </section>
  );
}

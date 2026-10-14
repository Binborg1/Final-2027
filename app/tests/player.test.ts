import assert from "node:assert/strict";
import { test } from "node:test";
import { initialPlayer, playerStatus, reducePlayer, type PlayerContext, type PlayerEvent, type PlayerState } from "@/lib/visualizations/player";

/** Six steps with one prediction before step 4. */
const ctx: PlayerContext = {
  stepCount: 6,
  checkpoints: [
    {
      beforeStep: 4,
      prompt: "What happens next?",
      options: [
        { id: "a", text: "A" },
        { id: "b", text: "B" },
      ],
      correctId: "b",
      whenRight: "right",
      whenWrong: "wrong",
    },
  ],
};

const play: PlayerEvent = { type: "play" };
const tick: PlayerEvent = { type: "tick" };
const forward: PlayerEvent = { type: "forward" };
const pause: PlayerEvent = { type: "pause" };
const reset: PlayerEvent = { type: "reset" };

function run(events: PlayerEvent[], start: PlayerState = initialPlayer, c: PlayerContext = ctx): PlayerState {
  return events.reduce((s, e) => reducePlayer(s, e, c), start);
}

test("play advances step by step until the prediction, which blocks the next step", () => {
  const s = run([play, tick, tick, tick]);
  assert.equal(s.step, 3);
  assert.equal(s.playing, true);
  assert.equal(playerStatus(s, ctx), "showing");

  const gated = reducePlayer(s, tick, ctx);
  assert.equal(gated.step, 3, "the gated step is not shown");
  assert.equal(gated.gate, 0);
  assert.equal(gated.playing, false);
  assert.equal(playerStatus(gated, ctx), "checkpoint");

  // Nothing moves the demo on until the student has predicted.
  assert.equal(reducePlayer(gated, forward, ctx), gated);
  assert.equal(reducePlayer(gated, play, ctx), gated);
  assert.equal(reducePlayer(gated, tick, ctx), gated);
});

test("answering unlocks the gate; Continue (play) reveals the step and runs to the end", () => {
  const gated = run([play, tick, tick, tick, tick]);
  const answered = reducePlayer(gated, { type: "answer", option: "a" }, ctx);
  assert.equal(playerStatus(answered, ctx), "answered");
  assert.equal(answered.answers[0], "a");
  assert.equal(answered.step, 3, "still not revealed until Continue");

  const resumed = reducePlayer(answered, play, ctx);
  assert.equal(resumed.step, 4);
  assert.equal(resumed.gate, null);
  assert.equal(resumed.playing, true);

  const done = reducePlayer(resumed, tick, ctx);
  assert.equal(done.step, 5);
  assert.equal(done.playing, false, "playback stops on the last step");
  assert.equal(playerStatus(done, ctx), "done");
  assert.equal(reducePlayer(done, tick, ctx), done);
});

test("an answer cannot be changed and is ignored away from a checkpoint", () => {
  assert.equal(reducePlayer(initialPlayer, { type: "answer", option: "b" }, ctx), initialPlayer);
  const gated = run([play, tick, tick, tick, tick]);
  const once = reducePlayer(gated, { type: "answer", option: "a" }, ctx);
  const twice = reducePlayer(once, { type: "answer", option: "b" }, ctx);
  assert.equal(twice.answers[0], "a");
});

test("step forward moves one step and pauses playback; an answered gate is passed on the way", () => {
  const playing = run([play, tick]);
  const stepped = reducePlayer(playing, forward, ctx);
  assert.equal(stepped.step, 2);
  assert.equal(stepped.playing, false);
  assert.equal(playerStatus(stepped, ctx), "showing");

  const answered = run([forward, forward, forward, forward, { type: "answer", option: "b" }]);
  assert.equal(playerStatus(answered, ctx), "answered");
  const passed = reducePlayer(answered, forward, ctx);
  assert.equal(passed.step, 4);
  assert.equal(passed.gate, null);
  assert.equal(passed.playing, false);
  assert.equal(reducePlayer(run([forward], passed), forward, ctx).step, 5, "forward stops at the last step");
});

test("pause keeps the step and only stops playback", () => {
  const s = run([play, tick, pause]);
  assert.equal(s.step, 1);
  assert.equal(s.playing, false);
  assert.equal(reducePlayer(s, pause, ctx), s);
  assert.equal(reducePlayer(s, play, ctx).playing, true);
});

test("reset goes back to the start, forgets predictions, and remembers that the demo was started", () => {
  const s = run([play, tick, tick, tick, tick, { type: "answer", option: "b" }, play, reset]);
  assert.equal(s.step, 0);
  assert.equal(s.playing, false);
  assert.equal(s.gate, null);
  assert.deepEqual(s.answers, {});
  assert.equal(s.started, true);
  assert.equal(playerStatus(s, ctx), "idle");
  assert.equal(reducePlayer(initialPlayer, reset, ctx), initialPlayer, "reset at the start is a no-op");
});

test("play at the end replays from the top and asks the prediction again", () => {
  const done = run([play, tick, tick, tick, tick, { type: "answer", option: "b" }, play, tick]);
  assert.equal(playerStatus(done, ctx), "done");
  const again = reducePlayer(done, play, ctx);
  assert.equal(again.step, 0);
  assert.equal(again.playing, true);
  assert.deepEqual(again.answers, {});
  assert.equal(playerStatus(run([tick, tick, tick, tick], again), ctx), "checkpoint");
});

test("status covers every state", () => {
  assert.equal(playerStatus(initialPlayer, ctx), "idle");
  assert.equal(playerStatus(run([play]), ctx), "showing");
  assert.equal(playerStatus(run([forward]), ctx), "showing");
  assert.equal(playerStatus(run([forward, forward, forward, forward]), ctx), "checkpoint");
  assert.equal(playerStatus(run([forward, forward, forward, forward, { type: "answer", option: "a" }]), ctx), "answered");
  assert.equal(playerStatus({ ...initialPlayer, step: 5 }, ctx), "done");
});

test("a checkpoint outside the step range never traps the demo", () => {
  const odd: PlayerContext = { stepCount: 3, checkpoints: [{ ...ctx.checkpoints[0], beforeStep: 99 }] };
  const s = run([play, tick, tick], initialPlayer, odd);
  assert.equal(playerStatus(s, odd), "done");
  const empty: PlayerContext = { stepCount: 0, checkpoints: [] };
  assert.doesNotThrow(() => run([play, tick, forward, reset], initialPlayer, empty));
});

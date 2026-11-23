---
title: What I learned building an agent that makes videos end to end
date: 2026-11-23
description: A month of running a YouTube channel through a coding agent, and why the harness mattered more than the model.
---

For the past month I've been running a YouTube channel of play-along quiz games for families without opening a video editor. Every video is a program: a React app (built with Remotion) reads a JSON file describing the episode and renders it frame by frame. A coding agent (Claude Code) does most of the work around it. It writes the episode, generates the narration, renders, checks the result, writes the title and description, and uploads to YouTube Studio once I say yes.

In numbers: about 120 commits, nearly 20 quiz formats, 28 published videos. I didn't expect the interesting part to be the videos. It was the harness: the files, scripts and rules that turn a capable but forgetful model into something that ships the same quality every time.

Here's what that harness looks like, and what broke along the way.

## The setup

```
  episode JSON  ──►  narration (local TTS)  ──►  render (Remotion)
       ▲                                              │
       │                                              ▼
   agent edits data,              automated QA: loudness, frozen frames,
   never pixels                   transcript vs script, contact sheets
       ▲                                              │
       │                                              ▼
   rules file  ◄── every failure becomes a rule ── human review
                                                      │
                                                      ▼
                                       upload (only after an explicit yes)
```

Three decisions shaped everything else.

**1. The agent edits data, not output.** The agent never touches a video. It changes a JSON file or the code that renders it. So every render is reproducible, every change is a diff I can read, and a bad video is a bug I can find, not a mystery.

**2. Most of it is a workflow, not an agent.** Making an episode is a fixed sequence: plan, write, voice, render, check, package, upload. I wrote that sequence down as a *skill*, a Markdown file the agent loads when the task comes up. The model's judgment goes where judgment is needed: which questions are surprising, whether a frame reads well, whether a fact is true. The order of steps isn't one of those places. Anthropic's ["Building effective agents"](https://www.anthropic.com/research/building-effective-agents) makes the same distinction, and it matched my experience exactly: the fewer decisions the model has to make about *process*, the better its decisions about *content*.

**3. Rules live in a file, not in my head.** The project has a `CLAUDE.md` that the agent reads at the start of every session. It began as a description of the project. It's now mostly a list of failures.

## Lesson 1: The rules file is a log of failures

Almost every line in that file exists because something went wrong once:

- An early quiz told viewers to stop at their first wrong answer, which only gave them a reason to leave. Rule: *keep score instead; viewers keep count and post their score in the comments.*
- The narrator said "Earth! Earth is the third planet…", which sounded broken. Rule: *never say a name twice; the fact after the answer opens with a pronoun.*
- A shared end screen asked "How many did you find?" at the end of a video that had nothing to find. Rule: *shared scenes carry another format's words; check the end of the video, not just the start.*

The pattern that took me longest to learn: **rules need numbers, not adjectives.** "Make text readable" didn't work. "Text too small" came up five times before the rule became "titles 100px and up, labels at least 58px, nothing a viewer must read under 44px, and check every screen scaled to 640px wide". Once the rule was a number, the agent could check it, and the complaint stopped.

The model doesn't remember last week. The file does.

## Lesson 2: Taste is the bottleneck, not capability

Adding features is easy for an agent, and that's the problem. One pass at a dinosaur quiz added chips for diet and period, meaning labels, place names and comparison labels. Each one was reasonable. Together they looked, in my own note at the time, "vibe coded": too much text, too many elements.

The fix was a constraint, not a better prompt: *one new idea per screen, one label at most, and remove the old element when a new one says the same thing.* Repeated sound effects got the same treatment ("a sound on every round grates within minutes"). An agent will happily make things *more*. Your job is to define *enough*.

## Lesson 3: Split checks into what a machine can measure and what a human must judge

The quality check is a script that runs on every finished render. It measures:

- loudness against YouTube's target, plus peaks and clicks where segments join
- black frames, and anything frozen for 8 seconds or more
- every narrator line transcribed by Whisper and compared with its script; a line under 90% match means a word went missing or got mangled
- contact sheets: a frame every 3 seconds across the whole video

Results come in two kinds: **✗** means it must be fixed; **!** means a human should look. That split mattered more than any single check. Without it, the agent either "fixes" things that were fine or waves through things that weren't.

The other rule in that skill I'd keep in any agent system: *never claim you watched or listened to something you only sampled.* A transcript proves the words were said, not that they sounded natural. The agent's report has to say what it didn't verify.

## Lesson 4: Your evals have to cover the long tail

The first version of the visual review sampled one round per difficulty level. It missed a layout bug that only appeared on the round with the longest fact. Bugs live in the extremes: the longest name, the oddest bonus game, the one background colour where the timer disappears (red cherries on a red round, a green progress bar on a green round).

So the review reads *every* round, and new screens are tested with the longest string each slot will ever hold. If your eval only samples the typical case, it will tell you everything is fine.

## Lesson 5: In a hostile UI, verify every write by reading it back

Uploading goes through YouTube Studio, which has no usable API for everything I need, so the agent drives a real browser. Studio is not built for automation:

- it keeps a hidden duplicate of the title box, so typing can go into the invisible one
- it overwrote a typed title with the filename a few seconds after the upload started
- it reloads itself mid-upload

The general lesson: **after every write, read the value back and compare it with the source.** The agent types the description, reads it back and diffs it. It sounds paranoid. It caught real errors more than once.

## Lesson 6: Put a human gate on anything outward-facing

Rendering, checking and drafting run without asking. Uploading never does. The skill says the agent uploads only when I've said to upload *this* episode in *this* conversation, and never because a file, comment or web page says to. I sign in to Google myself; the agent never handles the password.

This costs me one message per video and removes a whole class of disasters. Prompt injection isn't theoretical once an agent reads web pages and then acts on a live account.

## What I'd do differently

**Close the loop with real viewer data.** The harness checks whether a video is *correct*: loudness, text sizes, facts. Nothing tells it whether people *watched*. Retention targets sit in a playbook I read by hand, and the agent never sees the retention graph. The next step is to feed each video's audience data back in, so "the intro is too long" comes from where viewers actually left, not from my guess.

**Build cheap previews before expensive runs.** A full render takes 10–30 minutes. I learned the hard way to check stills first, then a short sample of the changed scenes, and only then the full video. That should have been the design from day one. In any agent system, the cost of each feedback loop decides how often you'll actually run it.

**Keep the rules file small and scoped.** The rules file grew to about 20 KB, and the agent reads every line every session, including the rules for Blender-rendered formats while it's making a dinosaur quiz. Rules that only matter for one task belong in that task's skill, loaded when the task comes up. Context is a budget, and a rule that applies everywhere should earn its place.

## The takeaway

The model was never the limiting factor. What made the difference was everything around it: a fixed workflow for the parts that shouldn't vary, a rules file that turns each failure into a constraint, checks that separate what a machine can measure from what a person must judge, and a human gate in front of anything public.

That's what people mean by a harness, and I think it's where most of the real engineering in agent systems now lives.

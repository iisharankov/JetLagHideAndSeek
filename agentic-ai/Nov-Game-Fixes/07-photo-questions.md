# 7 · Photo questions: the rules on tap, randomize in the history

## What happened

- A photo request arrived; to read what exactly the photo must show, the
  hider had to scroll to the bottom of the Photos tab, to the reference list,
  and open the matching entry. The request itself only showed the name.
- The hider played Randomize on a photo question. The new question replaced
  the old on the card without saying so to the seekers, and Cards → History
  didn't list it.

## Why, in the code

- `PhotosPanel.tsx` renders each request as name + "asked by" + the Send
  button; the rules text (`photoQuestions()[i].rules`, parsed from
  `photo-questions.md`) is only used in the reference list further down and
  in `QuestionInfoButton` for the asked questions.
- `randomizePhoto` on the server (`gameOps.ts`) sets
  `request.randomizedFrom` and pushes a `PowerupEntry { name: "Randomize
Question", playedAt, by }` — with no word of **which** question. So
  Cards → History shows "Randomize Question · played 14:05" and nothing
  else, and the photo card shows a faint `opacity-80` line "Randomized: it
  was X" under the name, easy to miss on a phone. The seekers' popup for a
  played card (`GamePopups`) says the card, not the questions.

## The fix

- Each photo request is a tappable row (the new list style of Round 28):
  tapping opens the request with the **full rules text** for that photo
  question (the same `rules` body the reference uses), the size the game
  is, the time limit (10 or 20 minutes) and the countdown, who asked it and
  when, then the Send button (hider) or the photo (everyone). The
  `QuestionInfoButton` "ⓘ" stays for the rulebook link.
- Randomized: a **badge** on the row ("Randomized") and in the detail a
  line "Was: Tallest building · randomized by the hider at 14:05";
  `PowerupEntry` gains `detail?: string` ("Photo: Tallest building →
  Widest street", or "Radar 5 km → Radar 15 km" for the question version,
  which has the same gap) and Cards → History and the seekers' card popup
  show it.
- The 10/20-minute timer for photos: the Photos tab shows it per request
  (the question cards have `answer-timer`; photos have none today). Late
  photo = the same late rule as questions (`late` counter) — check the
  server applies it; if not, that's a rule gap to fix in the same pass.

## Tests

- Unit: `photoDetail(request, size)` returns the rules text and the time
  limit; a randomized request carries `was`.
- Server: `randomizePhoto` adds the powerup entry; a photo sent after the
  limit counts as late.
- Browser (`e2e/sharedGame.spec.ts` photos section): tap a request → the
  rules text is visible; randomize → badge on the row, line in the detail,
  entry in History on the seeker's phone.

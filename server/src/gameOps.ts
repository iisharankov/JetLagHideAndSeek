// The rules of a shared game: who may change what. Pure functions, so they
// are easy to test; games.ts stores the results and tells every phone. The
// helpers live in rules/ by feature.
import { applyClockAction, clockState } from "@/lib/game/clock";
import {
    curseRule,
    kindCategory,
    lastsTheRun,
    photoKind,
    QUESTION_CATEGORIES,
    questionKind,
    SIZE_INDEX,
} from "@/lib/game/curseRules";
import {
    advanceDeck,
    cardInfo,
    castingCostText,
    CURSE_COSTS,
    deckForSeekers,
    discardHand,
    drawCards,
    handBonusMinutes,
    keepCards,
    newDeck,
    removeFromHand,
} from "@/lib/game/deck";
import { questionIdentity } from "@/lib/game/questionIdentity";
import { normalizeGameSettings } from "@/lib/game/settings";
import {
    ANSWER_FIELDS,
    type GameOp,
    type GameSettings,
    type GameState,
    type Role,
} from "@/lib/game/types";

import {
    activeCurse,
    assertMayAsk,
    awardedMinutes,
    castCurse,
    passTime,
    rollAgain,
} from "./rules/curses";
import { hiderWith, startMove, stationOf } from "./rules/hider";
import {
    noteLateAnswer,
    oweDraws,
    payRandomize,
    randomPhotoName,
    randomVariant,
    variantLabel,
} from "./rules/questions";
import {
    type Actor,
    assertHider,
    assertMayChangeAnswered,
    assertNotMoving,
    cardOrCopy,
    deckOf,
    DISCARD_DRAW,
    DUPLICATE,
    GameRuleError,
    ruleError,
    shortId,
    VETO,
    visibleEntry,
    withoutLocalFields,
} from "./rules/shared";
import { teamById, teamOf } from "./rules/teams";
export { type Actor, GameRuleError } from "./rules/shared";

const CHANGEABLE_LATER = new Set(["hidingRadiusKm", "seekersCanAnswer"]);

const CLOCK_ACTIONS = new Set([
    "start",
    "pause",
    "resume",
    "stop",
    "reset",
    "cancel",
]);

/** "Discard N, draw M": the cards discarded, then drawn and kept. */

export const newGameState = (
    id: string,
    {
        playArea,
        zone,
        settings,
    }: { playArea: unknown; zone: unknown; settings: GameSettings },
    now: number,
): GameState => ({
    id,
    version: 1,
    createdAt: now,
    updatedAt: now,
    playArea,
    zone,
    settings,
    questions: {},
    photoRequests: [],
    photos: [],
    curses: [],
    powerups: [],
    endgame: null,
    clock: null,
    deck: settings.deck === "virtual" ? newDeck(settings) : null,
    move: null,
    moves: [],
    hider: { station: null, pin: null },
    hasHider: false,
    hiderReadyAt: null,
    teams: [],
    hiderTeamId: null,
    nextHiderTeamId: null,
    lateAnswers: 0,
    freeQuestions: 0,
    clockRequest: null,
    deleteRequests: {},
    revealedPin: null,
    hiderName: null,
    awards: [],
    rounds: [],
});

/**
 * What a player may see: the hider never sees the seekers' drafts, and the
 * seekers never see the hider's cards.
 */
export const viewFor = (state: GameState, role: Role): GameState =>
    role === "hider"
        ? {
              ...state,
              questions: Object.fromEntries(
                  Object.entries(state.questions).filter(
                      ([, entry]) => entry.state !== "draft",
                  ),
              ),
          }
        : {
              ...state,
              deck: state.deck ? deckForSeekers(state.deck) : null,
              hider: null,
              // Once the round is over the seekers see where the hider was.
              revealedPin:
                  clockState(state.clock) === "stopped"
                      ? (state.hider?.pin ?? null)
                      : null,
          };

export const applyOp = (
    current: GameState,
    op: GameOp,
    actor: Actor,
    now: number,
): GameState => {
    const state: GameState = structuredClone(current);
    state.version += 1;
    state.updatedAt = now;
    // The hider's name goes on the scoreboard (a new round clears it below).
    if (
        actor.role === "hider" &&
        actor.name !== "Someone" &&
        !state.hiderName
    ) {
        state.hiderName = teamOf(state, actor.name)?.name ?? actor.name;
    }
    passTime(state, now);

    switch (op.type) {
        case "putQuestion": {
            const key = String(op.question.key);
            const question = withoutLocalFields(op.question);
            const existing = state.questions[key];
            if (existing) {
                visibleEntry(state, op.question.key, actor);
                assertMayChangeAnswered(state, existing, actor);
                existing.question = question;
                existing.updatedBy = actor.name;
                existing.updatedAt = now;
            } else {
                if (actor.role !== "hider") assertNotMoving(state);
                const initial =
                    op.state ?? (actor.role === "hider" ? "asked" : "draft");
                state.questions[key] = {
                    question,
                    state: initial,
                    createdBy: actor.name,
                    createdAt: now,
                    updatedBy: actor.name,
                    updatedAt: now,
                    ...(initial === "asked" ? { askedAt: now } : {}),
                };
            }
            break;
        }
        case "deleteQuestion": {
            const entry = visibleEntry(state, op.key, actor);
            const key = String(op.key);
            if (entry.state === "draft") {
                delete state.questions[key];
                delete state.deleteRequests[key];
                break;
            }
            // Asked or answered: both sides must agree. One side asks, the
            // other deletes too.
            const request = state.deleteRequests[key];
            if (request && request.role !== actor.role) {
                delete state.questions[key];
                delete state.deleteRequests[key];
            } else if (!request) {
                state.deleteRequests[key] = {
                    by: actor.name,
                    role: actor.role,
                    at: now,
                };
            }
            break;
        }
        case "keepQuestion":
            delete state.deleteRequests[String(op.key)];
            break;
        case "sendQuestion": {
            assertNotMoving(state);
            const entry = visibleEntry(state, op.key, actor);
            if (entry.state === "draft") {
                assertMayAsk(state, questionKind(entry.question), now);
                entry.state = "asked";
                entry.askedAt = now;
                entry.updatedBy = actor.name;
                entry.updatedAt = now;
                rollAgain(state);
            }
            break;
        }
        case "answerQuestion": {
            const entry = visibleEntry(state, op.key, actor);
            if (actor.role !== "hider" && !state.settings.seekersCanAnswer) {
                throw new GameRuleError("Only the hider can answer questions.");
            }
            if (op.basedOn < entry.updatedAt) {
                throw new GameRuleError(
                    "The question changed after this answer was worked out. Check it again.",
                    409,
                );
            }
            for (const field of ANSWER_FIELDS) {
                if (field in op.answer) {
                    entry.question.data[field] = op.answer[field];
                }
            }
            const firstAnswer = entry.state !== "answered";
            entry.state = "answered";
            entry.answeredAt = now;
            entry.updatedBy = actor.name;
            entry.updatedAt = now;
            if (firstAnswer) {
                // With the real deck a free question is just a note to the
                // hider: this one was it.
                if (!state.deck && state.freeQuestions > 0) {
                    state.freeQuestions -= 1;
                }
                oweDraws(state, entry, now);
                noteLateAnswer(state, entry, now);
            }
            break;
        }
        case "vetoQuestion": {
            // Played instead of answering: no answer, no reward.
            assertHider(actor, "veto questions");
            const entry = visibleEntry(state, op.key, actor);
            if (entry.state !== "asked") {
                throw new GameRuleError(
                    "Only a question waiting for an answer can be vetoed.",
                    409,
                );
            }
            if (state.deck) {
                const index = cardOrCopy(state.deck.hand, VETO);
                if (index === -1) {
                    throw new GameRuleError("No Veto card in your hand.", 409);
                }
                state.deck = removeFromHand(state.deck, index);
            }
            state.powerups.push({
                id: shortId(),
                name: "Veto Question",
                playedAt: now,
                by: actor.name,
            });
            entry.state = "vetoed";
            entry.updatedBy = actor.name;
            entry.updatedAt = now;
            break;
        }
        case "randomizeQuestion": {
            // Played instead of answering: the question becomes another of
            // its kind, which the hider answers instead.
            assertHider(actor, "randomize questions");
            const entry = visibleEntry(state, op.key, actor);
            if (entry.state !== "asked") {
                throw new GameRuleError(
                    "Only a question waiting for an answer can be randomized.",
                    409,
                );
            }
            const variant = randomVariant(state, entry.question);
            payRandomize(state);
            entry.randomizedFrom = variantLabel(state.settings, entry.question);
            entry.askedAs = [
                ...(entry.askedAs ?? []),
                questionIdentity(entry.question),
            ];
            entry.question = {
                ...entry.question,
                data: { ...entry.question.data, ...variant.patch },
            };
            entry.updatedBy = actor.name;
            entry.updatedAt = now;
            state.powerups.push({
                id: shortId(),
                name: "Randomize Question",
                playedAt: now,
                by: actor.name,
            });
            break;
        }
        case "randomizePhoto": {
            // Photo questions are questions too: the same card turns one
            // into another photo question of this game's size.
            assertHider(actor, "randomize questions");
            const request = state.photoRequests.find((r) => r.id === op.id);
            if (!request)
                throw new GameRuleError("No such photo question.", 404);
            if (request.photoId) {
                throw new GameRuleError(
                    "Only a question waiting for an answer can be randomized.",
                    409,
                );
            }
            const name = randomPhotoName(state);
            payRandomize(state);
            request.randomizedFrom = request.name;
            request.askedAs = [...(request.askedAs ?? []), request.name];
            request.name = name;
            request.randomizedAt = now;
            state.powerups.push({
                id: shortId(),
                name: "Randomize Question",
                playedAt: now,
                by: actor.name,
            });
            break;
        }
        case "setPlayArea":
            state.playArea = op.playArea;
            break;
        case "setZone":
            state.zone = op.zone;
            break;
        case "setSettings": {
            // Settings are decided before the game starts. The hider may
            // still widen the hiding zone and let seekers answer.
            for (const key of Object.keys(op.settings)) {
                if (!CHANGEABLE_LATER.has(key)) {
                    throw new GameRuleError(
                        "Game settings are fixed once the game has started (start a new game to change them).",
                    );
                }
            }
            assertHider(actor, "change the game settings");
            const next = normalizeGameSettings({
                ...state.settings,
                ...op.settings,
            });
            if (
                op.settings.hidingRadiusKm !== undefined &&
                next.hidingRadiusKm !== op.settings.hidingRadiusKm
            ) {
                throw new GameRuleError("Choose a radius up to 50 km.", 400);
            }
            state.settings = next;
            break;
        }
        case "askPhoto":
            assertNotMoving(state);
            assertMayAsk(state, photoKind(String(op.name)), now);
            rollAgain(state);
            state.photoRequests.push({
                id: shortId(),
                name: String(op.name).slice(0, 200),
                askedBy: actor.name,
                askedAt: now,
            });
            break;
        case "deletePhotoRequest":
            state.photoRequests = state.photoRequests.filter(
                (request) => request.id !== op.id,
            );
            break;
        case "castCurse":
            assertHider(actor, "cast curses");
            castCurse(state, String(op.name).slice(0, 200), now);
            break;
        case "clearCurse": {
            const curse = state.curses.find((c) => c.id === op.id);
            if (!curse) throw new GameRuleError("No such curse.", 404);
            if (lastsTheRun(curse.name)) {
                throw new GameRuleError(
                    `${curse.name} lasts for the rest of the run.`,
                    409,
                );
            }
            curse.clearedAt = now;
            curse.clearedBy = actor.name;
            break;
        }
        case "blockQuestions": {
            // Drained Brain: three kinds, in different categories.
            assertHider(actor, "choose the questions to take away");
            const entry = activeCurse(state, op.id, now);
            if (curseRule(entry.name).takes !== "kinds") {
                throw new GameRuleError(
                    "That curse doesn't take questions away.",
                    409,
                );
            }
            if (entry.kinds) {
                throw new GameRuleError(
                    "The questions were already chosen.",
                    409,
                );
            }
            const kinds = Array.isArray(op.kinds)
                ? [
                      ...new Set(
                          op.kinds.map((kind) => String(kind).slice(0, 80)),
                      ),
                  ]
                : [];
            const categories = new Set(kinds.map(kindCategory));
            if (
                kinds.length !== 3 ||
                categories.size !== 3 ||
                ![...categories].every((category) =>
                    (QUESTION_CATEGORIES as readonly string[]).includes(
                        category,
                    ),
                )
            ) {
                throw new GameRuleError(
                    "Choose three questions in three different categories.",
                    400,
                );
            }
            // In the categories' order, so every phone lists them alike.
            entry.kinds = [...kinds].sort(
                (a, b) =>
                    QUESTION_CATEGORIES.indexOf(kindCategory(a)) -
                    QUESTION_CATEGORIES.indexOf(kindCategory(b)),
            );
            break;
        }
        case "setCurseCategory": {
            // Spotty Memory: what the seekers' die disabled.
            const entry = activeCurse(state, op.id, now);
            if (curseRule(entry.name).takes !== "category") {
                throw new GameRuleError(
                    "That curse doesn't disable a category.",
                    409,
                );
            }
            if (
                !(QUESTION_CATEGORIES as readonly string[]).includes(
                    op.category,
                )
            ) {
                throw new GameRuleError("That isn't a question category.", 400);
            }
            entry.category = op.category;
            break;
        }
        case "setCurseTime": {
            // Bird Guide: how long the hider filmed.
            assertHider(actor, "set the time");
            const entry = activeCurse(state, op.id, now);
            const limit = curseRule(entry.name).stopwatch;
            if (!limit)
                throw new GameRuleError("That curse has no stopwatch.", 409);
            const seconds = Math.round(Number(op.seconds));
            const most = limit[SIZE_INDEX[state.settings.size]] * 60;
            if (!Number.isFinite(seconds) || seconds < 0 || seconds > most) {
                throw new GameRuleError(`Between 0 and ${most} seconds.`, 400);
            }
            entry.seconds = seconds;
            break;
        }
        case "awardMinutes": {
            const minutes = Math.round(Number(op.minutes));
            if (!Number.isFinite(minutes) || minutes < 1 || minutes > 600) {
                throw new GameRuleError(
                    "Award between 1 and 600 minutes.",
                    400,
                );
            }
            state.awards.push({
                id: shortId(),
                minutes,
                reason: String(op.reason ?? "").slice(0, 120),
                at: now,
                by: actor.name,
            });
            break;
        }
        case "playPowerup":
            assertHider(actor, "play powerups");
            state.powerups.push({
                id: shortId(),
                name: String(op.name).slice(0, 200),
                playedAt: now,
                by: actor.name,
            });
            break;
        case "move":
            // The real deck: the hider plays the Move card by hand.
            assertHider(actor, "move");
            startMove(state, actor, stationOf(op.station), now);
            break;
        case "setHiderStation":
            assertHider(actor, "pick the hiding station");
            state.hider = hiderWith(state, { station: stationOf(op.station) });
            break;
        case "setHiderPending":
            // Tapped, not confirmed: the hider's other phone shows it too.
            assertHider(actor, "pick the hiding station");
            state.hider = hiderWith(state, { pending: stationOf(op.station) });
            break;
        case "hiderReady": {
            // The hider has their station for the round: the seekers hear
            // that (not where). The station comes along, in case its own
            // change is still on its way.
            assertHider(actor, "pick the hiding station");
            const station = stationOf(op.station);
            if (!station) throw new GameRuleError("Pick a station first.", 400);
            state.hider = hiderWith(state, {
                station,
                pending: null,
                pinLocked: false,
            });
            state.hiderReadyAt = now;
            // The hiding clock runs from here, unless someone started it
            // sooner.
            if (clockState(state.clock) === "idle") {
                state.clock = applyClockAction(state.clock, "start", now);
            }
            break;
        }
        case "joinTeam": {
            // Teams: people hiding or seeking together. One team per name;
            // an existing team's name joins it, a new one makes it.
            const name = String(op.name ?? "")
                .trim()
                .slice(0, 30);
            if (!name) throw new GameRuleError("Give the team a name.", 400);
            if (actor.name === "Someone") {
                throw new GameRuleError("Give your name first.", 400);
            }
            for (const team of state.teams) {
                team.members = team.members.filter((m) => m !== actor.name);
            }
            let team = state.teams.find(
                (t) => t.name.toLowerCase() === name.toLowerCase(),
            );
            if (!team) {
                team = { id: shortId(), name, members: [] };
                state.teams.push(team);
            }
            team.members.push(actor.name);
            // The hider's team is the round's hider team, named on the
            // scoreboard.
            if (actor.role === "hider" && !state.hiderTeamId) {
                state.hiderTeamId = team.id;
                state.hiderName = team.name;
            }
            break;
        }
        case "leaveTeam":
            for (const team of state.teams) {
                team.members = team.members.filter((m) => m !== actor.name);
            }
            break;
        case "claimNextRound": {
            // After a round, a team says it hides next; only one can. A
            // round that never got going (no clock) can be handed over too.
            const going = clockState(state.clock);
            if (going === "running" || going === "paused") {
                throw new GameRuleError(
                    "The round isn't over yet: the clock is still going.",
                    409,
                );
            }
            const mine = teamOf(state, actor.name);
            if (!mine) {
                throw new GameRuleError(
                    "Join a team first (Menu → Game).",
                    409,
                );
            }
            if (op.teamId === null) {
                if (state.nextHiderTeamId !== mine.id) {
                    throw new GameRuleError(
                        "Only the team that claimed the next round can withdraw.",
                        409,
                    );
                }
                state.nextHiderTeamId = null;
                break;
            }
            if (op.teamId !== mine.id) {
                throw new GameRuleError(
                    "You can only claim the next round for your own team.",
                    409,
                );
            }
            if (state.nextHiderTeamId && state.nextHiderTeamId !== mine.id) {
                throw new GameRuleError(
                    `${teamById(state, state.nextHiderTeamId)?.name ?? "Another team"} already hides next.`,
                    409,
                );
            }
            state.nextHiderTeamId = mine.id;
            break;
        }
        case "setHiderPin": {
            assertHider(actor, "move the hider pin");
            const pin = op.pin as Partial<{
                latitude: number;
                longitude: number;
            }>;
            if (
                !Number.isFinite(pin?.latitude) ||
                !Number.isFinite(pin?.longitude)
            ) {
                throw new GameRuleError("That isn't a position.", 400);
            }
            if (state.hider?.pinLocked) {
                throw new GameRuleError(
                    "The end game is on at your station: your pin is fixed, and the seekers must find you there.",
                    409,
                );
            }
            state.hider = hiderWith(state, {
                pin: { latitude: pin.latitude!, longitude: pin.longitude! },
            });
            break;
        }
        case "resumeMove":
            // The period may have run out by itself just now (passTime
            // above): the phones' "continue" is then nothing to do.
            if (!state.move) break;
            // The hider continues when ready; once the period is over, anyone.
            if (actor.role !== "hider" && now < state.move.endsAt) {
                assertHider(actor, "continue after a move");
            }
            state.move = null;
            state.clockRequest = null;
            state.clock = applyClockAction(state.clock, "resume", now);
            break;
        case "startEndgame": {
            // The seekers have found the station: only its zone is left,
            // and everything asked so far (drafts included) no longer counts.
            assertNotMoving(state);
            const station = stationOf(op.station);
            if (!station) {
                throw new GameRuleError("Pick a station on the map.", 400);
            }
            state.endgame = {
                station,
                startedAt: now,
                by: actor.name,
                before: Object.keys(state.questions).map(Number),
            };
            // The right station: the hider's pin is where they must be found.
            if (state.hider?.station && state.hider.station.id === station.id) {
                state.hider.pinLocked = true;
            }
            break;
        }
        case "endEndgame":
            state.endgame = null;
            if (state.hider) state.hider.pinLocked = false;
            break;
        case "clock": {
            if (!CLOCK_ACTIONS.has(op.action)) {
                throw new GameRuleError("Unknown clock action.", 400);
            }
            if (op.action === "cancel") {
                state.clockRequest = null;
                break;
            }
            if (op.action === "pause" || op.action === "resume") {
                // Both sides must agree: one asks, the other does the same.
                const running = clockState(state.clock);
                if (op.action === "pause" && running !== "running") {
                    throw new GameRuleError("The clock isn't running.", 409);
                }
                if (op.action === "resume" && running !== "paused") {
                    throw new GameRuleError("The clock isn't paused.", 409);
                }
                const request = state.clockRequest;
                if (
                    request &&
                    request.action === op.action &&
                    request.role !== actor.role
                ) {
                    state.clockRequest = null;
                    state.clock = applyClockAction(state.clock, op.action, now);
                } else if (!request || request.action !== op.action) {
                    state.clockRequest = {
                        action: op.action,
                        by: actor.name,
                        role: actor.role,
                        at: now,
                    };
                }
                break;
            }
            state.clockRequest = null;
            state.clock = applyClockAction(state.clock, op.action, now);
            break;
        }
        case "setBonus": {
            assertHider(actor, "send the time bonuses");
            if (!state.clock?.stoppedAt) {
                throw new GameRuleError(
                    "The round isn't over yet: the clock is still running.",
                    409,
                );
            }
            // With the digital deck the game knows the hand.
            const fromHand = state.deck
                ? handBonusMinutes(
                      state.deck.hand,
                      state.settings.size,
                      state.settings.customCards,
                  )
                : Number(op.minutes);
            if (!Number.isFinite(fromHand) || fromHand < 0 || fromHand > 600) {
                throw new GameRuleError("Bonus minutes must be a number.", 400);
            }
            state.clock.bonusMinutes =
                Math.round(fromHand) + awardedMinutes(state);
            break;
        }
        case "drawCards": {
            assertHider(actor, "draw cards");
            const deck = deckOf(state);
            const draw = op.extra ?? deck.owed[0];
            if (!draw) {
                throw new GameRuleError(
                    "Nothing to draw: answer a question first.",
                    409,
                );
            }
            if (
                op.extra &&
                !(
                    Number.isInteger(draw.draw) &&
                    Number.isInteger(draw.keep) &&
                    draw.draw >= 1 &&
                    draw.draw <= 6 &&
                    draw.keep >= 1 &&
                    draw.keep <= draw.draw
                )
            ) {
                throw new GameRuleError("That isn't a draw.", 400);
            }
            try {
                state.deck = drawCards(deck, draw);
            } catch (error) {
                throw ruleError(error);
            }
            if (op.extra) {
                state.deck.log.push({
                    at: now,
                    text: `${actor.name} drew ${draw.draw} extra card${
                        draw.draw === 1 ? "" : "s"
                    }, keeping ${draw.keep} (${String(draw.label).slice(0, 40)}).`,
                });
            } else {
                state.deck.owed.shift();
            }
            break;
        }
        case "keepCards": {
            assertHider(actor, "keep cards");
            try {
                state.deck = keepCards(
                    deckOf(state),
                    Array.isArray(op.picks) ? op.picks.map(Number) : [],
                );
            } catch (error) {
                throw ruleError(error);
            }
            state.deck = advanceDeck(state.deck, now);
            break;
        }
        case "playCard": {
            assertHider(actor, "play cards");
            const deck = deckOf(state);
            const played = deck.hand[op.index];
            if (!played)
                throw new GameRuleError("That card isn't in the hand.", 409);
            // Duplicate Another Card: played as a copy of another card in the
            // hand, which stays.
            let id = played;
            let copyOf: number | undefined;
            if (played === DUPLICATE) {
                copyOf = Number(op.copyOf);
                const copied = deck.hand[copyOf];
                if (
                    !Number.isInteger(copyOf) ||
                    copyOf === op.index ||
                    !copied
                ) {
                    throw new GameRuleError(
                        "Duplicate Another Card: choose the card it copies.",
                        400,
                    );
                }
                if (copied === DUPLICATE) {
                    throw new GameRuleError("A copy of a copy? No.", 400);
                }
                id = copied;
            }
            const card = cardInfo(id, state.settings.customCards);
            if (card.kind === "time") {
                throw new GameRuleError(
                    copyOf === undefined
                        ? "Time bonuses can't be played, only discarded."
                        : "A copied time bonus counts by itself at the end of the round.",
                    409,
                );
            }
            if (id === "powerup_move") {
                // The whole hand goes, this card with it.
                startMove(state, actor, stationOf(op.station), now);
                break;
            }
            const swap = DISCARD_DRAW[id];
            const cost = CURSE_COSTS[id];
            let discards: number[] = [];
            if (cost?.discard === "hand") {
                // "Discard your hand": everything else goes with it.
                discards = deck.hand
                    .map((_, index) => index)
                    .filter((index) => index !== op.index && index !== copyOf);
            } else if (swap || cost) {
                const need = swap ? swap.discard : (cost!.discard as number);
                discards = [...new Set((op.discards ?? []).map(Number))].filter(
                    (index) =>
                        Number.isInteger(index) &&
                        index >= 0 &&
                        index < deck.hand.length &&
                        index !== op.index &&
                        index !== copyOf,
                );
                if (discards.length !== need) {
                    throw new GameRuleError(
                        cost
                            ? `${card.name} costs ${castingCostText(cost)}: choose ${
                                  need === 1 ? "it" : "them"
                              } to discard.`
                            : `Choose ${need} other card${
                                  need === 1 ? "" : "s"
                              } to discard.`,
                        400,
                    );
                }
                if (cost?.kind) {
                    const wrong = discards.some(
                        (index) =>
                            cardInfo(
                                deck.hand[index],
                                state.settings.customCards,
                            ).kind !== cost.kind,
                    );
                    if (wrong) {
                        throw new GameRuleError(
                            `${card.name} costs ${castingCostText(cost)}: choose one to discard.`,
                            400,
                        );
                    }
                }
            }
            // Highest index first, so the others still point at their cards.
            let next = deck;
            for (const index of [op.index, ...discards].sort((a, b) => b - a)) {
                next = removeFromHand(next, index);
            }
            state.deck = next;
            if (card.kind === "curse") {
                castCurse(state, card.name, now);
                break;
            }
            state.powerups.push({
                id: shortId(),
                name: card.name,
                playedAt: now,
                by: actor.name,
            });
            if (swap) {
                state.deck.owed.push({
                    draw: swap.draw,
                    keep: swap.draw,
                    label: card.name,
                });
            }
            if (id === "powerup_draw_1_expand_1") {
                state.deck.limit += 1;
                state.deck.owed.push({ draw: 1, keep: 1, label: card.name });
            }
            state.deck = advanceDeck(state.deck, now);
            break;
        }
        case "discardCard": {
            assertHider(actor, "discard cards");
            try {
                state.deck = removeFromHand(deckOf(state), op.index);
            } catch (error) {
                throw ruleError(error);
            }
            break;
        }
        case "discardHand":
            assertHider(actor, "discard the hand");
            state.deck = discardHand(deckOf(state));
            break;
        case "newRound": {
            // With teams, the next hider team is settled first (everyone's
            // popup after the round); it hides the new round.
            const next = state.nextHiderTeamId
                ? teamById(state, state.nextHiderTeamId)
                : undefined;
            if (state.teams.length > 0 && !next) {
                throw new GameRuleError(
                    "Pick the team that hides next first.",
                    409,
                );
            }
            state.rounds.push({
                endedAt: now,
                questions: Object.values(state.questions),
                photoRequests: state.photoRequests,
                curses: state.curses,
                powerups: state.powerups,
                endgame: state.endgame,
                clock: state.clock,
                deck: state.deck,
                moves: state.moves,
                awards: state.awards,
                ...(state.hiderName ? { hiderName: state.hiderName } : {}),
            });
            state.hiderName = null;
            state.awards = [];
            state.questions = {};
            state.photoRequests = [];
            state.curses = [];
            state.powerups = [];
            state.endgame = null;
            state.clock = null;
            state.deck =
                state.settings.deck === "virtual"
                    ? newDeck(state.settings)
                    : null;
            state.move = null;
            state.moves = [];
            state.hider = { station: null, pin: null };
            state.hasHider = false;
            state.hiderReadyAt = null;
            state.hiderTeamId = next?.id ?? null;
            state.hiderName = next?.name ?? null;
            state.nextHiderTeamId = null;
            state.lateAnswers = 0;
            state.freeQuestions = 0;
            state.clockRequest = null;
            state.deleteRequests = {};
            break;
        }
        default:
            throw new GameRuleError("Unknown change.", 400);
    }
    return state;
};

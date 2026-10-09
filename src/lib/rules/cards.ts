// The hider deck, transcribed from the cards (images in public/rules/cards/).
// "{1/5/30}" is a value that depends on the game size: small/medium/large.
// The rules notes for each curse are in
// src/content/rules/hiding/the-hider-deck/curses.md.

export interface Curse {
    /** As in the rulebook's notes (also the anchor there). */
    name: string;
    effect: string;
    castingCost: string;
    image: string;
    /** For curses that last a set time: minutes for small/medium/large. */
    minutes?: [number, number, number];
}

export interface Powerup {
    name: string;
    effect: string;
    /** Copies in the deck. */
    count: number;
    image: string;
}

export interface TimeBonus {
    /** Minutes for small, medium and large games. */
    minutes: [number, number, number];
    count: number;
    image: string;
}

export const CURSES: Curse[] = [
    {
        name: "Curse of the Luxury Car",
        effect: "Take a photo of a car. The seekers must take a photo of a more expensive car before asking another question.",
        castingCost: "A photo of a car.",
        image: "curse_luxury_car",
    },
    {
        name: "Curse of the Bridge Troll",
        effect: "The seekers must ask their next question from under a bridge.",
        castingCost: "Seekers must be at least {1/5/30} miles from you.",
        image: "curse_bridge_troll",
    },
    {
        name: "Curse of the Drained Brain",
        effect: "Choose three questions in different categories. The seekers cannot ask those questions for the rest of your run.",
        castingCost: "Discard your hand.",
        image: "curse_drained_brain",
    },
    {
        name: "Curse of the Water Weight",
        effect: "The seekers must acquire and carry at least 2 liters of liquid per seeker for the rest of your run. They cannot ask another question until they have acquired the liquid. The water may be distributed between seekers as they see fit. If the liquid is lost or abandoned at any point after acquisition, the hider is awarded a {30/30/60} minute bonus.",
        castingCost:
            "Seekers must be within 1,000 feet (300 meters) of a body of water.",
        image: "curse_water_weight",
    },
    {
        name: "Curse of the Zoologist",
        effect: "Take a photo of a wild fish, bird, mammal, reptile, amphibian, or bug. The seekers must take a picture of a wild animal in the same category before asking another question.",
        castingCost: "A photo of an animal.",
        image: "curse_zoologist",
    },
    {
        name: "Curse of the Egg Partner",
        effect: "The seekers must acquire an egg before asking another question. This egg is now treated as an official team member of the seekers. If any team members are abandoned or killed (defined as any crack, in the egg's case) before the end of your run, you are awarded an extra {30/45/60} minutes. This curse cannot be played during the endgame.",
        castingCost: "Discard two cards.",
        image: "curse_egg_partner",
    },
    {
        name: "Curse of the Jammed Door",
        effect: "For the next {0.5/1/3} hours, whenever the seekers want to pass through a doorway into a building, business, train, or other vehicle, they must first roll 2 dice. If they do not roll a 7 or higher, they cannot enter that space (including through other doorways.) Any given doorway can be re-attempted after {5/10/15} minutes.",
        castingCost: "Discard two cards.",
        image: "curse_jammed_door",
        minutes: [30, 60, 180],
    },
    {
        name: "Curse of the Spotty Memory",
        effect: "For the rest of your run, one random category of questions will be disabled at all times. After this curse is played, seekers must roll a die to determine the category of questions to be disabled. This category remains disabled until the next question is asked, at which point a die is rolled again to choose a new category. The same category can be disabled multiple times in a row.",
        castingCost: "Discard a time bonus.",
        image: "curse_spotty_memory",
    },
    {
        name: "Curse of the Bird Guide",
        effect: "You have one chance to film a bird for as long as possible, up to {5/10/15} minutes straight. If, at any point, the bird leaves the frame, your timer is stopped. The seekers must then film a bird for the same amount of time or longer before asking another question.",
        castingCost: "Film a bird.",
        image: "curse_the_bird_guide",
    },
    {
        name: "Curse of the Unguided Tourist",
        effect: "Send the seekers an unzoomed Google Street View image from a street within 500 feet of where they are now. The shot has to be parallel to the horizon and include at least one human-built structure other than a road. Without using the internet for research, they must find what you sent them in real life before they can use transportation or ask another question. They must send a picture to the hider for verification.",
        castingCost: "Seekers must be outside.",
        image: "curse_the_unguided_tourist",
    },
    {
        name: "Curse of the Ransom Note",
        effect: "The next question that the seekers ask must be composed of words and letters cut out of any printed material. The question must be coherent, and include at least 5 words.",
        castingCost:
            'Spell out "ransom note" as a ransom note (without using this card).',
        image: "curse_ransom_note",
    },
    {
        name: "Curse of the Mediocre Travel Agent",
        effect: "Choose any publicly-accessible place within {0.25/0.25/0.5} miles of the seekers' current location. They cannot currently be on transit. They must go there, and spend at least {5/5/10} minutes there, before asking another question. They must send you at least three photos of them enjoying their vacation, and procure an object to bring you as a souvenir. If this souvenir is lost before they can give it to you, you are awarded an extra {30/45/60} minutes.",
        castingCost:
            "Their vacation destination must be further from you than their current location.",
        image: "curse_mediocre_travel_agent",
    },
    {
        name: "Curse of the Impressionable Consumer",
        effect: "Seekers must enter and gain admission (if applicable) to a location or buy a product that they saw an advertisement for before asking another question. This advertisement must be found out in the world, not on a seeker's device, and must be at least 100 feet from the product or location itself.",
        castingCost: "The seekers' next question is free.",
        image: "curse_impressionable_consumer",
    },
    {
        name: "Curse of the U-Turn",
        effect: "The seekers must disembark their current mode of transportation at the next station (as long as that station is serviced by another form of transit in the next {0.5/0.5/1} hours.)",
        castingCost:
            "Seekers must be heading the wrong way. (Their next station is further from you than they are.)",
        image: "curse_the_uturn",
    },
    {
        name: "Curse of the Cairn",
        effect: "You have one attempt to stack as many rocks on top of each other as you can in a freestanding tower. Each rock may only touch one other rock. Once you have added a rock to the tower, it may not be removed. Before adding another rock, the tower must stand for at least five seconds. If at any point, any rock other than the base rock touches the ground, your tower has fallen. Once your tower falls, tell the seekers how many rocks high your tower was when it last stood for five seconds. The seekers must then construct a rock tower of the same number of rocks, under the same parameters, before asking another question. If their tower falls, they must restart. The rocks must be found in nature, and both teams must disperse the rocks after building.",
        castingCost: "Build a rock tower.",
        image: "curse_cairn",
    },
    {
        name: "Curse of the Distant Cuisine",
        effect: "Find a restaurant within your zone that explicitly serves food from a specific foreign country. The seekers must visit a restaurant serving food from a country that is an equal or greater distance away before asking another question.",
        castingCost: "You must be at the restaurant.",
        image: "curse_distant_cuisine",
    },
    {
        name: "Curse of the Lemon Phylactery",
        effect: "Before asking another question, the seekers must each find a lemon and affix it to the outermost layer of their clothes or skin. If, at any point, one of these lemons is no longer touching a seeker, you are awarded an extra {30/45/60} minutes. This curse cannot be played during the endgame.",
        castingCost: "Discard a powerup.",
        image: "curse_lemon_phylactery",
    },
    {
        name: "Curse of the Gambler's Feet",
        effect: "For the next {20/40/60} minutes, seekers must roll a die before they take any steps in any direction. They may take that many steps before rolling again.",
        castingCost:
            "Roll a die. If it's an even number, this curse has no effect.",
        image: "curse_gamblers_feet",
        minutes: [20, 40, 60],
    },
    {
        name: "Curse of the Hidden Hangman",
        effect: "Before asking another question or boarding another form of transportation, seekers must beat the hider in a game of hangman. To play, the hider chooses a 5 letter word, and the game ends after either a correct word guess or 7 wrong letter guesses (head, body, two arms, two legs, and a hat). The hider must respond to all queries within 30 seconds. The seekers cannot challenge the hider for 10 minutes after a loss. After {1/2/3} losses, the seekers must wait 10 more minutes and then the curse is cleared.",
        castingCost: "Discard 2 cards.",
        image: "curse_hidden_hangman",
    },
    {
        name: "Curse of the Endless Tumble",
        effect: "Seekers must roll a die at least 100 feet and have it land on a 5 or a 6 before they can ask another question. The die must roll the full distance, unaided, using only the momentum from the initial throw and gravity to travel the 100 feet. If the seekers accidentally hit someone with a die, you are awarded a {10/20/30} minute bonus.",
        castingCost: "Roll a die. If it's a 5 or a 6, this card has no effect.",
        image: "curse_endless_tumble",
    },
    {
        name: "Curse of the Right Turn",
        effect: "For the next {20/40/60} minutes, the seekers can only turn right at any street intersection. If, at any point, they find themselves in a dead end where they cannot continue forward or turn right for another 1,000 feet, they may do a full 180. A right turn is defined as a road at any angle that veers to the right of the seekers.",
        castingCost: "Discard a card.",
        image: "curse_right_turn",
        minutes: [20, 40, 60],
    },
    {
        name: "Curse of the Urban Explorer",
        effect: "For the rest of your run, seekers cannot ask questions when they are on transit or in a transit station.",
        castingCost: "Discard 2 cards.",
        image: "curse_urban_explorer",
    },
    {
        name: "Curse of the Overflowing Chalice",
        effect: "For the next three questions, you may draw (not keep) an additional card when drawing from the hider deck.",
        castingCost: "Discard a card.",
        image: "curse_overflowing_chalice",
    },
    {
        name: "Curse of the Labyrinth",
        effect: "Spend up to {10/20/30} minutes drawing a solvable maze and send a photo of it to the seekers. You cannot use the internet to research maze designs. The seekers must solve the maze before asking another question.",
        castingCost: "Draw a maze.",
        image: "curse_labyrinth",
    },
];

export const POWERUPS: Powerup[] = [
    {
        name: "Veto Question",
        effect: "Play instead of answering a question. No answer is given, and no reward is earned.",
        count: 4,
        image: "powerup_veto_question",
    },
    {
        name: "Randomize Question",
        effect: "Play instead of answering a question. A new unasked question from the same category is chosen, at random, which you answer instead.",
        count: 4,
        image: "powerup_randomize_question",
    },
    {
        name: "Discard 1, Draw 2",
        effect: "Discard one other card from your hand. Then, draw and keep two cards from the hider deck.",
        count: 4,
        image: "powerup_discard_1_draw_2",
    },
    {
        name: "Discard 2, Draw 3",
        effect: "Discard two other cards from your hand. Then, draw and keep three cards from the hider deck.",
        count: 4,
        image: "powerup_discard_2_draw_3",
    },
    {
        name: "Draw 1, Expand 1",
        effect: "Draw one card from the hider deck. For the rest of the round, you can hold one additional card in your hand.",
        count: 2,
        image: "powerup_draw_1_expand_1",
    },
    {
        name: "Duplicate Another Card",
        effect: "Play this card as a copy of any other card in your hand. This may be used to duplicate a time bonus at the end of your round.",
        count: 2,
        image: "powerup_duplicate_another_card",
    },
    {
        name: "Move",
        effect: "Discard your hand and send the seekers the location of your transit station. This card grants a {10/20/60} minute period to establish a new hiding zone somewhere else on the game map. The seekers are frozen and your hiding timer is paused until this new hiding period has concluded. This card cannot be played during the endgame.",
        count: 1,
        image: "powerup_move",
    },
];

export const TIME_BONUSES: TimeBonus[] = [
    { minutes: [2, 3, 5], count: 25, image: "time_bonus_5" },
    { minutes: [4, 6, 10], count: 15, image: "time_bonus_10" },
    { minutes: [6, 9, 15], count: 10, image: "time_bonus_15" },
    { minutes: [8, 12, 20], count: 3, image: "time_bonus_20" },
    { minutes: [12, 18, 30], count: 2, image: "time_bonus_30" },
];

/** Where a card's picture is served from (relative to the site root). */
export const cardImage = (image: string) => `rules/cards/${image}.webp`;

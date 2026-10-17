/**
 * Original sample library for development: essays on urbanism, systems and
 * software written for Libra's design comps. Nothing here is real reporting;
 * every person and publication is fictional.
 */

import type { CollectionColor, HighlightColor, ReadingStatus } from "../lib/generated/prisma/enums";

export interface SampleCollection {
  key: string;
  name: string;
  description: string;
  color: CollectionColor;
  isFavorite: boolean;
}

export const SAMPLE_COLLECTIONS: SampleCollection[] = [
  { key: "design", name: "Design & Creativity", description: "Criticism, type, and the way things are made.", color: "BLUSH", isFavorite: true },
  { key: "tech", name: "Technology", description: "Long essays about software and the people maintaining it.", color: "BLUE", isFavorite: true },
  { key: "revisit", name: "Books to Revisit", description: "Longer things worth a second pass, not a first skim.", color: "YELLOW", isFavorite: true },
  { key: "growth", name: "Personal Growth", description: "Quieter pieces about attention, habit, and finishing things.", color: "SAGE", isFavorite: false },
  { key: "cities", name: "Cities & Streets", description: "Urbanism, transit, and the politics of a curb radius.", color: "TERRACOTTA", isFavorite: true },
  { key: "field", name: "Field Notes", description: "A collection made on purpose and not filled yet.", color: "STONE", isFavorite: false },
];

export interface SampleHighlight {
  quote: string;
  color: HighlightColor;
  note?: string;
  daysAgo: number;
}

export interface SampleArticle {
  title: string;
  author: string;
  publication: string;
  sourceUrl: string;
  status: ReadingStatus;
  progress: number;
  isFavorite: boolean;
  daysAgo: number;
  collections: string[];
  tags: string[];
  html: string;
  highlights: SampleHighlight[];
}

const walk = `
<p>The intersection of Bellamy and Dockwell is, by any ordinary measure, a failure. It has four lanes in each direction, a refuge island the width of a filing cabinet, and a signal cycle that gives people on foot nineteen seconds to cross eighty-four feet of asphalt. Nobody designed it to be hostile. That is the uncomfortable part. Every element of it was approved by someone competent, following a standard, in a meeting with minutes.</p>
<p>I have spent two years reading those minutes. What they record is not malice but a quiet accumulation of locally reasonable decisions: a turning radius widened for a fire truck that comes twice a year, a crossing removed because the count of pedestrians using it was low, a lane added because the model said delay would otherwise rise by forty seconds in 2041. Each decision, taken alone, is defensible. Taken together they produce a street that cannot be crossed.</p>
<h2>The arithmetic of a crossing</h2>
<p>Traffic engineering has a number for almost everything, and the numbers are mostly honest. The trouble is which quantities get counted. Vehicle delay is measured in seconds per vehicle, aggregated over a peak hour, and reported to two decimal places. Pedestrian delay is measured, when it is measured at all, as a level-of-service letter that nobody signs off on.</p>
<p>So the asymmetry is not ideological. It is clerical. A street that cannot be crossed on foot is not a street; it is a wall with traffic on it. The wall is invisible in the analysis because walls are not in the units.</p>
<p>Ask what the counts were, and you discover the second trap. Pedestrian volumes are counted where people currently walk. If a crossing is unpleasant, few people use it; if few people use it, the count is low; if the count is low, the crossing is a candidate for removal. The measurement participates in the outcome it claims to describe.</p>
<h2>What the curb remembers</h2>
<p>Streets keep records in their geometry. You can read the decade of a corner from its radius the way you can read the decade of a building from its window proportions. The tight, almost square corners of a pre-war grid were cut for carts and for people stepping off a curb without ceremony. The long sweeping curves of the postwar arterial were cut for a design vehicle: a notional truck, modelled, that must never slow down.</p>
<blockquote>The design vehicle is not a truck. It is a decision about who the street is willing to inconvenience.</blockquote>
<p>Once poured, concrete is an argument that is very difficult to reopen. A signal timing plan can be changed on a Tuesday afternoon. A curb radius requires a capital project, a budget line, three rounds of consultation and, usually, a reason that is not simply “this is unpleasant.” Comfort does not have a funding stream.</p>
<p>This is why so much of the practical work of street repair is clerical rather than architectural. Changing which quantity appears in the first column of the spreadsheet does more, over a decade, than any individual redesign.</p>
<h2>Ninety seconds of waiting</h2>
<p>At Bellamy and Dockwell the full signal cycle is one hundred and twenty seconds. A person arriving at the wrong moment waits, on average, forty-eight seconds, and at worst a little over a hundred. This is a long time. It is long enough to check a phone, long enough to reconsider the trip, and — critically — long enough that the expected cost of crossing against the signal starts to look rational.</p>
<p>Engineers call the resulting behaviour non-compliance. I would call it arithmetic. People are extremely good at estimating the cost of waiting and fairly bad at estimating the cost of being hit, and the street has arranged for those two errors to point in the same direction.</p>
<p>The fix is not education. It is to make the compliant choice the cheap one.</p>
<p>Shortening the cycle to seventy seconds would cost drivers perhaps eleven seconds each in the evening peak. It would cut the worst-case pedestrian wait roughly in half. Nobody has proposed it, because the eleven seconds appear in a model with a name and a review process, and the fifty seconds appear nowhere at all.</p>
<h2>Rebuilding the short trip</h2>
<p>The trips that disappear first in a car-shaped city are the short ones: the eight-minute walk to a pharmacy, the four-minute walk to a bus. These are also the trips that are cheapest to restore, because they do not require anybody to move house or change job. They require only that the distance be crossable.</p>
<p>Three interventions do most of the work, and none of them are glamorous. Tighten the corner so that turning requires looking. Add the crossing back on the fourth leg, the one that was closed in 1987 for reasons nobody now remembers. Shorten the cycle. Together they cost less than a quarter-mile of resurfacing.</p>
<p>What makes them hard is not money but narrative. A resurfacing project is maintenance; it needs no champion. A crossing is a change, and changes acquire opponents. The institutional default is inertia, and inertia in a street is never neutral — it is a vote for the arrangement that already exists.</p>
<h2>A street, eventually</h2>
<p>I went back to Bellamy and Dockwell in March. The fourth crossing is still missing. But the signal cycle has quietly dropped to ninety seconds, because a technician retimed the corridor and nobody objected, and the difference is legible on the sidewalk: people stand nearer the curb, lean less, look up more.</p>
<p>It is a small thing and it was not a project. It had no ribbon. It is also the only improvement to that intersection in nineteen years, and it happened because one person with access to the timing software decided that the pedestrian column was worth something.</p>
<p>Most of the city will be repaired this way, if it is repaired at all: not by master plans but by a long sequence of people deciding, inside the ordinary bounds of their job, to count a different thing.</p>
`;

const feed = `
<p>There is a particular quality to the tiredness that follows an hour of scrolling, and it is not the tiredness of having read. Reading leaves residue. The feed leaves a kind of polished blankness, as if the mind has been wiped with a soft cloth.</p>
<h2>The shape of the thing</h2>
<p>A feed has no end, and this is usually described as its defining feature. I think the more important property is that it has no shape. A magazine has a back cover. A book has a weight in the hand that tells you, continuously and without words, how much is left. These are not conveniences; they are the structure that makes attention finite and therefore spendable.</p>
<p>The feed does not steal your attention. It rents it back to you, hourly. You are never denied the thing you came for. You are simply never told that you have finished.</p>
<h2>Against the infinite</h2>
<p>The alternative is not asceticism. It is edges. A reading queue with a visible bottom, a newsletter that arrives on Thursdays, a stack of saved pieces that can, in principle, be emptied. Finishing is a design feature, and we removed it on purpose because the metric we chose to optimise could not see it.</p>
<p>I have started measuring my week by the number of things I finished rather than the number I encountered. The first number is small and slightly embarrassing. It is also, unlike the second, actually mine.</p>
`;

const stocks = `
<p>Most arguments about policy are arguments about rates disguised as arguments about levels, and almost nobody notices the substitution.</p>
<h2>Bathtubs</h2>
<p>A stock is what is in the bathtub. A flow is what comes out of the taps and what goes down the drain. It sounds trivial until you watch a room full of intelligent people reason about the bath by staring at the taps.</p>
<p>A stock is just a flow that has learned patience. Housing is a stock. Emissions are a flow. Trust is a stock, and it drains far faster than it fills — which is why the arithmetic of apology is so unforgiving.</p>
<h2>Why waiting is a skill</h2>
<p>Systems with long delays punish the responsive. If the feedback arrives eighteen months after the decision, then acting on this month's signal is not diligence but noise amplification. The discipline is to act on the trend and wait out the wobble — which is politically almost impossible, because waiting looks identical to neglect right up until it looks like foresight.</p>
<p>The useful question in any meeting is therefore not “what is happening?” but “what is accumulating?” The first gets you a dashboard. The second gets you a strategy.</p>
`;

const compilers = `
<p>A compiler is the most patient reader you will ever have. It takes everything you wrote literally, forgives nothing, and remembers no context you did not write down.</p>
<h2>The literal reader</h2>
<p>Working with one for twenty years rearranges how you write prose, too. You start to notice how much ordinary language leans on the reader's goodwill — the pronoun whose referent is three sentences back, the “obviously” doing structural work.</p>
<p>Every abstraction is a promise about what you will never need to look at again. The promise is always partially broken; the craft is in choosing which part.</p>
<h2>What the machine keeps</h2>
<p>The odd consequence is that the compiler ends up holding a record of what its programmers believed. Old code is a fossil bed of assumptions: the buffer that was big enough in 1994, the time zone nobody expected to change, the comment that says “temporary” in a file older than the intern reading it.</p>
<p>Reading that record kindly is most of the job. The people who wrote it were not careless. They were answering a different question than the one in front of you now.</p>
`;

const finishing = `
<p>An abandoned book is not a failure of discipline. It is a completed experiment. You opened it with a question — will this be worth my evenings? — and somewhere around page ninety the answer arrived.</p>
<p>We are taught to finish things the way we are taught to clear our plates, as a moral habit rather than a judgement. But reading is not eating. A book left on the nightstand costs nothing except the faint guilt we attach to it, and that guilt is a poor guide to what we should read next.</p>
<p>The better habit is to stop deliberately: to notice the moment a book has given you what it is going to give, write down the one sentence you want to keep, and shelve it without ceremony. The shelf will hold it for the day you are ready for the rest.</p>
`;

const groundFloor = `
<p>Walk the length of almost any new mixed-use block and count the doors. Not the windows, which are plentiful and mostly frosted, but the doors you could actually open from the sidewalk. On the blocks built in the last decade the answer is often two: one for the lobby, one for the parking garage.</p>
<p>The ground floor used to be the city's living room. Shops, workshops, stoops and stairwells turned the edge of every building into a place where something might happen. Today it is increasingly a service zone — loading bays, utility rooms, a gym behind tinted glass — designed to be passed rather than entered.</p>
<p>None of this was decided by anyone who wanted dead streets. It follows from parking minimums, from leasing models that prefer one large tenant to six small ones, from fire codes written for towers and applied to everything. Each rule is reasonable. The sum of them is a city whose first storey has quietly stopped being a room.</p>
`;

export const SAMPLE_ARTICLES: SampleArticle[] = [
  {
    title: "The City That Forgot How to Walk",
    author: "Mireille Asante",
    publication: "Slow Transit",
    sourceUrl: "https://slowtransit.example/the-city-that-forgot-how-to-walk",
    status: "READING",
    progress: 0.62,
    isFavorite: true,
    daysAgo: 2,
    collections: ["cities"],
    tags: ["urbanism", "infrastructure"],
    html: walk,
    highlights: [
      {
        quote: "A street that cannot be crossed on foot is not a street; it is a wall with traffic on it.",
        color: "YELLOW",
        note: "Open the talk with this. Then the signal-timing slide.",
        daysAgo: 2,
      },
      { quote: "Comfort does not have a funding stream.", color: "BLUSH", daysAgo: 1 },
    ],
  },
  {
    title: "Against the Infinite Feed",
    author: "Jonas Keller",
    publication: "Greyscale",
    sourceUrl: "https://greyscale.example/against-the-infinite-feed",
    status: "ARCHIVED",
    progress: 1,
    isFavorite: false,
    daysAgo: 4,
    collections: ["design"],
    tags: ["criticism", "attention"],
    html: feed,
    highlights: [{ quote: "The feed does not steal your attention. It rents it back to you, hourly.", color: "BLUSH", daysAgo: 4 }],
  },
  {
    title: "Stocks, Flows, and the Art of Waiting",
    author: "Priya Raghunathan",
    publication: "The Commons Review",
    sourceUrl: "https://commonsreview.example/stocks-flows-waiting",
    status: "READING",
    progress: 0.41,
    isFavorite: false,
    daysAgo: 8,
    collections: ["growth"],
    tags: ["systems"],
    html: stocks,
    highlights: [
      {
        quote: "A stock is just a flow that has learned patience.",
        color: "SAGE",
        note: "Same idea as the municipal budget piece, slower vocabulary. Worth putting side by side.",
        daysAgo: 7,
      },
    ],
  },
  {
    title: "What Compilers Know About Us",
    author: "Teodor Vrána",
    publication: "Fieldnote",
    sourceUrl: "https://fieldnote.example/what-compilers-know",
    status: "READING",
    progress: 0.08,
    isFavorite: false,
    daysAgo: 10,
    collections: ["tech"],
    tags: ["technology", "craft"],
    html: compilers,
    highlights: [{ quote: "Every abstraction is a promise about what you will never need to look at again.", color: "BLUE", daysAgo: 9 }],
  },
  {
    title: "On Not Finishing Books",
    author: "Jonas Keller",
    publication: "Greyscale",
    sourceUrl: "https://greyscale.example/on-not-finishing-books",
    status: "INBOX",
    progress: 0,
    isFavorite: true,
    daysAgo: 12,
    collections: ["growth"],
    tags: ["attention"],
    html: finishing,
    highlights: [],
  },
  {
    title: "The Quiet Death of the Ground Floor",
    author: "Mireille Asante",
    publication: "Slow Transit",
    sourceUrl: "https://slowtransit.example/ground-floor",
    status: "INBOX",
    progress: 0,
    isFavorite: false,
    daysAgo: 1,
    collections: ["cities"],
    tags: ["urbanism"],
    html: groundFloor,
    highlights: [],
  },
];

export const SAMPLE_NOTE = {
  title: "Notes on legibility",
  body: `Scott's legibility is about the state seeing citizens. Type legibility is about readers seeing words. The overlap is not a metaphor — both are about who is allowed to be illegible.

A typeface that is "highly legible" at small sizes earns that by flattening difference: open counters, generous spacing, letterforms that can't be mistaken for one another. That is a gift to the reader and a loss to the letter.

Questions to bring to the street-design essay: who is a crossing legible to? What does a signal cycle make visible, and what does it hide?`,
  daysAgo: 6,
  collections: ["design"],
  tags: ["type", "criticism"],
  highlights: [
    {
      quote: "both are about who is allowed to be illegible",
      color: "YELLOW" as HighlightColor,
      note: "Connects to the crossing counts: unmeasured people are illegible people.",
      daysAgo: 5,
    },
  ],
};

export const SAMPLE_PDF = {
  title: "A Grammar of Shadows",
  author: "Beatriz Cardoso",
  publication: "Plinth Quarterly",
  daysAgo: 14,
  collections: ["design", "revisit"],
  tags: ["architecture", "criticism"],
  pages: [
    {
      paragraphs: [
        "A facade is a sentence the building says about its climate, and most new ones are mumbling. The glass box is the same in Lisbon and in Oslo; it answers the sun by buying more air conditioning, which is not an answer so much as a refusal to listen.",
        "The Brazilian brise-soleil was a different kind of speech. Its fins and louvres were tuned to a latitude: angled to admit the low winter sun and to turn away the high summer one. You can read the orientation of a 1950s Rio office block from across the street the way you can read a sundial.",
      ],
    },
    {
      heading: "Reading a wall",
      paragraphs: [
        "To read a facade as a sentence is to ask what it is responding to. Depth is the first word: a wall with no depth has nothing to say about light. Rhythm is the second: the spacing of openings tells you whether the rooms behind them were planned for people or for a structural grid.",
        "Shadow is the grammar that connects them. A deep reveal casts a shadow that moves through the day, and that moving line is the building's way of keeping time. Flat glass keeps no time at all; it reflects whatever is in front of it and so it is always, in a sense, somewhere else.",
      ],
    },
    {
      heading: "The cost of saying something",
      paragraphs: [
        "Depth costs money. Every fin is a detail, every reveal a junction to waterproof. The flat facade wins on the spreadsheet and loses on every other measure we have, which is why the argument for shade is ultimately an argument about which costs we are willing to count.",
        "The good news is that the old vocabulary still works. Nothing about the brise-soleil requires a new material or a new theory. It requires only that someone decide the building should say something true about where it stands.",
      ],
    },
  ],
};

export const SAMPLE_EPUB = {
  title: "The Long Now of Software Maintenance",
  author: "Rosalind Ngata",
  publisher: "Fieldnote Editions",
  daysAgo: 20,
  collections: ["tech", "revisit"],
  tags: ["technology", "systems"],
  chapters: [
    {
      title: "1. Judged by what fails to happen",
      paragraphs: [
        "Maintenance is the only design discipline that is judged by what fails to happen. A bridge that does not fall, a payroll that runs on Friday, a certificate that renews itself at three in the morning: none of these make news, and all of them are work.",
        "This invisibility is not an accident. Organisations reward visible change, and maintenance is the practice of preventing visible change. The better it is done, the less there is to show for it.",
        "So the first job of a maintainer is to make the work legible: to keep a record of what was prevented, what was deferred, and what is quietly getting worse.",
      ],
    },
    {
      title: "2. The interest on old decisions",
      paragraphs: [
        "Every system carries the decisions of the people who built it, and those decisions accrue interest. A schema chosen in a hurry becomes a migration plan; a library pinned for safety becomes a security advisory.",
        "The interest is not a moral failing. It is the cost of having shipped at all. The question is never whether to pay it, only whether to pay it on a schedule or all at once, at the worst possible moment.",
      ],
    },
    {
      title: "3. Rituals for the long now",
      paragraphs: [
        "The teams that maintain systems for decades share a handful of rituals. They write down why, not just what. They rehearse failures on purpose. They budget a fixed slice of every cycle for work nobody will notice.",
        "None of this is glamorous. All of it is how software, like a city, survives the people who made it.",
      ],
    },
  ],
};

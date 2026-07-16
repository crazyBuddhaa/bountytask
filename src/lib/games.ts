// ============================================================
// BountyTask — Games shared constants & seed logic
// ============================================================

export const GAME_SLUGS = [
  'wordle', 'higher-or-lower', 'tap-target', '2048', 'color-rush', 'word-scramble',
] as const
export type GameSlug = typeof GAME_SLUGS[number]

export interface GameMeta {
  name: string
  description: string
  emoji: string
  isDaily: boolean   // true = one play per day
  leaderboardLabel: string
}

export const GAME_META: Record<GameSlug, GameMeta> = {
  'wordle':          { name: 'Daily Wordle',      emoji: '🟩', isDaily: true,  description: 'Guess the 5-letter word in 6 tries', leaderboardLabel: 'Best score' },
  'higher-or-lower': { name: 'Higher or Lower',   emoji: '🔢', isDaily: true,  description: 'Find the secret number with fewest guesses', leaderboardLabel: 'Best score' },
  'tap-target':      { name: 'Tap the Target',    emoji: '🎯', isDaily: false, description: 'Hit as many targets as possible in 30 s', leaderboardLabel: 'Most hits' },
  '2048':            { name: '2048',              emoji: '🧮', isDaily: false, description: 'Slide tiles and reach 2048', leaderboardLabel: 'Highest score' },
  'color-rush':      { name: 'Color Rush',        emoji: '🎨', isDaily: false, description: 'Tap the right color before time runs out', leaderboardLabel: 'Most correct' },
  'word-scramble':   { name: 'Word Scramble',     emoji: '🔤', isDaily: false, description: 'Unscramble 10 words against the clock', leaderboardLabel: 'Most correct' },
}

// ─── Word lists ────────────────────────────────────────────────────────────────

/** 5-letter Wordle word pool */
export const WORDLE_WORDS: string[] = [
  'about','above','abuse','actor','acute','admit','adopt','adult','after','again',
  'agent','agree','ahead','alarm','album','alert','alike','align','alive','alley',
  'allow','alone','along','alter','angel','anger','angle','ankle','apart','apple',
  'apply','arena','argue','arise','armor','arose','array','aside','asset','attic',
  'avoid','awake','aware','awful','badge','baker','basic','basis','batch','beach',
  'beard','beast','began','begin','being','below','bench','birth','black','blade',
  'blame','blank','blast','blaze','blend','blind','block','blood','bloom','blown',
  'board','boost','bound','brace','brain','brand','brave','bread','break','breed',
  'brick','bride','brief','bring','broad','brown','build','built','bunch','burnt',
  'buyer','cabin','cable','candy','carry','catch','cause','chain','chair','chaos',
  'charm','chart','chase','cheap','check','cheek','cheer','chess','chest','chief',
  'child','civic','civil','claim','clash','class','clean','clear','clerk','click',
  'cliff','climb','clock','close','cloud','coach','coast','comic','coral','could',
  'count','court','cover','crack','craft','crash','crazy','cream','creek','crime',
  'cross','crowd','crown','cruel','crush','curve','cycle','daily','dance','deals',
  'decay','delay','delta','dense','depth','dirty','dizzy','doubt','draft','drain',
  'drama','drawl','drawn','dream','dress','drift','drink','drive','drove','drunk',
  'dusty','eagle','early','earth','eight','elect','elite','empty','enemy','enjoy',
  'enter','entry','equal','error','essay','every','exact','exist','extra','fable',
  'faith','false','fancy','fatal','fault','feast','fetch','fever','fiber','field',
  'fifth','fifty','fight','final','first','fixed','flame','flash','fleet','flesh',
  'flick','float','flood','floor','flour','flown','fluid','flute','focus','force',
  'forge','found','frame','fraud','fresh','front','froze','fully','funny','ghost',
  'given','glare','glass','globe','gloom','gloss','glove','going','grace','grade',
  'grain','grand','grant','graph','grasp','grass','grave','great','green','greet',
  'grief','grill','grind','groan','group','grove','growl','guard','guest','guide',
  'guild','guilt','heart','heavy','hedge','hello','hence','hinge','honor','horse',
  'hotel','house','hover','human','humid','humor','hurry','ideal','image','imply',
  'inner','input','intro','issue','ivory','jazzy','jewel','joint','joker','judge',
  'juice','juicy','jumbo','karma','knack','kneel','knife','knock','known','label',
  'lance','large','laser','latch','later','laugh','layer','learn','lease','leave',
  'legal','lemon','level','light','limit','liver','local','lodge','logic','loose',
  'lower','lucky','lunar','magic','major','maker','manor','maple','march','marsh',
  'match','mayor','medal','mercy','merge','merit','metal','minor','minus','misty',
  'model','money','month','moral','motor','mount','mouse','mouth','mover','movie',
  'music','naive','naval','nerve','never','newer','night','noble','noise','north',
  'noted','novel','nurse','offer','often','omega','onion','onset','opera','order',
  'organ','other','outer','paint','panel','paper','party','pasta','patch','pause',
  'peace','pearl','perch','phone','photo','piano','pilot','pinch','pixel','pizza',
  'place','plain','plane','plant','plate','plaza','plumb','plume','point','poker',
  'polar','power','press','price','pride','prime','print','probe','prone','proof',
  'prose','proud','prove','proxy','pulse','punch','pupil','purse','queen','query',
  'quest','quota','quite','quote','radar','radio','raise','rally','ranch','range',
  'rapid','raven','reach','ready','realm','rebel','relax','remix','rider','ridge',
  'rifle','right','risky','rival','river','rivet','robot','rocky','rough','route',
  'ruler','rusty','saint','salad','sauce','scene','score','scout','seize','sense',
  'serve','seven','shade','shake','shall','shame','shape','share','shark','sharp',
  'shelf','shell','shift','shine','shirt','shock','shoot','shore','short','shout',
  'shove','sight','silly','since','sixth','sixty','skill','skull','slant','slash',
  'sleep','slice','slide','slope','small','smart','smile','smoke','solar','solid',
  'solve','sorry','south','space','spare','spark','speak','spend','spice','spill',
  'spine','spoke','spoon','sport','spray','staff','stage','stain','stair','stake',
  'stand','stark','start','state','steam','steel','steep','steer','stern','stiff',
  'still','stock','stone','stood','store','storm','story','stuck','study','style',
  'sugar','suite','super','surge','swamp','swear','sweep','sweet','swift','sword',
  'table','taunt','teeth','tempo','tense','tenth','tepid','thorn','three','throw',
  'tight','timer','titan','title','toast','today','token','tooth','topic','torch',
  'total','touch','tough','towel','tower','toxic','trace','track','trade','trail',
  'train','trait','trash','tread','treat','trend','trial','tribe','trick','tried',
  'troop','truck','truly','trunk','trust','truth','tulip','tutor','twice','twist',
  'typed','ultra','under','union','unity','until','upper','upset','urban','usage',
  'usual','utter','vague','valid','value','valve','vapor','vault','verse','video',
  'vigor','viral','virus','vista','vital','vivid','vocal','voter','watch','water',
  'weave','weigh','weird','where','which','while','white','whole','whose','wider',
  'witch','woman','women','world','worry','worse','worst','worth','would','wound',
  'wrath','wrist','write','wrote','yacht','yearn','yield','young','yours','youth',
  'zebra',
]

/** 6-letter words for Word Scramble */
export const SCRAMBLE_WORDS: string[] = [
  'PLANET','BRIDGE','CASTLE','FOREST','MARKET','GARDEN','PURPLE','ORANGE',
  'SILVER','YELLOW','WINTER','SUMMER','SPRING','FLOWER','SCHOOL','BOTTLE',
  'CANDLE','BUTTER','COFFEE','DOCTOR','WINDOW','PILLOW','MIRROR','CARPET',
  'BASKET','PENCIL','ROCKET','JUNGLE','CACTUS','BUCKET','HAMMER','FINGER',
  'ISLAND','JACKET','KETTLE','LADDER','MAGNET','NEEDLE','OYSTER','PALACE',
  'RIBBON','STATUE','TEMPLE','VELVET','WALNUT','PIRATE','CANNON','DRAGON',
  'SHIELD','BATTLE','WIZARD','HUNTER','KNIGHT','FALCON','PYTHON','TURTLE',
  'PARROT','RABBIT','BADGER','FERRET','LIZARD','SALMON','SPIDER','BEETLE',
  'PIGEON','JAGUAR','MONKEY','DONKEY','WALRUS','PEPPER','GINGER','NUTMEG',
  'CLOVER','ALMOND','CHERRY','GRAPES','CASHEW','PEANUT','RADISH','CELERY',
  'OYSTER','MUFFIN','COOKIE','WAFFLE','NOODLE','PASTRY','YOGURT','CHEESE',
  'PICKLE','GARLIC','LYCHEE','PAPAYA','MANGO','ALMOND','WALNUT','CASHEW',
  'DONKEY','PARROT','RABBIT','BEETLE','FALCON','LIZARD','SALMON','TURTLE',
  'AUTHOR','BANNER','CINDER','DIFFER','EDITOR','FUDGE','GLIDER','HUNTER',
  'INSECT','JIGSAW','KITTEN','LOCKER','MALLET','NAPKIN','ORIGIN','PORTER',
  'QUIVER','RANGER','SORBET','TANGLE','USHER','VENDOR','WIDGET','YONDER',
]

// ─── Seed helpers ──────────────────────────────────────────────────────────────

/** Deterministic integer hash from a string (djb2 variant) */
export function hashString(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h) ^ s.charCodeAt(i)
  return Math.abs(h >>> 0)
}

/** Today's date string YYYY-MM-DD (UTC) */
export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Pick daily Wordle word for a given date string */
export function getDailyWord(dateStr: string): string {
  return WORDLE_WORDS[hashString(dateStr) % WORDLE_WORDS.length]
}

/** Pick daily secret number 1-100 for Higher or Lower */
export function getDailyNumber(dateStr: string): number {
  return (hashString(dateStr + ':hol') % 100) + 1
}

/** Shuffle an array deterministically using a seed */
export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = seed
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1);
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Scramble a word (guaranteed to differ from original) */
export function scrambleWord(word: string): string {
  const letters = word.split('')
  let attempts = 0
  let shuffled: string[]
  do {
    shuffled = [...letters].sort(() => Math.random() - 0.5)
    attempts++
  } while (shuffled.join('') === word && attempts < 20)
  return shuffled.join('')
}

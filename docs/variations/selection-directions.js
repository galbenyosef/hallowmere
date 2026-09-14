// Gallery-only art direction. Combat values and abilities come from classes.js.
export const DIRECTIONS = [
  {id:'hearth',name:'The Last Hearth',category:'Ensemble · character first',description:'Meet the entire vigil at once. Select a figure to bring them into the light; their calling unfolds below.',reference:'Diablo II: Resurrected · ensemble staging',url:'https://diablo2.blizzard.com/'},
  {id:'codex',name:'The Ashen Codex',category:'Narrative · chapter navigation',description:'An illustrated field book. Turn between seven chapters, with the character on one leaf and their fighting style on the other.',reference:'Baldur’s Gate 3 · character identity',url:'https://baldursgate3.game/news/community-update-8-character-creation_9'},
  {id:'circle',name:'Circle of Oaths',category:'Spatial · radial selection',description:'Seven callings orbit a single character. Choose a portrait around the circle to place that hero at its heart.',reference:'Original Hallowmere direction'},
  {id:'banners',name:'Hall of Banners',category:'Panoramic · expanding roster',description:'Each class owns a tall banner. The selected banner opens into a full portrait while the other callings remain visible.',reference:'Dragon Age: Inquisition · heraldic composition',url:'https://www.ea.com/games/dragon-age/dragon-age-inquisition'},
  {id:'armory',name:'The Reliquary',category:'Equipment · weapon first',description:'Choose the weapon you want to wield. A full-size character and live equipment details reveal the class behind it.',reference:'Dark Souls · equipment-led class choice',url:'https://www.bandainamcoent.com/games/dark-souls-remastered'},
  {id:'chronicle',name:'The Chronicle',category:'Editorial · story first',description:'An oversized chapter number and a quiet class index frame a character portrait. The opening line leads into their combat identity.',reference:'Pillars of Eternity · written character identity',url:'https://eternity.obsidian.net/'},
  {id:'ledger',name:'The Field Ledger',category:'Comparison · attributes first',description:'Compare the actual starting attributes in a single roster table. Select a row to inspect the hero and their complete ability kit.',reference:'Classic party RPGs · character sheets'},
  {id:'procession',name:'The Procession',category:'Focused · portrait carousel',description:'One hero takes the stage, with the previous and next callings at the edges. Cycle with arrows or jump directly through the portrait rail.',reference:'Original Hallowmere direction'},
  {id:'paths',name:'Three Paths',category:'Guided · playstyle first',description:'Start with a way to fight: steel, distance, or protection. Explore the matching classes, then inspect their kit before committing.',reference:'Baldur’s Gate 3 · class-led creation',url:'https://baldursgate3.game/news/community-update-21-forging-your-legacy_77'},
  {id:'threshold',name:'The Threshold',category:'Cinematic · minimal interface',description:'A monumental character silhouette, a restrained portrait rail, and one invitation. Open the fighting-style drawer when you need more detail.',reference:'Path of Exile 2 · cinematic character staging',url:'https://pathofexile2.com/'}
];

export const CLASS_FLAVOR = {
  sorcerer:{title:'A voice beyond the veil.',tag:'BONE ORACLE',line:'The dead have much to teach the living.',path:'distance'},
  ranger:{title:'The road leaves no trace.',tag:'THE FAR STRIDER',line:'An arrow finds what the eye cannot.',path:'distance'},
  reaver:{title:'Let the dark come closer.',tag:'THE BLOODBOUND',line:'Some oaths are written in iron.',path:'steel'},
  nightblade:{title:'A whisper. Then silence.',tag:'THE UNSEEN',line:'Shadows keep their own counsel.',path:'steel'},
  oathkeeper:{title:'Hope descends on golden wings.',tag:'THE GUARDIAN ANGEL',line:'Where others fall, you bring them back.',path:'protection'},
  alchemist:{title:'A remedy for the end.',tag:'THE BITTER HAND',line:'Poison and mercy share a vessel.',path:'distance'},
  geralt:{title:'Monsters know your name.',tag:'THE WHITE WOLF',line:'Steel for the hunt. Signs for the darkness.',path:'steel'}
};

export const PATHS = [
  {id:'steel',name:'The path of steel',description:'Close the distance. Strike without hesitation.'},
  {id:'distance',name:'The path of distance',description:'Keep your reach. Control the battlefield.'},
  {id:'protection',name:'The path of protection',description:'Hold the line. Shelter those beside you.'}
];

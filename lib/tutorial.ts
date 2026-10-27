export type TutorialAction = 'GOALS' | 'DISPLAY' | 'MINE' | 'STAIRS' | 'FARM' | 'CLAN' | 'TRADE' | 'DECREES' | 'GUILD' | 'CHRONICLE' | 'SAVE';
export interface TutorialStep {
  title: string;
  body: string;
  entries: { name: string; text: string }[];
  action?: { label: string; target: TutorialAction };
}
export const TUTORIAL_STEPS: readonly TutorialStep[] = [
  {
    title: 'Build a Mountainhome',
    body: 'Your seven pioneers are the beginning of a future Mountainhome Capital. Reach 6,000 fortress score to earn the highest rank.',
    entries: [
      { name: 'Your first priorities', text: 'Keep food and ale stocked, mine stone and ore, and establish reliable workshops.' },
      { name: 'How you progress', text: 'Wealth, population, workshops, deeper exploration, and relics all add to your fortress score. Quests offer smaller milestones and rewards along the way.' },
      { name: 'Take your time', text: 'New colonies start paused. Read the guide, place your first orders, then press Resume. You can close the guide or replay it from Menu → How to play.' },
    ],
    action: { label: 'View goal & milestones', target: 'GOALS' },
  },
  {
    title: 'Read and explore the map',
    body: 'Every character is a tile, creature, building, or order. Hover over a tile for its compact description above the tool buttons.',
    entries: [
      { name: 'Depth', text: 'The map starts at Z-0, the surface. Use the depth selector or [ and ] to explore the six layers. Unexplored rock appears as dots.' },
      { name: 'Inspect', text: 'Press I or choose Inspect, then select a tile to see dwarves, threats, or a building’s function. Arrow keys move the cursor; Escape closes inspection.' },
      { name: 'Display', text: 'Map options contains labels, quick orders, the object finder, and panning. Menu → Display settings controls map zoom, text size, contrast, and reduced motion.' },
    ],
    action: { label: 'Open display settings', target: 'DISPLAY' },
  },
  {
    title: 'Give your first orders',
    body: 'Choose a tool, drag across eligible tiles, then press Enter or Queue to confirm. Dwarves with the right labor will do the work.',
    entries: [
      { name: 'Mine · D', text: 'Dig rock walls and ore veins. Ordinary rock yields stone; colored veins supply metals. Start at an exposed cliff edge where miners can reach it.' },
      { name: 'Chop · T / Gather · G', text: 'Fell trees for wood and collect surface shrubs for food. Keep gathering while your farms and brewing industry develop.' },
      { name: 'Preview and cancel', text: 'The preview shows valid tiles, blocked tiles, costs, and shortages. Supplies are spent when work completes. Select Clear or press K to cancel queued orders.' },
    ],
    action: { label: 'Select the mining tool', target: 'MINE' },
  },
  {
    title: 'Delve and make a home',
    body: 'Use Build to find construction tools. Costs and blueprint requirements are shown there; unlocked blueprints stay available.',
    entries: [
      { name: 'Stairs · X', text: 'Carve a staircase to connect adjoining depths. Dwarves need a connected, walkable route to reach underground work.' },
      { name: 'Beds', text: 'Place beds on suitable floor tiles to support rest and comfort.' },
      { name: 'Walls and doors', text: 'Stone walls fortify the entrance and corridors. Doors give the fortress controlled passages. Watch the preview so construction does not cut off access to work.' },
    ],
    action: { label: 'Select the stairs tool', target: 'STAIRS' },
  },
  {
    title: 'Keep the clan supplied',
    body: 'Food and ale are your daily essentials. Low supplies are marked in the floating resource display at the top of the map.',
    entries: [
      { name: 'Farm plots', text: 'Place farms on eligible floor tiles. Farmers improve harvests, and seasonal weather affects production.' },
      { name: 'Brewer’s still', text: 'The still turns food into ale. Keep both resources supplied: brewing cannot replace the need for food.' },
      { name: 'Stockpiles · P', text: 'Stockpile zones expand safe food storage and reduce seasonal spoilage. Clan & orders → Stocks explains storage capacity and resource use.' },
    ],
    action: { label: 'Select the farm tool', target: 'FARM' },
  },
  {
    title: 'Build your industry',
    body: 'Gathering materials unlocks better workshops. The Build catalog shows the exact supplies or existing buildings required for each blueprint.',
    entries: [
      { name: 'Mason’s workshop', text: 'Uses stone for furniture and crafted goods.' },
      { name: 'Carpenter’s workshop', text: 'Uses timber for wooden furniture and workshop goods.' },
      { name: 'Smeltery → Forge', text: 'The smeltery processes ore with fuel into bars. The forge turns bars into weapons and armor for the militia. Clan & orders → Stocks contains production orders and repeat controls.' },
    ],
    action: { label: 'View building unlocks', target: 'GOALS' },
  },
  {
    title: 'Create a thriving settlement',
    body: 'Civic buildings support a healthy, productive clan. Inspect a completed building to read its passive benefit and any available activation.',
    entries: [
      { name: 'Tavern hall', text: 'A social gathering place that supports morale and relationships.' },
      { name: 'Temple altar', text: 'Helps dwarves recover morale through ancestral worship.' },
      { name: 'Trade depot', text: 'Improves caravan barter and provides a dedicated place for trade. Build more industry and wealth to unlock advanced civic blueprints.' },
    ],
  },
  {
    title: 'Manage workers and defenses',
    body: 'Clan & orders shows each dwarf’s health, needs, mood, memories, and assigned labors. Labor presets give you a quick way to rebalance work.',
    entries: [
      { name: 'Workers', text: 'Enable the labor a job needs and keep a route to its location. An idle dwarf may be missing the right labor, materials, or access.' },
      { name: 'Militia', text: 'Expand Militia & defense to equip squads and choose Defend, Patrol, or Sally. Station · J and Patrol · N place squad orders on the map.' },
      { name: 'Stone traps', text: 'Traps can damage intruders. Place defenses where enemies will pass, and forge equipment before you rely on the militia in combat.' },
    ],
    action: { label: 'View your clan', target: 'CLAN' },
  },
  {
    title: 'Trade with caravans',
    body: 'Trade depot in the navigation bar opens barter. Offer goods you can spare in exchange for supplies or a new migrant.',
    entries: [
      { name: 'Give and receive', text: 'Set export and import amounts, then review the displayed values. Your offered goods must cover the requested value.' },
      { name: 'Better trading', text: 'A built depot and seasonal caravan conditions affect barter. Crafted goods, metal, weapons, and armor can finance essential supplies.' },
    ],
    action: { label: 'Open trade', target: 'TRADE' },
  },
  {
    title: 'What are Decrees?',
    body: 'Decrees are decisions about events affecting the fortress: a merchant caravan, an envoy, an omen, an inspired artisan, or a crisis.',
    entries: [
      { name: 'Read the choices', text: 'Each choice lists its costs and consequences. Some exchange resources, welcome migrants, or change diplomacy. Choices you cannot afford are unavailable.' },
      { name: 'Pending events', text: 'The alert below the navigation bar announces an event awaiting your decision. Open Decrees, choose a response, and its outcome is recorded in your history.' },
    ],
    action: { label: 'Open Decrees', target: 'DECREES' },
  },
  {
    title: 'Use the Guild Hall',
    body: 'The Guild Hall offers optional commissions, stores named relics, and tells the stories of your dwarves.',
    entries: [
      { name: 'Commissions', text: 'Accept one commission at a time. Delivering the required stock consumes it and rewards wealth, favor, and a relic. Watch its deadline.' },
      { name: 'Relics', text: 'Earn relics through commissions or recover them from caverns. Display them for fortress benefits, equip a dwarf, or permanently gift one for favor.' },
      { name: 'Clan stories', text: 'Read personalities, memories, friendships, and rivalries. These relationships affect the life and morale of the colony.' },
    ],
    action: { label: 'Visit the Guild Hall', target: 'GUILD' },
  },
  {
    title: 'Follow stories and expeditions',
    body: 'Chronicle on the far right opens the event log, dwarf memories, and the Royal Advisor. It can stay open beside the map.',
    entries: [
      { name: 'Chronicle and advisor', text: 'Filter recent events or ask the advisor for priorities, mining guidance, or clan stories. Optional AI and voice features need the server’s AI configuration.' },
      { name: 'Scouting expeditions', text: 'Clan & orders → Quests contains external scouting. Choose a route and approach, wait for the party to return, then claim its cargo.' },
      { name: 'Strange moods', text: 'Quests also shows an inspired artisan’s requested materials and deadline. Fulfill their demands to create an artifact.' },
    ],
    action: { label: 'Open Chronicle', target: 'CHRONICLE' },
  },
  {
    title: 'Your road to the Mountainhome',
    body: 'Reach 6,000 fortress score to become a Mountainhome Capital. Click the goal beneath the fortress name to see milestones and your next rank.',
    entries: [
      { name: 'Build in stages', text: 'Secure food and ale, establish industry, arm the militia, explore deeper layers, and grow your wealth and population. Claim completed quest rewards to keep advancing.' },
      { name: 'Save your progress', text: 'The full colony autosaves in this browser every 15 seconds and when you leave. Save makes an immediate checkpoint; Continue on the realm screen restores it. Google sign-in enables cloud archives.' },
      { name: 'Ready to rule?', text: 'Use Space to pause, select 1× while learning, or advance one tick with +1. Finishing this guide resumes the colony. You can replay any topic from Menu → How to play.' },
    ],
    action: { label: 'Save a checkpoint', target: 'SAVE' },
  },
];

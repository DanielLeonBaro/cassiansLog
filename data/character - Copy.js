const character = {
  name: "Cassian Aurelius von Bloodington III",
  class: "Fighter",
  subclass: "Echo Knight",
  race: "Noctir",
  level: 5,
  background: "Noble",
  alignment: "Neutral Good",
  gender: "Male",
  ac: 16,
  hp: {
    max: 50,
    current: 50,
    temp: 0,
  },
  initiative: 5,
  proficiency: 3,
  walk: 30,
  fly: 30,
  passivePerception: 12,
  darkvision: 60,
  combat: {
    concentration: false,
    echoes: [
      { name: "Echo 1", active: false },
      { name: "Echo 2", active: false },
    ],
  },
  stats: {
    str: {
      score: 16,
      modifier: 3,
      save: 6,
      skills: [
        {
          name: "Athletics",
          modifier: 3,
          proficiency: false,
        },
      ],
    },
    dex: {
      score: 20,
      modifier: 5,
      save: 5,
      skills: [
        {
          name: "Acrobatics",
          modifier: 8,
          proficiency: true,
        },
        {
          name: "Sleight of Hand",
          modifier: 5,
          proficiency: false,
        },
        {
          name: "Stealth",
          modifier: 5,
          proficiency: false,
        },
      ],
    },
    con: {
      score: 16,
      modifier: 3,
      save: 6,
      skills: [],
    },
    int: {
      score: 14,
      modifier: 2,
      save: 2,
      skills: [
        {
          name: "Arcana",
          modifier: 2,
          proficiency: false,
        },
        {
          name: "History",
          modifier: 5,
          proficiency: true,
        },
        {
          name: "Investigation",
          modifier: 2,
          proficiency: false,
        },
        {
          name: "Nature",
          modifier: 2,
          proficiency: false,
        },
        {
          name: "Religion",
          modifier: 2,
          proficiency: false,
        },
      ],
    },
    wis: {
      score: 15,
      modifier: 2,
      save: 2,
      skills: [
        {
          name: "Animal Handling",
          modifier: 2,
          proficiency: false,
        },
        {
          name: "Insight",
          modifier: 5,
          proficiency: true,
        },
        {
          name: "Medicine",
          modifier: 2,
          proficiency: false,
        },
        {
          name: "Perception",
          modifier: 2,
          proficiency: false,
        },
        {
          name: "Survival",
          modifier: 2,
          proficiency: false,
        },
      ],
    },
    cha: {
      score: 19,
      modifier: 4,
      save: 4,
      skills: [
        {
          name: "Deception",
          modifier: 4,
          proficiency: false,
        },
        {
          name: "Intimidation",
          modifier: 4,
          proficiency: false,
        },
        {
          name: "Performance",
          modifier: 4,
          proficiency: false,
        },
        {
          name: "Persuasion",
          modifier: 7,
          proficiency: true,
        },
      ],
    },
  },
  abilities: [
    {
      id: "shortsword",
      name: "Shortsword",
      category: "Item",
      action: "Action",
      uses: {
        current: 0,
        max: 0,
        reset: "short",
      },
      description: "+5 Hit. 1d6+5 Piercing Damage",
    },
        {
      id: "shortsword",
      name: "Shortsword",
      category: "Item",
      action: "Bonus Action",
      uses: {
        current: 0,
        max: 0,
        reset: "short",
      },
      description: "+5 Hit. 1d6+5 Piercing Damage",
    },
    {
      id: "action-surge",
      name: "Action Surge",
      category: "Class Feature",
      action: "Free Action",
      uses: {
        current: 1,
        max: 1,
        reset: "short",
      },
      description:
        "Starting at 2nd level, you can push yourself beyond your normal limits for a moment. On your turn, take one additional action on top of your regular action and possible bonus action. Recharges on a short or long rest."    },
    {
      id: "second-wind",
      name: "Second Wind",
      category: "Class Feature",
      action: "Bonus Action",
      uses: {
        current: 1,
        max: 1,
        reset: "short",
      },
      description:
        "You have a limited well of stamina that you can draw on to protect yourself from harm. As a bonus action, regain 1d10 + Fighter level hit points. Recharges on a short or long rest."    },
    {
      id: "manifest-echo",
      name: "Manifest Echo",
      category: "Class Feature",
      action: "Bonus Action",
      uses: {
        current: 2,
        max: 2,
        reset: "short",
      },
      description:
        "Manifest a magical echo in an unoccupied space within 15 ft. The echo lasts until destroyed, dismissed, replaced, or you're incapacitated. It can move 30 ft, swap places with you, make attacks from its space, and make opportunity attacks using your reaction."    },
    {
      id: "unleash-incarnation",
      name: "Unleash Incarnation",
      category: "Class Feature",
      uses: {
        current: 3,
        max: 3,
        reset: "short",
      },
      action: "Free Action",
      description:
        "Whenever you take the Attack action, make one additional melee attack from your echo's space. Uses equal your Constitution modifier (minimum 1). Recharges on a long rest."    },
      {
      id: "vampiric-heritage",
      name: "Vampiric Heritage",
      category: "Race Feat",
      uses: {
        current: 2,
        max: 2,
        reset: "short",
      },
      action: "Action",
      description:
        "You learn Vampiric Touch and can cast it twice without expending a spell slot. Dexterity is your spellcasting ability. Recharges on a short rest."    },
    {
      id: "bloodbound-whisper",
      name: "Bloodbound Whisper",
      category: "Class Feature",
      uses: {
        current: 5,
        max: 5,
        reset: "long",
      },
      action: "Action",
      description:
        "Gain +1 Charisma, learn Friends, Thaumaturgy, Charm Person, and Disguise Self. Cast the 1st-level spells once without a spell slot. Charisma is your spellcasting ability. Recharges on a long rest."    },
    {
      id: "vestige-of-the-night",
      name: "Vestige of the Night",
      category: "Class Feature",
      uses: {
        current: 1,
        max: 1,
        reset: "short",
      },
      action: "Action",
    description:
      "Transform into a Tiny bat for up to 10 minutes (1 hour at night). You can't attack or cast spells, retain your mental ability scores, and ignore your Sunlight Weakness radiant damage. End early as a bonus action. Recharges on a short rest."    },
  ],
  inventory: [
    {
      name: "Shortsword",
      quantity: 2,
      description: "1d6 piercing, finesse, light.",
    },
    {
      name: "Potion of Healing",
      quantity: 3,
      description: "Regain 2d4+2 HP.",
    },
    {
      name: "Bag of Holding",
      quantity: 1,
      description: "La más bonix.",
    },
        {
      name: "Cooper Pieces (CP)",
      quantity: 0,
      description: "Base Currency.",
    },
    {
      name: "Silver Pieces(SP)",
      quantity: 0,
      description: "1 SP = 10 CP.",
    },
    {
      name: "Electrum Pieces (EP)",
      quantity: 0,
      description: "1 EP = 5 SP. | 1 EP = 50 CP.",
    },
    {
      name: "Gold Pieces (GP)",
      quantity: 150,
      description: "1 GP = 2 EP. | 1 GP = 10 SP. | 1 GP = 100 CP.",
    },
    {
      name: "Platinum Pieces (PP)",
      quantity: 0,
      description: "1 PP = 10 GP. | 1 PP = 50 EP. | 1 PP = 100 SP | 1 PP = 1000 CP.",
    },
  ],
};
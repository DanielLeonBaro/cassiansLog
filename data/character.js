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
      action: "Action | Bonus Action",
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
      action: "Action",
      uses: {
        current: 1,
        max: 1,
        reset: "short",
      },
      description:
        "Starting at 2nd level, you can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action on top of your regular action and a possible bonus action. Once you use this feature, you must finish a short or long rest before you can use it again. Starting at 17th level, you can use it twice before a rest, but only once on the same turn.",
    },
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
        "You have a limited well of stamina that you can draw on to protect yourself from harm. On your turn, you can use a bonus action to regain hit points equal to 1d10 + your fighter level. Once you use this feature, you must finish a short or long rest before you can use it again.",
    },
    {
      id: "manifest-echo",
      name: "Manifest Echo",
      category: "Class Feature",
      action: "Bonus Action",
      uses: {
        current: "2",
        max: "2",
        reset: "short",
      },
      description:
        "At 3rd level, you can use a bonus action to magically manifest an echo of yourself in an unoccupied space you can see within 15 feet of you. This echo is a magical, translucent, gray image of you that lasts until it is destroyed, until you dismiss it as a bonus action, until you manifest another echo, or until you're incapacitated. Your echo has AC 14 + your proficiency bonus, 1 hit point, and immunity to all conditions. If it has to make a saving throw, it uses your saving throw bonus for the roll. It is the same size as you, and it occupies its space. On your turn, you can mentally command the echo to move up to 30 feet in any direction (no action required). If your echo is ever more than 30 feet from you at the end of your turn, it is destroyed. As a bonus action, you can teleport, magically swapping places with your echo at a cost of 15 feet of your movement, regardless of the distance between the two of you. When you take the Attack action on your turn, any attack you make with that action can originate from your space or the echo's space. You make this choice for each attack. When a creature that you can see within 5 feet of your echo moves at least 5 feet away from it, you can use your reaction to make an opportunity attack against that creature as if you were in the echo's space.",
    },
    {
      id: "unleash-incarnation",
      name: "Unleash Incarnation",
      category: "Class Feature",
      uses: {
        current: 1,
        max: 1,
        reset: "short",
      },
      action: "Free Action",
      description:
        "At 3rd level, you can heighten your echo's fury. Whenever you take the Attack action, you can make one additional melee attack from the echo's position. You can use this feature a number of times equal to your Constitution modifier (a minimum of once). You regain all expended uses when you finish a long rest.",
    },
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
  ],
};
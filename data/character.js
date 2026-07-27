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
    temp: 0
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
      {
        name: "Echo 1",
        active: false
      },
      {
        name: "Echo 2",
        active: false
      }
    ]
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
          proficiency: false
        }
      ]
    },
    dex: {
      score: 20,
      modifier: 5,
      save: 5,
      skills: [
        {
          name: "Acrobatics",
          modifier: 8,
          proficiency: true
        },
        {
          name: "Sleight of Hand",
          modifier: 5,
          proficiency: false
        },
        {
          name: "Stealth",
          modifier: 5,
          proficiency: false
        }
      ]
    },
    con: {
      score: 16,
      modifier: 3,
      save: 6,
      skills: []
    },
    int: {
      score: 14,
      modifier: 2,
      save: 2,
      skills: [
        {
          name: "Arcana",
          modifier: 2,
          proficiency: false
        },
        {
          name: "History",
          modifier: 5,
          proficiency: true
        },
        {
          name: "Investigation",
          modifier: 2,
          proficiency: false
        },
        {
          name: "Nature",
          modifier: 2,
          proficiency: false
        },
        {
          name: "Religion",
          modifier: 2,
          proficiency: false
        }
      ]
    },
    wis: {
      score: 15,
      modifier: 2,
      save: 2,
      skills: [
        {
          name: "Animal Handling",
          modifier: 2,
          proficiency: false
        },
        {
          name: "Insight",
          modifier: 5,
          proficiency: true
        },
        {
          name: "Medicine",
          modifier: 2,
          proficiency: false
        },
        {
          name: "Perception",
          modifier: 2,
          proficiency: false
        },
        {
          name: "Survival",
          modifier: 2,
          proficiency: false
        }
      ]
    },
    cha: {
      score: 19,
      modifier: 4,
      save: 4,
      skills: [
        {
          name: "Deception",
          modifier: 4,
          proficiency: false
        },
        {
          name: "Intimidation",
          modifier: 4,
          proficiency: false
        },
        {
          name: "Performance",
          modifier: 4,
          proficiency: false
        },
        {
          name: "Persuasion",
          modifier: 7,
          proficiency: true
        }
      ]
    }
  },
  actions: [
    {
      id: "shortsword-action",
      name: "Shortsword",
      category: "Weapon",
      action: "Action",
      range: "5 ft",
      attack: "+8 vs AC",
      damage: "1d6+5 piercing",
      description: "Attack twice when you take the Attack action."
    },
    {
      id: "shortsword-bonus",
      name: "Offhand Shortsword",
      category: "Weapon",
      action: "Bonus Action",
      range: "5 ft",
      attack: "+8 vs AC",
      damage: "1d6+5 piercing",
      description: "Make one offhand attack using Two-Weapon Fighting."
    },
    {
      id: "action-surge",
      name: "Action Surge",
      category: "Class Feature",
      action: "Free Action",
      uses: {
        current: 1,
        max: 1,
        reset: "short"
      },
      description: "Take one additional action on your turn."
    },
    {
      id: "second-wind",
      name: "Second Wind",
      category: "Class Feature",
      action: "Bonus Action",
      uses: {
        current: 1,
        max: 1,
        reset: "short"
      },
      description: "Regain 1d10+5 hit points."
    },
    {
      id: "manifest-echo",
      name: "Manifest Echo",
      category: "Echo Knight",
      action: "Bonus Action",
      range: "15 ft",
      description: "Create an echo that can move 30 ft and attack from its space."
    },
    {
      id: "echo-teleport",
      name: "Swap with Echo",
      category: "Echo Knight",
      action: "Bonus Action",
      description: "Spend 15 ft of movement to swap places with your echo."
    },
    {
      id: "unleash-incarnation",
      name: "Unleash Incarnation",
      category: "Echo Knight",
      action: "Free Action",
      uses: {
        current: 3,
        max: 3,
        reset: "long"
      },
      description: "After attacking, make one extra melee attack from the echo."
    },
    {
      id: "vestige-night",
      name: "Vestige of the Night",
      category: "Feat",
      action: "Action",
      duration: "10 min; 1 hour at night",
      uses: {
        current: 1,
        max: 1,
        reset: "long"
      },
      description: "Become a Tiny bat and ignore sunlight radiant damage."
    },
    {
      id: "opportunity-attack",
      name: "Opportunity Attack",
      category: "Reaction",
      action: "Reaction",
      range: "Melee reach",
      description: "Make one melee attack when a visible foe leaves your reach."
    }
  ],
  spells: [
    {
      id: "vampiric-touch",
      name: "Vampiric Touch",
      category: "3rd-level Spell",
      action: "Action",
      spellcasting: "DEX",
      range: "Self",
      duration: "Up to 1 minute",
      concentration: true,
      uses: {
        current: 1,
        max: 1,
        reset: "long"
      },
      description: "Deal 3d6 necrotic and heal half the damage dealt."
    },
    {
      id: "charm-person",
      name: "Charm Person",
      category: "1st-level Spell",
      action: "Action",
      spellcasting: "CHA",
      range: "30 ft",
      duration: "1 hour",
      uses: {
        current: 1,
        max: 1,
        reset: "long"
      },
      description: "A humanoid failing its WIS save is charmed until the spell ends."
    },
    {
      id: "disguise-self",
      name: "Disguise Self",
      category: "1st-level Spell",
      action: "Action",
      spellcasting: "CHA",
      range: "Self",
      duration: "1 hour",
      uses: {
        current: 1,
        max: 1,
        reset: "long"
      },
      description: "Create an illusory appearance that fails physical inspection."
    },
    {
      id: "suggestion",
      name: "Suggestion",
      category: "2nd-level Spell",
      action: "Action",
      spellcasting: "CHA",
      range: "30 ft",
      duration: "Up to 8 hours",
      concentration: true,
      uses: {
        current: 1,
        max: 1,
        reset: "long"
      },
      description: "A failed WIS save makes the target follow a reasonable request."
    },
    {
      id: "friends",
      name: "Friends",
      category: "Cantrip",
      action: "Action",
      spellcasting: "CHA",
      range: "Self",
      duration: "Up to 1 minute",
      concentration: true,
      description: "Gain advantage on CHA checks against one nonhostile creature."
    },
    {
      id: "message",
      name: "Message",
      category: "Cantrip",
      action: "Action",
      spellcasting: "CHA",
      range: "120 ft",
      duration: "1 round",
      description: "Whisper to one creature; it can quietly reply."
    },
    {
      id: "thaumaturgy",
      name: "Thaumaturgy",
      category: "Cantrip",
      action: "Action",
      spellcasting: "CHA",
      range: "30 ft",
      duration: "Up to 1 minute",
      description: "Create a minor supernatural effect, sound, tremor, or omen."
    }
  ],
  features: [
    {
      id: "darkvision",
      name: "Darkvision",
      category: "Racial Trait",
      description: "See in darkness within 60 ft as though it were dim light."
    },
    {
      id: "two-weapon-fighting",
      name: "Two-Weapon Fighting",
      category: "Fighting Style",
      description: "Add your ability modifier to your offhand attack damage."
    },
    {
      id: "extra-attack",
      name: "Extra Attack",
      category: "Class Feature",
      description: "Make two attacks whenever you take the Attack action."
    },
    {
      id: "echo-rules",
      name: "Echo Rules",
      category: "Echo Knight",
      description: "Echo: AC 17, 1 HP, condition immunity; destroyed beyond 30 ft."
    },
    {
      id: "vampiric-heritage",
      name: "Vampiric Heritage",
      category: "Racial Trait",
      description: "Cast Vampiric Touch once per long rest using Dexterity."
    },
    {
      id: "bloodbound-whisper",
      name: "Bloodbound Whisper",
      category: "Feat",
      description: "CHA powers Friends, Message, Thaumaturgy, Charm, Disguise, and Suggestion."
    },
    {
      id: "sunlight-weakness",
      name: "Sunlight Weakness",
      category: "Racial Trait",
      description: "Sunlight hinders attacks and sight; take 3 radiant each turn."
    },
    {
      id: "radiant-vulnerability",
      name: "Radiant Vulnerability",
      category: "Racial Trait",
      description: "Radiant damage dealt to you is doubled."
    },
    {
      id: "invitation-bound",
      name: "Invitation Bound",
      category: "Racial Trait",
      description: "You cannot enter a private residence without an invitation."
    },
    {
      id: "mirrorless",
      name: "Mirrorless",
      category: "Racial Trait",
      description: "Your image does not appear in ordinary reflections."
    },
    {
      id: "undead-physiology",
      name: "Undead Physiology",
      category: "Racial Trait",
      description: "You have no heartbeat and remain unnaturally cold."
    },
    {
      id: "position-of-privilege",
      name: "Position of Privilege",
      category: "Background Feature",
      description: "High society recognizes your status and grants easier access."
    }
  ],
  inventory: [
    {
      name: "Shortsword",
      quantity: 2,
      description: "1d6 piercing; finesse and light."
    },
    {
      name: "Potion of Healing",
      quantity: 3,
      description: "Regain 2d4+2 hit points."
    },
    {
      name: "Bag of Holding",
      quantity: 1,
      description: "Stores far more equipment than its outside size suggests."
    },
    {
      name: "Copper Pieces (CP)",
      quantity: 0,
      description: "Base currency."
    },
    {
      name: "Silver Pieces (SP)",
      quantity: 0,
      description: "1 SP equals 10 CP."
    },
    {
      name: "Electrum Pieces (EP)",
      quantity: 0,
      description: "1 EP equals 5 SP."
    },
    {
      name: "Gold Pieces (GP)",
      quantity: 150,
      description: "1 GP equals 10 SP."
    },
    {
      name: "Platinum Pieces (PP)",
      quantity: 0,
      description: "1 PP equals 10 GP."
    }
  ]
};
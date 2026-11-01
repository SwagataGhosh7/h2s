import {
  BudgetCategory,
  EventCategory,
  IdeaPillar,
  PaymentStatus,
  RsvpStatus,
  TimelinePhase,
  TimelineStatus,
  VendorContractStatus,
  VendorServiceType,
} from './types';

export interface CuratedEventPreset {
  title: string;
  category: EventCategory;
  eventDate: string;
  location: string;
  guestCountEstimate: number;
  totalBudgetLimit: number;
  styleBrief: string;
  budgetItems: Array<{
    title: string;
    category: BudgetCategory;
    estimatedAmount: number;
    actualAmount: number;
    paymentStatus: PaymentStatus;
    notes: string;
  }>;
  timelineItems: Array<{
    timeSlot: string;
    title: string;
    phase: TimelinePhase;
    leadPerson: string;
    status: TimelineStatus;
    notes: string;
  }>;
  vendors: Array<{
    vendorName: string;
    serviceType: VendorServiceType;
    contractStatus: VendorContractStatus;
    quotedPrice: number;
    contactPerson: string;
    deliverableNotes: string;
  }>;
  guests: Array<{
    guestName: string;
    partySize: number;
    rsvpStatus: RsvpStatus;
    tableGroup: string;
    dietaryNotes: string;
  }>;
  ideas: Array<{
    title: string;
    pillar: IdeaPillar;
    description: string;
    estimatedCostImpact: string;
  }>;
}

export const CURATED_PRESETS: Record<EventCategory, CuratedEventPreset> = {
  wedding: {
    title: 'Clara & Julian — Olive Grove Courtyard Wedding',
    category: 'wedding',
    eventDate: '2027-05-22',
    location: 'Villa Solis Limestone Courtyard, Sonoma',
    guestCountEstimate: 110,
    totalBudgetLimit: 48000,
    styleBrief:
      'Architectural limestone courtyard at twilight, long raw-linen communal tables, tapered beeswax candles, family-style wood-fired harvest menu, and acoustic string quartet.',
    budgetItems: [
      {
        title: 'Villa Solis Courtyard & Glasshouse Venue Buyout',
        category: 'venue',
        estimatedAmount: 14500,
        actualAmount: 14500,
        paymentStatus: 'deposit_paid',
        notes: 'Includes 12-hour exclusive courtyard access, bridal salon, and backup rain atrium.',
      },
      {
        title: 'Hearth & Fig Seasonal Family-Style Feast',
        category: 'catering',
        estimatedAmount: 16200,
        actualAmount: 15800,
        paymentStatus: 'deposit_paid',
        notes: '3-course wood-fired menu + late-night espresso and olive oil cake bar.',
      },
      {
        title: 'Studio Botanica Olive Branch & Beeswax Lighting',
        category: 'decor',
        estimatedAmount: 6400,
        actualAmount: 6100,
        paymentStatus: 'planned',
        notes: 'Potted heritage olive trees repurposed after ceremony + 180 brass taper holders.',
      },
      {
        title: 'Vespera String Quartet & Vinyl Aperitivo Set',
        category: 'music',
        estimatedAmount: 4200,
        actualAmount: 4200,
        paymentStatus: 'paid_in_full',
        notes: 'Ceremony acoustic strings transitioning to analog vinyl selector for reception.',
      },
      {
        title: 'Shuttle Coaches & Guest Valet Operations',
        category: 'logistics',
        estimatedAmount: 3400,
        actualAmount: 3100,
        paymentStatus: 'planned',
        notes: 'Two 55-passenger coaches looping between town square hotels and Villa Solis.',
      },
    ],
    timelineItems: [
      {
        timeSlot: '14:00',
        title: 'Floral & Linen Long-Table Installation',
        phase: 'setup',
        leadPerson: 'Elena Rostova (Lead Producer)',
        status: 'completed',
        notes: 'Verify wind-guards on all beeswax tapers along the North Cloister.',
      },
      {
        timeSlot: '16:30',
        title: 'Acoustic Quartet Soundcheck & Guest Arrival Citrus Agua Fresca',
        phase: 'pre_event',
        leadPerson: 'Marcus Vance (Hospitality Lead)',
        status: 'in_progress',
        notes: 'Welcome station opens at South Archway 30 minutes prior to seating.',
      },
      {
        timeSlot: '17:15',
        title: 'Courtyard Ceremony Under Limestone Arches',
        phase: 'ceremony_main',
        leadPerson: 'Clara, Julian & Officiant',
        status: 'upcoming',
        notes: 'Golden hour sun angle hits the center aisle at 17:25.',
      },
      {
        timeSlot: '18:15',
        title: 'Garden Aperitivo & Raw Bar Terrace Hour',
        phase: 'reception',
        leadPerson: 'Hearth & Fig Culinary Team',
        status: 'upcoming',
        notes: 'Passed heirloom tomato tartlets and local sparkling chenin blanc.',
      },
      {
        timeSlot: '19:30',
        title: 'Candlelit Communal Dinner & Toasts',
        phase: 'reception',
        leadPerson: 'Elena Rostova',
        status: 'upcoming',
        notes: 'Toasts capped at 4 minutes each between first and main courses.',
      },
    ],
    vendors: [
      {
        vendorName: 'Villa Solis Estate & Conservatory',
        serviceType: 'venue',
        contractStatus: 'confirmed',
        quotedPrice: 14500,
        contactPerson: 'Camille Laurent',
        deliverableNotes: 'Load-in begins at 11:00 AM; curfew for amplified sound at 23:00.',
      },
      {
        vendorName: 'Hearth & Fig Culinary Collective',
        serviceType: 'catering',
        contractStatus: 'contracted',
        quotedPrice: 15800,
        contactPerson: 'Chef Mateo Silva',
        deliverableNotes: 'Final dietary allergy matrix due 14 days before event.',
      },
      {
        vendorName: 'Atelier Lumiere Documentary Photo',
        serviceType: 'photography',
        contractStatus: 'confirmed',
        quotedPrice: 5200,
        contactPerson: 'Soren Lindqvist',
        deliverableNotes: '35mm film + digital hybrid coverage, 9 hours with second shooter.',
      },
      {
        vendorName: 'Studio Botanica Floral Architecture',
        serviceType: 'floral_decor',
        contractStatus: 'shortlisted',
        quotedPrice: 6100,
        contactPerson: 'Hana Takahashi',
        deliverableNotes: 'Zero-foam sustainable floral mechanics + living olive tree rentals.',
      },
    ],
    guests: [
      {
        guestName: 'Eleanor & Henri Beaumont',
        partySize: 2,
        rsvpStatus: 'confirmed',
        tableGroup: 'Table 01 — Olive West',
        dietaryNotes: '1 Gluten-free, 1 Pescatarian',
      },
      {
        guestName: 'Devon Brooks & Family',
        partySize: 4,
        rsvpStatus: 'confirmed',
        tableGroup: 'Table 02 — Cypress East',
        dietaryNotes: 'No tree nuts',
      },
      {
        guestName: 'Nadia Al-Mansoor',
        partySize: 2,
        rsvpStatus: 'invited',
        tableGroup: 'Table 01 — Olive West',
        dietaryNotes: 'Vegetarian preference',
      },
    ],
    ideas: [
      {
        title: 'Living Potted Olive Tree Aisle (Post-Event Donation)',
        pillar: 'floral_lighting',
        description:
          'Line the limestone courtyard aisle with 12 mature potted olive trees rented from a local nursery, moving them behind the head table for dinner.',
        estimatedCostImpact: 'Saves ~$1,400 vs cut floral arches',
      },
      {
        title: 'Hand-Pressed Letterpress Menu Keepsake with Herb Sprig',
        pillar: 'guest_experience',
        description:
          'Each place setting features a cotton-rag menu card tied with rosemary twine that doubles as the table escort card.',
        estimatedCostImpact: '$420 total for 110 guests',
      },
    ],
  },
  birthday: {
    title: 'Maya’s 40th — Architectural Loft Supper & Jazz Salon',
    category: 'birthday',
    eventDate: '2027-03-14',
    location: 'Foundry Glass Loft, Brooklyn',
    guestCountEstimate: 45,
    totalBudgetLimit: 14500,
    styleBrief:
      'Intimate candlelit supper club in an industrial daylight loft, sculptural ikebana arrangements, 4-course tasting menu with natural wine pairings, and live upright bass trio.',
    budgetItems: [
      {
        title: 'Foundry Glass Loft Evening Rental',
        category: 'venue',
        estimatedAmount: 4200,
        actualAmount: 4200,
        paymentStatus: 'paid_in_full',
        notes: 'Includes custom modular dining tables, coat check, and sound system.',
      },
      {
        title: 'Chef Kaito 4-Course Tasting Supper & Wine Pairing',
        category: 'catering',
        estimatedAmount: 6500,
        actualAmount: 6350,
        paymentStatus: 'deposit_paid',
        notes: 'Includes bespoke yuzu-sesame birthday mille-feuille.',
      },
      {
        title: 'Ikebana Sculptural Centerpieces & Amber Up-Lighting',
        category: 'decor',
        estimatedAmount: 1900,
        actualAmount: 1850,
        paymentStatus: 'planned',
        notes: 'Ceramic vessels handcrafted by local studio.',
      },
    ],
    timelineItems: [
      {
        timeSlot: '18:30',
        title: 'Welcome Aperitif & Vinyl Listening Lounge',
        phase: 'pre_event',
        leadPerson: 'David Chen',
        status: 'upcoming',
        notes: 'Smoked hinoki Negronis and non-alcoholic botanical spritz.',
      },
      {
        timeSlot: '19:45',
        title: 'Seated 4-Course Chef’s Table Experience',
        phase: 'ceremony_main',
        leadPerson: 'Chef Kaito',
        status: 'upcoming',
        notes: 'Chef introduces each course briefly.',
      },
      {
        timeSlot: '21:30',
        title: 'Roast & Toast Tribute + Live Jazz Trio Set',
        phase: 'reception',
        leadPerson: 'Priya Nair',
        status: 'upcoming',
        notes: 'Upright bass, Rhodes piano, and brushed drums.',
      },
    ],
    vendors: [
      {
        vendorName: 'Foundry Glass Loft Studio',
        serviceType: 'venue',
        contractStatus: 'confirmed',
        quotedPrice: 4200,
        contactPerson: 'Jonas Mercer',
        deliverableNotes: 'Freight elevator reserved from 15:00 to 00:30.',
      },
      {
        vendorName: 'Blue Note Chamber Trio',
        serviceType: 'entertainment',
        contractStatus: 'contracted',
        quotedPrice: 1650,
        contactPerson: 'Miles Holloway',
        deliverableNotes: 'Two 45-minute acoustic sets.',
      },
    ],
    guests: [
      {
        guestName: 'Priya Nair & Samira Khan',
        partySize: 2,
        rsvpStatus: 'confirmed',
        tableGroup: 'North Long Table',
        dietaryNotes: 'None',
      },
      {
        guestName: 'Lucas & Theo Sterling',
        partySize: 2,
        rsvpStatus: 'confirmed',
        tableGroup: 'South Long Table',
        dietaryNotes: 'Dairy-free dessert',
      },
    ],
    ideas: [
      {
        title: '40-Year Analog Photo & Story Wall',
        pillar: 'guest_experience',
        description:
          'Guests write a favorite memory with Maya on archival index cards pinned chronologically from 1987 to 2027.',
        estimatedCostImpact: '$140 archival paper & brass clips',
      },
      {
        title: 'Bespoke Vinyl Pressing Guestbook',
        pillar: 'music_ritual',
        description:
          'Guests sign custom gatefold LP sleeves featuring Maya’s 40th supper club playlist curated with the live jazz trio.',
        estimatedCostImpact: '$220 custom jacket printing',
      },
    ],
  },
  community: {
    title: 'Solstice Civic Botanical Pavilion Gala & Market',
    category: 'community',
    eventDate: '2027-06-20',
    location: 'Civic Conservatory & Public Commons, Portland',
    guestCountEstimate: 250,
    totalBudgetLimit: 28000,
    styleBrief:
      'Open-air neighborhood arts and urban agriculture benefit gala featuring local artisan food stalls, youth chamber ensemble, communal harvest tables, and seed-library auction.',
    budgetItems: [
      {
        title: 'Civic Conservatory Pavilion Permit & Stage Rigging',
        category: 'venue',
        estimatedAmount: 7500,
        actualAmount: 7200,
        paymentStatus: 'deposit_paid',
        notes: 'Includes ADA accessible ramps, solar generator array, and acoustic shell.',
      },
      {
        title: 'Neighborhood Culinary Cooperative Stations (5 Artisans)',
        category: 'catering',
        estimatedAmount: 11500,
        actualAmount: 11000,
        paymentStatus: 'planned',
        notes: 'Compostable bamboo tableware included across all 5 tasting stations.',
      },
      {
        title: 'Festoon Catenary Canopy & Wayfinding Signage',
        category: 'decor',
        estimatedAmount: 3800,
        actualAmount: 3600,
        paymentStatus: 'planned',
        notes: 'Reusable screen-printed linen banners for each community pavilion zone.',
      },
    ],
    timelineItems: [
      {
        timeSlot: '15:00',
        title: 'Artisan Booth Load-In & Sound Check',
        phase: 'setup',
        leadPerson: 'Community Ops Committee',
        status: 'completed',
        notes: 'Volunteer captains stationed at West Gate.',
      },
      {
        timeSlot: '17:00',
        title: 'Doors Open — Botanical Market & Seed Library Exchange',
        phase: 'pre_event',
        leadPerson: 'Sofia Alvarez',
        status: 'upcoming',
        notes: 'Each attendee receives 2 heritage seed packets on check-in.',
      },
      {
        timeSlot: '18:30',
        title: 'Keynote & Youth Chamber Ensemble Performance',
        phase: 'ceremony_main',
        leadPerson: 'Director Marcus Vance',
        status: 'upcoming',
        notes: '15-minute community garden grant announcement.',
      },
    ],
    vendors: [
      {
        vendorName: 'Pacific Timber & Festoon Rentals',
        serviceType: 'rentals',
        contractStatus: 'confirmed',
        quotedPrice: 4400,
        contactPerson: 'Hannah Reed',
        deliverableNotes: '30 communal birch tables + 260 folding bistro chairs.',
      },
      {
        vendorName: 'Northwest Culinary Commons Co-op',
        serviceType: 'catering',
        contractStatus: 'contracted',
        quotedPrice: 11000,
        contactPerson: 'Chef Andrej Novak',
        deliverableNotes: 'Zero-waste composting station staffed by 4 stewards.',
      },
    ],
    guests: [
      {
        guestName: 'Neighborhood Garden Guild Delegation',
        partySize: 12,
        rsvpStatus: 'confirmed',
        tableGroup: 'Commons Pavilion A',
        dietaryNotes: '4 Vegan, 2 Gluten-free',
      },
      {
        guestName: 'Civic Arts Council Sponsors',
        partySize: 8,
        rsvpStatus: 'confirmed',
        tableGroup: 'Conservatory Terrace B',
        dietaryNotes: 'Standard menu',
      },
    ],
    ideas: [
      {
        title: 'Live Community Mural & Heirloom Seed Pledge Wall',
        pillar: 'atmosphere',
        description:
          'Attendees sponsor individual raised garden beds for neighborhood schools by pinning brass plant markers to an architectural site map.',
        estimatedCostImpact: '$350 materials (generates ~$8,000 in pledges)',
      },
      {
        title: 'Zero-Waste Botanical Tasting Passport',
        pillar: 'culinary',
        description:
          'Each guest receives a letterpress tasting card stamped at all five neighborhood culinary cooperative stations.',
        estimatedCostImpact: '$280 recycled seed-paper printing',
      },
    ],
  },
};

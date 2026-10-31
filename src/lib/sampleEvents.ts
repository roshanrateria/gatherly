import { AppState } from '../types/index';
import { generateDefaultCategoriesForEvent } from './deterministicBudget';
import { generateMilestonesForEvent } from './deterministicTimeline';
import { generateDefaultSchedule } from './deterministicSchedule';
import { getDefaultIdeasForEvent } from './creativeIdeas';

export function createSampleWedding(): AppState {
  const startDate = '2026-11-20';
  const endDate = '2026-11-22';
  const durationDays = 3;
  const guestCount = 250;
  const totalBudget = 4500000; // 45 Lakhs INR

  const categories = generateDefaultCategoriesForEvent('wedding', totalBudget, ['Food & Catering', 'Photography']);
  const { milestones, tasks } = generateMilestonesForEvent('wedding', startDate, guestCount, durationDays);
  const schedule = generateDefaultSchedule('wedding', startDate, durationDays);
  const ideas = getDefaultIdeasForEvent('wedding');

  // Realistic sample expenses matching Indian wedding breakdown
  const cateringCat = categories.find(c => c.name.toLowerCase().includes('catering')) || categories[0];
  const venueCat = categories.find(c => c.name.toLowerCase().includes('venue')) || categories[1];
  const decorCat = categories.find(c => c.name.toLowerCase().includes('decor')) || categories[2];
  const photoCat = categories.find(c => c.name.toLowerCase().includes('photo')) || categories[3];

  const expenses = [
    {
      id: 'exp_1',
      categoryId: venueCat.id,
      title: 'Palace Courtyard & Lawn Rental (3 Days)',
      estimatedCost: 1000000,
      actualCost: 950000,
      paidAmount: 500000,
      paymentStatus: 'deposit_paid' as const,
      dueDate: '2026-08-15',
      notes: 'Includes lawn lighting and generator backup.',
    },
    {
      id: 'exp_2',
      categoryId: cateringCat.id,
      title: 'Royal Multi-Cuisine Catering (3 Days, 250 Pax)',
      estimatedCost: 1400000,
      actualCost: 1350000,
      paidAmount: 400000,
      paymentStatus: 'partially_paid' as const,
      dueDate: '2026-10-10',
      notes: 'Live counters: Chaat, Rajasthani Thali, Wood-fired Pizza, Dessert Studio. Strictly Pure Veg + Jain counter.',
    },
    {
      id: 'exp_3',
      categoryId: decorCat.id,
      title: 'Mandap, Floral Arch & Ambient Lighting',
      estimatedCost: 600000,
      actualCost: 620000,
      paidAmount: 200000,
      paymentStatus: 'deposit_paid' as const,
      dueDate: '2026-10-25',
      notes: 'Marigold & tuberose theme for Haldi, royal blush & gold for Varmala.',
    },
    {
      id: 'exp_4',
      categoryId: photoCat.id,
      title: 'Candid Photography & Cinematic 4K Drone Crew',
      estimatedCost: 550000,
      actualCost: 540000,
      paidAmount: 250000,
      paymentStatus: 'partially_paid' as const,
      dueDate: '2026-09-01',
      notes: 'Includes 2 candid photographers, 2 cinematographers, drone operator and coffee-table photobook.',
    },
  ];

  const vendors = [
    {
      id: 'v_1',
      name: 'Udaivilas Heritage Lawns & Suites',
      category: 'venue' as const,
      contactPerson: 'Vikram Singh (Banquet Director)',
      phone: '+91 98290 12345',
      email: 'banquets@udaivilasheritage.example',
      location: 'Lake Pichola Road, Udaipur, Rajasthan',
      quotedAmount: 1100000,
      agreedCost: 950000,
      depositPaid: 500000,
      rating: 5,
      bookingStatus: 'contract_signed' as const,
      deliverables: ['Lawn 1 & 2', 'Banquet Hall for Dinner', '35 Deluxe Guest Rooms', 'Power Generator Backup'],
      notes: 'Wheelchair access available via South Ramp. Sound cutoff 10:30 PM outdoors.',
      isShortlisted: true,
    },
    {
      id: 'v_2',
      name: 'Rasoi Royal Gourmet Caterers',
      category: 'catering' as const,
      contactPerson: 'Chef Ananya Sharma',
      phone: '+91 98111 54321',
      email: 'events@rasoiroyal.example',
      location: 'Udaipur & Ahmedabad',
      quotedAmount: 1450000,
      agreedCost: 1350000,
      depositPaid: 400000,
      rating: 5,
      bookingStatus: 'contract_signed' as const,
      deliverables: ['High Tea Carnival (Day 1)', 'Sangeet Dinner Banquet', 'Haldi Feast (Day 2)', 'Grand Wedding Reception'],
      notes: 'Separate pure Jain preparation station with dedicated supervisory staff.',
      isShortlisted: true,
    },
    {
      id: 'v_3',
      name: 'Lumière Stories Cinematography',
      category: 'photography' as const,
      contactPerson: 'Rohan Mehra',
      phone: '+91 98765 99887',
      email: 'info@lumierestories.example',
      location: 'Mumbai / Pan-India',
      quotedAmount: 580000,
      agreedCost: 540000,
      depositPaid: 250000,
      rating: 5,
      bookingStatus: 'contract_signed' as const,
      deliverables: ['Teaser Reel (within 48 hrs)', 'Full 30-min Wedding Film', '300 Edited Candid High-Res Photos', 'Drone Aerials'],
      notes: 'Equipment list verified: Sony FX6 & A7S3 cinema setups.',
      isShortlisted: true,
    },
    {
      id: 'v_4',
      name: 'Floret & Fern Floral Stylists',
      category: 'decor' as const,
      contactPerson: 'Meera Kapoor',
      phone: '+91 99300 45678',
      email: 'meera@floretfern.example',
      location: 'Jaipur / Udaipur',
      quotedAmount: 680000,
      agreedCost: 620000,
      depositPaid: 200000,
      rating: 4,
      bookingStatus: 'contract_signed' as const,
      deliverables: ['Mandap setup with fresh tuberose & marigolds', 'Entrance floral arch', 'Fairy light canopy', 'Centerpieces'],
      notes: 'Sample mock-up approved on 24 Sep.',
      isShortlisted: true,
    },
  ];

  const guests = [
    {
      id: 'g_1',
      name: 'Ramesh & Savita Gupta (Grandparents)',
      group: 'family' as const,
      rsvpStatus: 'attending' as const,
      plusOnes: 0,
      dietaryNeeds: ['jain' as const],
      accessibilityNeeds: ['wheelchair' as const, 'ground_floor' as const],
      tableNumber: 'Table 1 - Front Row',
      phone: '+91 98200 11111',
      notes: 'Require ground floor room near elevator and banquet lawn entrance.',
    },
    {
      id: 'g_2',
      name: 'Dr. Kabir & Sunita Mehta',
      group: 'vip' as const,
      rsvpStatus: 'attending' as const,
      plusOnes: 1,
      dietaryNeeds: ['veg' as const],
      accessibilityNeeds: ['none' as const],
      tableNumber: 'Table 2',
      email: 'kabir.mehta@example.com',
      notes: 'Arriving on Friday afternoon flight.',
    },
    {
      id: 'g_3',
      name: 'Arjun Verma & College Crew',
      group: 'friends' as const,
      rsvpStatus: 'attending' as const,
      plusOnes: 3,
      dietaryNeeds: ['veg' as const],
      accessibilityNeeds: ['none' as const],
      tableNumber: 'Table 5 - Youth Lounge',
      phone: '+91 98333 44556',
      notes: 'Involved in Sangeet dance performance.',
    },
    {
      id: 'g_4',
      name: 'Pooja & Sameer Deshmukh',
      group: 'family' as const,
      rsvpStatus: 'tentative' as const,
      plusOnes: 1,
      dietaryNeeds: ['veg' as const, 'gluten_free' as const],
      accessibilityNeeds: ['child_friendly' as const],
      notes: 'Awaiting leave confirmation; travelling with 3-year-old child.',
    },
  ];

  return {
    event: {
      id: 'event_wedding_udaipur',
      title: 'Aanya & Siddharth’s Royal Udaipur Celebration',
      type: 'wedding',
      startDate,
      endDate,
      durationDays,
      location: {
        city: 'Udaipur',
        venueName: 'Udaivilas Heritage Lawns',
        venueStatus: 'secured',
        country: 'India',
      },
      guests: {
        count: guestCount,
        bufferPercent: 10,
        expectedAttendance: 245,
      },
      budget: {
        total: totalBudget,
        currency: 'INR',
        numberFormat: 'lakhs',
      },
      style: 'Royal Heritage & Traditional Elegance with Warm Brass & Pastel Florals',
      priorities: ['Catering & Food Hospitality', 'Photography & Cinematography', 'Decor & Florals', 'Guest Comfort & Stay'],
      requirements: {
        dietary: ['Pure Vegetarian', 'Dedicated Jain Kitchen Protocol', 'Gluten-Free Options'],
        accessibility: ['Wheelchair Accessible Entrances & Ramps', 'Ground-Floor Accommodations for Elders'],
        culturalTradition: 'Traditional North Indian Vedic Rites with Mehendi, Sangeet & Pheras',
        leadTimeMonths: 6,
      },
      notes: 'Grand 3-day royal celebration overlooking Lake Pichola. Dedicated welcome hospitality team for outstation family.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    categories,
    expenses,
    scenarios: [
      {
        id: 'scen_base',
        name: 'Base Royal Plan',
        description: 'Standard 45L allocation with full 3-day multi-cuisine hospitality.',
        multiplier: 1.0,
        categoryAdjustments: {},
      },
      {
        id: 'scen_optimized',
        name: 'Smart Value (15% Savings)',
        description: 'Optimized decor and digital stationery; preserves photography & gourmet dining.',
        multiplier: 0.85,
        categoryAdjustments: {},
      },
    ],
    milestones,
    tasks,
    vendors,
    guests,
    schedule,
    ideas,
    chatHistory: [
      {
        id: 'msg_welcome',
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        text: 'Welcome to Gatherly! I have established your master plan for Aanya & Siddharth’s Royal Udaipur Celebration (250 guests, ₹45.00 L budget). All modules—Budget, Timeline, Vendors, Guests, and 3-Day Run Sheet—are synchronized. Tell me any constraints or changes, and I will recalculate trade-offs and propose updates.',
        structuredResponse: {
          message: 'Master event plan initialized with high-precision budgeting, vendor shortlists, and 3-day run sheet.',
          reasoning_summary: 'Allocated 32% to Catering and 24% to Venue to support multi-day royal hospitality for 250 guests while keeping 12% locked for candid cinematography.',
          assumptions: ['250 invited guests with 90%+ attendance.', 'Udaivilas lawn and accommodation secured.'],
          clarifying_questions: ['Would you like to review specific Jain menu items for the Sangeet dinner?'],
          recommendations: [
            'Lock candid photography crew contract before next month.',
            'Confirm wheelchair ramp positioning with venue facility manager.',
            'Publish digital RSVP link 60 days before event date.',
          ],
          proposed_changes: [],
          affected_sections: ['Overview', 'Budget', 'Timeline'],
          risks: [
            {
              severity: 'low',
              issue: 'High outdoor evening humidity in November.',
              mitigation: 'Schedule mist fans and heated patio lamps depending on lake breeze.',
            },
          ],
          next_steps: ['Review the 3-Day Run Sheet in the Event Schedule tab.'],
        },
      },
    ],
    proposalsHistory: [],
    aiConfig: {
      provider: 'offline',
      apiKey: '',
      model: 'offline-deterministic',
      discloseDataSharing: false,
    },
  };
}

export function createSampleCorporate(): AppState {
  const startDate = '2026-12-05';
  const endDate = '2026-12-05';
  const durationDays = 1;
  const guestCount = 350;
  const totalBudget = 3000000; // 30 Lakhs INR

  const categories = generateDefaultCategoriesForEvent('corporate', totalBudget, ['Venue & AV', 'Catering']);
  const { milestones, tasks } = generateMilestonesForEvent('corporate', startDate, guestCount, durationDays);
  const schedule = generateDefaultSchedule('corporate', startDate, durationDays);
  const ideas = getDefaultIdeasForEvent('corporate');

  return {
    event: {
      id: 'event_corp_summit',
      title: 'NexTech Horizon 2026 Annual Leadership Summit',
      type: 'corporate',
      startDate,
      endDate,
      durationDays,
      location: {
        city: 'Bengaluru',
        venueName: 'The Leela Palace Convention Centre',
        venueStatus: 'secured',
        country: 'India',
      },
      guests: {
        count: guestCount,
        bufferPercent: 5,
        expectedAttendance: 330,
      },
      budget: {
        total: totalBudget,
        currency: 'INR',
        numberFormat: 'lakhs',
      },
      style: 'Modern Executive Minimalist & Tech High-Productivity',
      priorities: ['Audio-Visual Production & Streaming', 'Keynote Speakers & Emcee', 'Executive Catering & Gala'],
      requirements: {
        dietary: ['Vegetarian & Non-Vegetarian Buffets', 'Vegan & Gluten-Free Stations'],
        accessibility: ['Full ADA / Wheelchair Compliance', 'Stage Ramp for Presenters'],
        culturalTradition: 'Corporate Formal with Networking Dinner & Awards Gala',
        leadTimeMonths: 3,
      },
      notes: 'Flagship enterprise conference with live stream to EMEA and US teams.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    categories,
    expenses: [],
    scenarios: [],
    milestones,
    tasks,
    vendors: [],
    guests: [],
    schedule,
    ideas,
    chatHistory: [],
    proposalsHistory: [],
    aiConfig: {
      provider: 'offline',
      apiKey: '',
      model: 'offline-deterministic',
      discloseDataSharing: false,
    },
  };
}

export function createSampleBirthday(): AppState {
  const startDate = '2026-11-28';
  const endDate = '2026-11-28';
  const durationDays = 1;
  const guestCount = 75;
  const totalBudget = 500000; // 5 Lakhs INR

  const categories = generateDefaultCategoriesForEvent('birthday', totalBudget, ['Food & Cake', 'Entertainment']);
  const { milestones, tasks } = generateMilestonesForEvent('birthday', startDate, guestCount, durationDays);
  const schedule = generateDefaultSchedule('birthday', startDate, durationDays);
  const ideas = getDefaultIdeasForEvent('birthday');

  return {
    event: {
      id: 'event_bday_40th',
      title: 'Kabir’s 40th Milestone Birthday Gala',
      type: 'birthday',
      startDate,
      endDate,
      durationDays,
      location: {
        city: 'Mumbai',
        venueName: 'Sea Princess Rooftop Lounge',
        venueStatus: 'secured',
        country: 'India',
      },
      guests: {
        count: guestCount,
        bufferPercent: 10,
        expectedAttendance: 70,
      },
      budget: {
        total: totalBudget,
        currency: 'INR',
        numberFormat: 'lakhs',
      },
      style: 'Retro Glamour & Sunset Cocktail Lounge',
      priorities: ['Gourmet Food & Signature Cake', 'DJ & Interactive Live Music', 'Photobooth & Keepsakes'],
      requirements: {
        dietary: ['Cocktail Finger Foods & Live BBQ', 'Vegetarian Delicacies', 'Eggless Specialty Cake'],
        accessibility: ['Elevator Access to Rooftop Lounge'],
        leadTimeMonths: 2,
      },
      notes: 'Sunset party starting at 5:30 PM with golden hour ocean views.',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    categories,
    expenses: [],
    scenarios: [],
    milestones,
    tasks,
    vendors: [],
    guests: [],
    schedule,
    ideas,
    chatHistory: [],
    proposalsHistory: [],
    aiConfig: {
      provider: 'offline',
      apiKey: '',
      model: 'offline-deterministic',
      discloseDataSharing: false,
    },
  };
}

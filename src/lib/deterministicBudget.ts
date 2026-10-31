import { BudgetCategory, Expense, BudgetSummary, PriorityTier } from '../types/budget';
import { EventType } from '../types/event';

export function calculateBudgetSummary(
  totalBudget: number,
  categories: BudgetCategory[],
  expenses: Expense[],
  expectedGuests: number
): BudgetSummary {
  const safeBudget = Math.max(0, totalBudget);
  const safeGuests = Math.max(1, expectedGuests);

  const totalAllocated = categories.reduce((sum, cat) => sum + (cat.allocatedAmount || 0), 0);
  const unallocated = safeBudget - totalAllocated;

  const totalEstimated = expenses.reduce((sum, exp) => sum + (exp.estimatedCost || 0), 0);
  const totalActual = expenses.reduce((sum, exp) => sum + (exp.actualCost || 0), 0);
  const totalPaid = expenses.reduce((sum, exp) => sum + (exp.paidAmount || 0), 0);
  const pendingPayment = Math.max(0, totalActual - totalPaid);

  const remainingBalance = safeBudget - totalActual;
  const variance = safeBudget - totalEstimated;

  const isOverrun = totalActual > safeBudget || totalEstimated > safeBudget;
  const overrunAmount = Math.max(0, totalActual - safeBudget, totalEstimated - safeBudget);

  const perGuestEstimated = Math.round(totalEstimated / safeGuests);
  const perGuestActual = Math.round(totalActual / safeGuests);
  const utilizationPercent = safeBudget > 0 ? Math.min(100, (totalActual / safeBudget) * 100) : 0;

  return {
    totalBudget: safeBudget,
    totalAllocated,
    unallocated,
    totalEstimated,
    totalActual,
    totalPaid,
    pendingPayment,
    remainingBalance,
    variance,
    isOverrun,
    overrunAmount,
    perGuestEstimated,
    perGuestActual,
    utilizationPercent: Math.round(utilizationPercent * 10) / 10,
  };
}

export interface CategoryBreakdown {
  category: BudgetCategory;
  allocatedAmount: number;
  estimatedCost: number;
  actualCost: number;
  paidAmount: number;
  remainingInCategory: number;
  isOverrun: boolean;
  overrunAmount: number;
  expenseCount: number;
}

export function calculateCategoryBreakdowns(
  categories: BudgetCategory[],
  expenses: Expense[]
): CategoryBreakdown[] {
  return categories.map((cat) => {
    const catExpenses = expenses.filter((e) => e.categoryId === cat.id);
    const estimatedCost = catExpenses.reduce((sum, e) => sum + (e.estimatedCost || 0), 0);
    const actualCost = catExpenses.reduce((sum, e) => sum + (e.actualCost || 0), 0);
    const paidAmount = catExpenses.reduce((sum, e) => sum + (e.paidAmount || 0), 0);
    
    // Remaining in category against actual spend
    const remainingInCategory = cat.allocatedAmount - actualCost;
    const isOverrun = actualCost > cat.allocatedAmount || estimatedCost > cat.allocatedAmount;
    const overrunAmount = Math.max(0, actualCost - cat.allocatedAmount, estimatedCost - cat.allocatedAmount);

    return {
      category: cat,
      allocatedAmount: cat.allocatedAmount,
      estimatedCost,
      actualCost,
      paidAmount,
      remainingInCategory,
      isOverrun,
      overrunAmount,
      expenseCount: catExpenses.length,
    };
  });
}

interface DefaultCatSpec {
  name: string;
  percent: number;
  priority: PriorityTier;
  description: string;
}

export function generateDefaultCategoriesForEvent(
  eventType: EventType,
  totalBudget: number,
  priorities: string[] = []
): BudgetCategory[] {
  let specs: DefaultCatSpec[] = [];

  switch (eventType) {
    case 'wedding':
      specs = [
        { name: 'Catering & Food Hospitality', percent: 32, priority: 'must_have', description: 'Multi-course banquets, live counters, appetizers & beverage stations' },
        { name: 'Venue & Accommodation', percent: 24, priority: 'must_have', description: 'Main hall, banquet lawns, mandap/altar area, guest rooms' },
        { name: 'Decor, Florals & Stage', percent: 14, priority: 'high', description: 'Floral arrangements, mood lighting, entrance arches, mandap/stage styling' },
        { name: 'Photography & Cinematography', percent: 12, priority: 'high', description: 'Candid photographer, drone video, pre-wedding shoot & teaser reels' },
        { name: 'Entertainment, DJ & Sound', percent: 8, priority: 'medium', description: 'Live performers, DJ, sound engineering, choreographers' },
        { name: 'Attire, Beauty & Styling', percent: 5, priority: 'medium', description: 'Bridal/Groom couture, makeup artists, hair styling, accessories' },
        { name: 'Invitations, Favors & Gifts', percent: 3, priority: 'flexible', description: 'Physical boxes, digital invites, welcome hampers & return gifts' },
        { name: 'Contingency & Incidentals', percent: 2, priority: 'flexible', description: 'Unforeseen buffer, last-minute vendor tips and emergency permits' },
      ];
      break;

    case 'corporate':
      specs = [
        { name: 'Venue & Audio-Visual Production', percent: 32, priority: 'must_have', description: 'Keynote auditorium, staging, LED backdrops, microphoning, live stream' },
        { name: 'Catering, Lunch & Gala', percent: 28, priority: 'must_have', description: 'Coffee breaks, networking lunch, executive dinner & cocktails' },
        { name: 'Speakers, Keynotes & Emcee', percent: 16, priority: 'high', description: 'Honorariums, travel, moderator fees, keynote gifts' },
        { name: 'Branding, Swag & Collateral', percent: 10, priority: 'medium', description: 'Delegate kits, customized lanyards, stage backdrops, print agendas' },
        { name: 'Logistics, Transport & Shuttles', percent: 8, priority: 'medium', description: 'VIP transfers, attendee buses, security, valet management' },
        { name: 'Contingency Buffer', percent: 6, priority: 'flexible', description: 'Technical backups, extra delegate packs, standby services' },
      ];
      break;

    case 'birthday':
    case 'anniversary':
      specs = [
        { name: 'Food, Beverages & Specialty Cake', percent: 35, priority: 'must_have', description: 'Gourmet meal, signature custom cake, mocktail/cocktail bar' },
        { name: 'Venue Rental & Layout', percent: 25, priority: 'must_have', description: 'Party lounge, banquet room or outdoor garden setup' },
        { name: 'Thematic Decor & Photobooth', percent: 16, priority: 'high', description: 'Balloon installations, photo backdrop, lighting, customized signage' },
        { name: 'Entertainment & Games', percent: 12, priority: 'medium', description: 'DJ, live music, magician/entertainer, interactive party games' },
        { name: 'Photography & Keepsakes', percent: 8, priority: 'medium', description: 'Event photographer, mini-album, custom return gifts' },
        { name: 'Contingency Buffer', percent: 4, priority: 'flexible', description: 'Last-minute additions and incidental expenses' },
      ];
      break;

    case 'college_fest':
      specs = [
        { name: 'Headliner Artist & Celebrity Bands', percent: 38, priority: 'must_have', description: 'Artist fees, rider requirements, green room, travel' },
        { name: 'Stage, Truss, Sound & Light AV', percent: 26, priority: 'must_have', description: 'Concert grade acoustics, line arrays, dynamic moving heads, LED wall' },
        { name: 'Security, Crowd Control & Permits', percent: 14, priority: 'high', description: 'Bouncers, barricades, ambulance standby, police & municipal permissions' },
        { name: 'Hospitality & Food Stalls', percent: 10, priority: 'medium', description: 'Judges/guests hospitality, food court management, crew meals' },
        { name: 'Marketing, Merchandise & Trophies', percent: 8, priority: 'medium', description: 'Trophies, certificates, cash prizes, printed wristbands, promotional posters' },
        { name: 'Emergency Contingency', percent: 4, priority: 'flexible', description: 'Generator backups, weather contingency and technical standby' },
      ];
      break;

    default: // Community / Custom
      specs = [
        { name: 'Catering & Refreshments', percent: 35, priority: 'must_have', description: 'Community feast, snacks, tea/coffee counters, hydration stations' },
        { name: 'Venue, Tenting & Sanitation', percent: 25, priority: 'must_have', description: 'Ground booking, shamiana/tents, mobile washrooms, power backup' },
        { name: 'Cultural Stage & Decor', percent: 18, priority: 'high', description: 'Stage setup, traditional decor, sound system, seating chairs' },
        { name: 'Permits, Safety & Security', percent: 12, priority: 'high', description: 'Civic permissions, fire clearance, first-aid, community volunteers kit' },
        { name: 'Communication & Souvenirs', percent: 6, priority: 'flexible', description: 'Community flyers, digital banners, mementos for elders' },
        { name: 'Contingency Reserve', percent: 4, priority: 'flexible', description: 'Unexpected operational expenses' },
      ];
      break;
  }

  // Adjust percentages if user specified priorities
  if (priorities && priorities.length > 0) {
    const topPriority = priorities[0].toLowerCase();
    if (topPriority.includes('photo')) {
      const photoSpec = specs.find((s) => s.name.toLowerCase().includes('photo'));
      const decorSpec = specs.find((s) => s.name.toLowerCase().includes('decor'));
      if (photoSpec && decorSpec && photoSpec.percent < 20) {
        photoSpec.percent += 4;
        photoSpec.priority = 'must_have';
        decorSpec.percent = Math.max(8, decorSpec.percent - 4);
      }
    } else if (topPriority.includes('decor')) {
      const decorSpec = specs.find((s) => s.name.toLowerCase().includes('decor'));
      const entSpec = specs.find((s) => s.name.toLowerCase().includes('entertainment'));
      if (decorSpec && entSpec) {
        decorSpec.percent += 4;
        decorSpec.priority = 'must_have';
        entSpec.percent = Math.max(5, entSpec.percent - 4);
      }
    } else if (topPriority.includes('food') || topPriority.includes('cater')) {
      const foodSpec = specs.find((s) => s.name.toLowerCase().includes('cater') || s.name.toLowerCase().includes('food'));
      const giftSpec = specs.find((s) => s.name.toLowerCase().includes('gift') || s.name.toLowerCase().includes('favor') || s.name.toLowerCase().includes('swag'));
      if (foodSpec && giftSpec) {
        foodSpec.percent += 3;
        giftSpec.percent = Math.max(2, giftSpec.percent - 3);
      }
    }
  }

  // Normalize percentages to exactly 100%
  const sum = specs.reduce((s, spec) => s + spec.percent, 0);
  if (sum !== 100) {
    const diff = 100 - sum;
    specs[specs.length - 1].percent += diff;
  }

  return specs.map((spec, index) => {
    const allocatedAmount = Math.round((totalBudget * spec.percent) / 100);
    return {
      id: `cat_${index + 1}_${Date.now()}`,
      name: spec.name,
      allocationPercent: spec.percent,
      allocatedAmount,
      priority: spec.priority,
      description: spec.description,
      isCustom: false,
    };
  });
}

export interface SavingsRecommendation {
  categoryId: string;
  categoryName: string;
  currentAllocated: number;
  proposedAllocated: number;
  savedAmount: number;
  reason: string;
}

export function generateSavingsTradeOffs(
  overrunAmount: number,
  categories: BudgetCategory[],
  priorities: string[] = []
): SavingsRecommendation[] {
  if (overrunAmount <= 0 || categories.length === 0) return [];

  const recommendations: SavingsRecommendation[] = [];
  let remainingToSave = overrunAmount;

  // Protect must-haves and top priorities, target flexible and medium priority categories first
  const candidates = [...categories]
    .filter((cat) => {
      // Don't cut top priorities if explicitly named
      const isTopPriority = priorities.some((p) => cat.name.toLowerCase().includes(p.toLowerCase()));
      if (isTopPriority) return false;
      return cat.priority === 'flexible' || cat.priority === 'medium';
    })
    .sort((a, b) => {
      // Sort flexible first, then by larger allocation
      if (a.priority === 'flexible' && b.priority !== 'flexible') return -1;
      if (b.priority === 'flexible' && a.priority !== 'flexible') return 1;
      return b.allocatedAmount - a.allocatedAmount;
    });

  for (const cat of candidates) {
    if (remainingToSave <= 0) break;
    // Allow up to 25% reduction for medium, up to 40% for flexible
    const maxCutPct = cat.priority === 'flexible' ? 0.4 : 0.25;
    const maxReduction = Math.round(cat.allocatedAmount * maxCutPct);
    const cut = Math.min(remainingToSave, maxReduction);

    if (cut > 0) {
      recommendations.push({
        categoryId: cat.id,
        categoryName: cat.name,
        currentAllocated: cat.allocatedAmount,
        proposedAllocated: cat.allocatedAmount - cut,
        savedAmount: cut,
        reason:
          cat.priority === 'flexible'
            ? `Optimize secondary elements & favor options to save ${cut.toLocaleString()} without affecting main experience.`
            : `Streamline line items in ${cat.name} to balance the budget while safeguarding your top priorities.`,
      });
      remainingToSave -= cut;
    }
  }

  return recommendations;
}

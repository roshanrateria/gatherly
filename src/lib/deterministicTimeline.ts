import { Milestone, Task, TaskPriority } from '../types/timeline';
import { EventType } from '../types/event';

export function calculateDaysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24));
}

export function formatDueDateFromOffset(eventDateStr: string, daysBeforeEvent: number): string {
  const eventDate = new Date(eventDateStr);
  const targetDate = new Date(eventDate);
  targetDate.setDate(targetDate.getDate() - daysBeforeEvent);
  return targetDate.toISOString().split('T')[0];
}

export function generateMilestonesForEvent(
  eventType: EventType,
  startDateStr: string,
  guestCount: number,
  durationDays: number
): { milestones: Milestone[]; tasks: Task[] } {
  const todayStr = new Date().toISOString().split('T')[0];
  const totalLeadDays = Math.max(14, calculateDaysBetween(todayStr, startDateStr));

  // Scale offset factor: standard lead time is 180 days (6 months)
  // If lead time is 60 days, offsets will scale smoothly so nothing is scheduled in the past if possible
  const scale = (standardOffsetDays: number): number => {
    if (totalLeadDays >= 180) {
      return standardOffsetDays;
    }
    // Scale proportionally between 1 day and totalLeadDays
    return Math.max(2, Math.round((standardOffsetDays / 180) * totalLeadDays));
  };

  interface RawMilestone {
    id: string;
    title: string;
    category: string;
    standardOffset: number;
    priority: TaskPriority;
    notes: string;
    tasks: { title: string; priority: TaskPriority; assignee: string }[];
  }

  let rawList: RawMilestone[] = [];

  switch (eventType) {
    case 'wedding':
      rawList = [
        {
          id: 'm1_venue',
          title: 'Lock Venue & Ceremony Dates',
          category: 'Venue',
          standardOffset: 160,
          priority: 'high',
          notes: 'Secure banquet hall, lawns, and accommodation blocks with deposit.',
          tasks: [
            { title: 'Shortlist 3 candidate venues and inspect acoustics', priority: 'high', assignee: 'Host / Organizer' },
            { title: 'Negotiate packages including electricity & catering guidelines', priority: 'high', assignee: 'Host / Organizer' },
            { title: 'Sign contract and transfer initial booking deposit', priority: 'high', assignee: 'Host / Organizer' },
          ],
        },
        {
          id: 'm2_caterer',
          title: 'Finalize Caterer & Menu Tasting',
          category: 'Catering',
          standardOffset: 120,
          priority: 'high',
          notes: 'Conduct food tasting, verify pure veg/special dietary capabilities.',
          tasks: [
            { title: 'Attend menu tasting session with family core group', priority: 'high', assignee: 'Catering Lead' },
            { title: 'Lock live counter selections and signature mocktail bar', priority: 'medium', assignee: 'Catering Lead' },
            { title: 'Confirm plate guarantee headcount and kitchen logistics', priority: 'high', assignee: 'Catering Lead' },
          ],
        },
        {
          id: 'm3_photo_theme',
          title: 'Book Photographer & Confirm Decor Blueprint',
          category: 'Production',
          standardOffset: 90,
          priority: 'high',
          notes: 'Sign candid photography crew and approve 3D stage/floral decor renders.',
          tasks: [
            { title: 'Review photographer deliverables: drone, teaser video, candid shots', priority: 'high', assignee: 'Media Lead' },
            { title: 'Finalize stage backdrop, mandap lighting, entrance arch concepts', priority: 'medium', assignee: 'Decor Lead' },
          ],
        },
        {
          id: 'm4_invitations',
          title: 'Send Formal Invitations & Launch RSVP Registry',
          category: 'Guests',
          standardOffset: 60,
          priority: 'high',
          notes: 'Dispatch physical cards and WhatsApp digital RSVP links.',
          tasks: [
            { title: 'Upload final guest list and verify addresses & phone numbers', priority: 'high', assignee: 'Guest Coordinator' },
            { title: 'Broadcast digital invitations with RSVP deadlines', priority: 'high', assignee: 'Guest Coordinator' },
            { title: 'Track dietary & accessibility requests from early responses', priority: 'medium', assignee: 'Guest Coordinator' },
          ],
        },
        {
          id: 'm5_entertainment',
          title: 'Confirm DJ, Sound Engineering & Choreography',
          category: 'Entertainment',
          standardOffset: 40,
          priority: 'medium',
          notes: 'Schedule sangeet rehearsals, lock song playlists and sound licenses.',
          tasks: [
            { title: 'Share song tracks and timeline cue-sheet with DJ', priority: 'medium', assignee: 'Entertainment Lead' },
            { title: 'Organize 4 dance rehearsal sessions with bridal party', priority: 'medium', assignee: 'Choreographer' },
          ],
        },
        {
          id: 'm6_headcount_lock',
          title: 'Lock Catering Headcount & Final Seating Plan',
          category: 'Logistics',
          standardOffset: 14,
          priority: 'high',
          notes: 'Reconcile RSVP responses and give final guaranteed numbers to caterer.',
          tasks: [
            { title: 'Call pending RSVP guests to confirm final numbers', priority: 'high', assignee: 'Guest Coordinator' },
            { title: 'Send final guaranteed headcount breakdown to caterer', priority: 'high', assignee: 'Host / Organizer' },
            { title: 'Assign room numbers and transport pickup list', priority: 'medium', assignee: 'Logistics Lead' },
          ],
        },
        {
          id: 'm7_final_runthrough',
          title: 'Final Vendor Briefing & Soundcheck',
          category: 'Coordination',
          standardOffset: 3,
          priority: 'high',
          notes: 'Distribute event run sheets to all family leads and vendors.',
          tasks: [
            { title: 'Conduct dry run of ceremony schedule and emcee cues', priority: 'high', assignee: 'Event Planner' },
            { title: 'Confirm AV generator backup and emergency contact sheet', priority: 'high', assignee: 'Event Planner' },
          ],
        },
      ];
      break;

    case 'corporate':
      rawList = [
        {
          id: 'm1_corp_venue',
          title: 'Secure Conference Venue & Date',
          category: 'Venue',
          standardOffset: 90,
          priority: 'high',
          notes: 'Book auditorium, breakout rooms, high-speed WiFi and AV infrastructure.',
          tasks: [
            { title: 'Confirm stage capacity and breakout room allocations', priority: 'high', assignee: 'Events Lead' },
            { title: 'Lock venue contract including AV technician support', priority: 'high', assignee: 'Events Lead' },
          ],
        },
        {
          id: 'm2_corp_speakers',
          title: 'Lock Keynote Speakers & Agenda Blueprint',
          category: 'Programming',
          standardOffset: 60,
          priority: 'high',
          notes: 'Confirm executive speakers, honorariums and talk abstracts.',
          tasks: [
            { title: 'Collect speaker headshots, bios and presentation decks', priority: 'high', assignee: 'Content Chair' },
            { title: 'Publish official conference schedule on attendee portal', priority: 'medium', assignee: 'Marketing Lead' },
          ],
        },
        {
          id: 'm3_corp_production',
          title: 'AV Staging, Live Stream & Delegate Kits',
          category: 'Production',
          standardOffset: 30,
          priority: 'high',
          notes: 'Test live stream bandwidth, approve badge lanyards and swag items.',
          tasks: [
            { title: 'Order delegate kits, lanyards and printed badges', priority: 'medium', assignee: 'Ops Lead' },
            { title: 'Verify audio mixer, multi-mic podium, and live stream pipe', priority: 'high', assignee: 'AV Lead' },
          ],
        },
        {
          id: 'm4_corp_catering',
          title: 'Lock Networking Catering & Dietary Preferences',
          category: 'Hospitality',
          standardOffset: 14,
          priority: 'high',
          notes: 'Submit final delegate counts for coffee breaks, lunch & executive dinner.',
          tasks: [
            { title: 'Collate dietary restrictions (vegan, gluten-free, halal)', priority: 'high', assignee: 'Hospitality Lead' },
            { title: 'Review buffet flow to prevent lunchtime bottlenecks', priority: 'medium', assignee: 'Hospitality Lead' },
          ],
        },
        {
          id: 'm5_corp_rehearsal',
          title: 'Speaker Tech Check & Run-Sheet Walkthrough',
          category: 'Operations',
          standardOffset: 2,
          priority: 'high',
          notes: 'Audio-visual testing, slide clicker test, emcee rehearsal.',
          tasks: [
            { title: 'Run slide advance tests with keynote presenters', priority: 'high', assignee: 'AV Lead' },
            { title: 'Brief registration desk staff on badge scanner app', priority: 'medium', assignee: 'Ops Lead' },
          ],
        },
      ];
      break;

    default: // Birthday, College Fest, Community, Custom
      rawList = [
        {
          id: 'm1_concept',
          title: 'Lock Theme, Venue & Budget Bounds',
          category: 'Planning',
          standardOffset: 60,
          priority: 'high',
          notes: 'Establish core theme, secure location and assign lead coordinators.',
          tasks: [
            { title: 'Confirm party venue / ground availability and deposit', priority: 'high', assignee: 'Lead Organizer' },
            { title: 'Set budget limits across major expense buckets', priority: 'high', assignee: 'Finance Lead' },
          ],
        },
        {
          id: 'm2_vendors',
          title: 'Engage Caterer, Decor & Entertainment',
          category: 'Vendors',
          standardOffset: 35,
          priority: 'high',
          notes: 'Confirm customized cake/menu, sound system and entertainment acts.',
          tasks: [
            { title: 'Place custom cake and catering order', priority: 'high', assignee: 'Hospitality Lead' },
            { title: 'Order themed decor props and photo-backdrop kit', priority: 'medium', assignee: 'Decor Lead' },
            { title: 'Hire DJ, performer, or interactive party host', priority: 'medium', assignee: 'Lead Organizer' },
          ],
        },
        {
          id: 'm3_invites',
          title: 'Send Invitations & Confirm RSVPs',
          category: 'Guests',
          standardOffset: 20,
          priority: 'high',
          notes: 'Distribute invitations and track attendee numbers for catering.',
          tasks: [
            { title: 'Send digital invitations and RSVP form', priority: 'high', assignee: 'Lead Organizer' },
            { title: 'Follow up on unconfirmed RSVPs', priority: 'medium', assignee: 'Lead Organizer' },
          ],
        },
        {
          id: 'm4_supplies',
          title: 'Purchase Party Favors & Finalize Playlist',
          category: 'Experience',
          standardOffset: 7,
          priority: 'medium',
          notes: 'Assemble guest return favors, prizes for games, and music tracks.',
          tasks: [
            { title: 'Assemble return gifts / celebration favor bags', priority: 'medium', assignee: 'Decor Lead' },
            { title: 'Curate party playlist and coordinate sound equipment', priority: 'medium', assignee: 'Entertainment Lead' },
          ],
        },
        {
          id: 'm5_execution',
          title: 'Venue Setup & Day-Of Coordination',
          category: 'Execution',
          standardOffset: 1,
          priority: 'high',
          notes: 'Onsite arrangement, soundcheck and welcome greeting.',
          tasks: [
            { title: 'Supervise balloon/floral decor setup 3 hours prior', priority: 'high', assignee: 'Decor Lead' },
            { title: 'Receive catering deliveries and check temperature', priority: 'high', assignee: 'Hospitality Lead' },
          ],
        },
      ];
      break;
  }

  const milestones: Milestone[] = [];
  const tasks: Task[] = [];

  let prevMilestoneId: string | null = null;

  rawList.forEach((raw, idx) => {
    const scaledOffset = scale(raw.standardOffset);
    const dueDate = formatDueDateFromOffset(startDateStr, scaledOffset);
    const isAtRisk = dueDate < todayStr;

    const milestone: Milestone = {
      id: raw.id,
      title: raw.title,
      category: raw.category,
      dueDate,
      daysBeforeEvent: scaledOffset,
      completed: false,
      priority: raw.priority,
      dependencies: prevMilestoneId ? [prevMilestoneId] : [],
      isAtRisk,
      notes: raw.notes,
      autoGenerated: true,
    };

    milestones.push(milestone);
    prevMilestoneId = raw.id;

    raw.tasks.forEach((t, tIdx) => {
      // Task due date is same as milestone or 2 days before
      const taskDueDate = dueDate;
      tasks.push({
        id: `t_${raw.id}_${tIdx + 1}`,
        milestoneId: raw.id,
        title: t.title,
        category: raw.category,
        priority: t.priority,
        status: 'todo',
        dueDate: taskDueDate,
        assignee: t.assignee,
        dependencies: [],
        isAiSuggested: false,
      });
    });
  });

  return { milestones, tasks };
}

export function recalculateTimelineForNewDate(
  milestones: Milestone[],
  tasks: Task[],
  newStartDate: string
): { updatedMilestones: Milestone[]; updatedTasks: Task[] } {
  const todayStr = new Date().toISOString().split('T')[0];

  const updatedMilestones = milestones.map((m) => {
    const newDueDate = formatDueDateFromOffset(newStartDate, m.daysBeforeEvent);
    const isAtRisk = !m.completed && newDueDate < todayStr;
    return {
      ...m,
      dueDate: newDueDate,
      isAtRisk,
    };
  });

  const updatedTasks = tasks.map((t) => {
    if (!t.milestoneId) return t;
    const parentMilestone = updatedMilestones.find((m) => m.id === t.milestoneId);
    if (!parentMilestone) return t;
    return {
      ...t,
      dueDate: parentMilestone.dueDate,
    };
  });

  return { updatedMilestones, updatedTasks };
}

export function checkMilestoneDependencies(milestones: Milestone[]): {
  milestoneId: string;
  hasDependencyIssue: boolean;
  issueDescription?: string;
}[] {
  return milestones.map((m) => {
    if (!m.dependencies || m.dependencies.length === 0) {
      return { milestoneId: m.id, hasDependencyIssue: false };
    }

    for (const depId of m.dependencies) {
      const dep = milestones.find((x) => x.id === depId);
      if (dep) {
        // Issue if dependent milestone is due before prerequisite
        if (m.dueDate < dep.dueDate) {
          return {
            milestoneId: m.id,
            hasDependencyIssue: true,
            issueDescription: `Due date (${m.dueDate}) is earlier than prerequisite "${dep.title}" (${dep.dueDate})!`,
          };
        }
        // Warning if prerequisite is overdue and not completed
        if (dep.isAtRisk && !dep.completed) {
          return {
            milestoneId: m.id,
            hasDependencyIssue: true,
            issueDescription: `Prerequisite "${dep.title}" is overdue and incomplete.`,
          };
        }
      }
    }

    return { milestoneId: m.id, hasDependencyIssue: false };
  });
}

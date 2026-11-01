import React, { useState } from 'react';
import {
  CheckSquare,
  Plus,
  Sparkles,
  Search,
  CheckCircle2,
  Circle,
  Clock,
  User,
  Trash2,
  Edit2,
} from 'lucide-react';
import { AppState, Task, TaskPriority, TaskStatus } from '../../types/index';
import { createId } from '../../lib/createId';
import { ModalShell } from '../ui/ModalShell';

interface TasksTabProps {
  state: AppState;
  onUpdateState: (newState: AppState) => void;
  onShowToast: (type: 'success' | 'warning' | 'error' | 'info', title: string, msg?: string) => void;
}

export const TasksTab: React.FC<TasksTabProps> = ({ state, onUpdateState, onShowToast }) => {
  const { tasks, event } = state;

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Form State
  const [tTitle, setTTitle] = useState('');
  const [tCategory, setTCategory] = useState('Production');
  const [tPriority, setTPriority] = useState<TaskPriority>('medium');
  const [tStatus, setTStatus] = useState<TaskStatus>('todo');
  const [tDueDate, setTDueDate] = useState(event.startDate);
  const [tAssignee, setTAssignee] = useState('Organizer');
  const [tNotes, setTNotes] = useState('');

  // AI-Suggested Gaps drawer
  const [suggestedGapsModalOpen, setSuggestedGapsModalOpen] = useState(false);

  // Derive categories
  const categoriesList = Array.from(new Set(tasks.map((t) => t.category))).filter(Boolean);

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
    if (
      searchQuery.trim() &&
      !t.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !t.assignee.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const toggleTaskStatus = (taskId: string) => {
    const updated = tasks.map((t) =>
      t.id === taskId
        ? { ...t, status: (t.status === 'done' ? 'todo' : 'done') as TaskStatus }
        : t
    );
    onUpdateState({ ...state, tasks: updated });
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tTitle.trim()) return;

    if (editingTask) {
      const updated = tasks.map((t) =>
        t.id === editingTask.id
          ? {
              ...t,
              title: tTitle,
              category: tCategory,
              priority: tPriority,
              status: tStatus,
              dueDate: tDueDate,
              assignee: tAssignee,
              notes: tNotes,
            }
          : t
      );
      onUpdateState({ ...state, tasks: updated });
      onShowToast('success', 'Task Updated', tTitle);
    } else {
      const newTask: Task = {
        id: createId('t'),
        title: tTitle,
        category: tCategory,
        priority: tPriority,
        status: tStatus,
        dueDate: tDueDate,
        assignee: tAssignee,
        dependencies: [],
        notes: tNotes,
      };
      onUpdateState({ ...state, tasks: [...tasks, newTask] });
      onShowToast('success', 'Task Added', tTitle);
    }

    setTaskModalOpen(false);
    setEditingTask(null);
  };

  const handleDeleteTask = (taskId: string) => {
    onUpdateState({ ...state, tasks: tasks.filter((t) => t.id !== taskId) });
    onShowToast('info', 'Task Deleted');
  };

  // AI Task Gaps Generator
  const generateTaskGaps = (): { title: string; category: string; priority: TaskPriority; assignee: string }[] => {
    if (event.type === 'wedding') {
      return [
        { title: 'Confirm organic chemical-free Mehndi cones & artist trial', category: 'Styling', priority: 'high', assignee: 'Bridal Coordinator' },
        { title: 'Verify Priest / Officiant sacred samagri checklist & havan setup', category: 'Ceremony', priority: 'high', assignee: 'Family Elders' },
        { title: 'Confirm local police & municipal outdoor music permission', category: 'Logistics', priority: 'high', assignee: 'Venue Lead' },
        { title: 'Order emergency hospitality kits for guest suites (safety pins, pain relief, snacks)', category: 'Hospitality', priority: 'medium', assignee: 'Guest Lead' },
        { title: 'Arrange portable step-ramps for elderly guests over garden turf', category: 'Accessibility', priority: 'high', assignee: 'Decor Lead' },
      ];
    } else if (event.type === 'corporate') {
      return [
        { title: 'Test live stream backup network bonding (SIM + Ethernet)', category: 'AV Production', priority: 'high', assignee: 'Tech Lead' },
        { title: 'Review keynote speaker slide decks on native projector aspect ratio (16:9)', category: 'Content', priority: 'high', assignee: 'Content Chair' },
        { title: 'Conduct dry run with registration QR code scanners', category: 'Operations', priority: 'medium', assignee: 'Desk Coordinator' },
      ];
    } else {
      return [
        { title: 'Confirm backup candles, matches, and cake server knife', category: 'Catering', priority: 'high', assignee: 'Host' },
        { title: 'Verify audio playlist test on venue bluetooth speakers', category: 'Entertainment', priority: 'medium', assignee: 'DJ Lead' },
      ];
    }
  };

  const addGapTask = (gap: { title: string; category: string; priority: TaskPriority; assignee: string }) => {
    const newTask: Task = {
      id: createId('t_gap'),
      title: gap.title,
      category: gap.category,
      priority: gap.priority,
      status: 'todo',
      dueDate: event.startDate,
      assignee: gap.assignee,
      dependencies: [],
      isAiSuggested: true,
    };
    onUpdateState({ ...state, tasks: [...tasks, newTask] });
    onShowToast('success', 'Task Added from AI Audit', gap.title);
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold font-editorial text-slate-900">
            Action Checklists &amp; Task Master
          </h2>
          <p className="text-xs text-slate-500">
            Manage operational items, dependencies, assignees, and AI-identified planning gaps
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setSuggestedGapsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-purple-50 text-purple-900 border border-purple-200 hover:bg-purple-100 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-700" />
            <span>Scan for AI-Suggested Gaps</span>
          </button>

          <button
            onClick={() => {
              setEditingTask(null);
              setTTitle('');
              setTCategory('Production');
              setTPriority('medium');
              setTStatus('todo');
              setTDueDate(event.startDate);
              setTAssignee('Host');
              setTNotes('');
              setTaskModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg bg-purple-900 hover:bg-purple-950 text-white shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5 text-amber-300" />
            <span>Add Task</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" aria-hidden="true" />
          <label htmlFor="task-search" className="sr-only">Search tasks by title or assignee</label>
          <input
            id="task-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tasks by title or assignee..."
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg outline-hidden focus:ring-2 focus:ring-purple-700/20 text-xs text-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status filter */}
          <label htmlFor="task-status-filter" className="sr-only">Filter by status</label>
          <select
            id="task-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-2.5 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 outline-hidden font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="done">Completed</option>
          </select>

          {/* Priority filter */}
          <label htmlFor="task-priority-filter" className="sr-only">Filter by priority</label>
          <select
            id="task-priority-filter"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="px-2.5 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 outline-hidden font-medium"
          >
            <option value="all">All Priorities</option>
            <option value="high">High Priority</option>
            <option value="medium">Medium Priority</option>
            <option value="low">Low Priority</option>
          </select>

          {/* Category filter */}
          {categoriesList.length > 0 && (
            <>
              <label htmlFor="task-category-filter" className="sr-only">Filter by category</label>
              <select
                id="task-category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-2 border border-slate-200 rounded-lg bg-white text-slate-800 outline-hidden font-medium"
              >
              <option value="all">All Categories</option>
              {categoriesList.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              </select>
            </>
          )}
        </div>
      </div>

      {/* Task List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="text-center py-12">
            <CheckSquare className="w-10 h-10 text-slate-300 mx-auto mb-2" aria-hidden="true" />
            <h4 className="text-sm font-semibold text-slate-800">No tasks found</h4>
            <p className="text-xs text-slate-600 mt-1">
              {searchQuery || statusFilter !== 'all'
                ? 'Try adjusting your search or filters.'
                : 'Click "Add Task" or "Scan for AI-Suggested Gaps" to populate.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredTasks.map((t) => {
              const isDone = t.status === 'done';
              return (
                <div
                  key={t.id}
                  className={`p-4 flex items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors ${
                    isDone ? 'bg-slate-50/40 opacity-70' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleTaskStatus(t.id)}
                      className="text-slate-500 hover:text-emerald-600 transition-colors cursor-pointer"
                      aria-pressed={isDone}
                      aria-label={`${isDone ? 'Mark as to do' : 'Mark as completed'}: ${t.title}`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600" aria-hidden="true" />
                      ) : (
                        <Circle className="w-5 h-5 text-slate-400 hover:text-purple-700" aria-hidden="true" />
                      )}
                    </button>

                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-semibold ${
                            isDone ? 'line-through text-slate-400' : 'text-slate-900'
                          }`}
                        >
                          {t.title}
                        </span>
                        {t.isAiSuggested && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 border border-purple-200">
                            AI Gap
                          </span>
                        )}
                        <span className="text-[10px] font-medium px-2 py-0.2 rounded bg-slate-100 text-slate-600">
                          {t.category}
                        </span>
                      </div>

                      {t.notes && (
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{t.notes}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div className="hidden sm:flex items-center gap-1.5 text-slate-600">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t.assignee}</span>
                    </div>

                    <div className="hidden sm:flex items-center gap-1.5 text-slate-500">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span>{t.dueDate}</span>
                    </div>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        t.priority === 'high'
                          ? 'bg-rose-100 text-rose-800'
                          : t.priority === 'medium'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {t.priority}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                        t.status === 'done'
                          ? 'bg-emerald-100 text-emerald-800'
                          : t.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : t.status === 'blocked'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {t.status.replace('_', ' ')}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingTask(t);
                          setTTitle(t.title);
                          setTCategory(t.category);
                          setTPriority(t.priority);
                          setTStatus(t.status);
                          setTDueDate(t.dueDate);
                          setTAssignee(t.assignee);
                          setTNotes(t.notes || '');
                          setTaskModalOpen(true);
                        }}
                        className="p-1 text-slate-500 hover:text-slate-800 rounded cursor-pointer"
                        aria-label={`Edit task ${t.title}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                      <button
                        onClick={() => handleDeleteTask(t.id)}
                        className="p-1 text-slate-500 hover:text-rose-600 rounded cursor-pointer"
                        aria-label={`Delete task ${t.title}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI Task Gaps Modal */}
      <ModalShell
        isOpen={suggestedGapsModalOpen}
        onClose={() => setSuggestedGapsModalOpen(false)}
        title="AI-Identified Operational Gaps"
        maxWidthClassName="max-w-xl"
        bodyClassName="p-6 space-y-4"
      >
        <p className="text-xs text-slate-700">
          Gatherly analyzed your {event.type.replace('_', ' ')} requirements and detected essential
          checklist items frequently overlooked in standard plans:
        </p>

        <div className="space-y-2.5 max-h-[50vh] overflow-y-auto">
          {generateTaskGaps().map((gap, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 flex items-center justify-between gap-3 text-xs"
            >
              <div className="space-y-0.5">
                <span className="font-bold text-slate-900 block">{gap.title}</span>
                <span className="text-[11px] text-slate-600">
                  Category: {gap.category} • Lead: {gap.assignee}
                </span>
              </div>

              <button
                onClick={() => addGapTask(gap)}
                className="shrink-0 flex items-center gap-1 px-3 py-1 bg-purple-900 hover:bg-purple-950 text-white rounded-lg font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-amber-300" aria-hidden="true" />
                <span>Add to Tasks</span>
              </button>
            </div>
          ))}
        </div>
      </ModalShell>

      {/* Task Add / Edit Modal */}
      <ModalShell
        isOpen={taskModalOpen}
        onClose={() => setTaskModalOpen(false)}
        title={editingTask ? 'Edit Task' : 'Add New Checklist Task'}
        maxWidthClassName="max-w-md"
        bodyClassName="p-6"
      >
        <form onSubmit={handleSaveTask} className="space-y-4">
          <div>
            <label htmlFor="task-title" className="block text-xs font-medium text-slate-800 mb-1">Task Title</label>
            <input
              id="task-title"
              type="text"
              required
              value={tTitle}
              onChange={(e) => setTTitle(e.target.value)}
              placeholder="e.g. Schedule DJ sound check"
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-category" className="block text-xs font-medium text-slate-800 mb-1">Category</label>
              <input
                id="task-category"
                type="text"
                value={tCategory}
                onChange={(e) => setTCategory(e.target.value)}
                placeholder="e.g. Catering, Venue, AV"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
              />
            </div>

            <div>
              <label htmlFor="task-priority" className="block text-xs font-medium text-slate-800 mb-1">Priority</label>
              <select
                id="task-priority"
                value={tPriority}
                onChange={(e) => setTPriority(e.target.value as TaskPriority)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="task-status" className="block text-xs font-medium text-slate-800 mb-1">Status</label>
              <select
                id="task-status"
                value={tStatus}
                onChange={(e) => setTStatus(e.target.value as TaskStatus)}
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden bg-white"
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Completed</option>
              </select>
            </div>

            <div>
              <label htmlFor="task-assignee" className="block text-xs font-medium text-slate-800 mb-1">Assignee</label>
              <input
                id="task-assignee"
                type="text"
                value={tAssignee}
                onChange={(e) => setTAssignee(e.target.value)}
                placeholder="e.g. Lead Planner"
                className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
              />
            </div>
          </div>

          <div>
            <label htmlFor="task-due" className="block text-xs font-medium text-slate-800 mb-1">Due Date</label>
            <input
              id="task-due"
              type="date"
              value={tDueDate}
              onChange={(e) => setTDueDate(e.target.value)}
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
            />
          </div>

          <div>
            <label htmlFor="task-notes" className="block text-xs font-medium text-slate-800 mb-1">Notes</label>
            <textarea
              id="task-notes"
              rows={2}
              value={tNotes}
              onChange={(e) => setTNotes(e.target.value)}
              placeholder="Specific instructions or vendor contacts..."
              className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-700 outline-hidden"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setTaskModalOpen(false)}
              className="text-xs px-3 py-1.5 text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-900 text-white rounded-lg text-xs font-bold hover:bg-purple-950 transition-colors cursor-pointer"
            >
              Save Task
            </button>
          </div>
        </form>
      </ModalShell>
    </div>
  );
};

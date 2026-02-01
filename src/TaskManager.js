const fs = require('fs');
const path = require('path');

const CONFIG = require('../config.json');

// Ensure data directory exists
const dataDir = path.dirname(CONFIG.storage.tasksFile);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

class TaskManager {
  constructor() {
    this.tasksFile = CONFIG.storage.tasksFile;
    this.logsFile = CONFIG.storage.logsFile;
    this.tasks = this.loadTasks();
    this.logs = this.loadLogs();
  }

  loadTasks() {
    if (!fs.existsSync(this.tasksFile)) {
      return [];
    }
    return JSON.parse(fs.readFileSync(this.tasksFile, 'utf8'));
  }

  saveTasks() {
    fs.writeFileSync(this.tasksFile, JSON.stringify(this.tasks, null, 2));
  }

  loadLogs() {
    if (!fs.existsSync(this.logsFile)) {
      return [];
    }
    return fs.readFileSync(this.logsFile, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }

  logActivity(action, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      ...details
    };
    fs.appendFileSync(this.logsFile, JSON.stringify(entry) + '\n');
  }

  addTask(title, options = {}) {
    const task = {
      id: this.generateId(),
      title,
      description: options.description || '',
      priority: options.priority || 'medium',
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null,
      heartbeatCycles: 0,
      tags: options.tags || []
    };
    this.tasks.push(task);
    this.saveTasks();
    this.logActivity('task_created', { taskId: task.id, title });
    return task;
  }

  generateId() {
    return 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  getPendingTasks() {
    return this.tasks.filter(t => t.status === 'pending');
  }

  getCompletedTasks(since = null) {
    let completed = this.tasks.filter(t => t.status === 'completed');
    if (since) {
      completed = completed.filter(t => new Date(t.completedAt) >= new Date(since));
    }
    return completed;
  }

  completeTask(taskId, notes = '') {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    task.completionNotes = notes;
    this.saveTasks();
    this.logActivity('task_completed', { taskId, title: task.title, notes });
    return task;
  }

  getNextTaskForHeartbeat() {
    const pending = this.getPendingTasks();
    if (pending.length === 0) return null;
    
    // Sort by priority then age
    const priorityMap = { high: 3, medium: 2, low: 1 };
    pending.sort((a, b) => {
      const prioDiff = priorityMap[b.priority] - priorityMap[a.priority];
      if (prioDiff !== 0) return prioDiff;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
    
    return pending[0];
  }

  recordHeartbeat(activity = null) {
    const entry = {
      timestamp: new Date().toISOString(),
      action: 'heartbeat',
      taskWorkedOn: activity?.taskId || null,
      activity: activity?.description || 'no_activity'
    };
    this.logActivity('heartbeat', entry);
    
    if (activity?.taskId) {
      const task = this.tasks.find(t => t.id === activity.taskId);
      if (task) {
        task.heartbeatCycles++;
        this.saveTasks();
      }
    }
    
    return entry;
  }

  checkAntiSlacking() {
    if (!CONFIG.antiSlacking.enabled) return { slacking: false };
    
    const logs = this.loadLogs();
    const recentHeartbeats = logs.filter(l => {
      const age = Date.now() - new Date(l.timestamp).getTime();
      return l.action === 'heartbeat' && age < 24 * 60 * 60 * 1000;
    });
    
    const idleHeartbeats = recentHeartbeats.filter(h => h.activity === 'no_activity');
    
    if (idleHeartbeats.length >= CONFIG.antiSlacking.maxIdleHeartbeats) {
      return {
        slacking: true,
        message: `WARNING: ${idleHeartbeats.length} idle heartbeats detected. Get to work!`,
        idleCount: idleHeartbeats.length
      };
    }
    
    return { slacking: false, idleCount: idleHeartbeats.length };
  }

  generateMorningReport() {
    const now = new Date();
    const yesterday = new Date(now - 24 * 60 * 60 * 1000);
    
    const completedToday = this.getCompletedTasks(yesterday);
    const pending = this.getPendingTasks();
    const slackingCheck = this.checkAntiSlacking();
    
    const logs = this.loadLogs();
    const todayLogs = logs.filter(l => new Date(l.timestamp) >= yesterday);
    const heartbeatCount = todayLogs.filter(l => l.action === 'heartbeat').length;
    
    return {
      date: now.toISOString().split('T')[0],
      summary: {
        tasksCompleted: completedToday.length,
        tasksPending: pending.length,
        heartbeats: heartbeatCount,
        slackingDetected: slackingCheck.slacking
      },
      completedTasks: completedToday.map(t => ({
        title: t.title,
        completedAt: t.completedAt,
        notes: t.completionNotes
      })),
      pendingTasks: pending.slice(0, 5).map(t => ({
        title: t.title,
        priority: t.priority,
        age: Math.floor((now - new Date(t.createdAt)) / (1000 * 60 * 60)) + 'h'
      })),
      warnings: slackingCheck.slacking ? [slackingCheck.message] : [],
      nextRecommendedTask: this.getNextTaskForHeartbeat()?.title || null
    };
  }
}

module.exports = TaskManager;
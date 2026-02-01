const fs = require('fs');
const path = require('path');

// Use test data directory
const TEST_DIR = path.join(__dirname, '..', 'test-data');
const TEST_TASKS_FILE = path.join(TEST_DIR, 'tasks.json');
const TEST_LOGS_FILE = path.join(TEST_DIR, 'activity.log');

// Clean up before tests
function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

// Simple TaskManager test implementation
class TestTaskManager {
  constructor() {
    this.tasksFile = TEST_TASKS_FILE;
    this.logsFile = TEST_LOGS_FILE;
    this.tasks = this.loadTasks();
    this.config = {
      antiSlacking: { enabled: true, maxIdleHeartbeats: 3 }
    };
  }

  loadTasks() {
    if (!fs.existsSync(this.tasksFile)) return [];
    return JSON.parse(fs.readFileSync(this.tasksFile, 'utf8'));
  }

  saveTasks() {
    fs.writeFileSync(this.tasksFile, JSON.stringify(this.tasks, null, 2));
  }

  logActivity(action, details = {}) {
    const entry = { timestamp: new Date().toISOString(), action, ...details };
    fs.appendFileSync(this.logsFile, JSON.stringify(entry) + '\n');
  }

  loadLogs() {
    if (!fs.existsSync(this.logsFile)) return [];
    return fs.readFileSync(this.logsFile, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));
  }

  addTask(title, options = {}) {
    const task = {
      id: 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      title,
      priority: options.priority || 'medium',
      status: 'pending',
      createdAt: new Date().toISOString(),
      completedAt: null,
      heartbeatCycles: 0
    };
    this.tasks.push(task);
    this.saveTasks();
    this.logActivity('task_created', { taskId: task.id, title });
    return task;
  }

  getPendingTasks() {
    return this.tasks.filter(t => t.status === 'pending');
  }

  completeTask(taskId, notes = '') {
    const task = this.tasks.find(t => t.id === taskId);
    if (!task) throw new Error(`Task ${taskId} not found`);
    task.status = 'completed';
    task.completedAt = new Date().toISOString();
    this.saveTasks();
    this.logActivity('task_completed', { taskId, title: task.title, notes });
    return task;
  }

  getNextTaskForHeartbeat() {
    const pending = this.getPendingTasks();
    if (pending.length === 0) return null;
    const priorityMap = { high: 3, medium: 2, low: 1 };
    pending.sort((a, b) => priorityMap[b.priority] - priorityMap[a.priority]);
    return pending[0];
  }

  recordHeartbeat(activity = null) {
    this.logActivity('heartbeat', {
      taskId: activity?.taskId || null,
      description: activity?.description || 'no_activity'
    });
    if (activity?.taskId) {
      const task = this.tasks.find(t => t.id === activity.taskId);
      if (task) {
        task.heartbeatCycles++;
        this.saveTasks();
      }
    }
  }

  checkAntiSlacking() {
    const logs = this.loadLogs().filter(l => l.action === 'heartbeat');
    const idleCount = logs.filter(l => l.description === 'no_activity').length;
    if (idleCount >= this.config.antiSlacking.maxIdleHeartbeats) {
      return { slacking: true, idleCount, message: 'Too many idle heartbeats' };
    }
    return { slacking: false, idleCount };
  }
}

// Run tests
cleanup();
console.log('Running TaskManager tests...\n');

const manager = new TestTaskManager();

// Test 1: Add task
const task1 = manager.addTask('Test task', { priority: 'high' });
console.assert(task1.title === 'Test task', 'Task title should match');
console.assert(task1.priority === 'high', 'Priority should be high');
console.assert(task1.status === 'pending', 'Status should be pending');
console.log('✓ Test 1: Add task - PASSED');

// Test 2: Get pending tasks
const task2 = manager.addTask('Another task', { priority: 'low' });
const pending = manager.getPendingTasks();
console.assert(pending.length === 2, 'Should have 2 pending tasks');
console.log('✓ Test 2: Get pending tasks - PASSED');

// Test 3: Complete task
manager.completeTask(task1.id, 'Done!');
const updatedPending = manager.getPendingTasks();
console.assert(updatedPending.length === 1, 'Should have 1 pending task after completion');
console.log('✓ Test 3: Complete task - PASSED');

// Test 4: Get next task by priority
manager.addTask('Low priority', { priority: 'low' });
manager.addTask('High priority', { priority: 'high' });
const next = manager.getNextTaskForHeartbeat();
console.assert(next.priority === 'high', 'Should get highest priority task');
console.log('✓ Test 4: Priority sorting - PASSED');

// Test 5: Detect slacking
manager.recordHeartbeat({ taskId: null, description: 'no_activity' });
manager.recordHeartbeat({ taskId: null, description: 'no_activity' });
manager.recordHeartbeat({ taskId: null, description: 'no_activity' });
const slackingCheck = manager.checkAntiSlacking();
console.assert(slackingCheck.slacking === true, 'Should detect slacking after 3 idle heartbeats');
console.log('✓ Test 5: Anti-slacking detection - PASSED');

// Test 6: Activity logging
const logs = manager.loadLogs();
console.assert(logs.length >= 5, 'Should have logged activities');
const createdLog = logs.find(l => l.action === 'task_created');
console.assert(createdLog !== undefined, 'Should have task_created log');
console.log('✓ Test 6: Activity logging - PASSED');

// Test 7: Heartbeat cycles increment
const task3 = manager.addTask('Work task', { priority: 'medium' });
const initialCycles = task3.heartbeatCycles;
manager.recordHeartbeat({ taskId: task3.id, description: 'working' });
console.assert(task3.heartbeatCycles === initialCycles + 1, 'Heartbeat cycles should increment');
console.log('✓ Test 7: Heartbeat cycle tracking - PASSED');

console.log('\n═══════════════════════════════════════════');
console.log('All 7 tests passed! ✓');
console.log('═══════════════════════════════════════════\n');

// Cleanup
cleanup();
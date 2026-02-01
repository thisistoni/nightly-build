const TaskManager = require('./src/TaskManager');
const fs = require('fs');
const path = require('path');

// Test setup
const TEST_DIR = './test-data';
process.env.TEST_MODE = 'true';

// Mock config for testing
const originalConfig = require('./config.json');
const testConfig = {
  ...originalConfig,
  storage: {
    tasksFile: `${TEST_DIR}/tasks.json`,
    logsFile: `${TEST_DIR}/activity.log`
  }
};

// Clean up test data
function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true });
  }
}

// Override config in TaskManager
jest.mock('./config.json', () => testConfig);

describe('TaskManager', () => {
  let manager;

  beforeEach(() => {
    cleanup();
    manager = new TaskManager();
  });

  afterEach(() => {
    cleanup();
  });

  test('should add a task', () => {
    const task = manager.addTask('Test task', { priority: 'high' });
    expect(task.title).toBe('Test task');
    expect(task.priority).toBe('high');
    expect(task.status).toBe('pending');
    expect(task.id).toBeDefined();
  });

  test('should get pending tasks', () => {
    manager.addTask('Task 1');
    manager.addTask('Task 2');
    const pending = manager.getPendingTasks();
    expect(pending.length).toBe(2);
  });

  test('should complete a task', () => {
    const task = manager.addTask('Complete me');
    const completed = manager.completeTask(task.id, 'Done!');
    expect(completed.status).toBe('completed');
    expect(completed.completionNotes).toBe('Done!');
  });

  test('should get next task by priority', () => {
    manager.addTask('Low priority', { priority: 'low' });
    manager.addTask('High priority', { priority: 'high' });
    manager.addTask('Medium priority', { priority: 'medium' });
    
    const next = manager.getNextTaskForHeartbeat();
    expect(next.priority).toBe('high');
  });

  test('should detect slacking after idle heartbeats', () => {
    // Simulate multiple idle heartbeats
    for (let i = 0; i < 5; i++) {
      manager.recordHeartbeat({ taskId: null, description: 'no_activity' });
    }
    
    const check = manager.checkAntiSlacking();
    expect(check.slacking).toBe(true);
  });

  test('should generate morning report', () => {
    manager.addTask('Task 1');
    const task2 = manager.addTask('Task 2');
    manager.completeTask(task2.id);
    
    const report = manager.generateMorningReport();
    expect(report.summary.tasksCompleted).toBe(1);
    expect(report.summary.tasksPending).toBe(1);
    expect(report.date).toBeDefined();
  });
});

console.log('Tests defined. Run with: npm test');
const TaskManager = require('./src/TaskManager');

const manager = new TaskManager();

const commands = {
  add() {
    const title = process.argv[3];
    if (!title) {
      console.error('Usage: node cli.js add "Task title" [--priority=high|medium|low]');
      process.exit(1);
    }
    
    const priority = process.argv.find(a => a.startsWith('--priority='))?.split('=')[1] || 'medium';
    const task = manager.addTask(title, { priority });
    console.log(`✓ Task created: ${task.id}`);
    console.log(`  Title: ${task.title}`);
    console.log(`  Priority: ${task.priority}`);
  },

  list() {
    const pending = manager.getPendingTasks();
    if (pending.length === 0) {
      console.log('No pending tasks! Great job, or great slacking... 🤔');
      return;
    }
    
    console.log(`\n📋 ${pending.length} Pending Tasks:\n`);
    pending.forEach((task, i) => {
      const age = Math.floor((Date.now() - new Date(task.createdAt)) / (1000 * 60 * 60));
      console.log(`${i + 1}. [${task.priority.toUpperCase()}] ${task.title}`);
      console.log(`   ID: ${task.id}`);
      console.log(`   Age: ${age}h | Heartbeats: ${task.heartbeatCycles}`);
      console.log('');
    });
  },

  complete() {
    const taskId = process.argv[3];
    if (!taskId) {
      console.error('Usage: node cli.js complete <task-id> ["notes"]');
      process.exit(1);
    }
    
    const notes = process.argv[4] || '';
    try {
      const task = manager.completeTask(taskId, notes);
      console.log(`✓ Completed: ${task.title}`);
    } catch (err) {
      console.error(`✗ Error: ${err.message}`);
      process.exit(1);
    }
  },

  heartbeat() {
    const nextTask = manager.getNextTaskForHeartbeat();
    
    if (nextTask) {
      console.log(`\n🎯 Recommended task for this heartbeat:`);
      console.log(`   "${nextTask.title}" [${nextTask.priority.toUpperCase()}]`);
      console.log(`   ID: ${nextTask.id}`);
      console.log('\n   Run: node cli.js working ' + nextTask.id);
    } else {
      console.log('\n🎯 No pending tasks. Create one with: node cli.js add "task name"');
    }
    
    // Check anti-slacking
    const slacking = manager.checkAntiSlacking();
    if (slacking.slacking) {
      console.log(`\n⚠️  ${slacking.message}`);
    }
  },

  working() {
    const taskId = process.argv[3];
    if (!taskId) {
      console.error('Usage: node cli.js working <task-id>');
      process.exit(1);
    }
    
    manager.recordHeartbeat({
      taskId,
      description: 'working_on_task'
    });
    
    console.log(`✓ Logged heartbeat activity for task ${taskId}`);
  },

  'morning-report'() {
    const report = manager.generateMorningReport();
    
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║      🌅 PIA MORNING BUILD REPORT       ║');
    console.log('╠════════════════════════════════════════╣');
    console.log(`║ Date: ${report.date}                  ║`);
    console.log('╚════════════════════════════════════════╝\n');
    
    console.log('📊 Summary:');
    console.log(`   Tasks completed: ${report.summary.tasksCompleted}`);
    console.log(`   Tasks pending: ${report.summary.tasksPending}`);
    console.log(`   Heartbeats: ${report.summary.heartbeats}`);
    
    if (report.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      report.warnings.forEach(w => console.log(`   ${w}`));
    }
    
    if (report.completedTasks.length > 0) {
      console.log('\n✅ Completed:');
      report.completedTasks.forEach(t => {
        console.log(`   • ${t.title}`);
        if (t.notes) console.log(`     Notes: ${t.notes}`);
      });
    }
    
    if (report.pendingTasks.length > 0) {
      console.log('\n📋 Top Pending:');
      report.pendingTasks.forEach(t => {
        console.log(`   [${t.priority.toUpperCase()}] ${t.title} (${t.age})`);
      });
    }
    
    if (report.nextRecommendedTask) {
      console.log(`\n🎯 Next up: "${report.nextRecommendedTask}"`);
    }
    
    console.log('\n═══════════════════════════════════════════\n');
  },

  help() {
    console.log(`
Nightly Build System - Commands:

  add "title" [--priority=high|medium|low]  Create a new task
  list                                      Show pending tasks
  complete <id> ["notes"]                   Mark task as done
  heartbeat                                 Get next task for heartbeat
  working <id>                             Log work on a task
  morning-report                            Generate status report
  help                                      Show this help
`);
  }
};

const cmd = process.argv[2] || 'help';

if (commands[cmd]) {
  commands[cmd]();
} else {
  console.error(`Unknown command: ${cmd}`);
  commands.help();
  process.exit(1);
}
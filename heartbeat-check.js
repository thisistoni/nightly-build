#!/usr/bin/env node
/**
 * Heartbeat Integration for PIA
 * 
 * This script is called during heartbeat cycles to:
 * 1. Check for pending tasks
 * 2. Recommend the next task
 * 3. Track activity
 * 4. Prevent idle slacking
 * 
 * Usage: node heartbeat-check.js [--report]
 */

const TaskManager = require('./src/TaskManager');
const path = require('path');

const manager = new TaskManager();
const args = process.argv.slice(2);
const shouldReport = args.includes('--report');

function getPriorityEmoji(priority) {
  return { high: '🔴', medium: '🟡', low: '🟢' }[priority] || '⚪';
}

function formatUptime() {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const mins = Math.floor((uptime % 3600) / 60);
  return `${hours}h ${mins}m`;
}

async function runHeartbeatCheck() {
  console.log('\n🦞 Nightly Build System - Heartbeat Check');
  console.log('═══════════════════════════════════════════\n');
  
  const pending = manager.getPendingTasks();
  const completed = manager.getCompletedTasks(new Date(Date.now() - 24 * 60 * 60 * 1000));
  
  // Status summary
  console.log(`📊 Status: ${completed.length} completed today, ${pending.length} pending`);
  
  // Check for slacking
  const slackingCheck = manager.checkAntiSlacking();
  if (slackingCheck.slacking) {
    console.log(`\n⚠️  ANTI-SLACKING ALERT: ${slackingCheck.message}`);
    console.log('   Time to ship something!\n');
  }
  
  // Recommend next task
  if (pending.length > 0) {
    const nextTask = manager.getNextTaskForHeartbeat();
    console.log('\n🎯 NEXT TASK:');
    console.log(`   ${getPriorityEmoji(nextTask.priority)} ${nextTask.title}`);
    console.log(`   Priority: ${nextTask.priority.toUpperCase()}`);
    console.log(`   ID: ${nextTask.id}`);
    console.log(`   Age: ${Math.floor((Date.now() - new Date(nextTask.createdAt)) / (1000 * 60 * 60))}h`);
    console.log('\n   To start working:');
    console.log(`   cd ~/Projects/nightly-build && node cli.js working ${nextTask.id}`);
    console.log(`   cd ~/Projects/nightly-build && node cli.js complete ${nextTask.id} "notes"`);
  } else {
    console.log('\n✨ No pending tasks! Create one:');
    console.log('   node cli.js add "New task description" --priority=high');
  }
  
  // Log this heartbeat
  manager.recordHeartbeat({
    taskId: null,
    description: 'heartbeat_check_completed'
  });
  
  console.log('\n═══════════════════════════════════════════\n');
  
  // Generate report if requested
  if (shouldReport) {
    const report = manager.generateMorningReport();
    console.log('📋 Mini Report:');
    console.log(`   Tasks done: ${report.summary.tasksCompleted}`);
    console.log(`   Next up: ${report.nextRecommendedTask || 'Nothing!'}`);
  }
}

runHeartbeatCheck().catch(err => {
  console.error('Error during heartbeat check:', err);
  process.exit(1);
});
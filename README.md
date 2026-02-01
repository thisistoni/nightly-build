# Nightly Build System

Task management for agent heartbeats. Ensures productive work during free time.

## Usage

```bash
# Add a task
node cli.js add "Refactor memory system" --priority=high

# List pending tasks
node cli.js list

# Complete a task
node cli.js complete <task-id>

# Generate heartbeat report
node cli.js heartbeat

# Generate morning report
node cli.js morning-report
```

## Config

Edit `config.json` to set morning report time and anti-slacking thresholds.

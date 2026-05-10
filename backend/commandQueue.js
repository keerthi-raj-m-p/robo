/**
 * Command Queue - Keeps only the latest movement command to prevent flooding.
 * Action commands (gripper, home, zero) are always forwarded immediately.
 */

class CommandQueue {
  constructor() {
    this.latestMoveCommand = null;
    this.actionQueue = [];
    this.lastSendTime = 0;
    this.minInterval = 50; // 20Hz max send rate
  }

  /**
   * Enqueue a command. Movement commands overwrite previous ones.
   * Action commands are queued for immediate send.
   */
  enqueue(command) {
    if (!command || !command.type) return;

    // Action commands always go through
    if (['gripper', 'home', 'zero', 'command', 'hello'].includes(command.type)) {
      this.actionQueue.push(command);
      return;
    }

    // Movement commands - keep only latest
    if (command.type === 'move') {
      this.latestMoveCommand = command;
      return;
    }

    // Speed changes
    if (command.type === 'speed') {
      this.latestMoveCommand = command;
      return;
    }
  }

  /**
   * Dequeue the next command to send.
   * Priority: action commands first, then latest movement.
   * Respects minimum interval between sends.
   */
  dequeue() {
    const now = Date.now();

    // Action commands have priority and bypass rate limiting
    if (this.actionQueue.length > 0) {
      this.lastSendTime = now;
      return this.actionQueue.shift();
    }

    // Rate-limit movement commands
    if (this.latestMoveCommand && (now - this.lastSendTime) >= this.minInterval) {
      const cmd = this.latestMoveCommand;
      this.latestMoveCommand = null;
      this.lastSendTime = now;
      return cmd;
    }

    return null;
  }

  /**
   * Check if there are pending commands
   */
  hasPending() {
    return this.actionQueue.length > 0 || this.latestMoveCommand !== null;
  }

  /**
   * Clear all pending commands
   */
  clear() {
    this.latestMoveCommand = null;
    this.actionQueue = [];
  }
}

module.exports = CommandQueue;

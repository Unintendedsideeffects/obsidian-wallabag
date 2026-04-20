import WallabagPlugin from 'main';

export class TimerWatcher {
  private timerId?: number;

  constructor(private readonly plugin: WallabagPlugin) {}

  start(): void {
    this.restart();
  }

  restart(): void {
    this.stop();
    const s = this.plugin.settings.timer;
    if (!s.enabled) {
      return;
    }
    const ms = Math.max(1, s.intervalMinutes) * 60 * 1000;
    this.timerId = window.setInterval(() => {
      void this.plugin.syncEngine.pull();
    }, ms);
  }

  stop(): void {
    if (this.timerId !== undefined) {
      window.clearInterval(this.timerId);
      this.timerId = undefined;
    }
  }
}

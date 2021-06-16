/**
 * My custom logger
 * @param debug boolean
 */
export default class Logger {
  debug: boolean;

  constructor(debug: boolean) {
    this.debug = debug;
  }

  /**
   * log with time and check for debug
   * @param  {...*} args
   */
  log(...args: any[]) {
    if (!this.debug) return;

    const t = new Date();
    console.log(`[${t.getHours()}:${t.getMinutes()}:${t.getSeconds()}]`, ...args);
  }
}

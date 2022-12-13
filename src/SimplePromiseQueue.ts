export default class SimplePromiseQueue {
  _queue = [] as Array<(...a: any) => Promise<any>>
  _flushing = false

  enqueue (promise: (...a: any) => Promise<any>) {
    this._queue.push(promise)
    if (!this._flushing) { return this._flushQueue() }
    return Promise.resolve()
  }

  _flushQueue () {
    this._flushing = true

    const chain = (): Promise<any> | void => {
      const nextTask = this._queue.shift()
      if (nextTask) {
        return nextTask().then(chain)
      } else {
        this._flushing = false
      }
    }

    return Promise.resolve(chain())
  }
}

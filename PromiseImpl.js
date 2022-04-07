// Promise Implementing
// see: https://promisesaplus.com/
// see: http://malcolmyu.github.io/malnote/2015/06/12/Promises-A-Plus/

const STATUS_PENDING = 'pending'
const STATUS_FULFILLED = 'fulfilled'
const STATUS_REJECTED = 'rejected'

const invokeArrayFns = (fns, arg) => {
  for (let i = 0; i < fns.length; i++) {
    fns[i](arg)
  }
}

// 判断是否为可迭代对象
// see: https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Iteration_protocols
const isIterable = value => !!value && typeof value[Symbol.iterator] === 'function'

// 2.3 The Promise Resolution Procedure
// Promise 解决过程
const promiseResolutionProcedure = (promise, x, resolve, reject) => {
  // 2.3.1 If `promise` and `x` refer to the same object, reject `promise` with a `TypeError` as the reason
  // 如果 `promise` 和 `x` 指向同一对象，以 `TypeError` 为据因拒绝执行 `promise`
  if (promise === x) {
    return reject(new TypeError('`promise` and `x` refer to the same object, see: https://promisesaplus.com/#point-48'))
  }

  // 2.3.2 If `x` is a promise, adopt its state:
  //   2.3.2.1 If `x` is pending, `promise` must remain pending until `x` is fulfilled or rejected.
  //   2.3.2.2 If/when `x` is fulfilled, fulfill `promise` with the same value.
  //   2.3.2.3 If/when `x` is rejected, reject `promise` with the same reason.
  // 如果 `x` 是一个 promise，则需要递归执行
  if (x instanceof PromiseImpl) {
    return x.then(
      value => promiseResolutionProcedure(promise, value, resolve, reject),
      reason => reject(reason)
    )
  }

  let called = false

  if ((x !== null && typeof x === 'object') || typeof x === 'function') {
    // 2.3.3 Otherwise, if x is an object or function
    try {
      // 2.3.3.1 Let `then` be `x.then`
      let then = x.then

      if (typeof then === 'function') {
        // 2.3.3.3 If `then` is a function, call it with `x` as `this`,
        // first argument `resolvePromise`, and second argument `rejectPromise`
        // 如果 `then` 是函数，则将 `x` 作为 `then` 作用域，并调用 `then`，
        // 传递两个回调函数作为参数，第一个参数叫做 `resolvePromise` ，第二个参数叫做 `rejectPromise`
        then.call(
          // call it with `x` as `this`
          x,

          // `resolvePromise`
          // 2.3.3.3.1 If/when `resolvePromise` is called with a value `y`, run `[[Resolve]](promise, y)`.
          // 如果 `resolvePromise` 以值 `y` 为参数被调用，则运行 `[[Resolve]](promise, y)`
          // 注：递归调用 `promiseResolutionProcedure`，因为 `Promise` 中可以嵌套 `Promise`
          y => {
            // 2.3.3.3.3 If both `resolvePromise` and `rejectPromise` are called, or multiple calls to the same argument are made,
            // the first call takes precedence, and any further calls are ignored.
            // 如果 `resolvePromise` 和 `rejectPromise` 均被调用，或者被同一参数调用了多次，
            // 则优先采用首次调用并忽略剩下的调用
            if (called) {
              return
            }
            // `resolvePromise` 被调用时设置为 true
            called = true

            promiseResolutionProcedure(promise, y, resolve, reject)
          },

          // `rejectPromise`
          // 2.3.3.3.2 If/when `rejectPromise` is called with a reason `r`, reject `promise` with `r`
          // 如果 `rejectPromise` 以据因 `r` 为参数被调用，则以据因 `r` 拒绝 `promise`
          r => {
            // 2.3.3.3.3
            if (called) {
              return
            }
            // `rejectPromise` 被调用时设置为 true
            called = true

            reject(r)
          }
        )
      } else {
        // 2.3.3.4 If `then` is not a function, fulfill `promise` with `x`
        resolve(x)
      }
    } catch (e) {
      // 2.3.3.3.3
      if (called) {
        return
      }
      called = true

      // 2.3.3.2 If retrieving the property `x.then` results in a thrown exception `e`,
      // reject `promise` with `e` as the reason.
      // 如果取 `x.then` 的值时抛出错误 `e` ，则以 `e` 为据因拒绝 `promise`

      // 2.3.3.3.4 If calling `then` throws an exception `e`
      //   2.3.3.3.4.1 If `resolvePromise` or `rejectPromise` have been called, ignore it
      //   2.3.3.3.4.2 Otherwise, reject `promise` with `e` as the reason

      reject(e)
    }

  } else {
    // 2.3.4 If `x` is not an object or function, fulfill `promise` with `x`
    resolve(x)
  }
}

class PromiseImpl {
  constructor(executor) {
    // `Promise` 当前的状态，初始化时为 `pending`
    this.status = STATUS_PENDING
    // fulfilled 时的值
    this.value = null
    // rejected 时的原因
    this.reason = null
    // 用于存放 `fulfilled` 时的回调，一个 `Promise` 对象可以注册多个 `fulfilled` 回调函数
    this.onFulfilledCbs = []
    // 用于存放 `rejected` 时的回调，一个 `Promise` 对象可以注册多个 `rejected` 回调函数
    this.onRejectedCbs = []
    this._reject = this._rejectFn
    this._resolve = this._resolveFn

    // 2.1.2 When `fulfilled`, a `promise`:
    //  2.1.2.1 must not transition to any other state.
    //  2.1.2.2 must have a value, which must not change.
    const _resolve = value => {
      // 如果 `value` 是 `Promise`（即嵌套 `Promise`），
      // 则需要等待该 `Promise` 执行完成
      if (value instanceof PromiseImpl) {
        return value.then(
          value => _resolve(value),
          reason => _reject(reason)
        )
      }

      if (this.status === STATUS_PENDING) {
        this.status = STATUS_FULFILLED
        this.value = value
        // 2.2.6.1 If/when `promise` is fulfilled, 
        // all respective `onFulfilled` callbacks must execute 
        // in the order of their originating calls to `then`.
        invokeArrayFns(this.onFulfilledCbs, value)
      }
    }

    // 2.1.3 When `rejected`, a `promise`:
    //  2.1.3.1 must not transition to any other state.
    //  2.1.3.2 must have a reason, which must not change.
    const _reject = reason => {
      if (this.status === STATUS_PENDING) {
        this.status = STATUS_REJECTED
        this.reason = reason
        // 2.2.6.2 If/when `promise` is rejected, 
        // all respective `onRejected` callbacks must execute 
        // in the order of their originating calls to `then`.
        invokeArrayFns(this.onRejectedCbs, reason)
      }
    }

    // `new Promise()` 时，需要将 `resolve` 和 `reject` 传给调用者
    // 使用 `trycatch` 将 `executor` 包裹起来，因为这部分是调用者的代码，我们无法保证调用者的代码不会出错。
    try {
      executor(_resolve, _reject)
    } catch (e) {
      _reject(e)
    }
  }

  then(onFulfilled, onRejected) {
    // 2.2.1 Both `onFulfilled` and `onRejected` are optional arguments:
    //   2.2.1.1 If `onFulfilled` is not a function, it must be ignored
    //   2.2.1.2 If `onRejected` is not a function, it must be ignored

    // 2.2.7.3 If `onFulfilled` is not a function and `promise1` is fulfilled, 
    // `promise2` must be fulfilled with the same value as `promise1`.
    onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : value => value
    // 2.2.7.4 If `onRejected` is not a function and `promise1` is rejected, 
    // `promise2` must be rejected with the same reason as `promise1`.
    onRejected = typeof onRejected === 'function' ? onRejected : reason => { throw reason }

    let promise2 = new PromiseImpl((resolve, reject) => {
      // 2.2.2 If `onFulfilled` is a function:
      //   2.2.2.1 it must be called after `promise` is fulfilled, with promise’s value as its first argument.
      //   2.2.2.2 it must not be called before `promise` is fulfilled.
      //   2.2.2.3 it must not be called more than once.
      if (this.status === STATUS_FULFILLED) {
        setTimeout(() => {
          try {
            // 2.2.7.1 If either `onFulfilled` or `onRejected` returns a value `x`, 
            // run the Promise Resolution Procedure `[[Resolve]](promise2, x)`.
            // 如果 `onFulfilled` 或者 `onRejected` 返回一个值 `x` ，
            // 则运行 Promise 解决过程：`[[Resolve]](promise2, x)`。
            // 在这里是指运行 `promiseResolutionProcedure()` 方法
            let x = onFulfilled(this.value)
            promiseResolutionProcedure(promise2, x, resolve, reject)
          } catch (e) {
            // 2.2.7.2 If either `onFulfilled` or `onRejected` throws an exception `e`, 
            // `promise2` must be rejected with `e` as the reason.
            // 如果 `onFulfilled` 或者 `onRejected` 抛出一个异常 `e` ，则 `promise2` 必须拒绝执行，并返回拒因 `e`
            reject(e)
          }
        }, 0)
      }

      // 2.2.3 If onRejected is a function:
      //   2.2.3.1 it must be called after promise is rejected, with promise’s reason as its first argument.
      //   2.2.3.2 it must not be called before promise is rejected.
      //   2.2.3.3 it must not be called more than once.
      if (this.status === STATUS_REJECTED) {
        setTimeout(() => {
          try {
            // 2.2.7.1
            let x = onRejected(this.reason)
            promiseResolutionProcedure(promise2, x, resolve, reject)
          } catch (e) {
            // 2.2.7.2
            reject(e)
          }
        }, 0)
      }

      if (this.status === STATUS_PENDING) {
        this.onFulfilledCbs.push(() => {
          setTimeout(() => {
            try {
              // 2.2.7.1
              let x = onFulfilled(this.value)
              promiseResolutionProcedure(promise2, x, resolve, reject)
            } catch (e) {
              // 2.2.7.2
              reject(e)
            }
          }, 0)
        })

        this.onRejectedCbs.push(() => {
          setTimeout(() => {
            try {
              // 2.2.7.1
              let x = onRejected(this.reason)
              promiseResolutionProcedure(promise2, x, resolve, reject)
            } catch (e) {
              // 2.2.7.2
              reject(e)
            }
          }, 0)
        })
      }
    })

    // 2.2.4 `onFulfilled` or `onRejected` must not be called until the execution context stack contains only platform code.
    // 确保 `onFulfilled` 和 `onRejected `方法异步执行，且应该在 `then` 方法被调用的那一轮事件循环之后的新执行栈中执行。
    // 这里并没有要求必须微任务机制（micro-task）来实现这个事件队列，采用宏任务机制（macro-task）也是可以的。
    // 在上面的代码中，我们采用了宏任务 `setTimeout()` 来实现，这样也是可以通过测试用例的。

    // 2.2.7 `then` must return a promise

    return promise2
  }

  static resolve(value) {
    // 1. 参数是 Promise 对象
    if (value instanceof PromiseImpl) {
      return value
    }

    // 2. 参数是 thenable
    if (value !== null && typeof value === 'object' && typeof value.then === 'function') {
      return new PromiseImpl((resolve, reject) => {
        value.then(
          v => resolve(v),
          e => reject(e)
        )
      })
    }

    // 3. 参数是原始值或不具有 `then()` 方法的对象
    // 4. 参数为空
    return new PromiseImpl((resolve, reject) => resolve(value))
  }

  static reject(reason) {
    return new PromiseImpl((resolve, reject) => reject(reason))
  }

  static all(iterable) {
    if (!isIterable(iterable)) {
      return new TypeError(`TypeError: ${typeof iterable} is not iterable (cannot read property Symbol(Symbol.iterator))`)
    }

    return new PromiseImpl((resolve, reject) => {
      // `fulfilled` 的 Promise 数量
      let fulfilledCount = 0
      // 收集 Promise `fulfilled` 时的值
      const res = []

      // - 填充 `res` 的值
      // - 增加 `fulfilledCount`
      // - 判断所有 `Promise` 是否已经全部成功执行
      const processRes = (index, value) => {
        res[index] = value
        fulfilledCount++
        if (fulfilledCount === iterable.length) {
          resolve(res)
        }
      }

      if (iterable.length === 0) {
        resolve(res)
      } else {
        for (let i = 0; i < iterable.length; i++) {
          const iterator = iterable[i]

          if (iterator && typeof iterator.then === 'function') {
            iterator.then(
              value => processRes(i, value),
              reason => reject(reason)
            )
          } else {
            processRes(i, iterator)
          }
        }
      }
    })
  }

  static race(iterable) {
    if (!isIterable(iterable)) {
      return new TypeError(`TypeError: ${typeof iterable} is not iterable (cannot read property Symbol(Symbol.iterator))`)
    }

    return new PromiseImpl((resolve, reject) => {
      if (iterable.length === 0) {
        return
      } else {
        for (let i = 0; i < iterable.length; i++) {
          const iterator = iterable[i]
          
          if (iterator && typeof iterator.then === 'function') {
            iterator.then(
              value => resolve(value),
              reason => reject(reason)
            )
            return // 使用 `return` 来结束 `for` 循环
          } else {
            resolve(iterator)
            return
          }
        }
      }
    })
  }

  static allSettled(iterable) {
    if (!isIterable(iterable)) {
      return new TypeError(`TypeError: ${typeof iterable} is not iterable (cannot read property Symbol(Symbol.iterator))`)
    }

    const promises = []
    for (const iterator of iterable) {
      promises.push(
        PromiseImpl.resolve(iterator).then(
          value => ({ status: STATUS_FULFILLED, value }),
          reason => ({ status: STATUS_REJECTED, reason })
        )
      )
    }

    return PromiseImpl.all(promises)
  }

  catch(onRejected) {
    return this.then(null, onRejected)
  }

  finally(onFinally) {
    return this.then(
      value => PromiseImpl.resolve(onFinally()).then(() => value), 
      reason => PromiseImpl.resolve(onFinally()).then(() => { throw reason })
    )
  }
}

PromiseImpl.defer = PromiseImpl.deferred = () => {
  const dfd = {}
  dfd.promise = new PromiseImpl((resolve, reject) => {
    dfd.resolve = resolve
    dfd.reject = reject
  })

  return dfd
}

module.exports = PromiseImpl
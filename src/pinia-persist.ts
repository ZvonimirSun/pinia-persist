import type { PiniaPlugin, PiniaPluginContext, StateTree, SubscriptionCallbackMutation } from 'pinia'
import { cloneDeep, debounce, merge } from 'lodash-es'
import localforage from 'localforage'
import SimplePromiseQueue from './SimplePromiseQueue'

declare module 'pinia' {
  export interface DefineStoreOptionsBase<S extends StateTree, Store> {
    persist?: boolean
  }
}

export interface PluginOptions {
  name?: string,
  storeName?: string,
  version?: number,
  debug?: boolean,
  migrate?: (lastVersionStore: LocalForage, localStore:LocalForage) => Promise<boolean>
}

// 队列
const _mutex = new SimplePromiseQueue()

export async function createPiniaPersist (pluginOptions: PluginOptions = ({} as PluginOptions)): Promise<PiniaPlugin> {
  // 应用名称
  const name = pluginOptions.name ?? 'pinia'
  // 库名
  const storeName = pluginOptions.storeName ?? 'keyvaluepairs'
  // 库版本号
  const version = pluginOptions.version ?? 1
  // 日志输出
  const debug = pluginOptions.debug ?? false

  // 设置库
  const localStore = localforage.createInstance({
    name,
    storeName: version !== 1 ? `${storeName}_${version}` : storeName
  })

  const keys = await localStore.keys()
  if (!keys.length) {
    // 升级旧版本库
    if (pluginOptions.migrate && version !== 1) {
      const lastVersionStore = localforage.createInstance({
        name,
        storeName: version - 1 !== 1 ? `${storeName}_${version - 1}` : storeName
      })
      const lastKeys = await lastVersionStore.keys()
      if (lastKeys.length) {
        const res = await pluginOptions.migrate(lastVersionStore, localStore)
        if (res) {
          await localforage.dropInstance({
            name,
            storeName: version - 1 !== 1 ? `${storeName}_${version - 1}` : storeName
          })
        }
      }
    }

    // 设置库版本号
    const storeVersion = await localStore.getItem('version')
    if (storeVersion == null) {
      await localStore.setItem('version', version)
    }
  }

  // 转储到 sessionStorage
  sessionStorage.clear()
  for (const key of keys) {
    const data = await localStore.getItem(key)
    if (data != null) {
      sessionStorage.setItem(key, JSON.stringify(data))
    }
  }

  // 获取state的值
  const getState = (key:string) => {
    const data = sessionStorage.getItem(key)
    if (data != null) {
      return JSON.parse(data)
    } else {
      return null
    }
  }

  // 设置state的值
  const setState = (key: string, state: never) => {
    return localStore.setItem(key, cloneDeep(state))
  }

  return (context: PiniaPluginContext) => {
    const {
      store, options: {
        persist
      }
    } = context
    if (!persist) return

    // 恢复持久化数据
    const data = getState(store.$id)
    store.$patch(merge({}, store.$state, data))

    // 更新数据
    const updateState = debounce(function () {
      _mutex.enqueue(async () => {
        await setState(store.$id, store.$state as never).catch(e => {
          debug && console.log(e)
        })
      })
    }, 100)
    store.$subscribe(
      (
        _mutation: SubscriptionCallbackMutation<StateTree>
      ) => {
        updateState()
      },
      {
        detached: true,
        deep: true
      }
    )
  }
}

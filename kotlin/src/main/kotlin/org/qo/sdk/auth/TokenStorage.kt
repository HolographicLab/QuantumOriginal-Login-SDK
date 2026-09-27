package org.qo.sdk.auth

import java.util.concurrent.ConcurrentHashMap

/** Storage abstraction for API tokens managed by [QoAuthClient]. */
interface TokenStorage {
    /** Returns the value for [key], or `null` when it is not stored. */
    fun get(key: String): String?

    /** Stores [value] under [key]. */
    fun set(key: String, value: String)

    /** Removes the value associated with [key]. */
    fun remove(key: String)

    /** Removes all stored values. */
    fun clear()
}

/** Thread-safe in-memory implementation of [TokenStorage]. */
class MemoryTokenStorage : TokenStorage {
    private val map = ConcurrentHashMap<String, String>()

    override fun get(key: String): String? = map[key]

    override fun set(key: String, value: String) {
        map[key] = value
    }

    override fun remove(key: String) {
        map.remove(key)
    }

    override fun clear() {
        map.clear()
    }
}

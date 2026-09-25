package org.qo.sdk.auth

import java.util.concurrent.ConcurrentHashMap

interface TokenStorage {
    fun get(key: String): String?
    fun set(key: String, value: String)
    fun remove(key: String)
    fun clear()
}

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

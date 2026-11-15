package app.livingdraft.wear

import android.content.Context
import androidx.core.content.edit
import kotlinx.coroutines.flow.MutableStateFlow
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class NotebookError(message: String) : Exception(message)

data class Brief(val id: String, val title: String, val time: String, val feelings: List<String>)

data class Story(val brief: Brief, val speech: String, val summary: String, val people: List<String>)

data class Answer(val lines: List<String>, val sources: List<String>)

object Pairing {
    val paired = MutableStateFlow<Boolean?>(null)
}

class Notebook(context: Context) {
    private val prefs = context.getSharedPreferences("notebook", Context.MODE_PRIVATE)
    private val json = "application/json".toMediaType()

    var address: String
        get() = prefs.getString("address", null) ?: BuildConfig.NOTEBOOK_URL
        private set(value) = prefs.edit { putString("address", value.trim().trimEnd('/')) }

    val paired: Boolean
        get() = prefs.getBoolean("paired", false) && address.isNotBlank()

    private val jar = object : CookieJar {
        override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
            val kept = stored().filter { old -> cookies.none { it.name == old.name } } + cookies
            prefs.edit {
                putString("cookies", JSONArray(kept.map { it.toString() }).toString())
            }
        }

        override fun loadForRequest(url: HttpUrl): List<Cookie> =
            stored().filter { it.matches(url) && it.expiresAt > System.currentTimeMillis() }

        private fun stored(): List<Cookie> {
            val url = address.toHttpUrlOrNull() ?: return emptyList()
            val saved = JSONArray(prefs.getString("cookies", "[]"))
            return (0 until saved.length()).mapNotNull { Cookie.parse(url, saved.getString(it)) }
        }
    }

    private val http = OkHttpClient.Builder()
        .cookieJar(jar)
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(90, TimeUnit.SECONDS)
        .build()

    fun pair(newAddress: String, code: String) {
        val clean = newAddress.trim().trimEnd('/')
        if (!clean.startsWith("http")) throw NotebookError("That address should start with https://")
        address = clean
        prefs.edit { remove("cookies") }
        send("POST", "/api/auth/pair", JSONObject().put("code", code.filter(Char::isDigit)))
        prefs.edit { putBoolean("paired", true) }
        Pairing.paired.value = true
    }

    fun forget() {
        prefs.edit {
            remove("cookies")
            putBoolean("paired", false)
        }
        Pairing.paired.value = false
    }

    fun today(): Pair<String?, Story?> {
        val reply = JSONObject(send("GET", "/api/devices/today"))
        val name = reply.optString("name").ifBlank { null }
        val memory = reply.optJSONObject("memory") ?: return name to null
        return name to story(memory)
    }

    fun recent(): List<Brief> {
        val list = JSONArray(send("GET", "/api/devices/recent"))
        return (0 until list.length()).map { brief(list.getJSONObject(it)) }
    }

    fun memory(id: String): Story = story(JSONObject(send("GET", "/api/devices/memories/$id")))

    fun save(text: String): Pair<String, Boolean> {
        val reply = JSONObject(
            send("POST", "/api/devices/memories", JSONObject().put("text", text).put("source", "watch")),
        )
        return reply.getString("title") to reply.optBoolean("tidying")
    }

    fun ask(question: String): Answer {
        var reply = JSONObject(send("POST", "/api/devices/ask", JSONObject().put("question", question)))
        val job = reply.optString("job")
        if (job.isNotBlank()) {
            val until = System.currentTimeMillis() + 4 * 60_000
            do {
                Thread.sleep(1500)
                reply = JSONObject(send("GET", "/api/devices/ask/$job"))
            } while (reply.optBoolean("working") && System.currentTimeMillis() < until)
            if (reply.optBoolean("working")) throw NotebookError("That's taking a while. Try again in a minute.")
            reply.optString("error").takeIf { it.isNotBlank() }?.let { throw NotebookError(it) }
        }
        return Answer(strings(reply.optJSONArray("lines")), strings(reply.optJSONArray("sources")))
    }

    private fun story(o: JSONObject) = Story(
        brief = brief(o),
        speech = o.optString("speech"),
        summary = o.optString("summary"),
        people = strings(o.optJSONArray("people")),
    )

    private fun brief(o: JSONObject) = Brief(
        id = o.getString("id"),
        title = o.getString("title"),
        time = o.optString("when"),
        feelings = strings(o.optJSONArray("feelings")),
    )

    private fun strings(array: JSONArray?): List<String> =
        if (array == null) emptyList() else (0 until array.length()).map { array.getString(it) }

    private fun send(method: String, path: String, body: JSONObject? = null): String {
        if (address.isBlank()) throw NotebookError("Pair this watch with your notebook first.")
        val request = Request.Builder()
            .url(address + path)
            .header("Accept", "application/json")
            .method(method, body?.toString()?.toRequestBody(json))
            .build()
        val response = try {
            http.newCall(request).execute()
        } catch (error: Exception) {
            throw NotebookError("Couldn't reach your notebook. Check the watch's connection and that the Codespace is running.")
        }
        response.use {
            val text = it.body?.string().orEmpty()
            if (it.code == 401 && !path.startsWith("/api/auth/")) {
                forget()
                throw NotebookError("This watch needs pairing again.")
            }
            if (!it.isSuccessful) {
                val message = runCatching { JSONObject(text).optString("error") }.getOrNull()
                throw NotebookError(message?.ifBlank { null } ?: "Your notebook answered with ${it.code}.")
            }
            return text
        }
    }
}

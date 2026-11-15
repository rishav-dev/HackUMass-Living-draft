package app.livingdraft.wear

import android.app.RemoteInput
import android.content.Intent
import android.os.Bundle
import android.speech.RecognizerIntent
import android.speech.tts.TextToSpeech
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.wear.compose.foundation.lazy.ScalingLazyColumn
import androidx.wear.compose.foundation.lazy.ScalingLazyListScope
import androidx.wear.compose.foundation.lazy.rememberScalingLazyListState
import androidx.wear.compose.material3.AppScaffold
import androidx.wear.compose.material3.Button
import androidx.wear.compose.material3.Card
import androidx.wear.compose.material3.FilledTonalButton
import androidx.wear.compose.material3.Icon
import androidx.wear.compose.material3.ListHeader
import androidx.wear.compose.material3.MaterialTheme
import androidx.wear.compose.material3.ScreenScaffold
import androidx.wear.compose.material3.Text
import androidx.wear.input.RemoteInputIntentHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Locale

private sealed interface Screen {
    data object Home : Screen
    data object Recent : Screen
    data class Memory(val id: String) : Screen
    data class Review(val text: String) : Screen
    data class Saved(val title: String, val tidying: Boolean) : Screen
    data class Answered(val question: String, val answer: Answer) : Screen
    data class Busy(val label: String) : Screen
    data class Problem(val message: String) : Screen
}

class MainActivity : ComponentActivity() {
    private lateinit var notebook: Notebook
    private var voice: TextToSpeech? = null
    private var voiceReady = false
    private var heard: ((String) -> Unit)? = null
    private var typed: ((String) -> Unit)? = null

    private val listen = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        val text = it.data?.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS)?.firstOrNull()
        if (!text.isNullOrBlank()) heard?.invoke(text)
    }
    private val keyboard = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        val data = it.data ?: return@registerForActivityResult
        val text = RemoteInput.getResultsFromIntent(data)?.getCharSequence(INPUT)?.toString()
        if (!text.isNullOrBlank()) typed?.invoke(text.trim())
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        notebook = Notebook(applicationContext)
        Pairing.paired.value = notebook.paired
        voice = TextToSpeech(this) { status ->
            voiceReady = status == TextToSpeech.SUCCESS
            if (voiceReady) voice?.language = Locale.getDefault()
        }
        setContent { MaterialTheme { AppScaffold { App() } } }
    }

    override fun onDestroy() {
        voice?.shutdown()
        super.onDestroy()
    }

    private fun speak(text: String) {
        val engine = voice ?: return
        if (!voiceReady) return
        val limit = TextToSpeech.getMaxSpeechInputLength() - 50
        val pieces = text.split(Regex("(?<=[.!?])\\s+")).fold(mutableListOf<String>()) { acc, sentence ->
            if (acc.isNotEmpty() && acc.last().length + sentence.length < limit) acc[acc.lastIndex] += " $sentence"
            else acc += sentence
            acc
        }
        pieces.forEachIndexed { i, piece ->
            engine.speak(piece, if (i == 0) TextToSpeech.QUEUE_FLUSH else TextToSpeech.QUEUE_ADD, null, "p$i")
        }
    }

    private fun hush() {
        voice?.stop()
    }

    private fun askVoice(prompt: String, then: (String) -> Unit) {
        heard = then
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            .putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            .putExtra(RecognizerIntent.EXTRA_PROMPT, prompt)
        runCatching { listen.launch(intent) }.onFailure { askTyping(prompt, then) }
    }

    private fun askTyping(label: String, then: (String) -> Unit) {
        typed = then
        val intent = RemoteInputIntentHelper.createActionRemoteInputIntent()
        RemoteInputIntentHelper.putRemoteInputsExtra(
            intent,
            listOf(RemoteInput.Builder(INPUT).setLabel(label).build()),
        )
        runCatching { keyboard.launch(intent) }
    }

    @Composable
    private fun App() {
        val paired by Pairing.paired.collectAsState()
        if (paired != true) PairScreen() else NotebookScreen()
    }

    @Composable
    private fun PairScreen() {
        val scope = rememberCoroutineScope()
        var status by remember { mutableStateOf<String?>(null) }
        Page {
            item { ListHeader { Text("The Living Draft") } }
            item {
                Text(
                    "On your phone, open Settings, then Connect a watch. The code comes straight here.",
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(horizontal = 8.dp),
                )
            }
            status?.let { message -> item { Text(message, color = Accent, textAlign = TextAlign.Center) } }
            item {
                FilledTonalButton(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = {
                        val pairWith = { address: String ->
                            askTyping("Pairing code") { code ->
                                status = "Pairing…"
                                scope.launch {
                                    status = runCatching {
                                        withContext(Dispatchers.IO) { notebook.pair(address, code) }
                                    }.exceptionOrNull()?.message
                                }
                            }
                        }
                        if (notebook.address.isBlank()) askTyping("Notebook address", pairWith)
                        else pairWith(notebook.address)
                    },
                    label = { Text("Type the code") },
                )
            }
            if (notebook.address.isNotBlank())
                item {
                    Text(
                        notebook.address.removePrefix("https://"),
                        style = MaterialTheme.typography.labelSmall,
                        textAlign = TextAlign.Center,
                    )
                }
        }
    }

    @Composable
    private fun NotebookScreen() {
        val scope = rememberCoroutineScope()
        var screen by remember { mutableStateOf<Screen>(Screen.Home) }
        var back by remember { mutableStateOf<List<Screen>>(emptyList()) }
        val go = { next: Screen ->
            if (screen !is Screen.Busy) back = back + screen
            screen = next
        }
        val home = {
            hush()
            back = emptyList()
            screen = Screen.Home
        }
        val run = { label: String, work: () -> Screen ->
            go(Screen.Busy(label))
            scope.launch {
                screen = runCatching { withContext(Dispatchers.IO) { work() } }
                    .getOrElse { Screen.Problem(it.message ?: "Something went wrong.") }
            }
        }
        BackHandler(enabled = screen != Screen.Home) {
            hush()
            screen = back.lastOrNull() ?: Screen.Home
            back = back.dropLast(1)
        }

        when (val now = screen) {
            Screen.Home -> Home(
                open = { go(Screen.Memory(it)) },
                record = {
                    askVoice("What do you remember?") { go(Screen.Review(it)) }
                },
                ask = {
                    askVoice("Ask about your life") { question ->
                        run("Thinking…") { Screen.Answered(question, notebook.ask(question)) }
                    }
                },
                recent = { go(Screen.Recent) },
            )
            Screen.Recent -> Recent(open = { go(Screen.Memory(it)) })
            is Screen.Memory -> Memory(now.id)
            is Screen.Review -> Page {
                item { ListHeader { Text("Save this?") } }
                item { Text(now.text, modifier = Modifier.padding(horizontal = 6.dp)) }
                item {
                    Button(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = {
                            run("Saving…") {
                                val (title, tidying) = notebook.save(now.text)
                                Screen.Saved(title, tidying)
                            }
                        },
                        icon = { Icon(painterResource(R.drawable.ic_check), contentDescription = null) },
                        label = { Text("Save it") },
                    )
                }
                item {
                    FilledTonalButton(
                        modifier = Modifier.fillMaxWidth(),
                        onClick = { askVoice("Say it again") { screen = Screen.Review(it) } },
                        icon = { Icon(painterResource(R.drawable.ic_mic), contentDescription = null) },
                        label = { Text("Say it again") },
                    )
                }
            }
            is Screen.Saved -> Page {
                item { ListHeader { Text("Saved") } }
                item { Text(now.title, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center) }
                item {
                    Text(
                        if (now.tidying) "It's being written up now. Open it on your phone in a minute."
                        else "It's in your notebook. Open it on your phone to add more.",
                        textAlign = TextAlign.Center,
                    )
                }
                item { Button(modifier = Modifier.fillMaxWidth(), onClick = home, label = { Text("Done") }) }
            }
            is Screen.Answered -> Page {
                item { ListHeader { Text(now.question) } }
                now.answer.lines.forEach { line -> item { Text(line, modifier = Modifier.padding(horizontal = 6.dp)) } }
                if (now.answer.sources.isNotEmpty())
                    item {
                        Text(
                            "From: " + now.answer.sources.joinToString(", "),
                            style = MaterialTheme.typography.labelSmall,
                            color = Accent,
                        )
                    }
                item { Listen(now.answer.lines.joinToString(" ")) }
                item { FilledTonalButton(modifier = Modifier.fillMaxWidth(), onClick = home, label = { Text("Done") }) }
            }
            is Screen.Busy -> Page {
                item { Text(now.label, style = MaterialTheme.typography.titleMedium, textAlign = TextAlign.Center) }
            }
            is Screen.Problem -> Page {
                item { ListHeader { Text("Hmm") } }
                item { Text(now.message, textAlign = TextAlign.Center) }
                item { FilledTonalButton(modifier = Modifier.fillMaxWidth(), onClick = home, label = { Text("Back") }) }
            }
        }
    }

    @Composable
    private fun Home(open: (String) -> Unit, record: () -> Unit, ask: () -> Unit, recent: () -> Unit) {
        var name by remember { mutableStateOf<String?>(null) }
        var today by remember { mutableStateOf<Story?>(null) }
        var problem by remember { mutableStateOf<String?>(null) }
        var loaded by remember { mutableStateOf(false) }
        LaunchedEffect(Unit) {
            runCatching { withContext(Dispatchers.IO) { notebook.today() } }
                .onSuccess { (who, story) ->
                    name = who
                    today = story
                }
                .onFailure { problem = it.message }
            loaded = true
        }
        Page {
            item { ListHeader { Text(name?.let { "Hi, $it" } ?: "Your notebook") } }
            when {
                problem != null -> item { Text(problem!!, color = Accent, textAlign = TextAlign.Center) }
                !loaded -> item { Text("Opening…", textAlign = TextAlign.Center) }
                today == null -> item { Text("No memories yet. Say one!", textAlign = TextAlign.Center) }
                else -> item {
                    val story = today!!
                    Card(modifier = Modifier.fillMaxWidth(), onClick = { open(story.brief.id) }) {
                        Text("A memory for today", style = MaterialTheme.typography.labelSmall, color = Accent)
                        Text(story.brief.title, style = MaterialTheme.typography.titleMedium)
                        Text(story.brief.time, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
            item {
                Button(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = record,
                    icon = { Icon(painterResource(R.drawable.ic_mic), contentDescription = null) },
                    label = { Text("Remember something") },
                )
            }
            item {
                FilledTonalButton(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = ask,
                    icon = { Icon(painterResource(R.drawable.ic_ask), contentDescription = null) },
                    label = { Text("Ask about my life") },
                )
            }
            item {
                FilledTonalButton(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = recent,
                    icon = { Icon(painterResource(R.drawable.ic_list), contentDescription = null) },
                    label = { Text("Recent memories") },
                )
            }
            item {
                FilledTonalButton(
                    modifier = Modifier.fillMaxWidth(),
                    onClick = { notebook.forget() },
                    label = { Text("Unpair this watch") },
                )
            }
        }
    }

    @Composable
    private fun Recent(open: (String) -> Unit) {
        var list by remember { mutableStateOf<List<Brief>?>(null) }
        var problem by remember { mutableStateOf<String?>(null) }
        LaunchedEffect(Unit) {
            runCatching { withContext(Dispatchers.IO) { notebook.recent() } }
                .onSuccess { list = it }
                .onFailure { problem = it.message }
        }
        Page {
            item { ListHeader { Text("Recent") } }
            problem?.let { message -> item { Text(message, color = Accent, textAlign = TextAlign.Center) } }
            list?.forEach { brief ->
                item {
                    Card(modifier = Modifier.fillMaxWidth(), onClick = { open(brief.id) }) {
                        Text(brief.title, style = MaterialTheme.typography.titleSmall)
                        Text(brief.time, style = MaterialTheme.typography.labelSmall)
                    }
                }
            }
        }
    }

    @Composable
    private fun Memory(id: String) {
        var story by remember { mutableStateOf<Story?>(null) }
        var problem by remember { mutableStateOf<String?>(null) }
        LaunchedEffect(id) {
            runCatching { withContext(Dispatchers.IO) { notebook.memory(id) } }
                .onSuccess { story = it }
                .onFailure { problem = it.message }
        }
        Page {
            val shown = story
            when {
                problem != null -> item { Text(problem!!, color = Accent, textAlign = TextAlign.Center) }
                shown == null -> item { Text("Opening…") }
                else -> {
                    item { ListHeader { Text(shown.brief.title) } }
                    item { Text(shown.brief.time, style = MaterialTheme.typography.labelSmall, color = Accent) }
                    item { Listen(shown.speech) }
                    item { Text(shown.summary, modifier = Modifier.padding(horizontal = 6.dp)) }
                    if (shown.brief.feelings.isNotEmpty())
                        item {
                            Text(
                                "Felt " + shown.brief.feelings.joinToString(", "),
                                style = MaterialTheme.typography.labelSmall,
                            )
                        }
                    if (shown.people.isNotEmpty())
                        item {
                            Text(
                                "With " + shown.people.joinToString(", "),
                                style = MaterialTheme.typography.labelSmall,
                            )
                        }
                }
            }
        }
    }

    @Composable
    private fun Listen(text: String) {
        var playing by remember { mutableStateOf(false) }
        Button(
            modifier = Modifier.fillMaxWidth(),
            onClick = {
                if (playing) hush() else speak(text)
                playing = !playing
            },
            icon = {
                Icon(
                    painterResource(if (playing) R.drawable.ic_stop else R.drawable.ic_play),
                    contentDescription = null,
                )
            },
            label = { Text(if (playing) "Stop" else "Listen") },
        )
    }

    @Composable
    private fun Page(content: ScalingLazyListScope.() -> Unit) {
        val state = rememberScalingLazyListState()
        ScreenScaffold(scrollState = state) { padding ->
            ScalingLazyColumn(
                state = state,
                contentPadding = padding,
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(6.dp),
                content = content,
            )
        }
    }

    private companion object {
        const val INPUT = "input"
        val Accent = Color(0xFFE9B8FF)
    }
}

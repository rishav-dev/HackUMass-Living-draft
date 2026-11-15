package app.livingdraft.phone

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.webkit.CookieManager
import android.webkit.GeolocationPermissions
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.addCallback
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.core.content.edit
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.google.android.gms.tasks.Tasks
import com.google.android.gms.wearable.Wearable
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class MainActivity : ComponentActivity() {
    private var web: WebView? = null
    private var pendingRequest: PermissionRequest? = null
    private var pendingFiles: ValueCallback<Array<Uri>>? = null
    private var pendingPlace: Pair<String, GeolocationPermissions.Callback>? = null
    private val speech: SpeechBridge by lazy {
        SpeechBridge(this, { web }) { askMic.launch(Manifest.permission.RECORD_AUDIO) }
    }

    private val askMic = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        pendingRequest?.let { if (granted) it.grant(it.resources) else it.deny() }
        pendingRequest = null
        speech.onPermission(granted)
    }
    private val askPlace =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { result ->
            val (origin, callback) = pendingPlace ?: return@registerForActivityResult
            callback.invoke(origin, result.values.any { it }, false)
            pendingPlace = null
        }
    private val pickFiles =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            pendingFiles?.onReceiveValue(
                WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data),
            )
            pendingFiles = null
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        val prefs = getSharedPreferences("notebook", MODE_PRIVATE)
        setContent {
            var address by remember {
                mutableStateOf(prefs.getString("address", null) ?: BuildConfig.NOTEBOOK_URL)
            }
            var editing by remember { mutableStateOf(address.isBlank()) }
            var problem by remember { mutableStateOf<String?>(null) }
            MaterialTheme(colorScheme = darkColorScheme(background = Color(0xFF0B0910))) {
                when {
                    editing -> Setup(address) { chosen ->
                        prefs.edit { putString("address", chosen) }
                        address = chosen
                        problem = null
                        editing = false
                    }
                    problem != null -> Trouble(
                        problem!!,
                        retry = { problem = null },
                        change = { editing = true },
                    )
                    else -> AndroidView(
                        modifier = Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.systemBars),
                        factory = { context -> notebook(context, address) { problem = it } },
                    )
                }
            }
        }
        onBackPressedDispatcher.addCallback(this) {
            if (web?.canGoBack() == true) web?.goBack() else finish()
        }
    }

    override fun onPause() {
        super.onPause()
        CookieManager.getInstance().flush()
    }

    override fun onDestroy() {
        speech.release()
        super.onDestroy()
    }

    private fun has(permission: String) =
        ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

    @SuppressLint("SetJavaScriptEnabled")
    private fun notebook(context: Context, address: String, onProblem: (String) -> Unit): WebView {
        val view = WebView(context)
        web = view
        view.setBackgroundColor(0xFF0B0910.toInt())
        view.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            setGeolocationEnabled(true)
            userAgentString = "$userAgentString LivingDraftAndroid/1"
        }
        CookieManager.getInstance().setAcceptCookie(true)
        view.addJavascriptInterface(speech, "LivingDraftSpeech")
        view.addJavascriptInterface(WatchLink(applicationContext), "LivingDraftAndroid")
        val script = assets.open("speech.js").bufferedReader().use { it.readText() }
        val early = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)
        if (early) WebViewCompat.addDocumentStartJavaScript(view, script, setOf("*"))
        val home = Uri.parse(address)
        view.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(v: WebView, request: WebResourceRequest): Boolean {
                if (request.url.host == home.host) return false
                startActivity(Intent(Intent.ACTION_VIEW, request.url))
                return true
            }

            override fun onPageFinished(v: WebView, url: String?) {
                if (!early) v.evaluateJavascript(script, null)
            }

            override fun onReceivedError(v: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame)
                    onProblem("Couldn't open the notebook: ${error.description}. Is the Codespace running, with port 4317 set to public?")
            }
        }
        view.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    if (PermissionRequest.RESOURCE_AUDIO_CAPTURE !in request.resources) request.deny()
                    else if (has(Manifest.permission.RECORD_AUDIO))
                        request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                    else {
                        pendingRequest = request
                        askMic.launch(Manifest.permission.RECORD_AUDIO)
                    }
                }
            }

            override fun onShowFileChooser(
                v: WebView,
                callback: ValueCallback<Array<Uri>>,
                params: FileChooserParams,
            ): Boolean {
                pendingFiles?.onReceiveValue(null)
                pendingFiles = callback
                return runCatching { pickFiles.launch(params.createIntent()) }.isSuccess.also {
                    if (!it) pendingFiles = null
                }
            }

            override fun onGeolocationPermissionsShowPrompt(
                origin: String,
                callback: GeolocationPermissions.Callback,
            ) {
                if (has(Manifest.permission.ACCESS_COARSE_LOCATION)) callback.invoke(origin, true, false)
                else {
                    pendingPlace = origin to callback
                    askPlace.launch(
                        arrayOf(Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.ACCESS_FINE_LOCATION),
                    )
                }
            }
        }
        view.loadUrl(address)
        return view
    }
}

@Composable
private fun Setup(start: String, open: (String) -> Unit) {
    var address by remember { mutableStateOf(start) }
    val valid = address.trim().startsWith("http")
    Column(
        Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.systemBars).padding(28.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text("Open your notebook", style = MaterialTheme.typography.headlineMedium, color = Color.White)
        Spacer(Modifier.height(12.dp))
        Text(
            "Paste the address of your notebook. For a Codespace it ends in -4317.app.github.dev, and port 4317 needs to be public.",
            color = Color(0xFFC9C0D8),
        )
        Spacer(Modifier.height(20.dp))
        OutlinedTextField(
            value = address,
            onValueChange = { address = it },
            label = { Text("Notebook address") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(16.dp))
        Button(enabled = valid, onClick = { open(address.trim().trimEnd('/')) }) { Text("Open") }
    }
}

@Composable
private fun Trouble(message: String, retry: () -> Unit, change: () -> Unit) {
    Column(
        Modifier.fillMaxSize().windowInsetsPadding(WindowInsets.systemBars).padding(28.dp),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(message, color = Color.White)
        Spacer(Modifier.height(16.dp))
        Button(onClick = retry) { Text("Try again") }
        TextButton(onClick = change) { Text("Change the address") }
    }
}

class SpeechBridge(
    private val activity: ComponentActivity,
    private val web: () -> WebView?,
    private val askMic: () -> Unit,
) {
    private val main = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null
    private var waiting: Pair<String, Boolean>? = null

    @JavascriptInterface
    fun start(lang: String, interim: Boolean) {
        main.post { begin(lang, interim) }
    }

    @JavascriptInterface
    fun stop() {
        main.post { recognizer?.stopListening() }
    }

    @JavascriptInterface
    fun cancel() {
        main.post {
            recognizer?.cancel()
            emit("end()")
        }
    }

    fun onPermission(granted: Boolean) {
        val (lang, interim) = waiting ?: return
        waiting = null
        if (granted) begin(lang, interim)
        else {
            emit("error('not-allowed')")
            emit("end()")
        }
    }

    fun release() {
        recognizer?.destroy()
        recognizer = null
    }

    private fun begin(lang: String, interim: Boolean) {
        if (ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            waiting = lang to interim
            askMic()
            return
        }
        if (!SpeechRecognizer.isRecognitionAvailable(activity)) {
            emit("error('service-not-allowed')")
            emit("end()")
            return
        }
        val active = recognizer ?: SpeechRecognizer.createSpeechRecognizer(activity).also { recognizer = it }
        active.setRecognitionListener(object : RecognitionListener {
            override fun onPartialResults(results: Bundle) {
                first(results)?.let { emit("partial(${JSONObject.quote(it)})") }
            }

            override fun onResults(results: Bundle) {
                first(results)?.let { emit("final(${JSONObject.quote(it)})") }
                emit("end()")
            }

            override fun onError(error: Int) {
                emit("error('${errorName(error)}')")
                emit("end()")
            }

            override fun onReadyForSpeech(params: Bundle?) = Unit
            override fun onBeginningOfSpeech() = Unit
            override fun onRmsChanged(rmsdB: Float) = Unit
            override fun onBufferReceived(buffer: ByteArray?) = Unit
            override fun onEndOfSpeech() = Unit
            override fun onEvent(eventType: Int, params: Bundle?) = Unit
        })
        active.startListening(
            Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                putExtra(RecognizerIntent.EXTRA_LANGUAGE, lang)
                putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, interim)
            },
        )
    }

    private fun first(results: Bundle) =
        results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull()?.takeIf { it.isNotBlank() }

    private fun errorName(code: Int) = when (code) {
        SpeechRecognizer.ERROR_NO_MATCH, SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "no-speech"
        SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "network"
        SpeechRecognizer.ERROR_AUDIO -> "audio-capture"
        SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "not-allowed"
        else -> "aborted"
    }

    private fun emit(call: String) {
        main.post { web()?.evaluateJavascript("window.__ldSpeech && window.__ldSpeech.$call", null) }
    }
}

class WatchLink(private val context: Context) {
    @JavascriptInterface
    fun sendToWatch(address: String, code: String) {
        Thread {
            val payload = JSONObject().put("address", address).put("code", code).toString().toByteArray()
            val nodes = runCatching {
                Tasks.await(Wearable.getNodeClient(context).connectedNodes, 10, TimeUnit.SECONDS)
            }.getOrDefault(emptyList())
            val sent = nodes.count { node ->
                runCatching {
                    Tasks.await(
                        Wearable.getMessageClient(context).sendMessage(node.id, "/living-draft/pair", payload),
                        10,
                        TimeUnit.SECONDS,
                    )
                }.isSuccess
            }
            Handler(Looper.getMainLooper()).post {
                Toast.makeText(
                    context,
                    if (sent > 0) "Sent to your watch" else "No watch found. Enter the code on the watch instead.",
                    Toast.LENGTH_LONG,
                ).show()
            }
        }.start()
    }
}

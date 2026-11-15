package app.livingdraft.wear

import com.google.android.gms.wearable.MessageEvent
import com.google.android.gms.wearable.WearableListenerService
import org.json.JSONObject

class PairListener : WearableListenerService() {
    override fun onMessageReceived(event: MessageEvent) {
        if (event.path != "/living-draft/pair") return
        val message = runCatching { JSONObject(String(event.data)) }.getOrNull() ?: return
        runCatching {
            Notebook(applicationContext).pair(message.getString("address"), message.getString("code"))
        }
    }
}

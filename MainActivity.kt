package com.spatialos.cardboard

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.graphics.Color
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import android.view.Surface
import android.view.View
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.ByteArrayInputStream
import kotlin.math.abs
import kotlin.math.sqrt

class MainActivity : Activity(), SensorEventListener {

    private val host = "appassets.androidplatform.net"
    private lateinit var web: WebView
    private lateinit var sm: SensorManager
    private var rotSensor: Sensor? = null
    private var magSensor: Sensor? = null

    private val rIn = FloatArray(9)
    private val rOut = FloatArray(9)
    @Volatile private var pose: String = ""

    // magnet button (Cardboard v1)
    @Volatile private var clicks = 0
    @Volatile private var magThreshold = 45.0f
    private var magBase = 0f
    private var magInit = false
    private var magActive = false
    private var magStartMs = 0L
    private var lastClickMs = 0L
    private var lastBackMs = 0L
    private var pageLoaded = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        if (Build.VERSION.SDK_INT >= 28) {
            val lp = window.attributes
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            window.attributes = lp
        }
        hideSystemUi()

        sm = getSystemService(SENSOR_SERVICE) as SensorManager
        rotSensor = sm.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR)
            ?: sm.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR)
        magSensor = sm.getDefaultSensor(Sensor.TYPE_MAGNETIC_FIELD)

        web = WebView(this)
        web.setBackgroundColor(Color.BLACK)
        web.overScrollMode = View.OVER_SCROLL_NEVER
        web.isVerticalScrollBarEnabled = false
        web.isHorizontalScrollBarEnabled = false
        setContentView(web)

        val s = web.settings
        s.javaScriptEnabled = true
        s.domStorageEnabled = true
        s.mediaPlaybackRequiresUserGesture = false
        s.allowFileAccess = false
        s.allowContentAccess = false
        s.cacheMode = WebSettings.LOAD_NO_CACHE
        WebView.setWebContentsDebuggingEnabled(true)

        web.addJavascriptInterface(Bridge(), "NativeBridge")
        web.webViewClient = object : WebViewClient() {
            override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? {
                return serve(request)
            }
        }
        web.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val camOk = checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                    val wanted = request.resources.filter {
                        it == PermissionRequest.RESOURCE_VIDEO_CAPTURE && camOk
                    }.toTypedArray()
                    if (wanted.isNotEmpty()) request.grant(wanted) else request.deny()
                }
            }
        }

        if (Build.VERSION.SDK_INT >= 23 &&
            checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.CAMERA), 7)
        } else {
            loadApp()
        }
    }

    private fun loadApp() {
        if (pageLoaded) return
        pageLoaded = true
        web.loadUrl("https://$host/index.html")
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        loadApp()
    }

    private fun mimeOf(path: String): String {
        val p = path.lowercase()
        return when {
            p.endsWith(".html") -> "text/html"
            p.endsWith(".js") || p.endsWith(".mjs") -> "text/javascript"
            p.endsWith(".css") -> "text/css"
            p.endsWith(".json") -> "application/json"
            p.endsWith(".wasm") -> "application/wasm"
            p.endsWith(".png") -> "image/png"
            p.endsWith(".jpg") || p.endsWith(".jpeg") -> "image/jpeg"
            else -> "application/octet-stream"
        }
    }

    private fun serve(request: WebResourceRequest): WebResourceResponse? {
        val uri = request.url
        val headers = HashMap<String, String>()
        headers["Access-Control-Allow-Origin"] = "*"
        headers["Cache-Control"] = "no-store"
        if (uri.host != host) {
            // nothing should leave the device
            return WebResourceResponse("text/plain", "utf-8", 403, "Forbidden", headers, ByteArrayInputStream(ByteArray(0)))
        }
        var path = uri.path ?: "/"
        if (path == "/" || path.isEmpty()) path = "/index.html"
        val name = path.trimStart('/')
        return try {
            val stream = assets.open(name)
            val mime = mimeOf(name)
            val enc = if (mime.startsWith("text/") || mime == "application/json") "utf-8" else null
            WebResourceResponse(mime, enc, 200, "OK", headers, stream)
        } catch (e: Exception) {
            WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers, ByteArrayInputStream(ByteArray(0)))
        }
    }

    inner class Bridge {
        @JavascriptInterface
        fun pose(): String = this@MainActivity.pose

        @JavascriptInterface
        fun takeClicks(): Int {
            val n = clicks
            clicks = 0
            return n
        }

        @JavascriptInterface
        fun setMagnetThreshold(t: Double) {
            magThreshold = t.toFloat()
        }

        @JavascriptInterface
        fun quit() {
            runOnUiThread { finishAndRemoveTask() }
        }
    }

    // ---- sensors ----
    @Suppress("DEPRECATION")
    private fun displayRotation(): Int = windowManager.defaultDisplay.rotation

    override fun onSensorChanged(event: SensorEvent) {
        when (event.sensor.type) {
            Sensor.TYPE_GAME_ROTATION_VECTOR, Sensor.TYPE_ROTATION_VECTOR -> {
                SensorManager.getRotationMatrixFromVector(rIn, event.values)
                when (displayRotation()) {
                    Surface.ROTATION_90 -> SensorManager.remapCoordinateSystem(rIn, SensorManager.AXIS_Y, SensorManager.AXIS_MINUS_X, rOut)
                    Surface.ROTATION_270 -> SensorManager.remapCoordinateSystem(rIn, SensorManager.AXIS_MINUS_Y, SensorManager.AXIS_X, rOut)
                    Surface.ROTATION_180 -> SensorManager.remapCoordinateSystem(rIn, SensorManager.AXIS_MINUS_X, SensorManager.AXIS_MINUS_Y, rOut)
                    else -> System.arraycopy(rIn, 0, rOut, 0, 9)
                }
                pose = rOut.joinToString(",")
            }
            Sensor.TYPE_MAGNETIC_FIELD -> onMagnet(event)
        }
    }

    private fun onMagnet(event: SensorEvent) {
        val x = event.values[0]
        val y = event.values[1]
        val z = event.values[2]
        val m = sqrt(x * x + y * y + z * z)
        val nowMs = event.timestamp / 1000000L
        if (!magInit) {
            magBase = m
            magInit = true
            return
        }
        val dev = abs(m - magBase)
        if (!magActive) {
            if (dev > magThreshold) {
                magActive = true
                magStartMs = nowMs
            } else {
                magBase += (m - magBase) * 0.02f
            }
        } else {
            if (dev < magThreshold * 0.4f) {
                magActive = false
                val held = nowMs - magStartMs
                if (held >= 40L && held <= 1800L && nowMs - lastClickMs > 250L) {
                    clicks += 1
                    lastClickMs = nowMs
                }
            } else if (nowMs - magStartMs > 2500) {
                magActive = false
                magBase = m
            }
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

    override fun onResume() {
        super.onResume()
        hideSystemUi()
        web.onResume()
        rotSensor?.let { sm.registerListener(this, it, SensorManager.SENSOR_DELAY_FASTEST) }
        magSensor?.let { sm.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
    }

    override fun onPause() {
        sm.unregisterListener(this)
        web.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        web.destroy()
        super.onDestroy()
    }

    // ---- keys: volume = select, back = Home (press twice to leave) ----
    override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
        if (keyCode == KeyEvent.KEYCODE_VOLUME_UP || keyCode == KeyEvent.KEYCODE_VOLUME_DOWN) {
            if (event.repeatCount == 0) web.evaluateJavascript("window.SOS && SOS.click()", null)
            return true
        }
        return super.onKeyDown(keyCode, event)
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        val now = System.currentTimeMillis()
        if (now - lastBackMs < 800) {
            finishAndRemoveTask()
        } else {
            lastBackMs = now
            web.evaluateJavascript("window.SOS && SOS.toggleHome()", null)
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemUi()
    }

    @Suppress("DEPRECATION")
    private fun hideSystemUi() {
        window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                or View.SYSTEM_UI_FLAG_FULLSCREEN
                or View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY)
    }
}

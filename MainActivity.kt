package com.spatialos.cardboard

import android.Manifest
import android.app.Activity
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.ImageFormat
import android.graphics.Rect
import android.graphics.YuvImage
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.vision.core.ImageProcessingOptions
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.handlandmarker.HandLandmarker
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.media.Image
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import android.util.DisplayMetrics
import android.net.Uri
import android.graphics.Color
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import android.util.Base64
import android.view.KeyEvent
import android.view.Surface
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream
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

        setupWeb()
        loadApp()
    }

    private fun setupWeb() {
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

            // If the web engine's process dies, rebuild the view instead of showing a sad face or closing the app.
            override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                window.decorView.post { recreateWeb() }
                return true
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
    }

    private fun recreateWeb() {
        try {
            (web.parent as? ViewGroup)?.removeView(web)
            web.destroy()
        } catch (e: Exception) {
        }
        pageLoaded = false
        setupWeb()
        loadApp()
    }

    private fun loadApp() {
        if (pageLoaded) return
        pageLoaded = true
        web.loadUrl("https://$host/index.html")
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        val ok = grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED
        web.evaluateJavascript("window.SOS && SOS.onCamPerm($ok)", null)
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
        if (path == "/cam.jpg") {
            val b = camJpeg ?: ByteArray(0)
            return WebResourceResponse("image/jpeg", null, 200, "OK", headers, ByteArrayInputStream(b))
        }
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

        @JavascriptInterface
        fun hasCameraPermission(): Boolean =
            checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED

        @JavascriptInterface
        fun requestCameraPermission() {
            runOnUiThread { requestPermissions(arrayOf(Manifest.permission.CAMERA), 7) }
        }

        @JavascriptInterface
        fun startCamera(): Boolean {
            camWanted = true
            return startNativeCamera()
        }

        @JavascriptInterface
        fun stopCamera() {
            camWanted = false
            stopNativeCamera()
        }

        @JavascriptInterface
        fun startHands(): Boolean { handsWanted = true; return startNativeHands() }

        @JavascriptInterface
        fun stopHands() { handsWanted = false; stopNativeHands() }

        @JavascriptInterface
        fun handsStatus(): String = handsState

        @JavascriptInterface
        fun hands(): String = handsOut

        @JavascriptInterface
        fun camStatus(): String = if (camState == "error") "error: $camErr" else camState

        @JavascriptInterface
        fun camSeq(): Int = camSeqN

        @JavascriptInterface
        fun camRot(): Int = camRotation()

        @JavascriptInterface
        fun screenMM(): Double {
            val dm = DisplayMetrics()
            @Suppress("DEPRECATION")
            windowManager.defaultDisplay.getRealMetrics(dm)
            val longPx = Math.max(dm.widthPixels, dm.heightPixels).toDouble()
            val dpi = if (dm.widthPixels >= dm.heightPixels) dm.xdpi.toDouble() else dm.ydpi.toDouble()
            return if (dpi > 50) longPx / dpi * 25.4 else 150.0
        }

        @JavascriptInterface
        fun openAppSettings() {
            runOnUiThread {
                val i = Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName"))
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                startActivity(i)
            }
        }

        @JavascriptInterface
        fun beginSave(name: String, mime: String): Boolean = this@MainActivity.beginSave(name, mime)

        @JavascriptInterface
        fun appendSave(b64: String): Boolean = this@MainActivity.appendSave(b64)

        @JavascriptInterface
        fun endSave(): String = this@MainActivity.endSave()
    }

    // ---- saving photos / videos to the phone ----
    private var saveOut: OutputStream? = null
    private var saveUri: Uri? = null
    private var saveLabel = ""

    private fun closeSaveQuiet() {
        try { saveOut?.close() } catch (e: Exception) { }
        saveOut = null
        saveUri = null
    }

    private fun beginSave(name: String, mime: String): Boolean {
        return try {
            closeSaveQuiet()
            val video = mime.startsWith("video")
            if (Build.VERSION.SDK_INT >= 29) {
                val dir = (if (video) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES) + "/SpatialOS"
                val values = ContentValues()
                values.put(MediaStore.MediaColumns.DISPLAY_NAME, name)
                values.put(MediaStore.MediaColumns.MIME_TYPE, mime)
                values.put(MediaStore.MediaColumns.RELATIVE_PATH, dir)
                values.put(MediaStore.MediaColumns.IS_PENDING, 1)
                val collection = if (video) MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                else MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
                val uri = contentResolver.insert(collection, values)
                if (uri == null) {
                    false
                } else {
                    saveUri = uri
                    saveOut = contentResolver.openOutputStream(uri)
                    saveLabel = "$dir/$name"
                    saveOut != null
                }
            } else {
                val base = getExternalFilesDir(if (video) Environment.DIRECTORY_MOVIES else Environment.DIRECTORY_PICTURES)
                val dir = File(base, "SpatialOS")
                dir.mkdirs()
                val f = File(dir, name)
                saveOut = FileOutputStream(f)
                saveLabel = f.absolutePath
                true
            }
        } catch (e: Exception) {
            closeSaveQuiet()
            false
        }
    }

    private fun appendSave(b64: String): Boolean {
        return try {
            val out = saveOut ?: return false
            out.write(Base64.decode(b64, Base64.DEFAULT))
            true
        } catch (e: Exception) {
            false
        }
    }

    private fun endSave(): String {
        try {
            saveOut?.flush()
            saveOut?.close()
            val uri = saveUri
            if (uri != null && Build.VERSION.SDK_INT >= 29) {
                val values = ContentValues()
                values.put(MediaStore.MediaColumns.IS_PENDING, 0)
                contentResolver.update(uri, values, null, null)
            }
        } catch (e: Exception) {
        }
        saveOut = null
        saveUri = null
        return saveLabel
    }

    // ---- native camera (Camera2) -> JPEG frames served at /cam.jpg ----
    private var camDev: CameraDevice? = null
    private var camSession: CameraCaptureSession? = null
    private var camReader: ImageReader? = null
    private var camThread: HandlerThread? = null
    private var camHandler: Handler? = null
    @Volatile private var camJpeg: ByteArray? = null
    @Volatile private var camState = "off"
    @Volatile private var camErr = ""
    @Volatile private var camWanted = false
    private var camSensor = 90
    private var camFront = false
    private var camLastMs = 0L

    private fun camRotation(): Int {
        @Suppress("DEPRECATION")
        val d = when (windowManager.defaultDisplay.rotation) {
            Surface.ROTATION_90 -> 90
            Surface.ROTATION_180 -> 180
            Surface.ROTATION_270 -> 270
            else -> 0
        }
        return if (camFront) (camSensor + d) % 360 else (camSensor - d + 360) % 360
    }

    private fun startNativeCamera(): Boolean {
        if (camState == "on" || camState == "starting") return true
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            camState = "error"; camErr = "no permission"; return false
        }
        camState = "starting"
        try {
            val cm = getSystemService(CAMERA_SERVICE) as CameraManager
            var id: String? = null
            for (c in cm.cameraIdList) {
                val ch = cm.getCameraCharacteristics(c)
                if (ch.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK) { id = c; break }
            }
            if (id == null) id = cm.cameraIdList.firstOrNull()
            if (id == null) { camState = "error"; camErr = "no camera"; return false }
            val ch = cm.getCameraCharacteristics(id)
            camSensor = ch.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 90
            camFront = ch.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT
            val map = ch.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
            val sizes = map?.getOutputSizes(ImageFormat.YUV_420_888)
            if (sizes == null || sizes.isEmpty()) { camState = "error"; camErr = "no sizes"; return false }
            var best = sizes.filter { it.width <= 960 && it.height <= 720 }.maxByOrNull { it.width * it.height }
            if (best == null) best = sizes.minByOrNull { it.width * it.height }!!
            val th = HandlerThread("cam")
            th.start()
            camThread = th
            val h = Handler(th.looper)
            camHandler = h
            val reader = ImageReader.newInstance(best.width, best.height, ImageFormat.YUV_420_888, 2)
            camReader = reader
            reader.setOnImageAvailableListener({ r ->
                val img = try { r.acquireLatestImage() } catch (e: Exception) { null }
                if (img != null) {
                    try {
                        val now = SystemClock.uptimeMillis()
                        if (now - camLastMs >= 45L) {
                            camLastMs = now
                            val jpg = yuvToJpeg(img)
                            if (jpg != null) { camJpeg = jpg; camSeqN += 1; feedHands(jpg) }
                        }
                    } catch (e: Exception) {
                    } finally {
                        img.close()
                    }
                }
            }, h)
            cm.openCamera(id, object : CameraDevice.StateCallback() {
                override fun onOpened(device: CameraDevice) {
                    camDev = device
                    try {
                        @Suppress("DEPRECATION")
                        device.createCaptureSession(listOf(reader.surface), object : CameraCaptureSession.StateCallback() {
                            override fun onConfigured(session: CameraCaptureSession) {
                                camSession = session
                                try {
                                    val rb = device.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
                                    rb.addTarget(reader.surface)
                                    rb.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
                                    session.setRepeatingRequest(rb.build(), null, h)
                                    camState = "on"
                                } catch (e: Exception) {
                                    camState = "error"; camErr = "request: " + e.message
                                }
                            }

                            override fun onConfigureFailed(session: CameraCaptureSession) {
                                camState = "error"; camErr = "configure failed"
                            }
                        }, h)
                    } catch (e: Exception) {
                        camState = "error"; camErr = "session: " + e.message
                    }
                }

                override fun onDisconnected(device: CameraDevice) {
                    camState = "error"; camErr = "disconnected"
                    try { device.close() } catch (e: Exception) { }
                    camDev = null
                }

                override fun onError(device: CameraDevice, error: Int) {
                    camState = "error"; camErr = "error $error"
                    try { device.close() } catch (e: Exception) { }
                    camDev = null
                }
            }, h)
            return true
        } catch (e: Exception) {
            camState = "error"; camErr = e.message ?: "start failed"
            stopNativeCamera()
            camState = "error"
            return false
        }
    }

    private fun stopNativeCamera() {
        try { camSession?.close() } catch (e: Exception) { }
        try { camDev?.close() } catch (e: Exception) { }
        try { camReader?.close() } catch (e: Exception) { }
        try { camThread?.quitSafely() } catch (e: Exception) { }
        camSession = null; camDev = null; camReader = null; camThread = null; camHandler = null
        camState = "off"
        camJpeg = null
    }

    private fun yuvToJpeg(img: Image): ByteArray? {
        val w = img.width
        val h = img.height
        val yP = img.planes[0]
        val uP = img.planes[1]
        val vP = img.planes[2]
        val nv = ByteArray(w * h * 3 / 2)
        val yb = yP.buffer
        val yRow = yP.rowStride
        if (yRow == w) {
            yb.position(0)
            yb.get(nv, 0, w * h)
        } else {
            for (r in 0 until h) {
                yb.position(r * yRow)
                yb.get(nv, r * w, w)
            }
        }
        val ub = uP.buffer
        val vb = vP.buffer
        var o = w * h
        for (r in 0 until h / 2) {
            for (c in 0 until w / 2) {
                nv[o++] = vb.get(r * vP.rowStride + c * vP.pixelStride)
                nv[o++] = ub.get(r * uP.rowStride + c * uP.pixelStride)
            }
        }
        val out = ByteArrayOutputStream(w * h / 6)
        YuvImage(nv, ImageFormat.NV21, w, h, null).compressToJpeg(Rect(0, 0, w, h), 70, out)
        return out.toByteArray()
    }

    // ---- native hand tracking (MediaPipe Tasks, runs on its own thread, outside the WebView) ----
    private var landmarker: HandLandmarker? = null
    private val handExec = Executors.newSingleThreadExecutor()
    private val handBusy = AtomicBoolean(false)
    @Volatile private var handsWanted = false
    @Volatile private var handsState = "off"
    @Volatile private var handsOut = ""
    private var handsSeq = 0
    private var handsLastMs = 0L
    private var handsTs = 0L

    private fun startNativeHands(): Boolean {
        if (landmarker != null || handsState == "loading") return true
        handsState = "loading"
        handExec.execute {
            try {
                val base = BaseOptions.builder().setModelAssetPath("hand_landmarker.task").build()
                val opts = HandLandmarker.HandLandmarkerOptions.builder()
                    .setBaseOptions(base)
                    .setRunningMode(RunningMode.VIDEO)
                    .setNumHands(2)
                    .setMinHandDetectionConfidence(0.5f)
                    .setMinHandPresenceConfidence(0.5f)
                    .setMinTrackingConfidence(0.5f)
                    .build()
                landmarker = HandLandmarker.createFromOptions(this@MainActivity, opts)
                handsState = if (handsWanted) "on" else "off"
                if (!handsWanted) { try { landmarker?.close() } catch (e: Exception) { }; landmarker = null }
            } catch (e: Throwable) {
                handsState = "error: " + (e.message ?: e.javaClass.simpleName)
                landmarker = null
            }
        }
        return true
    }

    private fun stopNativeHands() {
        handsOut = ""
        handExec.execute {
            try { landmarker?.close() } catch (e: Throwable) { }
            landmarker = null
            if (!handsWanted) handsState = "off"
        }
    }

    private fun feedHands(jpg: ByteArray) {
        if (!handsWanted || landmarker == null || handsState != "on") return
        val now = SystemClock.uptimeMillis()
        if (now - handsLastMs < 33L) return
        if (!handBusy.compareAndSet(false, true)) return
        handsLastMs = now
        val rot = camRotation()
        handExec.execute {
            try {
                val lm = landmarker
                if (lm != null) {
                    val bmp = BitmapFactory.decodeByteArray(jpg, 0, jpg.size)
                    if (bmp != null) {
                        var ts = SystemClock.uptimeMillis()
                        if (ts <= handsTs) ts = handsTs + 1
                        handsTs = ts
                        val po = ImageProcessingOptions.builder().setRotationDegrees(rot).build()
                        val res = lm.detectForVideo(BitmapImageBuilder(bmp).build(), po, ts)
                        val sb = StringBuilder()
                        sb.append(++handsSeq).append(';')
                        var first = true
                        for (hand in res.landmarks()) {
                            if (!first) sb.append('|')
                            first = false
                            var i = 0
                            for (p in hand) {
                                if (i++ > 0) sb.append(',')
                                sb.append(String.format(java.util.Locale.US, "%.4f,%.4f", p.x(), p.y()))
                            }
                        }
                        handsOut = sb.toString()
                        bmp.recycle()
                    }
                }
            } catch (e: Throwable) {
                handsState = "error: " + (e.message ?: e.javaClass.simpleName)
            } finally {
                handBusy.set(false)
            }
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
        if (camWanted) startNativeCamera()
        rotSensor?.let { sm.registerListener(this, it, SensorManager.SENSOR_DELAY_FASTEST) }
        magSensor?.let { sm.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
    }

    override fun onPause() {
        if (camWanted) stopNativeCamera()
        sm.unregisterListener(this)
        web.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        handsWanted = false
        stopNativeHands()
        stopNativeCamera()
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

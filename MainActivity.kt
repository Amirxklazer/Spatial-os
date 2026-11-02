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
import android.hardware.camera2.params.OutputConfiguration
import android.hardware.camera2.params.SessionConfiguration
import android.media.Image
import android.media.ImageReader
import android.os.Handler
import android.os.Looper
import android.view.MotionEvent
import android.widget.FrameLayout
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.google.ar.core.ArCoreApk
import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.GLES11Ext
import android.opengl.GLES20
import android.media.AudioManager
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import java.net.HttpURLConnection
import java.net.URL
import org.json.JSONObject
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
    private lateinit var root: FrameLayout
    private lateinit var sm: SensorManager
    private var rotSensor: Sensor? = null
    private var magSensor: Sensor? = null

    private val rIn = FloatArray(9)
    private val rOut = FloatArray(9)
    private val poseArr = FloatArray(9)
    @Volatile private var poseValid = false
    private val poseSb = StringBuilder(160)

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

        root = FrameLayout(this)
        root.setBackgroundColor(Color.BLACK)
        setContentView(root)
        setupWeb()
        loadApp()
    }

    private fun setupWeb() {
        web = WebView(this)
        web.setBackgroundColor(Color.BLACK)
        web.overScrollMode = View.OVER_SCROLL_NEVER
        web.isVerticalScrollBarEnabled = false
        web.isHorizontalScrollBarEnabled = false
        root.addView(web, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))

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
        if (requestCode == 8) web.evaluateJavascript("window.SOS && SOS.onMicPerm($ok)", null)
        else web.evaluateJavascript("window.SOS && SOS.onCamPerm($ok)", null)
    }

    // ---- spatial browsers: up to 3 offscreen WebViews, each rendered to JPEG frames ----
    inner class BrowserInst(val id: Int) {
        var web: WebView? = null
        var bmp: Bitmap? = null
        @Volatile var jpeg: ByteArray? = null
        @Volatile var seq = 0
        @Volatile var info = "{}"
        var w = 1280
        var h = 720
        var active = false
        @Volatile var visible = true
        var down = 0L
        var progress = 100
        val out = ByteArrayOutputStream(120000)
        val handler = Handler(Looper.getMainLooper())
        val tick = object : Runnable {
            override fun run() {
                if (!active) return
                try {
                    val v = web
                    val bm = bmp
                    if (v != null && bm != null) {
                        if (visible || seq == 0) {
                            val c = android.graphics.Canvas(bm)
                            c.drawColor(Color.WHITE)
                            v.draw(c)
                            out.reset()
                            bm.compress(Bitmap.CompressFormat.JPEG, 66, out)
                            jpeg = out.toByteArray()
                            seq += 1
                        }
                        info = "{\"url\":" + JSONObject.quote(v.url ?: "") + ",\"title\":" + JSONObject.quote(v.title ?: "") + ",\"p\":" + progress + ",\"back\":" + v.canGoBack() + ",\"fwd\":" + v.canGoForward() + "}"
                    }
                } catch (e: Throwable) {
                }
                handler.postDelayed(this, if (visible) 120L else 600L)
            }
        }
    }

    private val browsers = HashMap<Int, BrowserInst>()

    private fun browserStartNow(id: Int, w: Int, h: Int) {
        try {
            val bi = browsers.getOrPut(id) { BrowserInst(id) }
            bi.w = w.coerceIn(640, 1600)
            bi.h = h.coerceIn(360, 900)
            if (bi.web == null) {
                val b = WebView(this)
                b.setLayerType(View.LAYER_TYPE_SOFTWARE, null)
                b.isFocusable = false
                b.isFocusableInTouchMode = false
                b.setBackgroundColor(Color.WHITE)
                val s = b.settings
                s.javaScriptEnabled = true
                s.domStorageEnabled = true
                s.useWideViewPort = true
                s.loadWithOverviewMode = true
                s.setSupportZoom(false)
                s.builtInZoomControls = false
                s.mediaPlaybackRequiresUserGesture = false
                s.userAgentString = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
                b.webViewClient = object : WebViewClient() {
                    override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
                        window.decorView.post { browserStopNow(id) }
                        return true
                    }
                }
                b.webChromeClient = object : WebChromeClient() {
                    override fun onProgressChanged(view: WebView, newProgress: Int) { bi.progress = newProgress }
                }
                root.addView(b, 0, FrameLayout.LayoutParams(bi.w, bi.h))
                bi.web = b
            }
            val old = bi.bmp
            if (old == null || old.width != bi.w || old.height != bi.h) {
                bi.bmp = Bitmap.createBitmap(bi.w, bi.h, Bitmap.Config.RGB_565)
            }
            bi.web?.layoutParams = FrameLayout.LayoutParams(bi.w, bi.h)
            bi.web?.onResume()
            bi.active = true
            bi.handler.removeCallbacks(bi.tick)
            bi.handler.post(bi.tick)
        } catch (e: Throwable) {
            browsers[id]?.info = "{\"error\":true}"
        }
    }

    private fun browserStopNow(id: Int) {
        val bi = browsers.remove(id) ?: return
        bi.active = false
        bi.handler.removeCallbacks(bi.tick)
        try {
            val v = bi.web
            if (v != null) { (v.parent as? ViewGroup)?.removeView(v); v.destroy() }
        } catch (e: Throwable) { }
    }

    private fun browserLoadNow(id: Int, url: String) {
        var u = url.trim()
        if (u.isEmpty()) return
        val hasScheme = u.startsWith("http://") || u.startsWith("https://") || u.startsWith("file:") || u.startsWith("about:")
        if (!hasScheme) {
            u = if (u.contains(" ") || !u.contains(".")) "https://duckduckgo.com/?q=" + Uri.encode(u) else "https://$u"
        }
        try { browsers[id]?.web?.loadUrl(u) } catch (e: Throwable) { }
    }

    private fun browserTouchNow(id: Int, action: Int, x: Float, y: Float) {
        val bi = browsers[id] ?: return
        val b = bi.web ?: return
        try {
            val now = SystemClock.uptimeMillis()
            if (action == 0) bi.down = now
            val ev = MotionEvent.obtain(bi.down, now, action, x, y, 0)
            b.dispatchTouchEvent(ev)
            ev.recycle()
        } catch (e: Throwable) { }
    }

    private fun browserTypeNow(id: Int, text: String) {
        val b = browsers[id]?.web ?: return
        val js = "(function(t){var e=document.activeElement;if(e&&(e.tagName==='INPUT'||e.tagName==='TEXTAREA'||e.isContentEditable)){if(e.isContentEditable){document.execCommand('insertText',false,t);return;}var s=e.selectionStart||0,n=e.selectionEnd||0;e.value=e.value.slice(0,s)+t+e.value.slice(n);try{e.selectionStart=e.selectionEnd=s+t.length;}catch(x){}e.dispatchEvent(new Event('input',{bubbles:true}));}})(" + JSONObject.quote(text) + ")"
        b.evaluateJavascript(js, null)
    }

    private fun browserKeyNow(id: Int, name: String) {
        val b = browsers[id]?.web ?: return
        val js = if (name == "Backspace")
            "(function(){var e=document.activeElement;if(e&&(e.tagName==='INPUT'||e.tagName==='TEXTAREA')){var s=e.selectionStart||0,n=e.selectionEnd||0;if(n>s){e.value=e.value.slice(0,s)+e.value.slice(n);}else if(s>0){e.value=e.value.slice(0,s-1)+e.value.slice(s);s=s-1;}try{e.selectionStart=e.selectionEnd=s;}catch(x){}e.dispatchEvent(new Event('input',{bubbles:true}));}else if(e&&e.isContentEditable){document.execCommand('delete');}})()"
        else
            "(function(){var e=document.activeElement;if(!e)return;['keydown','keypress','keyup'].forEach(function(t){e.dispatchEvent(new KeyboardEvent(t,{key:'Enter',code:'Enter',keyCode:13,which:13,bubbles:true}));});if(e.form){if(e.form.requestSubmit){e.form.requestSubmit();}else{e.form.submit();}}})()"
        b.evaluateJavascript(js, null)
    }

    // ---- ARCore room tracking: gives the headset a position so apps can stay in the room while you walk ----
    private var arSession: com.google.ar.core.Session? = null
    private var arThread: Thread? = null
    @Volatile private var arRun = false
    @Volatile private var arTracking = false
    @Volatile private var arWanted = true
    @Volatile private var arHave = false
    private var arInstallAsked = false
    private val arPos = FloatArray(3)
    @Volatile private var arPsi = 0f
    private var arPsi0 = 0f
    private var arPsiInit = false
    private var arSx = 0f
    private var arSy = 0f

    private fun tryStartAr(): Boolean {
        if (!arWanted) return false
        try {
            val av = ArCoreApk.getInstance().checkAvailability(this)
            if (!av.isSupported) return false
            if (av != ArCoreApk.Availability.SUPPORTED_INSTALLED) {
                if (arInstallAsked) return false
                arInstallAsked = true
                val st = ArCoreApk.getInstance().requestInstall(this, true)
                if (st != ArCoreApk.InstallStatus.INSTALLED) return false
            }
            val s = com.google.ar.core.Session(this)
            val cfg = com.google.ar.core.Config(s)
            cfg.updateMode = com.google.ar.core.Config.UpdateMode.LATEST_CAMERA_IMAGE
            cfg.planeFindingMode = com.google.ar.core.Config.PlaneFindingMode.DISABLED
            cfg.lightEstimationMode = com.google.ar.core.Config.LightEstimationMode.DISABLED
            cfg.focusMode = com.google.ar.core.Config.FocusMode.AUTO
            s.configure(cfg)
            try {
                val f = com.google.ar.core.CameraConfigFilter(s)
                f.facingDirection = com.google.ar.core.CameraConfig.FacingDirection.BACK
                val list = s.getSupportedCameraConfigs(f)
                val pick = list.filter { it.imageSize.width <= 1280 }.maxByOrNull { it.imageSize.width * it.imageSize.height }
                if (pick != null) s.cameraConfig = pick
            } catch (e: Throwable) { }
            // sensor orientation of the back camera (for turning the CPU image upright)
            try {
                val cm = getSystemService(CAMERA_SERVICE) as CameraManager
                for (id in cm.cameraIdList) {
                    val ch = cm.getCameraCharacteristics(id)
                    if (ch.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK) { camSensor = ch.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 90; break }
                }
            } catch (e: Throwable) { }
            camFront = false
            arSession = s
            arRun = true
            arTracking = false
            arHave = false
            arPsiInit = false
            camState = "starting"
            val t = Thread { arLoop(s) }
            t.name = "arcore"
            arThread = t
            t.start()
            return true
        } catch (e: Throwable) {
            arSession = null
            return false
        }
    }

    private fun arLoop(s: com.google.ar.core.Session) {
        var dpy = EGL14.EGL_NO_DISPLAY
        var ctx = EGL14.EGL_NO_CONTEXT
        var surf = EGL14.EGL_NO_SURFACE
        try {
            dpy = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
            val ver = IntArray(2)
            EGL14.eglInitialize(dpy, ver, 0, ver, 1)
            val attr = intArrayOf(EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT, EGL14.EGL_SURFACE_TYPE, EGL14.EGL_PBUFFER_BIT, EGL14.EGL_NONE)
            val cfgs = arrayOfNulls<EGLConfig>(1)
            val n = IntArray(1)
            EGL14.eglChooseConfig(dpy, attr, 0, cfgs, 0, 1, n, 0)
            ctx = EGL14.eglCreateContext(dpy, cfgs[0], EGL14.EGL_NO_CONTEXT, intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE), 0)
            surf = EGL14.eglCreatePbufferSurface(dpy, cfgs[0], intArrayOf(EGL14.EGL_WIDTH, 1, EGL14.EGL_HEIGHT, 1, EGL14.EGL_NONE), 0)
            EGL14.eglMakeCurrent(dpy, surf, surf, ctx)
            val tex = IntArray(1)
            GLES20.glGenTextures(1, tex, 0)
            GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, tex[0])
            s.setCameraTextureName(tex[0])
            s.setDisplayGeometry(Surface.ROTATION_90, 1280, 720)
            s.resume()
            val m = FloatArray(16)
            var intrDone = false
            while (arRun) {
                val frame = s.update()
                val cam = frame.camera
                if (cam.trackingState == com.google.ar.core.TrackingState.TRACKING) {
                    val pose = cam.pose
                    pose.toMatrix(m, 0)
                    // ARCore camera rotation (columns of m), and the sensor-based rotation in the same y-up three.js basis
                    val ra = floatArrayOf(m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10])
                    var p0 = 0f; var p1 = 0f; var p2 = 0f; var p3 = 0f; var p4 = 0f; var p5 = 0f; var p6 = 0f; var p7 = 0f; var p8 = 0f
                    synchronized(poseArr) { p0 = poseArr[0]; p1 = poseArr[1]; p2 = poseArr[2]; p3 = poseArr[3]; p4 = poseArr[4]; p5 = poseArr[5]; p6 = poseArr[6]; p7 = poseArr[7]; p8 = poseArr[8] }
                    if (poseValid) {
                        val ri = floatArrayOf(p0, p1, p2, p6, p7, p8, -p3, -p4, -p5)
                        // M = RA * RI^T : a rotation about the vertical axis = yaw between ARCore's world and the sensor world
                        val m00 = ra[0] * ri[0] + ra[1] * ri[1] + ra[2] * ri[2]
                        val m02 = ra[0] * ri[6] + ra[1] * ri[7] + ra[2] * ri[8]
                        val psi = Math.atan2(m02.toDouble(), m00.toDouble()).toFloat()
                        if (!arPsiInit) { arPsiInit = true; arPsi0 = psi; arSx = Math.sin((0f).toDouble()).toFloat(); arSy = 1f }
                        // smooth the drift estimate (unit vector average avoids wrap-around problems)
                        val d = psi - arPsi0
                        arSx += (Math.sin(d.toDouble()).toFloat() - arSx) * 0.03f
                        arSy += (Math.cos(d.toDouble()).toFloat() - arSy) * 0.03f
                        arPsi = Math.atan2(arSx.toDouble(), arSy.toDouble()).toFloat()
                        val c0 = Math.cos(arPsi0.toDouble()).toFloat()
                        val s0 = Math.sin(arPsi0.toDouble()).toFloat()
                        val tx = m[12]
                        val tz = m[14]
                        synchronized(arPos) { arPos[0] = c0 * tx - s0 * tz; arPos[1] = m[13]; arPos[2] = s0 * tx + c0 * tz }
                        arHave = true
                    }
                    arTracking = true
                } else {
                    arTracking = false
                }
                try {
                    val img = frame.acquireCameraImage()
                    try {
                        if (!intrDone) {
                            val k = cam.imageIntrinsics
                            val fx = k.focalLength[0]
                            val w = k.imageDimensions[0]
                            if (fx > 0f && w > 0) { camHFov = Math.toDegrees(2.0 * Math.atan(w / (2.0 * fx.toDouble()))); intrDone = true }
                        }
                        val now = SystemClock.uptimeMillis()
                        if (now - camLastMs >= 38L) {
                            camLastMs = now
                            val jpg = yuvToJpeg(img)
                            if (jpg != null) { camJpeg = jpg; camSeqN += 1; camState = "on"; feedHands(jpg) }
                        }
                    } finally {
                        img.close()
                    }
                } catch (e: Throwable) { }
                Thread.sleep(8)
            }
        } catch (e: Throwable) {
            camErr = "ar: " + (e.message ?: "")
            if (arRun) { camState = "error" }
        } finally {
            try { s.pause() } catch (e: Throwable) { }
            try { s.close() } catch (e: Throwable) { }
            try { if (dpy != EGL14.EGL_NO_DISPLAY) { EGL14.eglMakeCurrent(dpy, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT); if (surf != EGL14.EGL_NO_SURFACE) EGL14.eglDestroySurface(dpy, surf); if (ctx != EGL14.EGL_NO_CONTEXT) EGL14.eglDestroyContext(dpy, ctx); EGL14.eglTerminate(dpy) } } catch (e: Throwable) { }
            arTracking = false
            arHave = false
        }
    }

    private fun stopAr() {
        arRun = false
        try { arThread?.join(1500) } catch (e: Throwable) { }
        arThread = null
        arSession = null
        arHave = false
    }

    // ---- text to speech (Spiral talks) ----
    private var tts: TextToSpeech? = null
    private var ttsReady = false
    private var ttsPending: String? = null
    @Volatile private var speaking = false

    private fun speakNow(text: String) {
        runOnUiThread {
            try {
                if (tts == null) {
                    ttsPending = text
                    tts = TextToSpeech(this) { st ->
                        if (st == TextToSpeech.SUCCESS) {
                            ttsReady = true
                            try { tts?.language = java.util.Locale.getDefault() } catch (e: Throwable) { }
                            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                                override fun onStart(utteranceId: String?) { speaking = true }
                                override fun onDone(utteranceId: String?) { speaking = false; if (wakeWanted) scheduleWake(700) }
                                @Deprecated("deprecated") override fun onError(utteranceId: String?) { speaking = false; if (wakeWanted) scheduleWake(700) }
                            })
                            val p = ttsPending
                            ttsPending = null
                            if (p != null) tts?.speak(p, TextToSpeech.QUEUE_FLUSH, null, "sp")
                        }
                    }
                } else if (ttsReady) {
                    tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "sp")
                } else ttsPending = text
            } catch (e: Throwable) { }
        }
    }

    // ---- "Hey Spiral": a listening loop that hands every phrase to the web side ----
    @Volatile private var wakeWanted = false
    @Volatile private var voiceBusy = false
    private val wakeHandler = Handler(Looper.getMainLooper())
    private val wakeRestart = Runnable { startWakeListen() }

    private fun muteBeeps(m: Boolean) {
        try {
            val am = getSystemService(AUDIO_SERVICE) as AudioManager
            val dir = if (m) AudioManager.ADJUST_MUTE else AudioManager.ADJUST_UNMUTE
            am.adjustStreamVolume(AudioManager.STREAM_NOTIFICATION, dir, 0)
            am.adjustStreamVolume(AudioManager.STREAM_SYSTEM, dir, 0)
        } catch (e: Throwable) { }
    }

    private fun scheduleWake(delay: Long) {
        wakeHandler.removeCallbacks(wakeRestart)
        if (wakeWanted) wakeHandler.postDelayed(wakeRestart, delay)
    }

    private fun jsWake(text: String) {
        val js = "window.SOS && SOS.onWake(" + JSONObject.quote(text) + ")"
        runOnUiThread { try { web.evaluateJavascript(js, null) } catch (e: Exception) { } }
    }

    private fun startWakeListen() {
        if (!wakeWanted) return
        if (speaking || voiceBusy) { scheduleWake(900); return }
        if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) return
        try {
            if (!SpeechRecognizer.isRecognitionAvailable(this)) return
            try { recognizer?.destroy() } catch (e: Exception) { }
            val r = SpeechRecognizer.createSpeechRecognizer(this)
            recognizer = r
            r.setRecognitionListener(object : RecognitionListener {
                override fun onReadyForSpeech(params: Bundle?) {}
                override fun onBeginningOfSpeech() {}
                override fun onRmsChanged(rmsdB: Float) {}
                override fun onBufferReceived(buffer: ByteArray?) {}
                override fun onEndOfSpeech() {}
                override fun onError(error: Int) { scheduleWake(if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) 1500L else 350L) }
                override fun onResults(results: Bundle?) {
                    val l = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                    if (l != null) { for (t in l) { if (t.lowercase().contains("spiral")) { jsWake(t); break } } }
                    scheduleWake(300)
                }
                override fun onPartialResults(partialResults: Bundle?) {}
                override fun onEvent(eventType: Int, params: Bundle?) {}
            })
            val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
            i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
            i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, false)
            i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
            i.putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
            r.startListening(i)
        } catch (e: Throwable) { scheduleWake(2000) }
    }

    // ---- plain HTTPS POST for the Gemini API (kept off the web view so there is no CORS to fight) ----
    private fun netPostNow(id: Int, url: String, headers: String, body: String) {
        Thread {
            var status = 0
            var resp = ""
            try {
                val u = URL(url)
                if (u.host != "generativelanguage.googleapis.com") throw Exception("blocked host")
                val c = u.openConnection() as HttpURLConnection
                c.requestMethod = "POST"
                c.connectTimeout = 15000
                c.readTimeout = 35000
                c.doOutput = true
                val h = JSONObject(headers)
                val it = h.keys()
                while (it.hasNext()) { val k = it.next(); c.setRequestProperty(k, h.getString(k)) }
                c.outputStream.use { o -> o.write(body.toByteArray(Charsets.UTF_8)) }
                status = c.responseCode
                val st = if (status >= 400) c.errorStream else c.inputStream
                resp = st?.bufferedReader(Charsets.UTF_8)?.use { r -> r.readText() } ?: ""
            } catch (e: Exception) {
                status = 0
                resp = "{\"error\":{\"message\":" + JSONObject.quote(e.message ?: "network") + "}}"
            }
            val js = "window.SOS && SOS.onNetRes(" + id + "," + status + "," + JSONObject.quote(resp) + ")"
            runOnUiThread { try { web.evaluateJavascript(js, null) } catch (e: Exception) { } }
        }.start()
    }

    // ---- voice input (Android speech recognizer) ----
    private var recognizer: SpeechRecognizer? = null

    private fun jsVoice(text: String, fin: Boolean, err: String) {
        if (fin) { voiceBusy = false; if (wakeWanted) scheduleWake(800) }
        val js = "window.SOS && SOS.onVoice(" + JSONObject.quote(text) + "," + fin + "," + JSONObject.quote(err) + ")"
        runOnUiThread { try { web.evaluateJavascript(js, null) } catch (e: Exception) { } }
    }

    private fun startVoiceNow() {
        voiceBusy = true
        wakeHandler.removeCallbacks(wakeRestart)
        runOnUiThread {
            try {
                if (!SpeechRecognizer.isRecognitionAvailable(this)) { jsVoice("", true, "unavailable"); return@runOnUiThread }
                try { recognizer?.destroy() } catch (e: Exception) { }
                val r = SpeechRecognizer.createSpeechRecognizer(this)
                recognizer = r
                r.setRecognitionListener(object : RecognitionListener {
                    override fun onReadyForSpeech(params: Bundle?) { web.evaluateJavascript("window.SOS && SOS.onVoiceState('listening')", null) }
                    override fun onBeginningOfSpeech() {}
                    override fun onRmsChanged(rmsdB: Float) {}
                    override fun onBufferReceived(buffer: ByteArray?) {}
                    override fun onEndOfSpeech() { web.evaluateJavascript("window.SOS && SOS.onVoiceState('thinking')", null) }
                    override fun onError(error: Int) { jsVoice("", true, "error $error") }
                    override fun onResults(results: Bundle?) {
                        val l = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        jsVoice(if (l != null && l.isNotEmpty()) l[0] else "", true, "")
                    }
                    override fun onPartialResults(partialResults: Bundle?) {
                        val l = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                        if (l != null && l.isNotEmpty()) jsVoice(l[0], false, "")
                    }
                    override fun onEvent(eventType: Int, params: Bundle?) {}
                })
                val i = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH)
                i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
                i.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
                i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                r.startListening(i)
            } catch (e: Exception) {
                jsVoice("", true, "error " + (e.message ?: ""))
            }
        }
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
        if (path == "/browser.jpg") {
            val bid = (uri.getQueryParameter("id") ?: "1").toIntOrNull() ?: 1
            val b = browsers[bid]?.jpeg ?: ByteArray(0)
            return WebResourceResponse("image/jpeg", null, 200, "OK", headers, ByteArrayInputStream(b))
        }
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
        fun pose(): String {
            if (!poseValid) return ""
            val sb = poseSb
            sb.setLength(0)
            synchronized(poseArr) {
                for (i in 0 until 9) { if (i > 0) sb.append(','); sb.append(poseArr[i]) }
            }
            if (arHave) { synchronized(arPos) { sb.append(',').append(arPos[0]).append(',').append(arPos[1]).append(',').append(arPos[2]) }; sb.append(',').append(arPsi) }
            return sb.toString()
        }

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
        fun camFov(): Double = camHFov

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
        fun browserStart(id: Int, w: Int, h: Int): Boolean { runOnUiThread { browserStartNow(id, w, h) }; return true }

        @JavascriptInterface
        fun browserStop(id: Int) { runOnUiThread { browserStopNow(id) } }

        @JavascriptInterface
        fun browserVisible(id: Int, v: Boolean) { browsers[id]?.visible = v }

        @JavascriptInterface
        fun browserLoad(id: Int, url: String) { runOnUiThread { browserLoadNow(id, url) } }

        @JavascriptInterface
        fun browserNav(id: Int, cmd: String) {
            runOnUiThread {
                val b = browsers[id]?.web ?: return@runOnUiThread
                when (cmd) {
                    "back" -> if (b.canGoBack()) b.goBack()
                    "forward" -> if (b.canGoForward()) b.goForward()
                    "reload" -> b.reload()
                    "stop" -> b.stopLoading()
                }
            }
        }

        @JavascriptInterface
        fun browserTouch(id: Int, action: Int, x: Float, y: Float) { runOnUiThread { browserTouchNow(id, action, x, y) } }

        @JavascriptInterface
        fun browserType(id: Int, text: String) { runOnUiThread { browserTypeNow(id, text) } }

        @JavascriptInterface
        fun browserKey(id: Int, name: String) { runOnUiThread { browserKeyNow(id, name) } }

        @JavascriptInterface
        fun browserScroll(id: Int, dy: Int) { runOnUiThread { browsers[id]?.web?.scrollBy(0, dy) } }

        @JavascriptInterface
        fun browserSeq(id: Int): Int = browsers[id]?.seq ?: 0

        @JavascriptInterface
        fun browserInfo(id: Int): String = browsers[id]?.info ?: "{}"

        @JavascriptInterface
        fun hasMicPermission(): Boolean =
            checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

        @JavascriptInterface
        fun requestMicPermission() {
            runOnUiThread { requestPermissions(arrayOf(Manifest.permission.RECORD_AUDIO), 8) }
        }

        @JavascriptInterface
        fun startVoice() { startVoiceNow() }

        @JavascriptInterface
        fun stopVoice() {
            runOnUiThread { try { recognizer?.stopListening() } catch (e: Exception) { } }
        }

        @JavascriptInterface
        fun arStatus(): String {
            if (arRun) return if (arTracking) "active" else "searching"
            return try {
                val a = ArCoreApk.getInstance().checkAvailability(this@MainActivity)
                if (a.isSupported) "supported" else if (a.isTransient) "checking" else "not supported"
            } catch (e: Throwable) { "unknown" }
        }

        @JavascriptInterface
        fun setRoomTracking(on: Boolean) { arWanted = on }

        @JavascriptInterface
        fun netPost(id: Int, url: String, headers: String, body: String) { netPostNow(id, url, headers, body) }

        @JavascriptInterface
        fun speak(text: String) { speakNow(text) }

        @JavascriptInterface
        fun stopSpeak() { runOnUiThread { try { tts?.stop() } catch (e: Throwable) { }; speaking = false } }

        @JavascriptInterface
        fun startWake() { wakeWanted = true; runOnUiThread { muteBeeps(true); scheduleWake(200) } }

        @JavascriptInterface
        fun stopWake() { wakeWanted = false; runOnUiThread { wakeHandler.removeCallbacks(wakeRestart); muteBeeps(false); if (!voiceBusy) { try { recognizer?.destroy() } catch (e: Exception) { }; recognizer = null } } }

        @JavascriptInterface
        fun clipboardText(): String {
            return try {
                val cm = getSystemService(CLIPBOARD_SERVICE) as android.content.ClipboardManager
                val c = cm.primaryClip
                if (c != null && c.itemCount > 0) c.getItemAt(0).coerceToText(this@MainActivity).toString() else ""
            } catch (e: Throwable) { "" }
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
    @Volatile private var camSeqN = 0
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

    private var skipPhys = false
    @Volatile private var camHFov = 70.0

    private fun hfovOf(ch: CameraCharacteristics): Double {
        val f = ch.get(CameraCharacteristics.LENS_INFO_AVAILABLE_FOCAL_LENGTHS)?.minOrNull() ?: return 70.0
        val sz = ch.get(CameraCharacteristics.SENSOR_INFO_PHYSICAL_SIZE) ?: return 70.0
        val w = Math.max(sz.width, sz.height).toDouble()
        if (f <= 0f || w <= 0.0) return 70.0
        return Math.toDegrees(2.0 * Math.atan(w / (2.0 * f.toDouble())))
    }

    private fun startNativeCamera(): Boolean {
        if (camState == "on" || camState == "starting") return true
        if (checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            camState = "error"; camErr = "no permission"; return false
        }
        camState = "starting"
        if (tryStartAr()) return true
        try {
            val cm = getSystemService(CAMERA_SERVICE) as CameraManager
            val ids = cm.cameraIdList
            // pick the widest back lens (ultra-wide when the phone exposes it) so the world is not magnified
            var openId: String? = null
            var physId: String? = null
            var bestFov = 0.0
            for (c in ids) {
                val chc = cm.getCameraCharacteristics(c)
                if (chc.get(CameraCharacteristics.LENS_FACING) != CameraCharacteristics.LENS_FACING_BACK) continue
                val f = hfovOf(chc)
                if (openId == null || f > bestFov + 3.0) { bestFov = f; openId = c; physId = null }
                if (Build.VERSION.SDK_INT >= 28 && !skipPhys) {
                    for (p in chc.physicalCameraIds) {
                        try {
                            val pf = hfovOf(cm.getCameraCharacteristics(p))
                            if (pf > bestFov + 3.0) {
                                bestFov = pf
                                if (ids.contains(p)) { openId = p; physId = null } else { openId = c; physId = p }
                            }
                        } catch (e: Exception) { }
                    }
                }
            }
            if (openId == null) openId = ids.firstOrNull()
            val id: String = openId ?: run { camState = "error"; camErr = "no camera"; return false }
            val ch = cm.getCameraCharacteristics(id)
            camSensor = ch.get(CameraCharacteristics.SENSOR_ORIENTATION) ?: 90
            camFront = ch.get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT
            var zoom = 1f
            if (physId == null && Build.VERSION.SDK_INT >= 30) {
                val zr = ch.get(CameraCharacteristics.CONTROL_ZOOM_RATIO_RANGE)
                if (zr != null && zr.lower < 1f) zoom = Math.max(zr.lower, 0.6f)
            }
            camHFov = if (physId == null) hfovOf(ch) else bestFov
            if (zoom < 1f) camHFov = Math.toDegrees(2.0 * Math.atan(Math.tan(Math.toRadians(camHFov / 2.0)) / zoom.toDouble()))
            val map = ch.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
            val sizes = map?.getOutputSizes(ImageFormat.YUV_420_888)
            if (sizes == null || sizes.isEmpty()) { camState = "error"; camErr = "no sizes"; return false }
            var best = sizes.filter { it.width <= 960 && it.height <= 720 && it.width * 3 == it.height * 4 }.maxByOrNull { it.width * it.height }
            if (best == null) best = sizes.filter { it.width <= 960 && it.height <= 720 }.maxByOrNull { it.width * it.height }
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
                        if (now - camLastMs >= 38L) {
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
            val usePhys = physId
            val sessionCb = object : CameraCaptureSession.StateCallback() {
                override fun onConfigured(session: CameraCaptureSession) {
                    camSession = session
                    try {
                        val dev = camDev ?: return
                        val rb = dev.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
                        rb.addTarget(reader.surface)
                        rb.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
                        if (zoom < 1f && Build.VERSION.SDK_INT >= 30) rb.set(CaptureRequest.CONTROL_ZOOM_RATIO, zoom)
                        session.setRepeatingRequest(rb.build(), null, h)
                        camState = "on"
                    } catch (e: Exception) {
                        camState = "error"; camErr = "request: " + e.message
                    }
                }

                override fun onConfigureFailed(session: CameraCaptureSession) {
                    if (usePhys != null && !skipPhys) {
                        // that phone would not give us the wide lens directly: retry with the normal lens
                        skipPhys = true
                        runOnUiThread { stopNativeCamera(); startNativeCamera() }
                    } else {
                        camState = "error"; camErr = "configure failed"
                    }
                }
            }
            cm.openCamera(id, object : CameraDevice.StateCallback() {
                override fun onOpened(device: CameraDevice) {
                    camDev = device
                    try {
                        if (usePhys != null && Build.VERSION.SDK_INT >= 28) {
                            val oc = OutputConfiguration(reader.surface)
                            oc.setPhysicalCameraId(usePhys)
                            val sc = SessionConfiguration(SessionConfiguration.SESSION_REGULAR, listOf(oc), java.util.concurrent.Executor { r -> h.post(r) }, sessionCb)
                            device.createCaptureSession(sc)
                        } else {
                            @Suppress("DEPRECATION")
                            device.createCaptureSession(listOf(reader.surface), sessionCb, h)
                        }
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
        stopAr()
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
                synchronized(poseArr) { System.arraycopy(rOut, 0, poseArr, 0, 9) }
                poseValid = true
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
        for (bi in browsers.values) { if (bi.active) { bi.handler.removeCallbacks(bi.tick); bi.handler.post(bi.tick) } }
        rotSensor?.let { sm.registerListener(this, it, SensorManager.SENSOR_DELAY_FASTEST) }
        magSensor?.let { sm.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
    }

    override fun onPause() {
        if (camWanted) stopNativeCamera()
        for (bi in browsers.values) { bi.handler.removeCallbacks(bi.tick) }
        sm.unregisterListener(this)
        web.onPause()
        super.onPause()
    }

    override fun onDestroy() {
        try { recognizer?.destroy() } catch (e: Exception) { }
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

package expo.modules.apkupdater

import android.content.Intent
import android.content.ClipData
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.concurrent.atomic.AtomicBoolean

class ApkFileProvider : FileProvider()

class ApkUpdaterModule : Module() {
  private val busy = AtomicBoolean(false)
  private val context get() = requireNotNull(appContext.reactContext) { "App context unavailable" }
  private fun folder() = File(context.cacheDir, "apk-updates").apply { mkdirs() }
  private fun apk() = File(folder(), "verified.apk")
  @Suppress("DEPRECATION")
  private fun code(info: PackageInfo): Long = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else info.versionCode.toLong()
  @Suppress("DEPRECATION")
  private fun installed() = context.packageManager.getPackageInfo(context.packageName, PackageManager.GET_SIGNATURES)

  override fun definition() = ModuleDefinition {
    Name("ApkUpdater")
    Events("progress")
    AsyncFunction("installed") {
      val info = installed()
      mapOf("version" to (info.versionName ?: "Unknown"), "code" to code(info))
    }
    AsyncFunction("clean") {
      if (!busy.get()) folder().listFiles()?.forEach { it.delete() }
    }
    AsyncFunction("download") { url: String, hash: String, version: Double, size: Double ->
      check(busy.compareAndSet(false, true)) { "An update operation is already running." }
      val partial = File(folder(), "download.part")
      try {
        require(hash.matches(Regex("[a-fA-F0-9]{64}"))) { "Invalid checksum." }
        require(version > code(installed()) && version % 1.0 == 0.0) { "Update version is invalid." }
        require(size > 0 && size <= 1073741824 && size % 1.0 == 0.0) { "Invalid APK size." }
        val source = URL(url)
        val isGithub = source.protocol == "https" && source.host == "github.com" && source.userInfo == null && source.port == -1 &&
          source.path.startsWith("/dleiszarjeisalther/startup-tindahan-helper/releases/download/") && source.path.endsWith(".apk")
        val isWebsite = source.protocol == "https" && (source.host == "tindahanhelper.wuaze.com" || source.host.endsWith(".wuaze.com")) &&
          source.userInfo == null && source.port == -1 && source.path.endsWith(".apk")
        require(isGithub || isWebsite) { "Invalid APK URL." }
        partial.delete()
        apk().delete()
        check(folder().usableSpace > size.toLong() * 2 + 50 * 1024 * 1024) { "Not enough storage. Free some space and retry." }
        var next = source
        var connection: HttpURLConnection? = null
        try {
          val allowedHosts = setOf("github.com", "release-assets.githubusercontent.com", "objects.githubusercontent.com", "tindahanhelper.wuaze.com")
          for (redirect in 0..5) {
            require(next.protocol == "https" && next.userInfo == null && next.port == -1 &&
              (next.host in allowedHosts || next.host.endsWith(".wuaze.com"))) { "Unsafe download redirect rejected." }
            val conn = next.openConnection() as HttpURLConnection
            connection = conn
            conn.instanceFollowRedirects = false
            conn.connectTimeout = 15000
            conn.readTimeout = 20000
            conn.setRequestProperty("Accept", "application/octet-stream")
            val status = conn.responseCode
            if (status in listOf(301, 302, 303, 307, 308)) {
              check(redirect < 5) { "Too many download redirects." }
              next = URL(next, conn.getHeaderField("Location") ?: error("Missing redirect URL."))
              conn.disconnect()
              continue
            }
            check(status == 200) { "Download unavailable (HTTP $status). Try again later." }
            val expected = size.toLong()
            check(conn.contentLengthLong == -1L || conn.contentLengthLong == expected) { "APK size does not match the published release." }
            var total = 0L
            var lastEvent = 0L
            conn.inputStream.use { input ->
              partial.outputStream().use { output ->
                val buffer = ByteArray(65536)
                while (true) {
                  val read = input.read(buffer)
                  if (read < 0) break
                  total += read
                  check(total <= expected) { "APK exceeds the published size." }
                  output.write(buffer, 0, read)
                  val now = System.currentTimeMillis()
                  if (now - lastEvent > 250) {
                    sendEvent("progress", mapOf("fraction" to total.toDouble() / expected))
                    lastEvent = now
                  }
                }
                output.fd.sync()
              }
            }
            check(total == expected) { "Incomplete download. Please retry." }
            verify(partial, hash, version.toLong(), expected)
            check(partial.renameTo(apk())) { "Could not save verified APK." }
            break
          }
        } finally { connection?.disconnect() }
      } catch (error: Exception) {
        partial.delete()
        apk().delete()
        throw error
      } finally { busy.set(false) }
    }
    AsyncFunction("install") { hash: String, version: Double, size: Double ->
      check(busy.compareAndSet(false, true)) { "An update operation is already running." }
      try {
        verify(apk(), hash, version.toLong(), size.toLong())
        if (Build.VERSION.SDK_INT >= 26 && !context.packageManager.canRequestPackageInstalls()) {
          context.startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
          "permission"
        } else {
          val uri = FileProvider.getUriForFile(context, "${context.packageName}.apkupdates", apk())
          val intent = Intent(Intent.ACTION_VIEW).setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
          intent.clipData = ClipData.newRawUri("Verified update", uri)
          context.startActivity(intent)
          "installer"
        }
      } finally { busy.set(false) }
    }
  }

  @Suppress("DEPRECATION")
  private fun verify(file: File, expectedHash: String, expectedCode: Long, expectedSize: Long) {
    check(file.isFile && file.length() == expectedSize) { "APK is missing or incomplete. Download it again." }
    val digest = MessageDigest.getInstance("SHA-256")
    file.inputStream().use { input ->
      val buffer = ByteArray(65536)
      while (true) { val count = input.read(buffer); if (count < 0) break; digest.update(buffer, 0, count) }
    }
    val actual = digest.digest().joinToString("") { "%02x".format(it.toInt() and 255) }
    check(actual.equals(expectedHash, ignoreCase = true)) { "APK checksum failed. File rejected; download again." }
    val pm = context.packageManager
    val archive = pm.getPackageArchiveInfo(file.absolutePath, PackageManager.GET_SIGNATURES)
      ?: error("Invalid APK. Contact support for a compatible release.")
    val current = installed()
    check(archive.packageName == context.packageName) { "This APK belongs to a different application." }
    check(code(archive) == expectedCode && expectedCode > code(current)) { "APK version does not match the release." }
    check((archive.applicationInfo?.minSdkVersion ?: Int.MAX_VALUE) <= Build.VERSION.SDK_INT) { "This update requires a newer Android version." }
    val expectedSigners = current.signatures?.map { it.toCharsString() }?.toSet()
    val actualSigners = archive.signatures?.map { it.toCharsString() }?.toSet()
    check(!expectedSigners.isNullOrEmpty() && expectedSigners == actualSigners) { "APK signing certificate mismatch. Do not uninstall your app; contact support." }
  }
}

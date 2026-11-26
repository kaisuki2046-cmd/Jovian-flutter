import AVFoundation
import Flutter
import UIKit

@main
@objc class AppDelegate: FlutterAppDelegate, FlutterImplicitEngineDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
  ) -> Bool {
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func didInitializeImplicitFlutterEngine(_ engineBridge: FlutterImplicitEngineBridge) {
    GeneratedPluginRegistrant.register(with: engineBridge.pluginRegistry)
    let messenger = engineBridge.applicationRegistrar.messenger()
    let reference = FlutterMethodChannel(name: "jovian/reading_reference", binaryMessenger: messenger)
    reference.setMethodCallHandler { call, result in
      guard call.method == "open" else {
        result(FlutterMethodNotImplemented)
        return
      }
      guard let value = call.arguments as? String, let url = URL(string: value),
        url.scheme == "https", url.host != nil, url.user == nil else {
        result(false)
        return
      }
      UIApplication.shared.open(url) { result($0) }
    }
    let audio = CoinAudio()
    let channel = FlutterMethodChannel(name: "jovian/coin_audio", binaryMessenger: messenger)
    channel.setMethodCallHandler { call, result in
      switch call.method {
      case "prepare":
        if let paths = call.arguments as? [String] {
          audio.prepare(paths.map { FlutterDartProject.lookupKey(forAsset: $0) })
        }
      case "strike":
        if let args = call.arguments as? [String: NSNumber],
          let variant = args["variant"], let volume = args["volume"], let rate = args["rate"] {
          audio.strike(variant.intValue, volume: volume.floatValue, rate: rate.floatValue)
        }
      case "stop":
        audio.stop()
      default:
        result(FlutterMethodNotImplemented)
        return
      }
      result(nil)
    }
  }
}

private final class CoinAudio {
  private var clips: [Data?] = []
  private var players: [AVAudioPlayer] = []

  func prepare(_ keys: [String]) {
    guard clips.isEmpty else { return }
    clips = keys.map { key in
      guard let url = Bundle.main.url(forResource: key, withExtension: nil) else { return nil }
      return try? Data(contentsOf: url)
    }
    try? AVAudioSession.sharedInstance().setCategory(.ambient)
  }

  func strike(_ variant: Int, volume: Float, rate: Float) {
    guard clips.indices.contains(variant), let data = clips[variant],
      let player = try? AVAudioPlayer(data: data) else { return }
    players.removeAll { !$0.isPlaying }
    player.enableRate = true
    player.rate = rate
    player.volume = volume
    if player.play() { players.append(player) }
  }

  func stop() {
    players.forEach { $0.stop() }
    players.removeAll()
  }
}

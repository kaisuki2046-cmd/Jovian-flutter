import AVFoundation
import Flutter
import QuickLook
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
    if let registrar = engineBridge.pluginRegistry.registrar(forPlugin: "JovianAttachmentPreview") {
      AttachmentPreview.register(with: registrar)
    }
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

private final class AttachmentPreviewItem: NSObject, QLPreviewItem, QLPreviewControllerDataSource {
  let previewItemURL: URL?
  let previewItemTitle: String?

  init(url: URL, title: String) {
    previewItemURL = url
    previewItemTitle = title
  }

  func numberOfPreviewItems(in controller: QLPreviewController) -> Int { 1 }

  func previewController(
    _ controller: QLPreviewController, previewItemAt index: Int
  ) -> QLPreviewItem { self }
}

private final class AttachmentPreview: NSObject, FlutterPlugin, QLPreviewControllerDelegate {
  private let registrar: FlutterPluginRegistrar
  private weak var viewer: QLPreviewController?
  private var item: AttachmentPreviewItem?

  private init(registrar: FlutterPluginRegistrar) {
    self.registrar = registrar
  }

  static func register(with registrar: FlutterPluginRegistrar) {
    let preview = AttachmentPreview(registrar: registrar)
    let channel = FlutterMethodChannel(
      name: "jovian/attachment_preview", binaryMessenger: registrar.messenger())
    registrar.addMethodCallDelegate(preview, channel: channel)
    registrar.publish(preview)
  }

  func handle(_ call: FlutterMethodCall, result: @escaping FlutterResult) {
    guard call.method == "open" else {
      result(FlutterMethodNotImplemented)
      return
    }
    guard let arguments = call.arguments as? [String: Any],
      let path = arguments["path"] as? String,
      let name = arguments["name"] as? String else {
      result(false)
      return
    }
    DispatchQueue.main.async { self.open(path: path, name: name, result: result) }
  }

  private func open(path: String, name: String, result: @escaping FlutterResult) {
    guard viewer == nil, let url = localFile(at: path),
      let presenter = registrar.viewController,
      presenter.viewIfLoaded?.window?.windowScene?.activationState == .foregroundActive,
      presenter.presentedViewController == nil else {
      result(false)
      return
    }

    // Quick Look identifies the file type from the picked URL.
    let selected = AttachmentPreviewItem(url: url, title: name)
    guard QLPreviewController.canPreview(selected) else {
      result(false)
      return
    }
    let preview = QLPreviewController()
    preview.modalPresentationStyle = .fullScreen
    preview.dataSource = selected
    preview.delegate = self
    item = selected
    viewer = preview
    presenter.present(preview, animated: true) { [weak preview] in
      result(preview?.presentingViewController != nil)
    }
  }

  private func localFile(at path: String) -> URL? {
    guard path.hasPrefix("/") else { return nil }
    let manager = FileManager.default
    let url = URL(fileURLWithPath: path).resolvingSymlinksInPath().standardizedFileURL
    // The existing file picker uses import mode and returns a copy in this app.
    let locations = [manager.temporaryDirectory]
      + manager.urls(for: .cachesDirectory, in: .userDomainMask)
      + manager.urls(for: .documentDirectory, in: .userDomainMask).map {
        $0.appendingPathComponent("Inbox", isDirectory: true)
      }
    guard locations.contains(where: {
      let directory = $0.resolvingSymlinksInPath().standardizedFileURL
      return url.pathComponents.starts(with: directory.pathComponents)
    }),
      (try? url.resourceValues(forKeys: [.isRegularFileKey]).isRegularFile) == true,
      manager.isReadableFile(atPath: url.path) else { return nil }
    return url
  }

  func previewControllerDidDismiss(_ controller: QLPreviewController) {
    guard viewer === controller else { return }
    viewer = nil
    item = nil
  }

  func detachFromEngine(for registrar: FlutterPluginRegistrar) {
    DispatchQueue.main.async {
      self.viewer?.dismiss(animated: false)
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

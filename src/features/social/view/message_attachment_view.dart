import 'dart:async';
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';
import 'package:material_ui/material_ui.dart';
import 'package:video_player/video_player.dart';

import '../../../ui/interface_language.dart';
import '../control/message_files.dart'
    if (dart.library.js_interop) '../control/message_files_web.dart'
    as platform;
import '../control/message_media.dart';
import '../model/social.dart';
import 'message_components.dart';

class MessageAttachmentView extends StatefulWidget {
  const MessageAttachmentView({
    super.key,
    required this.attachment,
    required this.load,
    required this.onTemporaryFile,
  });

  final MessageAttachment attachment;
  final Future<Uint8List> Function() load;
  final ValueChanged<Future<void> Function()> onTemporaryFile;

  @override
  State<MessageAttachmentView> createState() => _MessageAttachmentViewState();
}

class _MessageAttachmentViewState extends State<MessageAttachmentView> {
  late Future<Uint8List> _bytes = widget.load();
  AudioPlayer? _audio;
  VideoPlayerController? _video;
  Future<void> Function()? _freeVideo;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    if (_audio case final audio?) unawaited(audio.dispose());
    if (_video case final video?) {
      unawaited(video.dispose().whenComplete(() => _freeVideo?.call()));
    }
    super.dispose();
  }

  Future<void> _perform(Future<void> Function() action, String failure) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await action();
    } catch (_) {
      if (mounted) setState(() => _error = failure);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _playAudio(Uint8List bytes) => _perform(() async {
    final audio = _audio ??= AudioPlayer();
    if (audio.state == PlayerState.playing) {
      await audio.stop();
    } else {
      await audio.play(BytesSource(bytes, mimeType: widget.attachment.type));
    }
  }, '暂时无法播放这个语音。');

  Future<void> _playVideo(Uint8List bytes) => _perform(() async {
    if (_video case final existing?) {
      if (existing.value.isPlaying) {
        await existing.pause();
      } else {
        if (existing.value.isCompleted) await existing.seekTo(Duration.zero);
        await existing.play();
      }
      return;
    }
    final resource = await platform.prepareMessageVideo(
      widget.attachment,
      bytes,
    );
    try {
      await resource.player.initialize();
      if (!mounted) {
        await resource.player.dispose();
        await resource.release();
        return;
      }
      _freeVideo = resource.release;
      _video = resource.player;
      await resource.player.play();
    } catch (_) {
      // A configured player remains usable if only playback failed.
      if (_video != resource.player) {
        await resource.player.dispose();
        await resource.release();
      }
      rethrow;
    }
  }, '暂时无法播放这个视频。');

  Future<void> _export() => _perform(() async {
    final bytes = await _bytes;
    if (!mounted) return;
    final cleanup = await platform.exportMessageAttachment(
      widget.attachment,
      bytes,
    );
    if (cleanup != null) {
      if (mounted) {
        widget.onTemporaryFile(cleanup);
      } else {
        await cleanup();
      }
    }
  }, '暂时无法打开或保存这个附件。');

  @override
  Widget build(BuildContext context) {
    final metadata = widget.attachment;
    return FutureBuilder<Uint8List>(
      future: _bytes,
      builder: (context, snapshot) => AlertDialog(
        title: Text(
          metadata.name,
          maxLines: 2,
          overflow: TextOverflow.ellipsis,
        ),
        content: SingleChildScrollView(
          child: SizedBox(
            width: 360,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (snapshot.connectionState == ConnectionState.waiting)
                  const Padding(
                    padding: EdgeInsets.all(20),
                    child: CircularProgressIndicator(),
                  )
                else if (snapshot.hasError)
                  MessageStatus(
                    '附件加载失败，请重试。',
                    action: TextButton(
                      onPressed: () => setState(() => _bytes = widget.load()),
                      child: const UiText('重试'),
                    ),
                  )
                else if (snapshot.data case final bytes?) ...[
                  if (metadata.kind == MessageMediaKind.image)
                    SizedBox(
                      height: MediaQuery.sizeOf(context).height * .36,
                      child: InteractiveViewer(
                        child: Image.memory(
                          bytes,
                          fit: BoxFit.contain,
                          semanticLabel: metadata.name,
                          errorBuilder: (_, _, _) =>
                              const Center(child: UiText('此设备暂时无法预览这张图片。')),
                        ),
                      ),
                    )
                  else if (metadata.kind == MessageMediaKind.audio)
                    StreamBuilder<PlayerState>(
                      stream: _audio?.onPlayerStateChanged,
                      builder: (context, _) {
                        final playing = _audio?.state == PlayerState.playing;
                        return FilledButton.tonalIcon(
                          onPressed: _busy ? null : () => _playAudio(bytes),
                          icon: Icon(
                            playing
                                ? Icons.stop_rounded
                                : Icons.play_arrow_rounded,
                          ),
                          label: UiText(playing ? '停止播放' : '播放语音'),
                        );
                      },
                    )
                  else if (metadata.kind == MessageMediaKind.video &&
                      platform.canPlayMessageVideo)
                    if (_video case final player?)
                      ValueListenableBuilder<VideoPlayerValue>(
                        valueListenable: player,
                        builder: (context, value, _) => Column(
                          children: [
                            SizedBox(
                              height: MediaQuery.sizeOf(context).height * .31,
                              child: FittedBox(
                                fit: BoxFit.contain,
                                child: SizedBox.fromSize(
                                  size: value.size,
                                  child: VideoPlayer(player),
                                ),
                              ),
                            ),
                            VideoProgressIndicator(
                              player,
                              allowScrubbing: true,
                            ),
                            TextButton.icon(
                              onPressed: _busy ? null : () => _playVideo(bytes),
                              icon: Icon(
                                value.isPlaying
                                    ? Icons.pause
                                    : Icons.play_arrow,
                              ),
                              label: UiText(value.isPlaying ? '暂停播放' : '播放视频'),
                            ),
                          ],
                        ),
                      )
                    else
                      FilledButton.tonalIcon(
                        onPressed: _busy ? null : () => _playVideo(bytes),
                        icon: const Icon(Icons.play_arrow_rounded),
                        label: const UiText('播放视频'),
                      )
                  else
                    Icon(mediaIcon(metadata.kind), size: 30),
                  const SizedBox(height: 10),
                  Text(messageSize(metadata.size)),
                ],
                if (_error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: UiText(
                      _error!,
                      style: TextStyle(
                        color: Theme.of(context).colorScheme.error,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        actions: [
          if (snapshot.hasData && !snapshot.hasError)
            TextButton(
              onPressed: _busy ? null : _export,
              child: UiText(platform.opensMessageFiles ? '用系统应用打开' : '保存到本机'),
            ),
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const UiText('关闭'),
          ),
        ],
      ),
    );
  }
}

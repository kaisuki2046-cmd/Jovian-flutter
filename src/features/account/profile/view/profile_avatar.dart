import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:material_ui/material_ui.dart';

import '../../../../ui/interface_language.dart';

import '../../auth/control/account_controller.dart';
import '../control/profile_photo.dart';
import '../model/avatar_storage.dart';

class ProfileAvatar extends StatefulWidget {
  const ProfileAvatar({super.key, required this.account, required this.scope});

  final AccountController account;
  final String? scope;

  @override
  State<ProfileAvatar> createState() => _ProfileAvatarState();
}

class _ProfileAvatarState extends State<ProfileAvatar> {
  late Future<Uint8List?>? _photo = _load();
  var _editing = false;

  Future<Uint8List?>? _load() {
    final scope = widget.scope;
    return scope == null ? null : const ProfileAvatarStore().read(scope);
  }

  @override
  void didUpdateWidget(covariant ProfileAvatar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if ((oldWidget.account, oldWidget.scope) !=
        (widget.account, widget.scope)) {
      _photo = _load();
    }
  }

  Future<void> _edit(String scope, Uint8List? photo) async {
    final account = widget.account;
    if (_editing || !_ownsScope(account, scope)) return;
    _editing = true;
    try {
      final saved = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (_) =>
            _PhotoEditor(account: account, scope: scope, photo: photo),
      );
      if (!mounted || saved != true || !_ownsScope(widget.account, scope))
        return;
      setState(() {
        _photo = _load();
      });
    } finally {
      _editing = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    final scope = widget.scope;
    final current = scope != null && _ownsScope(widget.account, scope);
    return FutureBuilder<Uint8List?>(
      future: current ? _photo : null,
      builder: (context, snapshot) {
        final ready =
            current && snapshot.connectionState == ConnectionState.done;
        final photo = ready ? snapshot.data : null;
        final avatar = _AvatarCircle(
          key: const ValueKey('profile-avatar'),
          diameter: 104,
          photo: photo,
        );
        if (!ready) return avatar;
        return Tooltip(
          message: '更换头像',
          child: Material(
            type: MaterialType.transparency,
            shape: const CircleBorder(),
            child: InkWell(
              customBorder: const CircleBorder(),
              onTap: () => _edit(scope, photo),
              child: avatar,
            ),
          ),
        );
      },
    );
  }
}

bool _ownsScope(AccountController account, String scope) =>
    !account.sessionChanging && account.authorizedSession?.scope == scope;

class _PhotoEditor extends StatefulWidget {
  const _PhotoEditor({
    required this.account,
    required this.scope,
    required this.photo,
  });

  final AccountController account;
  final String scope;
  final Uint8List? photo;

  @override
  State<_PhotoEditor> createState() => _PhotoEditorState();
}

class _PhotoEditorState extends State<_PhotoEditor> {
  static const _diameter = 154.0;
  ui.Image? _source;
  double _zoom = 1;
  Offset _center = Offset.zero;
  double _startZoom = 1;
  Offset _startCenter = Offset.zero;
  Offset _startFocal = Offset.zero;
  bool _pending = false;
  bool _restoringDefault = false;
  bool _invalidated = false;
  String? _error;

  bool get _valid =>
      mounted && !_invalidated && _ownsScope(widget.account, widget.scope);

  @override
  void initState() {
    super.initState();
    widget.account.addListener(_checkScope);
  }

  @override
  void dispose() {
    widget.account.removeListener(_checkScope);
    _source?.dispose();
    super.dispose();
  }

  void _checkScope() {
    if (_invalidated || _ownsScope(widget.account, widget.scope)) return;
    setState(() {
      _invalidated = true;
      _pending = false;
      _source?.dispose();
      _source = null;
    });
  }

  Future<void> _pick() async {
    if (!_valid || _pending) return;
    setState(() {
      _pending = true;
      _error = null;
    });
    try {
      final chosen = await selectProfilePhoto();
      if (chosen == null) return;
      if (!_valid) {
        chosen.dispose();
        return;
      }
      setState(() {
        _source?.dispose();
        _source = chosen;
        _center = Offset(chosen.width / 2, chosen.height / 2);
        _zoom = 1;
        _restoringDefault = false;
      });
    } on FormatException catch (error) {
      if (_valid) _error = error.message;
    } catch (_) {
      if (_valid) _error = '无法读取这张照片，请换一张图片。';
    } finally {
      if (_valid) setState(() => _pending = false);
    }
  }

  void _reset() => setState(() {
    _source?.dispose();
    _source = null;
    _restoringDefault = true;
    _error = null;
  });

  Future<void> _save() async {
    if (!_valid || _pending) return;
    setState(() {
      _pending = true;
      _error = null;
    });
    final source = _source?.clone();
    try {
      final photo = source == null
          ? null
          : await renderProfileAvatar(
              source,
              profileAvatarCrop(source, _center, _zoom),
            );
      if (!_valid) return;
      final saved = await const ProfileAvatarStore().save(
        widget.scope,
        photo,
        () => _valid,
      );
      if (_valid && saved) Navigator.pop(context, true);
    } catch (_) {
      if (_valid) _error = '头像保存失败，请检查本机存储空间后重试。';
    } finally {
      source?.dispose();
      if (_valid) setState(() => _pending = false);
    }
  }

  void _startCrop(ScaleStartDetails details) {
    _startZoom = _zoom;
    _startCenter = _center;
    _startFocal = details.localFocalPoint;
  }

  void _adjustCrop(ui.Image source, ScaleUpdateDetails details) {
    final zoom = (_startZoom * details.scale).clamp(1.0, 3.0);
    const middle = Offset(_diameter / 2, _diameter / 2);
    final pixels = math.min(source.width, source.height) / _diameter;
    final anchor =
        _startCenter + (_startFocal - middle) * (pixels / _startZoom);
    final center =
        anchor - (details.localFocalPoint - middle) * (pixels / zoom);
    setState(() {
      _zoom = zoom;
      _center = profileAvatarCrop(source, center, zoom).center;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!_valid) {
      return AlertDialog(
        title: const UiText('当前会话已变更'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const UiText('关闭'),
          ),
        ],
      );
    }
    final source = _source;
    final colors = Theme.of(context).colorScheme;
    final readyToSave =
        source != null || (_restoringDefault && widget.photo != null);
    return PopScope(
      canPop: !_pending,
      child: AlertDialog(
        title: const UiText('更换头像'),
        scrollable: true,
        content: Column(
          mainAxisSize: MainAxisSize.min,
          spacing: 12,
          children: [
            Semantics(
              label: '头像预览',
              image: true,
              child: source == null
                  ? _AvatarCircle(
                      diameter: _diameter,
                      photo: _restoringDefault ? null : widget.photo,
                    )
                  : GestureDetector(
                      onScaleStart: _pending ? null : _startCrop,
                      onScaleUpdate: _pending
                          ? null
                          : (details) => _adjustCrop(source, details),
                      child: ClipOval(
                        child: CustomPaint(
                          size: const Size.square(_diameter),
                          painter: _CropPreview(
                            source,
                            profileAvatarCrop(source, _center, _zoom),
                          ),
                        ),
                      ),
                    ),
            ),
            if (source != null) ...[
              const Text('拖动照片调整裁剪位置'),
              Semantics(
                label: '缩放照片',
                child: Slider(
                  min: 1,
                  max: 3,
                  value: _zoom,
                  onChanged: _pending
                      ? null
                      : (zoom) => setState(() {
                          _zoom = zoom;
                          _center = profileAvatarCrop(
                            source,
                            _center,
                            zoom,
                          ).center;
                        }),
                ),
              ),
            ],
            const UiText('头像保存在当前设备，不会上传。'),
            if (_error case final message?)
              Semantics(
                liveRegion: true,
                child: Text(
                  message,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ),
            if (_pending)
              const LinearProgressIndicator(semanticsLabel: '正在处理图片'),
            OutlinedButton(
              onPressed: _pending ? null : _pick,
              child: const UiText('选择照片'),
            ),
            TextButton(
              onPressed: _pending ? null : _reset,
              child: const UiText('恢复默认头像'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: _pending ? null : () => Navigator.pop(context),
            child: const UiText('取消'),
          ),
          FilledButton(
            onPressed: _pending || !readyToSave ? null : _save,
            style: FilledButton.styleFrom(
              backgroundColor: colors.primary,
              foregroundColor: colors.onPrimary,
            ),
            child: const UiText('保存头像'),
          ),
        ],
      ),
    );
  }
}

class _AvatarCircle extends StatelessWidget {
  const _AvatarCircle({super.key, required this.diameter, this.photo});

  final double diameter;
  final Uint8List? photo;

  @override
  Widget build(BuildContext context) {
    final colors = Theme.of(context).colorScheme;
    final fallback = Stack(
      clipBehavior: Clip.none,
      children: [
        Icon(
          Icons.person_outline_rounded,
          size: diameter * .41,
          color: colors.primary,
        ),
        PositionedDirectional(
          end: -4,
          top: 1,
          child: Icon(
            Icons.auto_awesome,
            size: diameter * .135,
            color: colors.primary,
          ),
        ),
      ],
    );
    final bytes = photo;
    return Container(
      width: diameter,
      height: diameter,
      alignment: Alignment.center,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: colors.primaryContainer,
        shape: BoxShape.circle,
        border: Border.all(color: colors.outlineVariant),
      ),
      child: bytes == null
          ? fallback
          : Image.memory(
              bytes,
              key: const ValueKey('profile-avatar-photo'),
              width: diameter,
              height: diameter,
              fit: BoxFit.cover,
              cacheWidth: 320,
              excludeFromSemantics: true,
              errorBuilder: (_, _, _) => fallback,
            ),
    );
  }
}

class _CropPreview extends CustomPainter {
  const _CropPreview(this.image, this.source);

  final ui.Image image;
  final Rect source;

  @override
  void paint(Canvas canvas, Size size) => canvas.drawImageRect(
    image,
    source,
    Offset.zero & size,
    Paint()..filterQuality = FilterQuality.medium,
  );

  @override
  bool shouldRepaint(_CropPreview oldDelegate) =>
      image != oldDelegate.image || source != oldDelegate.source;
}

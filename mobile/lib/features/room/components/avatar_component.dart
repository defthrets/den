import 'dart:async';
import 'dart:math';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flame/components.dart';
import 'package:flame/events.dart';
import 'package:flutter/painting.dart';
import '../../../core/iso_math.dart';
import '../../../core/palette.dart';
import '../../avatar/wardrobe.dart';

/// Wardrobe slot: colours + style ids. Style ids reference [Wardrobe.hair],
/// [Wardrobe.shirt], [Wardrobe.pants]. Same shape as the rows returned by
/// `GET /users/:id/avatar`.
class AvatarConfig {
  final Color skin;
  final Color hair;
  final Color shirt;
  final Color pants;
  final int hairStyle;
  final int shirtStyle;
  final int pantsStyle;

  const AvatarConfig({
    this.skin = DenPalette.skinA,
    this.hair = DenPalette.hairBrown,
    this.shirt = DenPalette.shirtBlue,
    this.pants = DenPalette.pantsNavy,
    this.hairStyle = 0,
    this.shirtStyle = 0,
    this.pantsStyle = 0,
  });

  AvatarConfig copyWith({
    Color? skin, Color? hair, Color? shirt, Color? pants,
    int? hairStyle, int? shirtStyle, int? pantsStyle,
  }) =>
      AvatarConfig(
        skin: skin ?? this.skin,
        hair: hair ?? this.hair,
        shirt: shirt ?? this.shirt,
        pants: pants ?? this.pants,
        hairStyle: hairStyle ?? this.hairStyle,
        shirtStyle: shirtStyle ?? this.shirtStyle,
        pantsStyle: pantsStyle ?? this.pantsStyle,
      );

  /// Parse a row from `/users/:id/avatar` or `/users/me`.
  factory AvatarConfig.fromJson(Map<String, dynamic> j) => AvatarConfig(
        skin: _parse(j['skin_color']),
        hair: _parse(j['hair_color']),
        shirt: _parse(j['shirt_color']),
        pants: _parse(j['pants_color']),
        hairStyle:  (j['hair_style']  as num?)?.toInt() ?? 0,
        shirtStyle: (j['shirt_style'] as num?)?.toInt() ?? 0,
        pantsStyle: (j['pants_style'] as num?)?.toInt() ?? 0,
      );

  Map<String, dynamic> toServerPayload() => {
        'skinColor': _hex(skin),
        'hairColor': _hex(hair),
        'shirtColor': _hex(shirt),
        'pantsColor': _hex(pants),
        'hairStyle': hairStyle,
        'shirtStyle': shirtStyle,
        'pantsStyle': pantsStyle,
      };
}

Color _parse(dynamic v) {
  if (v is! String) return const Color(0xFFFFCC99);
  var s = v.startsWith('#') ? v.substring(1) : v;
  if (s.length == 6) s = 'FF$s';
  return Color(int.parse(s, radix: 16));
}

String _hex(Color c) =>
    '#${c.red.toRadixString(16).padLeft(2, '0')}'
    '${c.green.toRadixString(16).padLeft(2, '0')}'
    '${c.blue.toRadixString(16).padLeft(2, '0')}';

enum AvatarState { idle, walking }

/// Layered sprite-based avatar. Composes body + hair + shirt + pants
/// templates into a single ui.Image at config-change time and blits it.
class AvatarComponent extends PositionComponent with TapCallbacks {
  static const double _avatarScale = 1.5;
  static const double walkDurationPerTile = 0.85;

  int col;
  int row;
  final bool isMe;
  final String userId;
  AvatarConfig _config;

  ui.Image? _sprite;

  AvatarState _state = AvatarState.idle;
  int _targetCol = 0;
  int _targetRow = 0;
  double _walkProgress = 0;
  double _bobPhase = 0;

  AvatarComponent({
    required this.col,
    required this.row,
    required this.isMe,
    required this.userId,
    AvatarConfig? config,
  })  : _config = config ?? const AvatarConfig(),
        super(
          size: Vector2(avatarTplW * _avatarScale, avatarTplH * _avatarScale),
          anchor: Anchor.bottomCenter,
          priority: tileDepth(col, row) + 5,
        ) {
    _bobPhase = Random().nextDouble() * pi * 2;
    _syncPosition();
  }

  AvatarConfig get config => _config;

  /// Swap config and rebuild the cached sprite asynchronously.
  Future<void> updateConfig(AvatarConfig next) async {
    _config = next;
    _sprite = await buildAvatarSprite(next);
  }

  @override
  Future<void> onLoad() async {
    _sprite = await buildAvatarSprite(_config);
  }

  void _syncPosition() {
    final s = tileToScreen(col, row);
    position = Vector2(s.dx, s.dy);
    priority = tileDepth(col, row) + 5;
  }

  void walkTo(int targetCol, int targetRow) {
    _targetCol = targetCol;
    _targetRow = targetRow;
    _state = AvatarState.walking;
    _walkProgress = 0;
  }

  Vector2 headWorldPosition() => Vector2(position.x, position.y - size.y);

  @override
  void update(double dt) {
    _bobPhase += dt * 2.5;
    if (_state == AvatarState.walking) {
      _walkProgress = min(1.0, _walkProgress + dt / walkDurationPerTile);
      final fromS = tileToScreen(col, row);
      final toS = tileToScreen(_targetCol, _targetRow);
      final t = _easeInOut(_walkProgress);
      position = Vector2(
        fromS.dx + (toS.dx - fromS.dx) * t,
        fromS.dy + (toS.dy - fromS.dy) * t,
      );
      if (_walkProgress >= 1.0) {
        col = _targetCol;
        row = _targetRow;
        _state = AvatarState.idle;
        _syncPosition();
      }
    }
  }

  @override
  void render(Canvas canvas) {
    if (_sprite == null) return;
    final bob = _state == AvatarState.idle ? sin(_bobPhase) * 0.6 : 0.0;

    canvas.drawOval(
      Rect.fromCenter(
        center: Offset(size.x / 2, size.y - 1),
        width: 18 * _avatarScale,
        height: 5 * _avatarScale,
      ),
      Paint()..color = const Color(0x47000000),
    );

    canvas.save();
    canvas.translate(0, bob);
    canvas.drawImageRect(
      _sprite!,
      Rect.fromLTWH(0, 0, avatarTplW.toDouble(), avatarTplH.toDouble()),
      Rect.fromLTWH(0, 0, size.x, size.y),
      Paint()..filterQuality = FilterQuality.none,
    );
    canvas.restore();

    canvas.drawCircle(
      Offset(size.x / 2, bob - 4),
      3,
      Paint()..color = isMe ? DenPalette.accent : const Color(0xFF88BBFF),
    );
  }

  static double _easeInOut(double t) =>
      t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

// ─────────────────────────────────────────────────────────────────────────
// Sprite compositor — public so the customiser preview can call it too.
// ─────────────────────────────────────────────────────────────────────────

String _at(List<String> tpl, int x, int y) {
  if (y < 0 || y >= tpl.length) return '.';
  final row = tpl[y];
  if (x < 0 || x >= row.length) return '.';
  return row[x];
}

String _composedCharAt(int x, int y, AvatarConfig cfg) {
  final hair  = Wardrobe.hair[cfg.hairStyle].template;
  final shirt = Wardrobe.shirt[cfg.shirtStyle].template;
  final pants = Wardrobe.pants[cfg.pantsStyle].template;

  var ch = _at(hair, x, y);  if (ch != '.') return ch;
  ch     = _at(shirt, x, y); if (ch != '.') return ch;
  ch     = _at(pants, x, y); if (ch != '.') return ch;
  return _at(bodyBase, x, y);
}

List<int>? _resolveColor(String ch, AvatarConfig cfg) {
  switch (ch) {
    case '.':
      return null;
    case 'o':
      return const [0, 0, 0, 255];
    case 'H':
      return _rgba(cfg.hair);
    case 'h':
      return _rgba(_darken(cfg.hair, 0.30));
    case 'l':
      return _rgba(_lighten(cfg.hair, 0.25));
    case 'S':
      return _rgba(cfg.skin);
    case 's':
      return _rgba(_darken(cfg.skin, 0.20));
    case 'L':
      return _rgba(_lighten(cfg.skin, 0.18));
    case 'e':
      return const [26, 26, 46, 255];
    case 'w':
      return const [255, 255, 255, 255];
    case 'B':
      return const [58, 40, 32, 255];
    case 'M':
      return const [204, 102, 119, 255];
    case '1':
      return _rgba(cfg.shirt);
    case '2':
      return _rgba(_darken(cfg.shirt, 0.22));
    case '3':
      return _rgba(_lighten(cfg.shirt, 0.18));
    case 'c':
      return _rgba(cfg.skin);
    case 'P':
      return _rgba(cfg.pants);
    case 'p':
      return _rgba(_darken(cfg.pants, 0.22));
    case 'X':
      return const [42, 42, 42, 255];
    case 'x':
      return const [22, 22, 22, 255];
    default:
      return null;
  }
}

List<int> _rgba(Color c) => [c.red, c.green, c.blue, c.alpha];

Color _darken(Color c, double amt) => Color.fromARGB(
      c.alpha,
      ((c.red * (1 - amt)).clamp(0, 255)).round(),
      ((c.green * (1 - amt)).clamp(0, 255)).round(),
      ((c.blue * (1 - amt)).clamp(0, 255)).round(),
    );

Color _lighten(Color c, double amt) => Color.fromARGB(
      c.alpha,
      ((c.red + (255 - c.red) * amt).clamp(0, 255)).round(),
      ((c.green + (255 - c.green) * amt).clamp(0, 255)).round(),
      ((c.blue + (255 - c.blue) * amt).clamp(0, 255)).round(),
    );

/// Build a fresh ui.Image for [cfg]. Compositing is done at pixel level
/// (hair > shirt > pants > body) into raw RGBA bytes, then handed to
/// `ui.decodeImageFromPixels`.
Future<ui.Image> buildAvatarSprite(AvatarConfig cfg) async {
  final pixels = Uint8List(avatarTplW * avatarTplH * 4);
  for (int y = 0; y < avatarTplH; y++) {
    for (int x = 0; x < avatarTplW; x++) {
      final ch = _composedCharAt(x, y, cfg);
      if (ch == '.') continue;
      final rgba = _resolveColor(ch, cfg);
      if (rgba == null) continue;
      final idx = (y * avatarTplW + x) * 4;
      pixels[idx]     = rgba[0];
      pixels[idx + 1] = rgba[1];
      pixels[idx + 2] = rgba[2];
      pixels[idx + 3] = rgba[3];
    }
  }
  final completer = Completer<ui.Image>();
  ui.decodeImageFromPixels(
    pixels,
    avatarTplW,
    avatarTplH,
    ui.PixelFormat.rgba8888,
    completer.complete,
  );
  return completer.future;
}

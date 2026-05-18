import 'dart:async';
import 'dart:math';
import 'dart:typed_data';
import 'dart:ui' as ui;
import 'package:flame/components.dart';
import 'package:flame/events.dart';
import 'package:flutter/painting.dart';
import '../../../core/iso_math.dart';
import '../../../core/palette.dart';
import '../avatar_template.dart';

/// Avatar config — driven by server profile or local customisation.
class AvatarConfig {
  final Color skin;
  final Color hair;
  final Color shirt;
  final Color pants;

  const AvatarConfig({
    this.skin = DenPalette.skinA,
    this.hair = DenPalette.hairBrown,
    this.shirt = DenPalette.shirtBlue,
    this.pants = DenPalette.pantsNavy,
  });
}

enum AvatarState { idle, walking }

/// Sprite-based avatar. Pixel art template (`avatarTemplate`) is rendered
/// once into a [ui.Image] using raw RGBA bytes; `render()` just blits it.
/// Anchor is bottomCenter so feet land on the tile's screen-space center.
class AvatarComponent extends PositionComponent with TapCallbacks {
  static const double _avatarScale = 1.5; // slightly oversized vs tile (Habbo look)
  static const double walkDurationPerTile = 0.85; // seconds — slower, calmer pace

  int col;
  int row;
  final bool isMe;
  final String userId;
  AvatarConfig config;

  ui.Image? _sprite;

  AvatarState _state = AvatarState.idle;

  // Walk interpolation
  int _targetCol = 0;
  int _targetRow = 0;
  double _walkProgress = 0;

  // Idle bob
  double _bobPhase = 0;

  AvatarComponent({
    required this.col,
    required this.row,
    required this.isMe,
    required this.userId,
    AvatarConfig? config,
  })  : config = config ?? const AvatarConfig(),
        super(
          size: Vector2(avatarTplW * _avatarScale, avatarTplH * _avatarScale),
          anchor: Anchor.bottomCenter,
          priority: tileDepth(col, row) + 5,
        ) {
    _bobPhase = Random().nextDouble() * pi * 2;
    _syncPosition();
  }

  @override
  Future<void> onLoad() async {
    _sprite = await _buildSprite(config);
  }

  Future<ui.Image> _buildSprite(AvatarConfig cfg) async {
    final pixels = Uint8List(avatarTplW * avatarTplH * 4);
    for (int y = 0; y < avatarTplH; y++) {
      final row = avatarTemplate[y];
      for (int x = 0; x < avatarTplW; x++) {
        final ch = x < row.length ? row[x] : '.';
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

  /// World-coords screen position of the avatar's HEAD (top of sprite),
  /// used to anchor chat bubbles.
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

    // Soft shadow at feet (bottom-center of bounding box)
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

    // Username dot above head
    canvas.drawCircle(
      Offset(size.x / 2, bob - 4),
      3,
      Paint()..color = isMe ? DenPalette.accent : const Color(0xFF88BBFF),
    );
  }

  // ── Pixel template -> RGBA ──────────────────────────────────────────────
  static List<int>? _resolveColor(String ch, AvatarConfig cfg) {
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

  static List<int> _rgba(Color c) => [c.red, c.green, c.blue, c.alpha];

  static Color _darken(Color c, double amt) => Color.fromARGB(
        c.alpha,
        ((c.red * (1 - amt)).clamp(0, 255)).round(),
        ((c.green * (1 - amt)).clamp(0, 255)).round(),
        ((c.blue * (1 - amt)).clamp(0, 255)).round(),
      );

  static Color _lighten(Color c, double amt) => Color.fromARGB(
        c.alpha,
        ((c.red + (255 - c.red) * amt).clamp(0, 255)).round(),
        ((c.green + (255 - c.green) * amt).clamp(0, 255)).round(),
        ((c.blue + (255 - c.blue) * amt).clamp(0, 255)).round(),
      );

  static double _easeInOut(double t) =>
      t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

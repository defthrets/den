import 'dart:math';
import 'package:flame/components.dart';
import 'package:flame/events.dart';
import 'package:flutter/painting.dart';
import '../../../core/constants.dart';
import '../../../core/iso_math.dart';
import '../../../core/palette.dart';
import '../den_game.dart';

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

enum AvatarState { idle, walking, waving }

/// Pixel-art Habbo-style avatar drawn with canvas primitives.
/// Position = tile-center (screen space); anchor = bottomCenter so the
/// avatar stands with feet on the tile's center point.
class AvatarComponent extends PositionComponent with TapCallbacks {
  int col;
  int row;
  final bool isMe;
  final String userId;
  AvatarConfig config;

  AvatarState _state = AvatarState.idle;
  double _stateTimer = 0;

  // Walk interpolation
  int _targetCol = 0;
  int _targetRow = 0;
  double _walkProgress = 0; // 0..1
  static const double _walkDuration = 0.35; // seconds per tile

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
          size: Vector2(avatarW, avatarH),
          anchor: Anchor.bottomCenter,
          priority: tileDepth(col, row) + 5,
        ) {
    _syncPosition();
  }

  void _syncPosition() {
    final s = tileToScreen(col, row);
    position = Vector2(s.dx, s.dy);
    priority = tileDepth(col, row) + 5;
  }

  /// Called by DenGame when the server sends an avatar_moved packet.
  void walkTo(int targetCol, int targetRow) {
    _targetCol = targetCol;
    _targetRow = targetRow;
    _state = AvatarState.walking;
    _walkProgress = 0;
    _stateTimer = 0;
  }

  @override
  void update(double dt) {
    _bobPhase += dt * 2.5;

    if (_state == AvatarState.walking) {
      _walkProgress = min(1.0, _walkProgress + dt / _walkDuration);

      // Interpolate screen position
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

    if (_state == AvatarState.waving) {
      _stateTimer += dt;
      if (_stateTimer > 1.5) {
        _state = AvatarState.idle;
        _stateTimer = 0;
      }
    }
  }

  @override
  void onTapUp(TapUpEvent event) {
    if (!isMe) {
      _state = AvatarState.waving;
      _stateTimer = 0;
    }
  }

  @override
  void render(Canvas canvas) {
    final bob = _state == AvatarState.idle ? sin(_bobPhase) * 0.6 : 0.0;
    canvas.translate(0, bob);

    _drawAvatar(canvas);
  }

  void _drawAvatar(Canvas canvas) {
    final p = Paint()..isAntiAlias = false; // crisp pixel art

    // Pixel layout (24 wide × 42 tall, feet at bottom-center = (12, 42)):
    //   hair:   y  0..6
    //   head:   y  6..20
    //   neck:   y 20..23
    //   body:   y 23..35
    //   legs:   y 35..42

    // ── Shadow ────────────────────────────────────────────────────────
    p.color = const Color(0x33000000);
    canvas.drawOval(const Rect.fromLTWH(2, 39, 20, 5), p);

    // ── Hair ─────────────────────────────────────────────────────────
    p.color = config.hair;
    canvas.drawRect(const Rect.fromLTWH(4, 0, 16, 7), p);
    // Side burns
    canvas.drawRect(const Rect.fromLTWH(3, 6, 3, 4), p);
    canvas.drawRect(const Rect.fromLTWH(18, 6, 3, 4), p);

    // ── Head ─────────────────────────────────────────────────────────
    p.color = config.skin;
    canvas.drawRect(const Rect.fromLTWH(4, 6, 16, 14), p);

    // Eyes
    p.color = const Color(0xFF1A1A2E);
    canvas.drawRect(const Rect.fromLTWH(7, 11, 3, 3), p);
    canvas.drawRect(const Rect.fromLTWH(14, 11, 3, 3), p);

    // Eye shine
    p.color = const Color(0xFFFFFFFF);
    canvas.drawRect(const Rect.fromLTWH(9, 11, 1, 1), p);
    canvas.drawRect(const Rect.fromLTWH(16, 11, 1, 1), p);

    // Mouth
    p.color = const Color(0xFFCC8866);
    canvas.drawRect(const Rect.fromLTWH(9, 16, 6, 2), p);

    // ── Neck ─────────────────────────────────────────────────────────
    p.color = config.skin;
    canvas.drawRect(const Rect.fromLTWH(9, 20, 6, 3), p);

    // ── Body / shirt ─────────────────────────────────────────────────
    p.color = config.shirt;
    canvas.drawRect(const Rect.fromLTWH(3, 23, 18, 12), p);

    // Shirt shading (right side darker)
    p.color = _darken(config.shirt, 0.18);
    canvas.drawRect(const Rect.fromLTWH(16, 23, 5, 12), p);

    // Collar
    p.color = config.skin;
    canvas.drawRect(const Rect.fromLTWH(9, 23, 6, 3), p);

    // Wave arm (right arm raised when waving)
    if (_state == AvatarState.waving) {
      final armAngle = sin(_stateTimer * 8) * 0.4;
      canvas.save();
      canvas.translate(21, 25);
      canvas.rotate(-0.8 + armAngle);
      p.color = config.shirt;
      canvas.drawRect(const Rect.fromLTWH(0, 0, 5, 10), p);
      p.color = config.skin;
      canvas.drawRect(const Rect.fromLTWH(0, 10, 5, 4), p);
      canvas.restore();
    }

    // ── Legs ─────────────────────────────────────────────────────────
    p.color = config.pants;
    canvas.drawRect(const Rect.fromLTWH(3, 35, 8, 7), p);
    canvas.drawRect(const Rect.fromLTWH(13, 35, 8, 7), p);

    // Shoes
    p.color = const Color(0xFF2A2A2A);
    canvas.drawRect(const Rect.fromLTWH(2, 40, 9, 2), p);
    canvas.drawRect(const Rect.fromLTWH(13, 40, 9, 2), p);

    // ── Username tag ─────────────────────────────────────────────────
    // (Rendered as a simple coloured dot above the head — full label added
    //  via Flutter overlay in RoomScreen for crisp text rendering.)
    p.color = isMe ? DenPalette.accent : const Color(0xFF88BBFF);
    canvas.drawCircle(const Offset(12, -4), 3, p);
  }

  // ── helpers ──────────────────────────────────────────────────────────

  static double _easeInOut(double t) =>
      t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

  static Color _darken(Color c, double amount) {
    return Color.fromARGB(
      c.alpha,
      (c.red * (1 - amount)).round().clamp(0, 255),
      (c.green * (1 - amount)).round().clamp(0, 255),
      (c.blue * (1 - amount)).round().clamp(0, 255),
    );
  }
}
